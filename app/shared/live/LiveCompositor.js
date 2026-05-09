// Real-time scene compositor for the live streaming feature.
//
// Pipeline:
//   getDisplayMedia() ─▶ HTMLVideoElement ─▶ Pixi.Texture (video sprite)
//                     ▶ smoothed cursor sprite (online inertia filter)
//                     ▶ LiveZoomController (manual hotkey)
//   Pixi renderer ─▶ canvas.captureStream(fps) ─▶ MediaRecorder (webm/matroska)
//   chunks ─▶ invoke('push_live_frame') ─▶ FFmpeg stdin ─▶ tee(rtmp, mp4)

import { Application, Container, Sprite, Texture, Graphics } from 'pixi.js'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import LiveZoomController from './LiveZoomController'

const CURSOR_POLL_INTERVAL_MS = 16   // ~60Hz cursor sampling
const SMOOTH_TAU_MS = 90             // exponential time constant; lower = snappier
const VELOCITY_DECAY = 0.72

class LiveCursorSmoother {
    constructor() {
        this.position = null
        this.target = null
        this.velocity = { x: 0, y: 0 }
        this.lastTime = null
    }

    setTarget(x, y) {
        this.target = { x, y }
        if (!this.position) this.position = { x, y }
    }

    sample(now = performance.now()) {
        if (!this.target) return null
        if (!this.position) {
            this.position = { ...this.target }
            this.lastTime = now
            return { ...this.position, dx: 0, dy: 0, speed: 0 }
        }
        const dt = Math.max(now - (this.lastTime ?? now), 1)
        const tau = SMOOTH_TAU_MS
        const baseAlpha = 1 - Math.exp(-dt / tau)

        const dx = this.target.x - this.position.x
        const dy = this.target.y - this.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const distFactor = Math.min(dist / 180, 1)
        const alpha = baseAlpha + (1 - baseAlpha) * distFactor * 0.45

        this.velocity.x = this.velocity.x * VELOCITY_DECAY + dx * alpha * (1 - VELOCITY_DECAY)
        this.velocity.y = this.velocity.y * VELOCITY_DECAY + dy * alpha * (1 - VELOCITY_DECAY)

        const predict = Math.min(distFactor * 0.18, 0.16)
        const px = this.position.x + dx * alpha + this.velocity.x * predict
        const py = this.position.y + dy * alpha + this.velocity.y * predict

        if (dist < 1.0) {
            this.position.x = this.target.x
            this.position.y = this.target.y
        } else {
            this.position.x = px
            this.position.y = py
        }
        this.lastTime = now

        const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2)
        return {
            x: this.position.x,
            y: this.position.y,
            dx: this.velocity.x,
            dy: this.velocity.y,
            speed,
        }
    }
}

function makeCursorSprite() {
    // Software-rendered cursor: simple arrow on a transparent background.
    // Drawn at native size; scaled later if the renderer is hi-DPI.
    const g = new Graphics()
    g.poly([
        0, 0,
        18, 14,
        10, 16,
        14, 24,
        10, 26,
        6, 18,
        0, 22,
    ])
        .fill({ color: 0xffffff })
        .stroke({ color: 0x000000, width: 1.5 })
    return g
}

export default class LiveCompositor {
    constructor({ canvas, config }) {
        this.canvas = canvas
        this.config = config

        this.app = null
        this.videoEl = null
        this.videoSprite = null
        this.cursorSprite = null
        this.contentLayer = null

        this.smoother = new LiveCursorSmoother()
        this.zoomController = new LiveZoomController({
            mode: config.zoomMode || 'hold',
            targetScale: config.zoomTargetScale || 2.0,
            easeMs: config.zoomEaseMs || 350,
        })

        this.cursorPollHandle = null
        this.unlistenZoomDown = null
        this.unlistenZoomUp = null

        this.mediaRecorder = null
        this.captureStream = null
        this.displayStream = null
        this.audioContext = null

        this.running = false
    }

    async start() {
        if (this.running) return
        this.running = true

        this.displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                frameRate: this.config.framerate || 30,
                cursor: this.config.hideNativeCursor === false ? 'always' : 'never',
            },
            audio: this.config.captureSystemAudio !== false,
        })

        if (this.config.captureMic) {
            try {
                const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
                this.displayStream = this._mergeAudioTracks(this.displayStream, micStream)
            } catch (e) {
                console.warn('[live] Mic capture failed:', e)
            }
        }

        // Stop the live session if the user revokes the screen-sharing permission.
        const videoTrack = this.displayStream.getVideoTracks()[0]
        if (videoTrack) {
            videoTrack.addEventListener('ended', () => {
                window.dispatchEvent(new CustomEvent('live:capture-ended'))
                this.stop().catch(() => {})
            })
        }

        const settings = videoTrack ? videoTrack.getSettings() : {}
        const width = settings.width || this.config.width || 1920
        const height = settings.height || this.config.height || 1080

        this.videoEl = document.createElement('video')
        this.videoEl.srcObject = this.displayStream
        this.videoEl.muted = true
        this.videoEl.autoplay = true
        this.videoEl.playsInline = true
        await this.videoEl.play()

        this.app = new Application()
        await this.app.init({
            canvas: this.canvas,
            width,
            height,
            background: 0x000000,
            antialias: false,
            preserveDrawingBuffer: true, // some browsers need this for captureStream
        })

        this.contentLayer = new Container()
        this.app.stage.addChild(this.contentLayer)

        const videoTexture = Texture.from(this.videoEl)
        this.videoSprite = new Sprite(videoTexture)
        this.videoSprite.width = width
        this.videoSprite.height = height
        this.contentLayer.addChild(this.videoSprite)

        if (this.config.hideNativeCursor !== false) {
            this.cursorSprite = makeCursorSprite()
            this.cursorSprite.alpha = 1
            this.contentLayer.addChild(this.cursorSprite)
        }

        this._renderTickerStart(width, height)
        this._startCursorPolling()
        await this._listenForZoomHotkeys()
        this._startMediaRecorder(width, height)

        // Notify the recorder pill that the composer is fully running.
        window.dispatchEvent(new CustomEvent('live:composer-ready', {
            detail: { width, height },
        }))
    }

    _mergeAudioTracks(systemStream, micStream) {
        try {
            const ctx = new AudioContext()
            const dest = ctx.createMediaStreamDestination()
            const sources = []
            const sysAudio = systemStream.getAudioTracks()[0]
            if (sysAudio) {
                const s = ctx.createMediaStreamSource(new MediaStream([sysAudio]))
                s.connect(dest)
                sources.push(s)
            }
            const micAudio = micStream.getAudioTracks()[0]
            if (micAudio) {
                const m = ctx.createMediaStreamSource(new MediaStream([micAudio]))
                m.connect(dest)
                sources.push(m)
            }
            this.audioContext = ctx

            const merged = new MediaStream()
            systemStream.getVideoTracks().forEach(t => merged.addTrack(t))
            dest.stream.getAudioTracks().forEach(t => merged.addTrack(t))
            return merged
        } catch (e) {
            console.warn('[live] AudioContext merge failed; using system audio only:', e)
            return systemStream
        }
    }

    _renderTickerStart(width, height) {
        const ticker = this.app.ticker
        ticker.add(() => {
            const sample = this.smoother.sample()
            if (sample && this.cursorSprite) {
                this.cursorSprite.position.set(sample.x, sample.y)
            }

            // Apply manual zoom to the entire content layer (video + cursor).
            // Anchor is updated continuously while in 'hold' mode so the zoom
            // tracks the cursor; once locked (via key-down) it stays put.
            this.zoomController.updateAnchor(sample)
            this.zoomController.applyTransform(this.contentLayer, width, height)
        })
    }

    async _startCursorPolling() {
        const poll = async () => {
            if (!this.running) return
            try {
                const pos = await invoke('get_cursor_position')
                if (pos) {
                    this.smoother.setTarget(pos.x, pos.y)
                }
            } catch (e) {
                // Ignore polling errors; will retry on next tick.
            }
            this.cursorPollHandle = setTimeout(poll, CURSOR_POLL_INTERVAL_MS)
        }
        poll()
    }

    async _listenForZoomHotkeys() {
        // Register the hotkey on the Rust side; default Ctrl+Shift+Z if not specified.
        const accelerator = this.config.zoomHotkey || 'Ctrl+Shift+Z'
        try {
            await invoke('register_live_zoom_hotkey', { accelerator })
        } catch (e) {
            console.warn('[live] Failed to register zoom hotkey:', e)
        }

        this.unlistenZoomDown = await listen('live:zoom-pressed', () => {
            const sample = this.smoother.sample()
            this.zoomController.onKeyDown(sample ? { x: sample.x, y: sample.y } : null)
        })
        this.unlistenZoomUp = await listen('live:zoom-released', () => {
            this.zoomController.onKeyUp()
        })
    }

    _startMediaRecorder(width, height) {
        const fps = this.config.framerate || 30
        // captureStream() on the visible canvas. WebGL canvases need
        // preserveDrawingBuffer:true (set in app.init) to be capturable in some browsers.
        this.captureStream = this.canvas.captureStream(fps)

        // Mux audio in if available
        if (this.displayStream) {
            this.displayStream.getAudioTracks().forEach(t => this.captureStream.addTrack(t))
        }

        // Probe codec preferences (matroska/webm wraps everything cleanly for FFmpeg).
        const candidates = [
            'video/x-matroska;codecs=avc1,opus',
            'video/webm;codecs=h264,opus',
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
        ]
        const mimeType = candidates.find(t => MediaRecorder.isTypeSupported(t))
            || 'video/webm'

        this.mediaRecorder = new MediaRecorder(this.captureStream, {
            mimeType,
            videoBitsPerSecond: (this.config.videoBitrateKbps || 6000) * 1000,
        })

        this.mediaRecorder.ondataavailable = async (event) => {
            if (!event.data || event.data.size === 0) return
            try {
                const buffer = await event.data.arrayBuffer()
                await invoke('push_live_frame', {
                    chunk: Array.from(new Uint8Array(buffer)),
                })
            } catch (err) {
                console.warn('[live] push_live_frame failed:', err)
            }
        }

        // 100ms timeslice keeps end-to-end latency low while batching IPC overhead.
        this.mediaRecorder.start(100)
    }

    async stop() {
        if (!this.running) return
        this.running = false

        if (this.cursorPollHandle) {
            clearTimeout(this.cursorPollHandle)
            this.cursorPollHandle = null
        }

        try {
            this.unlistenZoomDown?.()
            this.unlistenZoomUp?.()
        } catch {}

        try {
            await invoke('unregister_live_zoom_hotkey')
        } catch {}

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            // Wait for the final ondataavailable to fire before resolving.
            await new Promise((resolve) => {
                this.mediaRecorder.addEventListener('stop', resolve, { once: true })
                this.mediaRecorder.stop()
            })
        }

        if (this.displayStream) {
            this.displayStream.getTracks().forEach(t => t.stop())
            this.displayStream = null
        }
        if (this.captureStream) {
            this.captureStream.getTracks().forEach(t => t.stop())
            this.captureStream = null
        }
        if (this.audioContext) {
            try { await this.audioContext.close() } catch {}
            this.audioContext = null
        }

        if (this.videoEl) {
            this.videoEl.srcObject = null
            this.videoEl = null
        }

        if (this.app) {
            this.app.destroy(true, { children: true, texture: true })
            this.app = null
        }
    }
}
