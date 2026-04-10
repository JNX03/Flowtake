import PreviewScene from "../scene/PreviewScene"
import {
    FRAME,
    INIT_PREVIEW,
    IS_PLAYING,
    post,
    TIME,
    UPDATE,
    workerConsole
} from "./helpers"

// eslint-disable-next-line no-console
console.log("[previewWorker:boot] deps imported, replacing console")

// Replace console methods with worker console
Object.assign(console, workerConsole)

// Post a handshake so the main thread knows the worker actually reached
// post-import setup and can install its message listener.
post(self, "PREVIEW_WORKER_READY", { t: Date.now() })
console.log("[previewWorker:boot] posted PREVIEW_WORKER_READY")

const MIN_RENDER_INTERVAL = 16 // ~60fps cap

class PreviewRenderer {
    constructor() {
        this.isPlaying = false
        this.isInitialized = false
        this.lastRenderTime = 0
    }

    async init({ canvas, args, duration, screenFrame, screenVideoDims, cameraFrame, cameraVideoDims }) {

        console.log("[previewWorker] PreviewRenderer.init start", { screenVideoDims, hasCameraVideo: args.hasCameraVideo, duration })

        this.scene = new PreviewScene()
        console.log("[previewWorker] PreviewScene constructed, calling createApp")

        await this.scene.createApp(canvas)
        console.log("[previewWorker] createApp resolved")

        this.scene.initScreenVideo(screenVideoDims, screenFrame)
        console.log("[previewWorker] initScreenVideo done")

        if (args.hasCameraVideo) {
            this.scene.initCameraVideo(cameraVideoDims, cameraFrame)
            console.log("[previewWorker] initCameraVideo done")
        }

        await this.scene.init(args, duration)
        console.log("[previewWorker] scene.init resolved")

        this.isInitialized = true
        console.log("[previewWorker] PreviewRenderer.init DONE")
    }

    async setVideoFrame({ type, frame, mask, landmarks }) {
        if (type === "camera" && this.scene?.camera) {
            this.scene.camera.setEyeContactData(landmarks, !!landmarks)
        }
        this.scene?.setFrame(type, frame, mask)
        if (!this.isPlaying) this.scene?.render()
    }

    async update(payload) {
        if (this.isInitialized)
            await this.scene?.onReduxUpdate(payload)
    }

    async render({ time }) {
        this.scene?.setTime(time)
        // Throttle renders during playback to ~30fps
        if (this.isPlaying) {
            const now = performance.now()
            if (now - this.lastRenderTime < MIN_RENDER_INTERVAL) return
            this.lastRenderTime = now
        }
        this.scene?.update()
        this.scene?.render()
    }
}


let renderer = null

// Message handler for worker
self.addEventListener('message', async (event) => {
    const { type, payload, id, expectsResponse, isResponse } = event.data

    // log(false, type, payload, isResponse)

    if (isResponse) return

    let result
    let error = null

    try {
        switch (type) {

            case INIT_PREVIEW: {

                renderer = new PreviewRenderer()
                await renderer.init(payload)

                break
            }

            case TIME: {
                renderer?.render(payload)
                break
            }

            case IS_PLAYING: {
                if (renderer) renderer.isPlaying = payload
                break
            }

            case UPDATE: {
                await renderer?.update(payload)
                break
            }

            case FRAME: {
                await renderer?.setVideoFrame(payload)
                break
            }

            default:
                console.warn('Unknown message type in preview worker:', type)
        }
    } catch (e) {
        // Log the real error so it surfaces in the main-thread console
        // via workerConsole, then propagate it back through the response so
        // postAsync rejects instead of hanging forever.
        console.error('[previewWorker] handler threw for type=' + type, e?.stack || e?.message || String(e))
        error = { name: e?.name || 'Error', message: e?.message || String(e) }
    }

    if (expectsResponse) {
        post(self, type, { result }, id, false, true, [], error)
    }
})

self.addEventListener("unhandledrejection", (event) => {
    console.error('[previewWorker] unhandledrejection', event.reason?.stack || event.reason?.message || String(event.reason))
})