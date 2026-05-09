import {
    PauseIcon,
    PlayIcon,
    SpeakerWaveIcon,
    SpeakerXMarkIcon,
    StopIcon
} from "@heroicons/react/20/solid"
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
    shallowEqual,
    useDispatch,
    useSelector
} from "react-redux"
import { useResizeDetector } from "react-resize-detector"
import { MODE_SIDE_BY_SIDE } from "@shared/constants"
import { addErrorToast } from "@shared/errorToastHelper"
import {
    selectRendererDims,
    setRendererDims
} from "@shared/redux/animatorSlice"
import {
    selectAllCameraZooms,
    selectTargetScale as selectCameraZoomTargetScale,
    setCameraZooms
} from "@shared/redux/cameraZoomSlice"
import {
    selectAllClicks,
    setClicks
} from "@shared/redux/clickSlice"
import {
    selectAllClips,
    updateClip
} from "@shared/redux/clipSlice"
import { selectAllFilters } from "@shared/redux/filterSlice"
import { selectAllOverlays } from "@shared/redux/overlaySlice"
import {
    selectBlurStrength as selectCursorBlurStrength,
    selectCutOff,
    selectInertia,
    selectIsLoop,
    selectShowClickRing,
    selectShowSpotlight,
    selectSpotlightFeather,
    selectSpotlightOpacity,
    selectSpotlightRadius
} from "@shared/redux/cursorCoordsSlice"
import {
    selectAllCursorTypes,
    selectIsStatic,
    setCursorTypes
} from "@shared/redux/cursorTypeSlice"
import {
    selectAreCameraZoomAnimEntitiesGenerated,
    selectAreClickAnimEntitiesGenerated,
    selectAreCursorTypeAnimEntitiesGenerated,
    selectAreHotkeysEnabled,
    selectArePanAnimEntitiesGenerated,
    selectAreVideosReady,
    selectAreZoomAnimEntitiesGenerated,
    selectDuration,
    selectIsCleaningUpScene,
    selectIsMuted,
    selectIsPlaying,
    selectIsStopped,
    setAreCameraZoomAnimEntitiesGenerated,
    setAreClickAnimEntitiesGenerated,
    setAreCursorTypeAnimEntitiesGenerated,
    setArePanAnimEntitiesGenerated,
    setAreZoomAnimEntitiesGenerated,
    setIsInitialized,
    setIsMuted,
    setIsPlaying,
    setIsStopped
} from "@shared/redux/editorSlice"
import {
    selectAllMasks
} from "@shared/redux/maskSlice"
import {
    selectAllPans,
    setPans
} from "@shared/redux/panSlice"
import {
    selectAspectRatio,
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
    selectId,
    selectIsCameraVideoMirrored,
    selectLeftTrim,
    selectKeyboardEvents,
    selectMouseEvents,
    selectPadding,
    selectRightTrim,
    selectShadowAlpha,
    selectTopTrim,
    selectVideoDetails
} from "@shared/redux/projectSlice"
import {
    selectAllSubtitles,
    selectBackgroundColor,
    selectPosition,
    selectShadowAlpha as selectSubtitleShadowAlpha,
    selectTextColor,
    selectTotalSubtitles,
    selectTranscript,
    selectWidth,
    setSubtitles
} from "@shared/redux/subtitleSlice"
import { selectAllSpatials } from "@shared/redux/spatialSlice"
import { selectTime } from "@shared/redux/timelineSlice"
import {
    selectAllZooms,
    selectIntro,
    selectOutro,
    selectBlurStrength as selectZoomBlurStrength,
    selectTargetScale as selectZoomTargetScale,
    setZooms
} from "@shared/redux/zoomSlice"
import {
    FEATURE_IDS as PLUGIN_FEATURE_IDS,
    selectFeatureConfig as selectPluginFeatureConfig,
    selectIsFeatureEnabled as selectIsPluginFeatureEnabled
} from "@shared/redux/pluginSlice"
import CameraZoomConfig from "@shared/scene/cameraZoom/CameraZoomConfig"
import ClickConfig from "@shared/scene/click/ClickConfig"
import CursorTypeConfig from "@shared/scene/cursorType/CursorTypeConfig"
import PanConfig from "@shared/scene/pan/PanConfig"
import SubtitleConfig from "@shared/scene/subtitle/SubtitleConfig"
import ZoomConfig from "@shared/scene/zoom/ZoomConfig"
import PreviewWorkerManager from "@shared/workers/PreviewWorkerManager"
import AspectRatioDropdown from "./AspectRatioDropdown"
import OverlayCanvas from "./OverlayCanvas"
import VideoWrapper from "./VideoWrapper"

export default function Preview() {

    const dispatch = useDispatch()

    // TODO: masks can also be used to highlight information. just draw a border. easy to do!

    const mouseEvents = useSelector(selectMouseEvents)
    const hasMicrophoneAudio = useSelector(selectHasMicrophoneAudio)
    const hasSystemAudio = useSelector(selectHasSystemAudio)
    const totalSubtitles = useSelector(selectTotalSubtitles)
    const background = useSelector(selectBackground)
    const videoDetails = useSelector(selectVideoDetails, shallowEqual)
    const duration = useSelector(selectDuration)
    const transcript = useSelector(selectTranscript)
    const aspectRatio = useSelector(selectAspectRatio)
    const inertia = useSelector(selectInertia)
    const areZoomAnimsGenerated = useSelector(selectAreZoomAnimEntitiesGenerated)
    const arePanAnimsGenerated = useSelector(selectArePanAnimEntitiesGenerated)
    const areCameraZoomAnimsGenerated = useSelector(selectAreCameraZoomAnimEntitiesGenerated)
    const areCursorTypeAnimsGenerated = useSelector(selectAreCursorTypeAnimEntitiesGenerated)
    const areClickAnimsGenerated = useSelector(selectAreClickAnimEntitiesGenerated)
    const clipAnims = useSelector(selectAllClips)

    const isPlaying = useSelector(selectIsPlaying)
    const isStopped = useSelector(selectIsStopped)
    const time = useSelector(selectTime)
    const areVideosReady = useSelector(selectAreVideosReady)
    const isMuted = useSelector(selectIsMuted)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)

    const cameraZooms = useSelector(selectAllCameraZooms)
    const rendererDims = useSelector(selectRendererDims)
    const cursorTypeAnims = useSelector(selectAllCursorTypes)
    const isCursorStatic = useSelector(selectIsStatic)

    const subtitleAnims = useSelector(selectAllSubtitles)
    const subtitleBackgroundColor = useSelector(selectBackgroundColor)
    const subtitleTextColor = useSelector(selectTextColor)
    const subtitleWidth = useSelector(selectWidth)
    const subtitleShadowAlpha = useSelector(selectSubtitleShadowAlpha)
    const subtitlePosition = useSelector(selectPosition)

    const spatials = useSelector(selectAllSpatials)
    const zooms = useSelector(selectAllZooms)
    const leftTrim = useSelector(selectLeftTrim)
    const rightTrim = useSelector(selectRightTrim)
    const topTrim = useSelector(selectTopTrim)
    const bottomTrim = useSelector(selectBottomTrim)
    const pans = useSelector(selectAllPans)
    const cursorBlurStrength = useSelector(selectCursorBlurStrength)
    const cursorRotationStrength = useSelector(selectCursorMovementRotation)
    const cursorCutOff = useSelector(selectCutOff)
    const cursorIsLoop = useSelector(selectIsLoop)
    const clickAnims = useSelector(selectAllClicks)
    const showClickRing = useSelector(selectShowClickRing)
    const showSpotlight = useSelector(selectShowSpotlight)
    const spotlightRadius = useSelector(selectSpotlightRadius)
    const spotlightOpacity = useSelector(selectSpotlightOpacity)
    const spotlightFeather = useSelector(selectSpotlightFeather)
    const cursorScale = useSelector(selectCursorScale)
    const hasCameraVideo = useSelector(selectHasCameraVideo)
    const padding = useSelector(selectPadding)
    const cursorShadowAlpha = useSelector(selectCursorShadowAlpha)
    const borderRadius = useSelector(selectBorderRadius)
    const cursorStroke = useSelector(selectCursorStroke)
    const cursorFill = useSelector(selectCursorFill)
    const projectShadowAlpha = useSelector(selectShadowAlpha)
    const cameraVideoShadowAlpha = useSelector(selectCameraVideoShadowAlpha)
    const hasCameraVideoBackgroundBlur = useSelector(selectHasCameraVideoBackgroundBlur)
    const cameraVideoBackgroundBlurAmount = useSelector(selectCameraVideoBackgroundBlurAmount)
    const isCameraVideoMirrored = useSelector(selectIsCameraVideoMirrored)
    const isCleaningUpScene = useSelector(selectIsCleaningUpScene)
    const intro = useSelector(selectIntro)
    const outro = useSelector(selectOutro)
    const zoomTargetScale = useSelector(selectZoomTargetScale)
    const cameraZoomTargetScale = useSelector(selectCameraZoomTargetScale)
    const zoomBlurStrength = useSelector(selectZoomBlurStrength)

    const id = useSelector(selectId)

    const maskAnims = useSelector(selectAllMasks)
    const overlayAnims = useSelector(selectAllOverlays)
    const filterAnims = useSelector(selectAllFilters)

    const isMouseStyleEnabled = useSelector(selectIsPluginFeatureEnabled(PLUGIN_FEATURE_IDS.MOUSE_STYLE))
    const mouseStyleConfig = useSelector(selectPluginFeatureConfig(PLUGIN_FEATURE_IDS.MOUSE_STYLE), shallowEqual)
    const isKeyboardOverlayEnabled = useSelector(selectIsPluginFeatureEnabled(PLUGIN_FEATURE_IDS.KEYBOARD_OVERLAY))
    const keyboardOverlayConfig = useSelector(selectPluginFeatureConfig(PLUGIN_FEATURE_IDS.KEYBOARD_OVERLAY), shallowEqual)
    const keyboardEvents = useSelector(selectKeyboardEvents)

    const [manager, setManager] = useState(null)

    const isPlayable = useMemo(
        () => videoDetails && time < videoDetails.end,
        [videoDetails, time])

    const canvasRef = useRef(null)
    const screenVideoRef = useRef(null)
    const cameraVideoRef = useRef(null)
    const hasManagerRef = useRef(false)

    const [canvasRect, setCanvasRect] = useState(null)

    const { width: wrapperWidth, height: wrapperHeight, ref } = useResizeDetector()

    const createManager = useCallback(async () => {
        console.log("[Preview] createManager start", { duration, hasCameraVideo, projectId: id })
        let phase = "construct preview worker manager"
        try {
            const manager = new PreviewWorkerManager(screenVideoRef.current, cameraVideoRef.current)
            console.log("[Preview] awaiting manager.init()")
            phase = "initialize preview worker manager"
            await manager.init(
                canvasRef.current,
                duration,
                { cursorFill, cursorStroke, mouseEvents, hasCameraVideo, projectId: id })
            console.log("[Preview] manager.init() resolved")

            setManager(manager)
            dispatch(setIsInitialized(true))
        } catch (e) {
            e.message = `${e?.message || String(e)} (during ${phase})`
            console.error("[Preview] createManager failed:", e?.stack || e?.message || String(e))
            dispatch(addErrorToast("Failed to initialize preview: " + (e?.message || String(e))))
            // Allow re-entry so a retry (project reopen) can run createManager again.
            hasManagerRef.current = false
        }

    }, [cursorFill, cursorStroke, dispatch, duration, hasCameraVideo, id, mouseEvents])

    const onPlay = useCallback(() => {
        dispatch(setIsStopped(false))
        dispatch(setIsPlaying(true))
    }, [dispatch])

    const onPause = useCallback(
        () => dispatch(setIsPlaying(false)),
        [dispatch]
    )

    const onStop = useCallback(() => {
        dispatch(setIsStopped(true))
        dispatch(setIsPlaying(false))
    }, [dispatch])

    const onToggleSound = useCallback(() => {
        dispatch(setIsMuted(!isMuted))
    }, [dispatch, isMuted])

    useHotkeys('space', () => {
        if (isPlaying) onPause()
        else if (isPlayable) onPlay()
    },
        { enabled: areHotkeysEnabled },
        [isPlaying, isPlayable, areHotkeysEnabled])

    useEffect(() => {
        if (!manager && !hasManagerRef.current && areVideosReady && duration && mouseEvents) {
            hasManagerRef.current = true
            createManager()
        }
    }, [createManager, manager, areVideosReady, duration, mouseEvents])

    useEffect(() => {
        return () => {
            if (manager) manager.terminate()
        }
    }, [manager])

    useEffect(() => {
        const getDims = (aspectWidth, aspectHeight, maxRendererWidth, maxRendererHeight) => {
            let css
            if (wrapperWidth / wrapperHeight > aspectWidth / aspectHeight)
                css = {
                    x: Math.floor(wrapperHeight / aspectHeight * aspectWidth),
                    y: Math.floor(wrapperHeight)
                }
            else
                css = {
                    x: Math.floor(wrapperWidth),
                    y: Math.floor(wrapperWidth / aspectWidth * aspectHeight)
                }
            return {
                css,
                renderer: {
                    x: Math.min(Math.floor(css.x * window.devicePixelRatio), maxRendererWidth),
                    y: Math.min(Math.floor(css.y * window.devicePixelRatio), maxRendererHeight)
                }
            }
        }
        if (wrapperWidth && wrapperHeight) {
            let dims
            switch (aspectRatio) {
                case "16x9":
                    dims = getDims(16, 9, 1280, 720)
                    break
                case "9x16":
                    dims = getDims(9, 16, 405, 720)
                    break
                case "1x1":
                    dims = getDims(1, 1, 720, 720)
                    break
                default:
                    dims = getDims(16, 9, 1280, 720)
                    break
            }
            canvasRef.current.style.width = `${dims.css.x}px`
            canvasRef.current.style.height = `${dims.css.y}px`
            dispatch(setRendererDims(dims.renderer))
            // Update overlay canvas rect after layout settles
            requestAnimationFrame(() => {
                if (canvasRef.current) {
                    const parent = canvasRef.current.parentElement
                    if (parent) {
                        const parentRect = parent.getBoundingClientRect()
                        const cRect = canvasRef.current.getBoundingClientRect()
                        setCanvasRect({
                            left: cRect.left - parentRect.left,
                            top: cRect.top - parentRect.top,
                            width: cRect.width,
                            height: cRect.height,
                        })
                    }
                }
            })
        }
    }, [aspectRatio, dispatch, wrapperWidth, wrapperHeight])

    useEffect(() => {
        manager?.postTime(time)
    }, [time, manager])

    // handles creation of zoom, pan and camera zoom anim configs
    useEffect(() => {
        if (mouseEvents && videoDetails && !areZoomAnimsGenerated && !arePanAnimsGenerated &&
            !areCameraZoomAnimsGenerated) {
            dispatch(setZooms(
                ZoomConfig.createBulk(mouseEvents, videoDetails, intro, outro, zoomTargetScale, zoomBlurStrength)))
            dispatch(setAreZoomAnimEntitiesGenerated(true))
            dispatch(setPans(
                PanConfig.createBulk(mouseEvents, videoDetails, intro, outro, zoomTargetScale)))
            dispatch(setArePanAnimEntitiesGenerated(true))
            dispatch(setCameraZooms(
                CameraZoomConfig.createBulk(mouseEvents, videoDetails, intro, outro, cameraZoomTargetScale)))
            dispatch(setAreCameraZoomAnimEntitiesGenerated(true))
        }
    }, [areCameraZoomAnimsGenerated, arePanAnimsGenerated, areZoomAnimsGenerated, dispatch, mouseEvents, videoDetails,
        intro, outro, zoomTargetScale, zoomBlurStrength, cameraZoomTargetScale])

    // handles init and update of cursor type anim configs
    useEffect(() => {
        if (mouseEvents && videoDetails && !areCursorTypeAnimsGenerated) {
            dispatch(setCursorTypes(CursorTypeConfig.createBulk(mouseEvents, videoDetails)))
            dispatch(setAreCursorTypeAnimEntitiesGenerated(true))
        }
    }, [areCursorTypeAnimsGenerated, dispatch, mouseEvents, videoDetails])

    // handles init and update of click anim configs
    useEffect(() => {
        if (mouseEvents && !areClickAnimsGenerated && mouseEvents) {
            dispatch(setClicks(ClickConfig.createBulk(mouseEvents)))
            dispatch(setAreClickAnimEntitiesGenerated(true))
        }
    }, [areClickAnimsGenerated, dispatch, mouseEvents])

    useEffect(() => {
        if (manager && transcript && totalSubtitles === 0)
            dispatch(setSubtitles(SubtitleConfig.createBulk(transcript)))
    }, [transcript, manager, totalSubtitles, dispatch])

    useEffect(() => {

        const updateCameraPosition = (clip, cameraPosition) => {
            dispatch(updateClip({
                id: clip.id,
                changes: { layout: { mode: MODE_SIDE_BY_SIDE, config: { ...clip.layout.config, cameraPosition } } }
            }))
        }

        clipAnims.forEach(clip => {
            const { layout } = clip
            if (layout.mode === MODE_SIDE_BY_SIDE) {
                if (aspectRatio === "16x9") {
                    if (layout.config.cameraPosition === "top") updateCameraPosition(clip, "left")
                    else if (layout.config.cameraPosition === "bottom") updateCameraPosition(clip, "right")
                } else if (aspectRatio === "9x16") {
                    if (layout.config.cameraPosition === "left") updateCameraPosition(clip, "top")
                    else if (layout.config.cameraPosition === "right") updateCameraPosition(clip, "bottom")
                }
            }
        })
    }, [aspectRatio, clipAnims, dispatch])

    useEffect(() => {
        manager?.postUpdate({ type: 'project.cursorShadowAlpha', payload: cursorShadowAlpha })
    }, [manager, cursorShadowAlpha])

    useEffect(() => {
        manager?.postUpdate({ type: 'project.background', payload: background })
    }, [manager, background])

    useEffect(() => {
        manager?.postUpdate({ type: 'cursorTypeAnims.isStatic', payload: isCursorStatic })
    }, [manager, isCursorStatic])

    useEffect(() => {
        manager?.postUpdate({ type: 'project.videoDetails', payload: videoDetails })
    }, [manager, videoDetails])

    useEffect(() => {
        manager?.postUpdate({ type: 'subtitleAnims.backgroundColor', payload: subtitleBackgroundColor })
    }, [manager, subtitleBackgroundColor])

    useEffect(() => {
        manager?.postUpdate({ type: 'subtitleAnims.textColor', payload: subtitleTextColor })
    }, [manager, subtitleTextColor])

    useEffect(() => {
        manager?.postUpdate({ type: 'subtitleAnims.width', payload: subtitleWidth })
    }, [manager, subtitleWidth])

    useEffect(() => {
        manager?.postUpdate({ type: 'subtitleAnims.shadowAlpha', payload: subtitleShadowAlpha })
    }, [manager, subtitleShadowAlpha])

    useEffect(() => {
        manager?.postUpdate({ type: 'subtitleAnims.position', payload: subtitlePosition })
    }, [manager, subtitlePosition])

    useEffect(() => {
        manager?.postUpdate({ type: 'animator.rendererDims', payload: rendererDims })
    }, [manager, rendererDims])

    useEffect(() => {
        manager?.postUpdate({ type: 'project.leftTrim', payload: leftTrim })
    }, [manager, leftTrim])

    useEffect(() => {
        manager?.postUpdate({ type: 'project.rightTrim', payload: rightTrim })
    }, [manager, rightTrim])

    useEffect(() => {
        manager?.postUpdate({ type: 'project.topTrim', payload: topTrim })
    }, [manager, topTrim])

    useEffect(() => {
        manager?.postUpdate({ type: 'project.bottomTrim', payload: bottomTrim })
    }, [manager, bottomTrim])

    useEffect(() => {
        manager?.postUpdate({ type: 'project.borderRadius', payload: borderRadius })
    }, [manager, borderRadius])

    useEffect(() => {
        manager?.postUpdate({ type: 'cursorCoords.cutOff', payload: cursorCutOff })
    }, [manager, cursorCutOff])

    useEffect(() => {
        manager?.postUpdate({ type: 'cursorCoords.isLoop', payload: cursorIsLoop })
    }, [manager, cursorIsLoop])

    useEffect(() => {
        manager?.postUpdate({ type: 'cursorCoords.blurStrength', payload: cursorBlurStrength })
    }, [manager, cursorBlurStrength])

    useEffect(() => {
        manager?.postUpdate({ type: 'cursorCoords.showClickRing', payload: showClickRing })
    }, [manager, showClickRing])

    useEffect(() => {
        manager?.postUpdate({ type: 'cursorCoords.showSpotlight', payload: showSpotlight })
    }, [manager, showSpotlight])

    useEffect(() => {
        manager?.postUpdate({ type: 'cursorCoords.spotlightRadius', payload: spotlightRadius })
    }, [manager, spotlightRadius])

    useEffect(() => {
        manager?.postUpdate({ type: 'cursorCoords.spotlightOpacity', payload: spotlightOpacity })
    }, [manager, spotlightOpacity])

    useEffect(() => {
        manager?.postUpdate({ type: 'cursorCoords.spotlightFeather', payload: spotlightFeather })
    }, [manager, spotlightFeather])

    useEffect(() => {
        manager?.postUpdate({ type: 'project.cursorMovementRotation', payload: cursorRotationStrength })
    }, [manager, cursorRotationStrength])

    useEffect(() => {
        manager?.postUpdate({ type: 'project.cursorScale', payload: cursorScale })
    }, [manager, cursorScale])

    useEffect(() => {
        manager?.postUpdate({ type: 'project.padding', payload: padding })
    }, [manager, padding])

    useEffect(() => {
        manager?.postUpdate({ type: 'project.cursorStroke', payload: cursorStroke })
    }, [manager, cursorStroke])

    useEffect(() => {
        manager?.postUpdate({ type: 'project.cursorFill', payload: cursorFill })
    }, [manager, cursorFill])

    useEffect(() => {
        manager?.postUpdate({ type: 'project.shadowAlpha', payload: projectShadowAlpha })
    }, [manager, projectShadowAlpha])

    useEffect(() => {
        if (hasCameraVideo)
            manager?.postUpdate({ type: 'project.cameraVideoShadowAlpha', payload: cameraVideoShadowAlpha })
    }, [manager, hasCameraVideo, cameraVideoShadowAlpha])

    useEffect(() => {
        if (hasCameraVideo)
            manager?.postUpdate({ type: 'project.hasCameraVideoBackgroundBlur', payload: hasCameraVideoBackgroundBlur })
    }, [manager, hasCameraVideo, hasCameraVideoBackgroundBlur])

    useEffect(() => {
        if (hasCameraVideo)
            manager?.postUpdate({ type: 'project.cameraVideoBackgroundBlurAmount', payload: cameraVideoBackgroundBlurAmount })
    }, [manager, hasCameraVideo, cameraVideoBackgroundBlurAmount])

    useEffect(() => {
        if (hasCameraVideo)
            manager?.postUpdate({ type: 'project.isCameraVideoMirrored', payload: isCameraVideoMirrored })
    }, [manager, hasCameraVideo, isCameraVideoMirrored])

    useEffect(() => {
        if (hasCameraVideo) manager?.postUpdate({ type: 'cameraZoomAnims', payload: cameraZooms })
    }, [manager, hasCameraVideo, cameraZooms])

    useEffect(() => {
        manager?.postUpdate({ type: 'cursorTypeAnims', payload: cursorTypeAnims })
    }, [manager, cursorTypeAnims])

    useEffect(() => {
        manager?.postUpdate({ type: 'subtitleAnims', payload: subtitleAnims })
    }, [manager, subtitleAnims])

    useEffect(() => {
        manager?.postUpdate({ type: 'zoomAnims', payload: zooms })
    }, [manager, zooms])

    useEffect(() => {
        manager?.postUpdate({ type: 'panAnims', payload: pans })
    }, [manager, pans])

    useEffect(() => {
        manager?.postUpdate({ type: 'clickAnims', payload: clickAnims })
    }, [manager, clickAnims])

    useEffect(() => {
        manager?.postUpdate({ type: 'clipAnims', payload: clipAnims })
    }, [manager, clipAnims])

    useEffect(() => {
        manager?.postUpdate({ type: 'maskAnims', payload: maskAnims })
    }, [manager, maskAnims])

    useEffect(() => {
        manager?.postUpdate({ type: 'overlayAnims', payload: overlayAnims })
    }, [manager, overlayAnims])

    useEffect(() => {
        manager?.postUpdate({ type: 'filterAnims', payload: filterAnims })
    }, [manager, filterAnims])

    useEffect(() => {
        manager?.postUpdate({ type: 'spatialAnims', payload: spatials })
    }, [manager, spatials])

    useEffect(() => {
        manager?.postUpdate({ type: 'cursorCoords.inertia', payload: inertia })
    }, [manager, inertia])

    useEffect(() => {
        manager?.postUpdate({
            type: 'plugin.mouseStyle',
            payload: { enabled: isMouseStyleEnabled, ...mouseStyleConfig }
        })
    }, [manager, isMouseStyleEnabled, mouseStyleConfig])

    useEffect(() => {
        manager?.postUpdate({ type: 'plugin.keyboardOverlay.enabled', payload: isKeyboardOverlayEnabled })
    }, [manager, isKeyboardOverlayEnabled])

    useEffect(() => {
        manager?.postUpdate({ type: 'plugin.keyboardOverlay.config', payload: keyboardOverlayConfig })
    }, [manager, keyboardOverlayConfig])

    useEffect(() => {
        manager?.postUpdate({ type: 'plugin.keyboardOverlay.events', payload: keyboardEvents || [] })
    }, [manager, keyboardEvents])

    useEffect(() => {
        if (isCleaningUpScene) manager?.postUpdate({ type: 'isCleaningUpScene', payload: isCleaningUpScene })
    }, [manager, isCleaningUpScene])

    useEffect(() => {
        manager?.postIsPlaying(isPlaying)
    }, [manager, isPlaying])

    return (
        <div className="flowtake-preview flex-1 min-w-[320px] min-h-0 flex flex-col relative">
            <div className="flowtake-preview__chrome h-10 shrink-0 flex items-center justify-center">
                <div className="flowtake-preview__toolbar inline-flex items-center gap-2 px-2 py-1 rounded-full bg-base-100/90">
                    <AspectRatioDropdown />
                </div>
            </div>
            <div ref={ref} data-drop-zone="preview" className="flowtake-preview__stage flex-1 min-h-0 flex items-center justify-center relative group px-4 py-3">
                <canvas ref={canvasRef} className="flowtake-preview__canvas rounded-xl overflow-hidden cursor-none bg-black" />
                <OverlayCanvas canvasRect={canvasRect} />
            </div>
            <div className="flowtake-preview__controls h-12 shrink-0 flex items-center justify-center gap-2">
                <div className="join shadow-sm">
                    {!isPlaying && <button onClick={onPlay} disabled={!videoDetails || time >= videoDetails.end}
                        className="btn btn-sm join-item">
                        <PlayIcon className="h-5 w-5" />
                    </button>}
                    {isPlaying && <button onClick={onPause} className="btn btn-sm join-item">
                        <PauseIcon className="h-5 w-5" />
                    </button>}
                    <button onClick={onStop} disabled={isStopped} className="btn btn-sm join-item">
                        <StopIcon className="h-5 w-5" />
                    </button>
                </div>
                {(hasMicrophoneAudio || hasSystemAudio) &&
                    <button onClick={onToggleSound}
                        className={`btn btn-sm swap swap-flip shadow-sm ${isMuted ? "swap-active" : ""}`}>
                        <SpeakerXMarkIcon className="size-4 swap-on" />
                        <SpeakerWaveIcon className="size-4 swap-off" />
                    </button>}
            </div>
            <VideoWrapper screenVideoRef={screenVideoRef} cameraVideoRef={cameraVideoRef} />
        </div>
    )
}
