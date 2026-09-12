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
    SNAPSHOT,
    TIME,
    UPDATE,
    postAsync as postWorkerRequest
} from "./helpers"
import PreviewWorker from './previewWorker.js?worker'
import WorkerManager from "./WorkerManager"

const PREVIEW_INIT_TIMEOUT_MS = 12000
const PREVIEW_FRAME_TIMEOUT_MS = 5000

function closeFrameResource(resource) {
    try {
        resource?.close?.()
    } catch {
        // A successfully transferred VideoFrame/ImageBitmap is already detached.
    }
}

function workerFailureError(kind, event) {
    const error = event?.error instanceof Error
        ? event.error
        : new Error(event?.message || `Preview worker ${kind}`)
    if (!error.name || error.name === "Error") error.name = "WorkerError"
    return error
}

export default class PreviewWorkerManager extends WorkerManager {
    constructor(screenVideo, cameraVideo, performanceProfile = {}) {
        super()
        this.worker = new PreviewWorker()
        this.pendingRequestController = new AbortController()
        this.stopped = false
        getWebWorkerIntegration()?.addWorker(this.worker)

        // Worker failures are terminal for this manager. Abort every pending
        // request so initialization and frame pumps cannot hang indefinitely.
        this.worker.addEventListener("error", e => {
            console.error(
                "[PreviewWorkerManager] worker error:",
                e?.message,
                "at",
                e?.filename + ":" + e?.lineno + ":" + e?.colno,
                e?.error || e
            )
            this.terminate(workerFailureError("error", e))
        })
        this.worker.addEventListener("messageerror", e => {
            console.error("[PreviewWorkerManager] worker messageerror:", e)
            this.terminate(workerFailureError("message error", e))
        })

        this.worker.addEventListener("message", event => this.onMessage(event))
        this.screenVideo = screenVideo
        this.cameraVideo = cameraVideo
        const previewFps = Math.min(60, Math.max(12, Number(performanceProfile.previewFps) || 30))
        this.previewFrameIntervalMs = 1000 / previewFps
        this.performanceProfileId = performanceProfile.id || null
        this.previewMaxWidth = Number(performanceProfile.previewMaxWidth) || null
        this.previewMaxHeight = Number(performanceProfile.previewMaxHeight) || null
        this.lastScreenFrameAt = Number.NEGATIVE_INFINITY
        this.lastCameraFrameAt = Number.NEGATIVE_INFINITY

        this.isPlaying = false
        this.hasCameraVideoBackgroundBlur = false
        this.cameraVideoBackgroundBlurAmount = 0
        this.isScreenFramePending = false
        this.isCameraFramePending = false
        this.deferredPausedScreenRefresh = false
        this.deferredPausedCameraRefresh = false
        this.eyeContactEnabled = false
        this.faceLandmarkerReady = false

        // Extra videos (multi-app plugin) — index → { video, isPending }
        this.extraVideos = []
    }

    request(type, payload, id = crypto.randomUUID(), transferList = [], timeoutMs = PREVIEW_FRAME_TIMEOUT_MS) {
        if (this.stopped || !this.worker) {
            const error = new Error(`Preview worker is not available for request: ${type}`)
            error.name = "AbortError"
            return Promise.reject(error)
        }
        return postWorkerRequest(this.worker, type, payload, id, transferList, {
            signal: this.pendingRequestController.signal,
            timeoutMs,
            timeoutMessage: `Preview worker request timed out: ${type}`,
        })
    }

    assertActive() {
        if (!this.stopped && this.worker) return
        const reason = this.pendingRequestController.signal.reason
        if (reason instanceof Error) throw reason
        const error = new Error("Preview worker initialization was cancelled")
        error.name = "AbortError"
        throw error
    }

    /**
     * Register an extra-N video element + its native dims, set up frame pumping,
     * and tell the worker to allocate a Pixi PiP for it.
     *
     * Critical: posts an INITIAL frame right after registration. Without this
     * the PiP stays blank until the user hits play, because requestVideoFrameCallback
     * only fires when a *new* frame is presented and the extra video is paused on load.
     */
    registerExtraVideo(index, videoEl, dims) {
        if (!videoEl || this.stopped || !this.worker) return
        this.extraVideos[index] = {
            video: videoEl,
            isPending: false,
            isVisible: true,
            deferredPausedRefresh: false,
            lastFrameAt: Number.NEGATIVE_INFINITY,
        }

        // Tell the worker to allocate the ExtraVideo Pixi sprite.
        this.post(INIT_EXTRA_VIDEO, { index, dims })

        // Post an initial frame so the PiP shows the current still even when
        // the video is paused (which it is on first load).
        try {
            const initialFrame = new VideoFrame(videoEl)
            this.postFrame(`extra-${index}`, initialFrame).catch(e => {
                if (!this.stopped) {
                    console.warn(`[PreviewWorkerManager] extra-${index} initial frame post failed:`, e)
                }
            })
        } catch (e) {
            if (!this.stopped) {
                console.warn(`[PreviewWorkerManager] extra-${index} initial VideoFrame() failed:`, e)
            }
        }

        const cb = async now => {
            if (this.stopped) return
            const slot = this.extraVideos[index]
            if (!slot || slot.video !== videoEl) return        // unregistered
            const frameTime = Number.isFinite(now) ? now : performance.now()
            const isFrameDue = !this.isPlaying
                || frameTime - slot.lastFrameAt >= this.previewFrameIntervalMs
            if (slot.isVisible && isFrameDue && !slot.isPending) {
                slot.deferredPausedRefresh = false
                slot.isPending = true
                slot.lastFrameAt = frameTime
                let frame = null
                try {
                    frame = new VideoFrame(videoEl)
                    await this.postFrame(`extra-${index}`, frame)
                } catch (e) {
                    if (!this.stopped) {
                        console.warn(`[PreviewWorkerManager] extra-${index} frame post failed:`, e)
                    }
                } finally {
                    closeFrameResource(frame)
                    slot.isPending = false
                    this.flushDeferredPausedExtraRefresh(index, slot)
                }
            }
            if (!this.stopped) videoEl.requestVideoFrameCallback(cb)
        }
        videoEl.requestVideoFrameCallback(cb)

        // Also seek the extra video to currentTime to ensure it has a frame
        // ready (cold-loaded videos sometimes have HAVE_METADATA but no frame
        // until they're scrubbed).
        if (videoEl.currentTime === 0 && videoEl.duration > 0) {
            // Tiny seek to force a frame to be decoded
            try { videoEl.currentTime = 0.001 } catch { /* ignore */ }
        }
    }

    setExtraVisibility(index, visible) {
        const slot = this.extraVideos[index]
        const nextVisible = Boolean(visible)
        const becameVisible = Boolean(slot && !slot.isVisible && nextVisible)
        if (slot) slot.isVisible = Boolean(visible)
        if (!this.postIfActive(SET_EXTRA_VISIBILITY, { index, visible: nextVisible })) return

        // The worker canvas may have been cleared by a profile resize while
        // this source was hidden. A paused video will not emit another frame
        // callback, so repopulate it on the visibility transition.
        if (becameVisible && !this.isPlaying) {
            this.refreshPausedExtraFrame(index, { deferPending: true })
        }
    }

    async init(canvas, duration, args) {
        let timeout = null
        const initialization = this.initialize(canvas, duration, args)
        const timeoutPromise = new Promise((_, reject) => {
            timeout = setTimeout(() => {
                const error = new Error(`Preview worker initialization timed out after ${PREVIEW_INIT_TIMEOUT_MS}ms`)
                error.name = "TimeoutError"
                this.terminate(error)
                reject(error)
            }, PREVIEW_INIT_TIMEOUT_MS)
        })

        try {
            await Promise.race([initialization, timeoutPromise])
        } finally {
            if (timeout !== null) clearTimeout(timeout)
        }
    }

    async initialize(canvas, duration, args) {
        let phase = "read screen video dimensions"
        let screenFrame = null
        let cameraFrame = null

        try {
            this.assertActive()
            const screenVideoDims = await this.getDimensions(PROJECT_SCREEN_VIDEO, args.projectId)
            this.assertActive()

            let cameraVideoDims
            if (args.hasCameraVideo) {
                phase = "read camera video dimensions"
                cameraVideoDims = await this.getDimensions(PROJECT_CAMERA_VIDEO, args.projectId)
                this.assertActive()
                phase = "create camera segmenter"
                await this.createSegmenter(cameraVideoDims)
                if (this.stopped) {
                    try {
                        this.segmenter?.close()
                    } finally {
                        this.segmenter = null
                    }
                }
                this.assertActive()
            }
            phase = "transfer preview canvas"
            this.assertActive()
            const offscreenCanvas = canvas.transferControlToOffscreen()

            phase = "create initial screen frame"
            screenFrame = new VideoFrame(this.screenVideo)

            if (args.hasCameraVideo) {
                phase = "create initial camera frame"
                cameraFrame = new VideoFrame(this.cameraVideo)
            }

            const transferList = [offscreenCanvas, screenFrame]
            if (cameraFrame) transferList.push(cameraFrame)

            phase = "initialize preview worker"
            await this.request(
                INIT_PREVIEW,
                { args, canvas: offscreenCanvas, duration, screenFrame, screenVideoDims, cameraFrame, cameraVideoDims },
                undefined,
                transferList,
                PREVIEW_INIT_TIMEOUT_MS
            )

            phase = "setup preview frame callbacks"
            this.assertActive()
            this.setupVideoFrameCallbacks(args.hasCameraVideo)
        } catch (error) {
            closeFrameResource(screenFrame)
            closeFrameResource(cameraFrame)
            const message = `${error?.message || String(error)} (during ${phase})`
            if (error instanceof Error) {
                error.message = message
                throw error
            }
            throw new Error(message, { cause: error })
        }
    }

    setupVideoFrameCallbacks(hasCameraVideo) {
        const screenFrameCallback = async now => {
            if (this.stopped) return
            const frameTime = Number.isFinite(now) ? now : performance.now()
            const isFrameDue = !this.isPlaying
                || frameTime - this.lastScreenFrameAt >= this.previewFrameIntervalMs
            if (isFrameDue && !this.isScreenFramePending) {
                this.deferredPausedScreenRefresh = false
                this.isScreenFramePending = true
                this.lastScreenFrameAt = frameTime
                let frame = null
                try {
                    frame = new VideoFrame(this.screenVideo)
                    await this.postFrame(SCREEN_VIDEO, frame)
                } catch (error) {
                    if (!this.stopped) {
                        console.warn("[PreviewWorkerManager] screen frame post failed:", error)
                    }
                } finally {
                    closeFrameResource(frame)
                    this.isScreenFramePending = false
                    this.flushDeferredPausedScreenRefresh()
                }
            }
            if (!this.stopped) this.screenVideo.requestVideoFrameCallback(screenFrameCallback)
        }

        const cameraFrameCallback = async now => {
            if (this.stopped) return
            const frameTime = Number.isFinite(now) ? now : performance.now()
            const isFrameDue = !this.isPlaying
                || frameTime - this.lastCameraFrameAt >= this.previewFrameIntervalMs
            if (isFrameDue && !this.isCameraFramePending) {
                this.deferredPausedCameraRefresh = false
                this.isCameraFramePending = true
                this.lastCameraFrameAt = frameTime
                let frame = null
                let mask = null
                try {
                    frame = new VideoFrame(this.cameraVideo)
                    if (this.hasCameraBlur()) mask = await this.segment(frame, false)
                    let landmarks = null
                    if (this.eyeContactEnabled && this.faceLandmarkerReady) {
                        landmarks = this.detectFaceLandmarks(frame)
                    }
                    await this.postFrame(CAMERA_VIDEO, frame, mask, landmarks)
                } catch (error) {
                    if (!this.stopped) {
                        console.warn("[PreviewWorkerManager] camera frame post failed:", error)
                    }
                } finally {
                    closeFrameResource(frame)
                    closeFrameResource(mask)
                    this.isCameraFramePending = false
                    this.flushDeferredPausedCameraRefresh()
                }
            }
            if (!this.stopped) this.cameraVideo.requestVideoFrameCallback(cameraFrameCallback)
        }

        this.screenVideo?.requestVideoFrameCallback(screenFrameCallback)

        if (hasCameraVideo) this.cameraVideo?.requestVideoFrameCallback(cameraFrameCallback)
    }

    terminate(reason) {
        this.stopped = true
        this.isScreenFramePending = false
        this.isCameraFramePending = false
        this.deferredPausedScreenRefresh = false
        this.deferredPausedCameraRefresh = false
        this.extraVideos.forEach(slot => {
            if (slot) {
                slot.isPending = false
                slot.deferredPausedRefresh = false
            }
        })

        if (!this.pendingRequestController.signal.aborted) {
            const error = reason instanceof Error
                ? reason
                : new Error(reason || "Preview worker terminated")
            if (!error.name || error.name === "Error") error.name = "AbortError"
            this.pendingRequestController.abort(error)
        }

        super.terminate()
    }

    postIfActive(type, payload) {
        if (this.stopped || !this.worker) return false
        try {
            this.post(type, payload)
            return true
        } catch (error) {
            console.warn(`[PreviewWorkerManager] failed to post ${type}:`, error)
            return false
        }
    }

    postTime(time) {
        this.postIfActive(TIME, { time })
    }

    postUpdate(data) {
        if (!this.postIfActive(UPDATE, data)) return
        void this.postCameraVideoMaskUpdate(data).catch(error => {
            if (!this.stopped) {
                console.warn("[PreviewWorkerManager] camera mask update failed:", error)
            }
        })
    }

    setPerformanceProfile(performanceProfile = {}) {
        const previewFps = Math.min(60, Math.max(12, Number(performanceProfile.previewFps) || 30))
        const previewMaxWidth = Number(performanceProfile.previewMaxWidth) || null
        const previewMaxHeight = Number(performanceProfile.previewMaxHeight) || null
        if (this.performanceProfileId === (performanceProfile.id || null)
            && this.previewFrameIntervalMs === 1000 / previewFps
            && this.previewMaxWidth === previewMaxWidth
            && this.previewMaxHeight === previewMaxHeight) return

        this.performanceProfileId = performanceProfile.id || null
        this.previewMaxWidth = previewMaxWidth
        this.previewMaxHeight = previewMaxHeight
        this.previewFrameIntervalMs = 1000 / previewFps
        this.lastScreenFrameAt = Number.NEGATIVE_INFINITY
        this.lastCameraFrameAt = Number.NEGATIVE_INFINITY
        this.extraVideos.forEach(slot => {
            if (slot) slot.lastFrameAt = Number.NEGATIVE_INFINITY
        })
        if (!this.postIfActive(UPDATE, {
            type: 'preview.performanceProfile',
            payload: performanceProfile,
        })) return

        // Resizing clears every bounded worker canvas. Paused media will not
        // naturally produce another callback, so immediately repopulate all
        // screen, camera/mask, and extra-video preview textures.
        this.refreshPausedFrames()
    }

    refreshPausedFrames() {
        if (this.stopped || this.isPlaying) return

        this.refreshPausedScreenFrame({ deferPending: true })
        this.refreshPausedCameraFrame({ deferPending: true })
        this.extraVideos.forEach((_, index) => {
            this.refreshPausedExtraFrame(index, { deferPending: true })
        })
    }

    refreshPausedScreenFrame({ deferPending = false } = {}) {
        if (this.stopped || this.isPlaying || !this.screenVideo || this.screenVideo.readyState < 2) return false
        if (this.isScreenFramePending) {
            if (deferPending) this.deferredPausedScreenRefresh = true
            return false
        }

        this.deferredPausedScreenRefresh = false
        this.isScreenFramePending = true
        let frame = null
        try {
            frame = new VideoFrame(this.screenVideo)
            void this.postFrame(SCREEN_VIDEO, frame)
                .catch(error => {
                    if (!this.stopped) console.warn("[PreviewWorkerManager] screen paused refresh failed:", error)
                })
                .finally(() => {
                    closeFrameResource(frame)
                    this.isScreenFramePending = false
                    this.flushDeferredPausedScreenRefresh()
                })
        } catch (error) {
            closeFrameResource(frame)
            this.isScreenFramePending = false
            this.flushDeferredPausedScreenRefresh()
            if (!this.stopped) console.warn("[PreviewWorkerManager] screen paused frame failed:", error)
        }
        return true
    }

    refreshPausedCameraFrame({ deferPending = false } = {}) {
        if (this.stopped || this.isPlaying || !this.cameraVideo || this.cameraVideo.readyState < 2) return false
        if (this.isCameraFramePending) {
            if (deferPending) this.deferredPausedCameraRefresh = true
            return false
        }

        this.deferredPausedCameraRefresh = false
        this.isCameraFramePending = true
        void (async () => {
            let frame = null
            let mask = null
            try {
                frame = new VideoFrame(this.cameraVideo)
                if (this.hasCameraBlur()) mask = await this.segment(frame, false)
                const landmarks = this.eyeContactEnabled && this.faceLandmarkerReady
                    ? this.detectFaceLandmarks(frame)
                    : null
                await this.postFrame(CAMERA_VIDEO, frame, mask, landmarks)
            } catch (error) {
                if (!this.stopped) console.warn("[PreviewWorkerManager] camera paused refresh failed:", error)
            } finally {
                closeFrameResource(frame)
                closeFrameResource(mask)
                this.isCameraFramePending = false
                this.flushDeferredPausedCameraRefresh()
            }
        })()
        return true
    }

    refreshPausedExtraFrame(index, { deferPending = false } = {}) {
        const slot = this.extraVideos[index]
        if (this.stopped || this.isPlaying || !slot?.isVisible || !slot.video || slot.video.readyState < 2) return false
        if (slot.isPending) {
            if (deferPending) slot.deferredPausedRefresh = true
            return false
        }

        slot.deferredPausedRefresh = false
        slot.isPending = true
        let frame = null
        try {
            frame = new VideoFrame(slot.video)
            void this.postFrame(`extra-${index}`, frame)
                .catch(error => {
                    if (!this.stopped) console.warn(`[PreviewWorkerManager] extra-${index} paused refresh failed:`, error)
                })
                .finally(() => {
                    closeFrameResource(frame)
                    slot.isPending = false
                    this.flushDeferredPausedExtraRefresh(index, slot)
                })
        } catch (error) {
            closeFrameResource(frame)
            slot.isPending = false
            this.flushDeferredPausedExtraRefresh(index, slot)
            if (!this.stopped) console.warn(`[PreviewWorkerManager] extra-${index} paused frame failed:`, error)
        }
        return true
    }

    flushDeferredPausedScreenRefresh() {
        if (!this.deferredPausedScreenRefresh) return
        this.deferredPausedScreenRefresh = false
        if (!this.stopped && !this.isPlaying) {
            this.refreshPausedScreenFrame({ deferPending: true })
        }
    }

    flushDeferredPausedCameraRefresh() {
        if (!this.deferredPausedCameraRefresh) return
        this.deferredPausedCameraRefresh = false
        if (!this.stopped && !this.isPlaying) {
            this.refreshPausedCameraFrame({ deferPending: true })
        }
    }

    flushDeferredPausedExtraRefresh(index, slot) {
        if (!slot?.deferredPausedRefresh) return
        slot.deferredPausedRefresh = false
        if (!this.stopped && !this.isPlaying && this.extraVideos[index] === slot) {
            this.refreshPausedExtraFrame(index, { deferPending: true })
        }
    }

    clearDeferredPausedRefreshes() {
        this.deferredPausedScreenRefresh = false
        this.deferredPausedCameraRefresh = false
        this.extraVideos.forEach(slot => {
            if (slot) slot.deferredPausedRefresh = false
        })
    }

    postFrame(type, frame, mask, landmarks) {
        // postFrame is using postAsync to handle backpressure
        const transferList = [frame]
        if (mask) transferList.push(mask)
        return this.request(FRAME, { type, frame, mask, landmarks }, undefined, transferList)
            .catch(error => {
                closeFrameResource(frame)
                closeFrameResource(mask)
                throw error
            })
    }

    postIsPlaying(isPlaying) {
        const wasPlaying = this.isPlaying
        this.isPlaying = isPlaying
        if (isPlaying) this.clearDeferredPausedRefreshes()
        if (!this.postIfActive(IS_PLAYING, isPlaying)) return
        if (wasPlaying && !isPlaying) {
            this.refreshPausedFrames({ deferPending: true })
        }
    }

    captureSnapshot() {
        return this.postAsync(SNAPSHOT)
    }

    async enableEyeContact(cameraVideoDims) {
        if (this.faceLandmarkerReady) return
        try {
            await this.createFaceLandmarker(cameraVideoDims)
            if (this.stopped) {
                try {
                    this.faceLandmarker?.close()
                } finally {
                    this.faceLandmarker = null
                }
                return
            }
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
            let frame = null
            let mask = null
            try {
                this.assertActive()
                frame = new VideoFrame(this.cameraVideo)
                mask = await this.segment(frame, false)
                await this.postFrame(CAMERA_VIDEO, frame, mask)
            } finally {
                closeFrameResource(frame)
                closeFrameResource(mask)
            }
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
