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
    INIT_EXTRA_VIDEO,
    INIT_PREVIEW,
    IS_PLAYING,
    REDUX_DISPATCH,
    SET_EXTRA_VISIBILITY,
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

        // Surface worker-side evaluation errors. Without these listeners, if
        // the worker script throws while loading its imports (before the
        // message listener is installed), the worker is silently dead and
        // postAsync(INIT_PREVIEW, ...) hangs forever.
        this.worker.addEventListener("error", e => {
            console.error(
                "[PreviewWorkerManager] worker error:",
                e?.message,
                "at",
                e?.filename + ":" + e?.lineno + ":" + e?.colno,
                e?.error || e
            )
        })
        this.worker.addEventListener("messageerror", e => {
            console.error("[PreviewWorkerManager] worker messageerror:", e)
        })

        this.worker.addEventListener("message", event => this.onMessage(event))
        this.screenVideo = screenVideo
        this.cameraVideo = cameraVideo

        this.isPlaying = false
        this.hasCameraVideoBackgroundBlur = false
        this.cameraVideoBackgroundBlurAmount = 0
        this.isScreenFramePending = false
        this.isCameraFramePending = false
        this.stopped = false
        this.eyeContactEnabled = false
        this.faceLandmarkerReady = false

        // Extra videos (multi-app plugin) — index → { video, isPending }
        this.extraVideos = []
    }

    /**
     * Register an extra-N video element + its native dims, set up frame pumping,
     * and tell the worker to allocate a Pixi PiP for it.
     */
    registerExtraVideo(index, videoEl, dims) {
        if (!videoEl) return
        this.extraVideos[index] = { video: videoEl, isPending: false }

        // Tell the worker to allocate the ExtraVideo Pixi sprite.
        this.post(INIT_EXTRA_VIDEO, { index, dims })

        const cb = async () => {
            if (this.stopped) return
            const slot = this.extraVideos[index]
            if (!slot || slot.video !== videoEl) return        // unregistered
            if (!slot.isPending) {
                slot.isPending = true
                try {
                    await this.postFrame(`extra-${index}`, new VideoFrame(videoEl))
                } catch (e) {
                    console.warn(`[PreviewWorkerManager] extra-${index} frame post failed:`, e)
                }
                slot.isPending = false
            }
            if (!this.stopped) videoEl.requestVideoFrameCallback(cb)
        }
        videoEl.requestVideoFrameCallback(cb)
    }

    setExtraVisibility(index, visible) {
        this.post(SET_EXTRA_VISIBILITY, { index, visible })
    }

    async init(canvas, duration, args) {
        let phase = "read screen video dimensions"

        try {
            const screenVideoDims = await this.getDimensions(PROJECT_SCREEN_VIDEO, args.projectId)

            let cameraVideoDims
            if (args.hasCameraVideo) {
                phase = "read camera video dimensions"
                cameraVideoDims = await this.getDimensions(PROJECT_CAMERA_VIDEO, args.projectId)
                phase = "create camera segmenter"
                await this.createSegmenter(cameraVideoDims)
            }
            phase = "transfer preview canvas"
            const offscreenCanvas = canvas.transferControlToOffscreen()

            phase = "create initial screen frame"
            const screenFrame = new VideoFrame(this.screenVideo)

            let cameraFrame = null
            if (args.hasCameraVideo) {
                phase = "create initial camera frame"
                cameraFrame = new VideoFrame(this.cameraVideo)
            }

            const transferList = [offscreenCanvas, screenFrame]
            if (cameraFrame) transferList.push(cameraFrame)

            phase = "initialize preview worker"
            await this.postAsync(
                INIT_PREVIEW,
                { args, canvas: offscreenCanvas, duration, screenFrame, screenVideoDims, cameraFrame, cameraVideoDims },
                undefined,
                transferList
            )

            phase = "setup preview frame callbacks"
            this.setupVideoFrameCallbacks(args.hasCameraVideo)
        } catch (e) {
            e.message = `${e?.message || String(e)} (during ${phase})`
            throw e
        }
    }

    setupVideoFrameCallbacks(hasCameraVideo) {
        const screenFrameCallback = async () => {
            if (this.stopped) return
            if (!this.isScreenFramePending) {
                this.isScreenFramePending = true
                await this.postFrame(SCREEN_VIDEO, new VideoFrame(this.screenVideo))
                this.isScreenFramePending = false
            }
            if (!this.stopped) this.screenVideo.requestVideoFrameCallback(screenFrameCallback)
        }

        const cameraFrameCallback = async () => {
            if (this.stopped) return
            if (!this.isCameraFramePending) {
                this.isCameraFramePending = true
                const frame = new VideoFrame(this.cameraVideo)
                let mask
                if (this.hasCameraBlur()) mask = await this.segment(frame, false)
                let landmarks = null
                if (this.eyeContactEnabled && this.faceLandmarkerReady) {
                    landmarks = this.detectFaceLandmarks(frame)
                }
                await this.postFrame(CAMERA_VIDEO, frame, mask, landmarks)
                this.isCameraFramePending = false
            }
            if (!this.stopped) this.cameraVideo.requestVideoFrameCallback(cameraFrameCallback)
        }

        this.screenVideo?.requestVideoFrameCallback(screenFrameCallback)

        if (hasCameraVideo) this.cameraVideo?.requestVideoFrameCallback(cameraFrameCallback)
    }

    terminate() {
        this.stopped = true
        super.terminate()
    }

    postTime(time) {
        this.post(TIME, { time })
    }

    async postUpdate(data) {
        this.post(UPDATE, data)
        this.postCameraVideoMaskUpdate(data)
    }

    postFrame(type, frame, mask, landmarks) {
        // postFrame is using postAsync to handle backpressure
        const transferList = [frame]
        if (mask) transferList.push(mask)
        return this.postAsync(FRAME, { type, frame, mask, landmarks }, undefined, transferList)
    }

    postIsPlaying(isPlaying) {
        this.post(IS_PLAYING, isPlaying)
        this.isPlaying = isPlaying
    }

    async enableEyeContact(cameraVideoDims) {
        if (this.faceLandmarkerReady) return
        try {
            await this.createFaceLandmarker(cameraVideoDims)
            this.faceLandmarkerReady = true
        } catch (e) {
            console.warn("[Flowtake] FaceLandmarker initialization failed:", e)
        }
    }

    setEyeContactEnabled(enabled) {
        this.eyeContactEnabled = enabled
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
        // Intercept the boot handshake before delegating to the base class
        // so it's visible even if super.onMessage consumes it.
        if (event?.data?.type === "PREVIEW_WORKER_READY") {
            console.log("[PreviewWorkerManager] got PREVIEW_WORKER_READY from worker", event.data.payload)
            return
        }

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
