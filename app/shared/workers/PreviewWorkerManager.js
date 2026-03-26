import {
    CAMERA_VIDEO,
    PROJECT_CAMERA_VIDEO,
    PROJECT_SCREEN_VIDEO,
    SCREEN_VIDEO
} from "../constants"
import store from "../redux/store"
import RendererInputReader from "../RendererInputReader"
import { getWebWorkerIntegration } from "../sentryHelpers"
import {
    FRAME,
    INIT_PREVIEW,
    IS_PLAYING,
    REDUX_DISPATCH,
    TIME,
    UPDATE
} from "./helpers"
import PreviewWorker from './previewWorker.js?worker'
import WorkerManager from "./WorkerManager"

export default class PreviewWorkerManager extends WorkerManager {
    constructor(screenVideo, cameraVideo) {
        super()
        this.worker = new PreviewWorker()
        getWebWorkerIntegration()?.addWorker(this.worker)

        this.worker.addEventListener("message", event => this.onMessage(event))
        this.screenVideo = screenVideo
        this.cameraVideo = cameraVideo

        this.isPlaying = false
        this.hasCameraVideoBackgroundBlur = false
        this.cameraVideoBackgroundBlurAmount = 0
        this.isScreenFramePending = false
        this.isCameraFramePending = false
    }

    async init(canvas, duration, args) {
        const screenVideoDims = await this.getDimensions(PROJECT_SCREEN_VIDEO, args.projectId)

        let cameraVideoDims
        if (args.hasCameraVideo) {
            cameraVideoDims = await this.getDimensions(PROJECT_CAMERA_VIDEO, args.projectId)
            await this.createSegmenter(cameraVideoDims)
        }
        const offscreenCanvas = canvas.transferControlToOffscreen()

        const screenFrame = new VideoFrame(this.screenVideo)

        let cameraFrame = null
        if (args.hasCameraVideo) cameraFrame = new VideoFrame(this.cameraVideo)

        const transferList = [offscreenCanvas, screenFrame]
        if (cameraFrame) transferList.push(cameraFrame)

        await this.postAsync(
            INIT_PREVIEW,
            { args, canvas: offscreenCanvas, duration, screenFrame, screenVideoDims, cameraFrame, cameraVideoDims },
            undefined,
            transferList
        )

        this.setupVideoFrameCallbacks(args.hasCameraVideo)
    }

    setupVideoFrameCallbacks(hasCameraVideo) {
        const screenFrameCallback = async () => {
            if (!this.isScreenFramePending) {
                this.isScreenFramePending = true
                await this.postFrame(SCREEN_VIDEO, new VideoFrame(this.screenVideo))
                this.isScreenFramePending = false
            }
            this.screenVideo.requestVideoFrameCallback(screenFrameCallback)
        }

        const cameraFrameCallback = async () => {
            if (!this.isCameraFramePending) {
                this.isCameraFramePending = true
                const frame = new VideoFrame(this.cameraVideo)
                let mask
                if (this.hasCameraBlur()) mask = await this.segment(frame, false)
                await this.postFrame(CAMERA_VIDEO, frame, mask)
                this.isCameraFramePending = false
            }
            this.cameraVideo.requestVideoFrameCallback(cameraFrameCallback)
        }

        this.screenVideo?.requestVideoFrameCallback(screenFrameCallback)

        if (hasCameraVideo) this.cameraVideo?.requestVideoFrameCallback(cameraFrameCallback)
    }

    postTime(time) {
        this.post(TIME, { time })
    }

    async postUpdate(data) {
        this.post(UPDATE, data)
        this.postCameraVideoMaskUpdate(data)
    }

    postFrame(type, frame, mask) {
        // postFrame is using postAsync to handle backpressure
        const transferList = [frame]
        if (mask) transferList.push(mask)
        return this.postAsync(FRAME, { type, frame, mask }, undefined, transferList)
    }

    postIsPlaying(isPlaying) {
        this.post(IS_PLAYING, isPlaying)
        this.isPlaying = isPlaying
    }

    async postCameraVideoMaskUpdate(data) {
        const needsMask = data.type === 'project.hasCameraVideoBackgroundBlur' && data.payload === true && !this.hasCameraVideoBackgroundBlur && !this.isPlaying

        if (data.type === 'project.hasCameraVideoBackgroundBlur') this.hasCameraVideoBackgroundBlur = data.payload
        if (data.type === 'project.cameraVideoBackgroundBlurAmount') this.cameraVideoBackgroundBlurAmount = data.payload

        if (needsMask) {
            const frame = new VideoFrame(this.cameraVideo)
            const mask = await this.segment(frame, false)
            await this.postFrame(CAMERA_VIDEO, frame, mask)
        }
    }

    async onMessage(event) {
        const isMessageHandled = await super.onMessage(event)

        if (isMessageHandled) return

        const { type, payload, id, expectsResponse } = event.data

        let responsePayload = null
        const transferList = []

        switch (type) {
            case REDUX_DISPATCH:
                store.dispatch(payload)
                break
            default:
                console.warn('Unknown message type from preview worker:', type, payload)
        }
        if (expectsResponse) this.post(type, responsePayload, id, false, true, transferList)
    }

    getDimensions(type, projectId) {
        return RendererInputReader.getDimensions(type, { projectId })
    }

    hasCameraBlur() {
        return this.hasCameraVideoBackgroundBlur && this.cameraVideoBackgroundBlurAmount > 0
    }
}