import "pixi.js/webworker"
import "pixi.js/graphics"
import "pixi.js/mesh"
import "pixi.js/text"

import { Mp4OutputFormat } from "mediabunny"
import throttle from "throttleit"
import {
    RENDER_CAMERA_VIDEO,
    RENDER_OUTPUT_VIDEO,
    RENDER_SCREEN_VIDEO
} from "../constants"
import {
    RENDER_CANCELED,
    RENDER_COMPLETED,
    RENDER_PROCESSING_AUDIO,
    RENDER_UPLOADING
} from "../helpers"
import { selectRendererDims } from "../redux/animatorSlice"
import { selectAllCameraZooms } from "../redux/cameraZoomSlice"
import { selectAllClicks } from "../redux/clickSlice"
import { selectAllClips } from "../redux/clipSlice"
import {
    selectBlurStrength,
    selectCutOff,
    selectInertia,
    selectIsLoop,
    selectShowClickRing,
    selectShowSpotlight,
    selectSpotlightFeather,
    selectSpotlightOpacity,
    selectSpotlightRadius
} from "../redux/cursorCoordsSlice"
import {
    selectAllCursorTypes,
    selectIsStatic
} from "../redux/cursorTypeSlice"
import { selectAllMasks } from "../redux/maskSlice"
import { selectAllOverlays } from "../redux/overlaySlice"
import { selectAllPans } from "../redux/panSlice"
import { selectAllSpatials } from "../redux/spatialSlice"
import {
    selectBackground,
    selectBorderRadius,
    selectBottomTrim,
    selectCameraVideoBackgroundBlurAmount,
    selectCameraVideoShadowAlpha,
    selectCursorFill,
    selectCursorMovementRotation,
    selectCursorScale,
    selectCursorShadowAlpha,
    selectCursorStroke,
    selectHasCameraVideo,
    selectHasCameraVideoBackgroundBlur,
    selectHasMicrophoneAudio,
    selectHasSystemAudio,
    selectIsCameraVideoMirrored,
    selectLeftTrim,
    selectKeyboardEvents,
    selectMouseEvents,
    selectPadding,
    selectRightTrim,
    selectShadowAlpha,
    selectTopTrim,
    selectVideoDetails
} from "../redux/projectSlice"
import {
    setProgress,
    updateRender
} from "../redux/renderSlice"
import {
    selectAllSubtitles,
    selectBackgroundColor,
    selectPosition,
    selectShadowAlpha as selectSubtitleShadowAlpha,
    selectTextColor,
    selectWidth
} from "../redux/subtitleSlice"
import { selectAllZooms } from "../redux/zoomSlice"
import {
    FEATURE_IDS as PLUGIN_FEATURE_IDS,
    selectFeatureConfig as selectPluginFeatureConfig,
    selectIsFeatureEnabled as selectIsPluginFeatureEnabled
} from "../redux/pluginSlice"
import {
    selectAllKeyboardLayouts,
    selectKeyboardLayoutDefaults
} from "../redux/keyboardLayoutSlice"
import {
    selectAllMouseStyles,
    selectMouseStyleDefaults
} from "../redux/mouseStyleAnimSlice"
import RenderScene from "../scene/RenderScene"
import {
    CANCEL_RENDER,
    INIT_RENDER,
    post,
    postAsync,
    postDispatch,
    postIpc,
    RENDER_COMPLETE,
    RENDER_ERROR,
    SEGMENT_FRAME,
    START_RENDER,
    workerConsole
} from "./helpers"
import WorkerInputReader from "./WorkerInputReader"
import WorkerOutputWriter from "./WorkerOutputWriter"

// Replace console methods with worker console
Object.assign(console, workerConsole)

// Enhanced Renderer class for web worker
class WorkerRenderer {
    constructor(render) {
        this.render = render
        this.scene = new RenderScene(this.render.state)
        this.numberOfFrames = null
        this.timestamps = null
        this.animationFrameId = null
        this.isCanceled = false
        this.initPromise = null
        this.renderFramesPromise = null
        this.readers = {}
        this.fhId = null
    }

    async init(screenVideoDimensions, cameraVideoDimensions) {
        postDispatch(setProgress(0))

        const hasMicrophoneAudio = selectHasMicrophoneAudio(this.render.state)
        const hasSystemAudio = selectHasSystemAudio(this.render.state)
        const hasCameraVideo = selectHasCameraVideo(this.render.state)
        const rendererDims = selectRendererDims(this.render.state)
        const videoDetails = selectVideoDetails(this.render.state)

        if (hasMicrophoneAudio || hasSystemAudio) await postIpc("process-audio", [this.render.id])

        await this.scene.createApp()
        this.scene.background.renderId = this.render.id
        this.scene.initScreenVideo(screenVideoDimensions)

        if (hasCameraVideo && cameraVideoDimensions) this.scene.initCameraVideo(cameraVideoDimensions)

        const duration = await WorkerInputReader.getDuration(RENDER_SCREEN_VIDEO, { renderId: this.render.id })

        await this.scene.init(
            {
                videoDetails: selectVideoDetails(this.render.state),
                rendererDims,
                inertia: selectInertia(this.render.state),
                cameraZooms: selectAllCameraZooms(this.render.state),
                masks: selectAllMasks(this.render.state),
                cursorTypeAnims: selectAllCursorTypes(this.render.state),
                subtitleAnims: selectAllSubtitles(this.render.state),
                zooms: selectAllZooms(this.render.state),
                pans: selectAllPans(this.render.state),
                mouseEvents: selectMouseEvents(this.render.state),
                panCoordsSlice: this.render.state.panCoords,
                cursorCoordsSlice: this.render.state.undoableState.present.cursorCoords,
                clickAnims: selectAllClicks(this.render.state),
                clipAnims: selectAllClips(this.render.state),
                hasCameraVideo: selectHasCameraVideo(this.render.state),
                cursorFill: selectCursorFill(this.render.state),
                cursorStroke: selectCursorStroke(this.render.state),
                cursorShadowAlpha: selectCursorShadowAlpha(this.render.state),
                background: selectBackground(this.render.state),
                isCursorStatic: selectIsStatic(this.render.state),
                subtitleBackgroundColor: selectBackgroundColor(this.render.state),
                subtitleTextColor: selectTextColor(this.render.state),
                subtitleWidth: selectWidth(this.render.state),
                subtitleShadowAlpha: selectSubtitleShadowAlpha(this.render.state),
                subtitlePosition: selectPosition(this.render.state),
                trim: {
                    left: selectLeftTrim(this.render.state),
                    right: selectRightTrim(this.render.state),
                    top: selectTopTrim(this.render.state),
                    bottom: selectBottomTrim(this.render.state)
                },
                borderRadius: selectBorderRadius(this.render.state),
                cursorCutOff: selectCutOff(this.render.state),
                cursorIsLoop: selectIsLoop(this.render.state),
                cursorBlurStrength: selectBlurStrength(this.render.state),
                cursorMovementRotation: selectCursorMovementRotation(this.render.state),
                cursorScale: selectCursorScale(this.render.state),
                showSpotlight: selectShowSpotlight(this.render.state),
                spotlightRadius: selectSpotlightRadius(this.render.state),
                spotlightOpacity: selectSpotlightOpacity(this.render.state),
                spotlightFeather: selectSpotlightFeather(this.render.state),
                padding: selectPadding(this.render.state),
                shadowAlpha: selectShadowAlpha(this.render.state),
                cameraVideoShadowAlpha: selectCameraVideoShadowAlpha(this.render.state),
                hasCameraVideoBackgroundBlur: selectHasCameraVideoBackgroundBlur(this.render.state),
                cameraVideoBackgroundBlurAmount: selectCameraVideoBackgroundBlurAmount(this.render.state),
                isCameraVideoMirrored: selectIsCameraVideoMirrored(this.render.state),
                overlayAnims: selectAllOverlays(this.render.state),
                spatials: selectAllSpatials(this.render.state),
                showClickRing: selectShowClickRing(this.render.state),
                pluginMouseStyle: {
                    enabled: selectIsPluginFeatureEnabled(PLUGIN_FEATURE_IDS.MOUSE_STYLE)(this.render.state),
                    defaults: selectMouseStyleDefaults(this.render.state),
                    entities: selectAllMouseStyles(this.render.state),
                },
                pluginKeyboardOverlay: {
                    enabled: selectIsPluginFeatureEnabled(PLUGIN_FEATURE_IDS.KEYBOARD_OVERLAY)(this.render.state),
                    defaults: selectKeyboardLayoutDefaults(this.render.state),
                    entities: selectAllKeyboardLayouts(this.render.state),
                    events: selectKeyboardEvents(this.render.state) || [],
                },
            },
            duration)

        const msPerFrame = 1000 / this.render.config.fps

        let currentRendererTimestamp = videoDetails.start
        let currentOutputTimestamp = 0

        this.timestamps = []
        this.timestamps.push({ rendererTimestamp: currentRendererTimestamp, outputTimestamp: currentOutputTimestamp })

        const clips = selectAllClips(this.render.state)

        clips.forEach((config, i) => {
            let firstFrame = true
            while (currentRendererTimestamp < config.end - msPerFrame * config.playbackRate) {
                let msPerFrameAdjusted = 0

                const isAdjacent = i === 0 || clips[i - 1].end === config.start

                if (firstFrame && !isAdjacent) {
                    // if this is the first frame in a new clip and there is a gap between the two
                    // clips, just set the renderer timestamp to the start of the new clip.
                    firstFrame = false
                    currentRendererTimestamp = config.start
                } else if (firstFrame && i > 0) {
                    // if this is the first frame in a new clip, calculate the correct timestamp,
                    // taking into account how much time there was left after the last frame with the
                    // old speed, and how much of the new speed needs to be added.

                    firstFrame = false

                    const prevPlaybackRate = clips[i - 1].playbackRate
                    const prevTimestamp = this.timestamps.at(-1).rendererTimestamp
                    const prevConfig = clips[i - 1]

                    const prevFraction = (prevConfig.end - prevTimestamp) / (prevPlaybackRate * msPerFrame)
                    const currFraction = 1 - prevFraction

                    const speed = prevFraction * prevPlaybackRate + currFraction * config.playbackRate

                    msPerFrameAdjusted = msPerFrame * speed
                } else
                    msPerFrameAdjusted = msPerFrame * config.playbackRate

                currentRendererTimestamp += msPerFrameAdjusted
                currentOutputTimestamp += msPerFrame
                this.timestamps.push({ rendererTimestamp: currentRendererTimestamp, outputTimestamp: currentOutputTimestamp })
            }
        })

        this.timestamps.forEach(timestamp => {
            timestamp.rendererTimestamp = Math.round(timestamp.rendererTimestamp)
        })

        this.numberOfFrames = this.timestamps.length

        this.readers.screen = new WorkerInputReader(RENDER_SCREEN_VIDEO, { renderId: this.render.id })
        await this.readers.screen.init()
        await this.readers.screen.createSink(this.timestamps)

        if (hasCameraVideo) {
            this.readers.camera = new WorkerInputReader(RENDER_CAMERA_VIDEO, { renderId: this.render.id })
            await this.readers.camera.init()
            await this.readers.camera.createSink(this.timestamps)
        }

        // init sprites scale and dims with first frames
        await Promise.all([
            this.getNewFrame("screen", { rendererTimestamp: videoDetails.start }),
            this.getNewFrame("camera", { rendererTimestamp: videoDetails.start }),
        ])

        this.writer = new WorkerOutputWriter(
            RENDER_OUTPUT_VIDEO,
            { renderId: this.render.id },
            Mp4OutputFormat,
            this.render.config.fps,
            this.render.config.resolution,
            this.render.config.quality
        )

        await this.writer.init()
        await this.writer.start()
    }

    async getNewFrame(type, { rendererTimestamp: t }) {
        const wrappedCanvas = await this.readers[type]?.getCanvas(t)
        if (wrappedCanvas) {

            const hasBlur = selectHasCameraVideoBackgroundBlur(this.render.state)
            const blurAmount = selectCameraVideoBackgroundBlurAmount(this.render.state)

            if (type === "camera" && hasBlur && blurAmount > 0) {
                const frame = await createImageBitmap(wrappedCanvas.canvas)
                const mask = await postAsync(self, SEGMENT_FRAME, frame, undefined, [frame])
                this.scene.setFrame(type, wrappedCanvas.canvas, mask)
            } else
                this.scene.setFrame(type, wrappedCanvas.canvas)

            wrappedCanvas.canvas = null
        }
    }

    async renderFrames() {
        let i = 0

        const onProgress = throttle(progress => postDispatch(setProgress(progress)), 1000)

        console.log("rendering frames...")

        for (const timestamp of this.timestamps) {

            if (this.isCanceled) return

            onProgress(Math.max(0, i / this.numberOfFrames * 100))

            await Promise.all([this.getNewFrame("screen", timestamp), this.getNewFrame("camera", timestamp)])

            this.scene.time = timestamp.rendererTimestamp
            this.scene.update()

            const buffer = this.scene.renderToPixelBuffer()
            await this.writer.addFrame(buffer, timestamp.outputTimestamp)

            i++
        }

        console.log("rendering frames done")

        console.log("destroying scene")
        this.scene.destroy()
        this.scene = null
        console.log("destroying scene done")

        console.log("finalizing encoder")
        console.log("finalizing encoder")
        await this.writer.finalize()
        console.log("finalizing encoder done")

        console.log("closing readers")
        await this.readers.screen?.close()
        console.log("closing readers screen done")
        await this.readers.camera?.close()
        console.log("closing readers camera done")

        if (selectHasMicrophoneAudio(this.render.state) || selectHasSystemAudio(this.render.state)) {
            console.log("adding audio")
            postDispatch(updateRender({ id: this.render.id, changes: { status: RENDER_PROCESSING_AUDIO } }))
            await postIpc("add-audio", [this.render.id])
            console.log("adding audio done")
        }

        console.log("copying to videos folder")
        await postIpc("copy-to-videos-folder", [this.render.id])
        console.log("copying to videos folder done")

        console.log("cleaning up temp folder")
        await postIpc("clean-up-temp-folder", [this.render.id])
        console.log("cleaning up temp folder done")

        if (this.render.upload.isRequested) {
            console.log("uploading")
            postDispatch(updateRender({ id: this.render.id, changes: { status: RENDER_UPLOADING } }))
            await postIpc("upload", [this.render.id])
            console.log("uploading done")
        }
        console.log("updating render")
        postDispatch(updateRender({ id: this.render.id, changes: { status: RENDER_COMPLETED } }))
        postDispatch(setProgress(0))

        postIpc("send-notification", [this.render.id])
    }

    async cancel() {
        this.isCanceled = true
        await this.initPromise
        await this.renderFramesPromise
        await this.writer?.cancel()
        this.scene?.destroy()
        await this.readers.screen?.close()
        await this.readers.camera?.close()
        await postIpc("cancel-render", [this.render.id])
        await postIpc("clean-up-temp-folder", [this.render.id])
        postDispatch(updateRender({ id: this.render.id, changes: { status: RENDER_CANCELED } }))
    }
}

let renderer = null

// TODO: remove intermediate canvases

// Message handler for worker
self.addEventListener('message', async (event) => {
    const { type, payload, id, expectsResponse, isResponse } = event.data

    // log(false, type, payload, isResponse)

    if (isResponse) return

    let result

    switch (type) {

        case INIT_RENDER: {

            renderer = new WorkerRenderer(payload.render)

            // Initialize the renderer
            try {
                renderer.initPromise = renderer.init(payload.screenVideoDims, payload.cameraVideoDims)
                await renderer.initPromise
            } catch (error) {
                post(self, RENDER_ERROR, { error: error.message })
                renderer.initPromise = null
                await renderer.cancel()
                if (!error.isCaptured && !error.message.includes('CanvasRenderer is not yet implemented')) throw error
            }

            result = { renderId: payload.render.id }

            break
        }
        case START_RENDER:
            try {
                // Start rendering frames if not canceled
                if (!renderer.isCanceled) {
                    renderer.renderFramesPromise = renderer.renderFrames()
                }

                await renderer.renderFramesPromise

                post(self, RENDER_COMPLETE)
            } catch (error) {
                console.error(error)
                post(self, RENDER_ERROR, { error: error.message })
                renderer.renderFramesPromise = null
                await renderer.cancel()
                throw error
            }
            break

        case CANCEL_RENDER:
            if (renderer) {
                await renderer.cancel()
                renderer = null
            }
            break

        default:
            console.warn('Unknown message type in render worker:', type)
    }

    if (expectsResponse) post(self, type, { result }, id, false, true)
})

self.addEventListener("unhandledrejection", ({ reason }) => { throw reason })
