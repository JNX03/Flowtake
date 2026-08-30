import "pixi.js/webworker"
import "pixi.js/graphics"
import "pixi.js/mesh"
import "pixi.js/text"

import {
    Mp4OutputFormat,
    WebMOutputFormat
} from "mediabunny"
import throttle from "throttleit"
import {
    PROJECT_MEDIA,
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
import {
    createVideoOverlaySourceTimestamps,
    getVideoOverlaySourceTime,
    isVideoOverlay,
    isVideoOverlayActive
} from "../editor/videoOverlay"
import {
    buildRenderTimelineFrames,
    getClipSourceRange
} from "../editor/playbackClock"
import {
    buildCustomAudioExportClips,
    hasAudibleTimelineAudio
} from "../editor/audioTimeline"
import { getExportFormatConfig } from "../exportFormats"
import { selectRendererDims } from "../redux/animatorSlice"
import { selectAllCameraZooms } from "../redux/cameraZoomSlice"
import { selectAllClicks } from "../redux/clickSlice"
import { selectAllClips } from "../redux/clipSlice"
import {
    selectAllAudioClips,
    selectAudioTracks
} from "../redux/audioTrackSlice"
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
import {
    selectAllDrawnMice,
    selectDrawnMouseDefaults
} from "../redux/drawnMouseAnimSlice"
import {
    selectAllAppScenes
} from "../redux/appSceneAnimSlice"
import { selectExtraTracks } from "../redux/projectSlice"
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

const hasIncludedAudio = render =>
    render.config?.includeAudio !== false &&
    (
        selectHasMicrophoneAudio(render.state)
        || selectHasSystemAudio(render.state)
        || hasAudibleTimelineAudio(
            selectAllAudioClips(render.state),
            selectAudioTracks(render.state),
            { requireProjectPath: true }
        )
    )

const buildAudioPlan = render => {
    const videoDetails = selectVideoDetails(render.state)
    const customClips = buildCustomAudioExportClips({
        clips: selectAllAudioClips(render.state),
        tracks: selectAudioTracks(render.state),
        timelineStart: videoDetails.start,
        timelineEnd: videoDetails.end,
    })
    return {
        hasSystemAudio: selectHasSystemAudio(render.state),
        hasMicrophoneAudio: selectHasMicrophoneAudio(render.state),
        timelineStart: videoDetails.start,
        timelineEnd: videoDetails.end,
        clips: selectAllClips(render.state)
            .slice()
            .sort((left, right) => left.start - right.start)
            .map(clip => {
                const { sourceStart, sourceEnd } = getClipSourceRange(clip)
                return {
                    start: clip.start,
                    end: clip.end,
                    sourceStart,
                    sourceEnd,
                    playbackRate: clip.playbackRate ?? 1,
                    systemAudioVolume: clip.systemAudioVolume ?? 1,
                    microphoneAudioVolume: clip.microphoneAudioVolume ?? 1,
                }
            }),
        customClips,
    }
}

const OUTPUT_FORMAT_CLASSES = {
    mp4: Mp4OutputFormat,
    webm: WebMOutputFormat,
}

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
        this.videoOverlayReaders = new Map()
        this.videoOverlayConfigs = []
        this.fhId = null
    }

    async init(screenVideoDimensions, cameraVideoDimensions) {
        postDispatch(setProgress(0))

        const hasCameraVideo = selectHasCameraVideo(this.render.state)
        const rendererDims = selectRendererDims(this.render.state)
        const videoDetails = selectVideoDetails(this.render.state)

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
                pluginDrawnMouse: {
                    defaults: selectDrawnMouseDefaults(this.render.state),
                    entities: selectAllDrawnMice(this.render.state),
                },
                pluginAppScene: {
                    blocks: selectAllAppScenes(this.render.state),
                    trackOrder: (selectExtraTracks(this.render.state) || []).map(t => t.id),
                },
                pluginKeyboardOverlay: {
                    enabled: selectIsPluginFeatureEnabled(PLUGIN_FEATURE_IDS.KEYBOARD_OVERLAY)(this.render.state),
                    defaults: selectKeyboardLayoutDefaults(this.render.state),
                    entities: selectAllKeyboardLayouts(this.render.state),
                    events: selectKeyboardEvents(this.render.state) || [],
                },
            },
            duration)

        const clips = selectAllClips(this.render.state)
        this.timestamps = buildRenderTimelineFrames({
            clips,
            timelineStart: videoDetails.start,
            timelineEnd: videoDetails.end,
            fps: this.render.config.fps,
        }).map(timestamp => ({
            ...timestamp,
            rendererTimestamp: timestamp.sourceTimestamp === null
                ? null
                : Math.round(timestamp.sourceTimestamp),
            sourceTimestamp: timestamp.sourceTimestamp === null
                ? null
                : Math.round(timestamp.sourceTimestamp),
            sceneTimestamp: Math.round(timestamp.timelineTimestamp),
        }))

        this.numberOfFrames = this.timestamps.length

        const mediaTimestamps = this.timestamps.filter(timestamp => !timestamp.isGap)
        if (mediaTimestamps.length > 0) {
            this.readers.screen = new WorkerInputReader(RENDER_SCREEN_VIDEO, { renderId: this.render.id })
            await this.readers.screen.init()
            await this.readers.screen.createSink(mediaTimestamps)

            if (hasCameraVideo) {
                this.readers.camera = new WorkerInputReader(RENDER_CAMERA_VIDEO, { renderId: this.render.id })
                await this.readers.camera.init()
                await this.readers.camera.createSink(mediaTimestamps)
            }
        }

        const videoOverlays = selectAllOverlays(this.render.state).filter(isVideoOverlay)
        for (const config of videoOverlays) {
            if (!config.relativePath) {
                throw new Error(`Video overlay "${config.name || config.id}" is missing its project media path`)
            }

            const sourceTimestamps = createVideoOverlaySourceTimestamps(config, this.timestamps)
            if (sourceTimestamps.length === 0) continue

            const reader = new WorkerInputReader(PROJECT_MEDIA, {
                relativePath: config.relativePath,
            })
            await reader.init()
            await reader.createSink(sourceTimestamps)
            this.videoOverlayReaders.set(config.id, reader)
            this.videoOverlayConfigs.push(config)
        }

        // init sprites scale and dims with first frames
        const firstTimestamp = this.timestamps[0] ?? {
            rendererTimestamp: videoDetails.start,
            sourceTimestamp: videoDetails.start,
            sceneTimestamp: videoDetails.start,
        }
        await Promise.all([
            this.getNewFrame("screen", firstTimestamp),
            this.getNewFrame("camera", firstTimestamp),
            this.getNewVideoOverlayFrames(firstTimestamp),
        ])

        const exportFormat = getExportFormatConfig(this.render.config?.format)
        this.writer = new WorkerOutputWriter(
            RENDER_OUTPUT_VIDEO,
            {
                renderId: this.render.id,
                format: exportFormat.value,
                extension: exportFormat.extension,
            },
            OUTPUT_FORMAT_CLASSES[exportFormat.value],
            exportFormat.videoCodec,
            this.render.config.fps,
            this.render.config.resolution,
            this.render.config.quality
        )

        await this.writer.init()
        await this.writer.start()
    }

    async getNewFrame(type, { sourceTimestamp, rendererTimestamp }) {
        const t = sourceTimestamp ?? rendererTimestamp
        if (t === null || t === undefined) return
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

    async getNewVideoOverlayFrames({ sceneTimestamp, timelineTimestamp, rendererTimestamp }) {
        const editorTime = sceneTimestamp ?? timelineTimestamp ?? rendererTimestamp
        await Promise.all(this.videoOverlayConfigs.map(async config => {
            if (!isVideoOverlayActive(config, editorTime)) return

            const reader = this.videoOverlayReaders.get(config.id)
            const sourceTime = getVideoOverlaySourceTime(config, editorTime)
            const wrappedCanvas = await reader?.getCanvas(sourceTime)
            if (!wrappedCanvas?.canvas) return

            this.scene.overlayAnimator?.setVideoFrame(config.id, wrappedCanvas.canvas)
            wrappedCanvas.canvas = null
        }))
    }

    async renderFrames() {
        let i = 0

        const onProgress = throttle(progress => postDispatch(setProgress(progress)), 1000)

        console.log("rendering frames...")

        for (const timestamp of this.timestamps) {

            if (this.isCanceled) return

            onProgress(Math.max(0, i / this.numberOfFrames * 100))

            await Promise.all([
                this.getNewFrame("screen", timestamp),
                this.getNewFrame("camera", timestamp),
                this.getNewVideoOverlayFrames(timestamp),
            ])

            this.scene.time = timestamp.sceneTimestamp
            this.scene.update()
            this.scene.setPrimaryMediaVisible(!timestamp.isGap)

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
        for (const reader of this.videoOverlayReaders.values()) await reader.close()
        this.videoOverlayReaders.clear()
        console.log("closing video overlay readers done")

        if (hasIncludedAudio(this.render)) {
            console.log("adding audio")
            postDispatch(updateRender({ id: this.render.id, changes: { status: RENDER_PROCESSING_AUDIO } }))
            await postIpc("process-audio", [this.render.id, buildAudioPlan(this.render)])
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
        for (const reader of this.videoOverlayReaders.values()) await reader.close()
        this.videoOverlayReaders.clear()
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
                console.error(error)
                post(self, RENDER_ERROR, { error: error.message })
                renderer.initPromise = null
                await renderer.cancel()
                if (!error.isCaptured && !error.message.includes('CanvasRenderer is not yet implemented')) throw error
                // Init failed (already reported via RENDER_ERROR). Reply with a failed
                // response so the manager's postAsync rejects deterministically instead of
                // resolving with a fake success and racing into START_RENDER.
                if (expectsResponse) post(self, type, null, id, false, true, [], { name: error.name, message: error.message })
                return
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
