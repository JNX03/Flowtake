import {
    RENDER_CAMERA_VIDEO,
    RENDER_SCREEN_VIDEO
} from "../constants"
import { canEncodeVideo } from "mediabunny"
import {
    RENDER_CANCELED,
    RENDER_INITIALIZING,
    RENDER_RENDERING,
    TOAST_ERROR
} from "../helpers"
import { buildGitHubIssueUrl } from "../errorReporting"
import { sanitizeRenderError } from "../renderDiagnostics"
import { assertExportCodecSupport } from "../exportFormats"
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
        try {
            await this.init(onProcessed)
        } catch (e) {
            // Worker-side failures already report via the RENDER_ERROR message (which sets
            // isCancelled). This catch covers manager-side failures too — e.g. the screen
            // video is missing/empty so getDimensions() rejects before the worker ever runs.
            // Never rethrow: a rejected start() makes react-query retry and spawn more workers.
            if (!this.isCancelled) this.fail(e?.message || String(e))
            return
        }
        if (this.isCancelled) return
        this.post(START_RENDER)
        renderStore.dispatch(updateRender({ id: this.render.id, changes: { status: RENDER_RENDERING } }))
    }

    // Surface a render failure exactly once: real message in the toast + console, mark the
    // render canceled, and advance the queue. Guarded by isCancelled so init- and render-time
    // failures don't double-report.
    fail(message) {
        if (this.isCancelled) return
        const safeMessage = sanitizeRenderError(message)
        console.error("[render] Render failed:", safeMessage)
        this.isCancelled = true
        renderStore.dispatch(updateRender({
            id: this.render.id,
            changes: {
                status: RENDER_CANCELED,
                error: safeMessage,
                failedAt: Date.now(),
            },
        }))
        renderStore.dispatch(addToast({
            type: TOAST_ERROR,
            text: `Render failed: ${safeMessage}`,
            autoDismiss: false,
            actions: [{ label: "Report", url: buildGitHubIssueUrl(safeMessage) }]
        }))
        this.onProcessed?.()
    }

    async init(onProcessed) {
        this.onProcessed = onProcessed

        renderStore.dispatch(updateRender({ id: this.render.id, changes: { status: RENDER_INITIALIZING } }))

        await assertExportCodecSupport(
            this.render.config?.format,
            this.render.config?.resolution,
            canEncodeVideo
        )

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
                this.fail(payload?.error || "Render failed")
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
