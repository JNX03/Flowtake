import {
    RENDER_CAMERA_VIDEO,
    RENDER_SCREEN_VIDEO
} from "../../../helpers"
import {
    RENDER_CANCELED,
    RENDER_INITIALIZING,
    RENDER_RENDERING,
    TOAST_ERROR
} from "../helpers"
import {
    selectCameraVideoBackgroundBlurAmount,
    selectHasCameraVideo,
    selectHasCameraVideoBackgroundBlur
} from "../redux/projectSlice"
import {
    addToast,
    updateRender
} from "../redux/renderSlice"
import renderStore from "../redux/renderStore"
import RendererInputReader from "../RendererInputReader"
import { getWebWorkerIntegration } from "../sentryHelpers"
import {
    CANCEL_RENDER,
    INIT_RENDER,
    REDUX_DISPATCH,
    RENDER_COMPLETE,
    RENDER_ERROR,
    SEGMENT_FRAME,
    START_RENDER
} from "./helpers"
import RenderWorker from './renderWorker.js?worker'
import WorkerManager from "./WorkerManager"

export default class RenderWorkerManager extends WorkerManager {
    constructor(render) {
        super()
        this.worker = new RenderWorker()
        getWebWorkerIntegration()?.addWorker(this.worker)

        this.render = render
        this.isCancelled = false
    }

    async start(onProcessed) {
        await this.init(onProcessed)
        if (this.isCancelled) return
        this.post(START_RENDER)
        renderStore.dispatch(updateRender({ id: this.render.id, changes: { status: RENDER_RENDERING } }))
    }

    async init(onProcessed) {
        this.onProcessed = onProcessed

        renderStore.dispatch(updateRender({ id: this.render.id, changes: { status: RENDER_INITIALIZING } }))

        const hasCameraVideo = selectHasCameraVideo(this.render.state)
        const hasBlur = selectHasCameraVideoBackgroundBlur(this.render.state)
        const amount = selectCameraVideoBackgroundBlurAmount(this.render.state)

        const screenVideoDims = await this.getDimensions(RENDER_SCREEN_VIDEO)

        let cameraVideoDims
        if (hasCameraVideo) {
            cameraVideoDims = await this.getDimensions(RENDER_CAMERA_VIDEO)
            if (hasBlur && amount > 0) await this.createSegmenter(cameraVideoDims)
        }

        this.worker.addEventListener('message', event => this.onMessage(event))

        await this.postAsync(INIT_RENDER, { render: this.render, screenVideoDims, cameraVideoDims })
    }

    async onMessage(event) {
        const isMessageHandled = await super.onMessage(event)

        if (isMessageHandled) return

        const { type, payload, id, expectsResponse } = event.data

        let responsePayload = null
        const transferList = []

        switch (type) {
            case REDUX_DISPATCH:
                renderStore.dispatch(payload)
                break
            case RENDER_COMPLETE:
                this.onProcessed()
                break
            case RENDER_ERROR:
                renderStore.dispatch(updateRender({ id: this.render.id, changes: { status: RENDER_CANCELED } }))
                renderStore.dispatch(addToast({ type: TOAST_ERROR, text: "Render failed" }))
                this.isCancelled = true
                this.onProcessed()
                break
            case SEGMENT_FRAME: {
                responsePayload = await this.segment(payload)
                transferList.push(responsePayload)
                break
            }
            default:
                console.warn('Unknown message type from render worker:', type)
        }

        if (expectsResponse) this.post(type, responsePayload, id, false, true, transferList)
    }

    cancel() {
        this.post(CANCEL_RENDER)
    }

    async getDimensions(type) {
        return RendererInputReader.getDimensions(type, { renderId: this.render.id })
    }
}