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

// Replace console methods with worker console
Object.assign(console, workerConsole)

class PreviewRenderer {
    constructor() {
        this.isPlaying = false
        this.isInitialized = false
    }

    async init({ canvas, args, duration, screenFrame, screenVideoDims, cameraFrame, cameraVideoDims }) {

        this.scene = new PreviewScene()
        await this.scene.createApp(canvas)

        this.scene.initScreenVideo(screenVideoDims, screenFrame)

        if (args.hasCameraVideo)
            this.scene.initCameraVideo(cameraVideoDims, cameraFrame)

        await this.scene.init(args, duration)

        this.isInitialized = true
    }

    async setVideoFrame({ type, frame, mask }) {
        this.scene?.setFrame(type, frame, mask)
        if (!this.isPlaying) this.scene?.render()
    }

    async update(payload) {
        if (this.isInitialized)
            await this.scene?.onReduxUpdate(payload)
    }

    async render({ time }) {
        this.scene?.setTime(time)
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

    if (expectsResponse) post(self, type, { result }, id, false, true)
})

self.addEventListener("unhandledrejection", ({ reason }) => { throw reason })