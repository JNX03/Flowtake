import {
    FRAME,
    INIT_EXTRA_VIDEO,
    INIT_PREVIEW,
    IS_PLAYING,
    post,
    SET_EXTRA_VISIBILITY,
    SNAPSHOT,
    TIME,
    UPDATE,
    workerConsole
} from "./helpers"

// Replace console methods with worker console
Object.assign(console, workerConsole)

const previewSceneClassPromise = (async () => {
    console.log("[previewWorker:boot] loading worker-safe Pixi deps")
    await import("pixi.js/webworker")
    await import("pixi.js/graphics")
    await import("pixi.js/mesh")
    await import("pixi.js/text")

    const { default: PreviewScene } = await import("../scene/PreviewScene")

    // Post a handshake so the main thread knows the worker reached post-import
    // setup and can install its message listener.
    post(self, "PREVIEW_WORKER_READY", { t: Date.now() })
    console.log("[previewWorker:boot] posted PREVIEW_WORKER_READY")

    return PreviewScene
})().catch(error => {
    console.error("[previewWorker:boot] failed", error?.stack || error?.message || String(error))
    throw error
})

const MIN_RENDER_INTERVAL = 16 // ~60fps cap

const closeFrameResource = resource => {
    try {
        resource?.close?.()
    } catch {
        // The frame may already have been consumed and closed by the scene.
    }
}

class PreviewRenderer {
    constructor() {
        this.isPlaying = false
        this.isInitialized = false
        this.lastRenderTime = 0
    }

    async init({ canvas, args, duration, screenFrame, screenVideoDims, cameraFrame, cameraVideoDims }) {

        console.log("[previewWorker] PreviewRenderer.init start", { screenVideoDims, hasCameraVideo: args.hasCameraVideo, duration })
        let phase = "construct scene"

        try {
            const PreviewScene = await previewSceneClassPromise
            this.scene = new PreviewScene()
            console.log("[previewWorker] PreviewScene constructed, calling createApp")

            phase = "create Pixi app"
            await this.scene.createApp(canvas)
            console.log("[previewWorker] createApp resolved")

            phase = "initialize screen video"
            this.scene.initScreenVideo(screenVideoDims, screenFrame)
            console.log("[previewWorker] initScreenVideo done")

            if (args.hasCameraVideo) {
                phase = "initialize camera video"
                this.scene.initCameraVideo(cameraVideoDims, cameraFrame)
                console.log("[previewWorker] initCameraVideo done")
            }

            phase = "initialize scene animators"
            await this.scene.init(args, duration)
            console.log("[previewWorker] scene.init resolved")

            this.isInitialized = true
            console.log("[previewWorker] PreviewRenderer.init DONE")
        } catch (e) {
            e.message = `${e?.message || String(e)} (during ${phase})`
            throw e
        } finally {
            // Scene canvas wrappers close frames after drawing. These guards
            // also release transferred frames if initialization exits early.
            closeFrameResource(screenFrame)
            closeFrameResource(cameraFrame)
        }
    }

    async setVideoFrame({ type, frame, mask, landmarks }) {
        try {
            if (type === "camera" && this.scene?.camera) {
                this.scene.camera.setEyeContactData(landmarks, !!landmarks)
            }
            this.scene?.setFrame(type, frame, mask)
            if (!this.isPlaying) this.scene?.render()
        } finally {
            // Keep worker memory bounded even when a frame targets a missing
            // scene slot or rendering throws before CanvasWrapper consumes it.
            closeFrameResource(frame)
            closeFrameResource(mask)
        }
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

    async snapshot() {
        if (!this.isInitialized || !this.scene?.app?.renderer) {
            throw new Error("Preview renderer is not ready")
        }
        this.scene.render()
        return this.scene.app.renderer.extract.base64({
            target: this.scene.app.stage,
            format: "png",
        })
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

            case INIT_EXTRA_VIDEO: {
                renderer?.scene?.initExtraVideo(payload.index, payload.dims)
                break
            }

            case SET_EXTRA_VISIBILITY: {
                renderer?.scene?.setExtraVisibility(payload.index, payload.visible)
                break
            }

            case SNAPSHOT: {
                result = await renderer?.snapshot()
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
        error = {
            name: e?.name || 'Error',
            message: e?.message || String(e),
            stack: e?.stack
        }
    }

    if (expectsResponse) {
        post(self, type, { result }, id, false, true, [], error)
    }
})

self.addEventListener("unhandledrejection", (event) => {
    console.error('[previewWorker] unhandledrejection', event.reason?.stack || event.reason?.message || String(event.reason))
})
