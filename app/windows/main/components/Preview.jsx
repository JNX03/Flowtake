import {
    PauseIcon,
    PencilSquareIcon,
    PlayIcon,
    SpeakerWaveIcon,
    SpeakerXMarkIcon,
    StopIcon
} from "@heroicons/react/20/solid"
import {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react"
import PropTypes from "prop-types"
import { useHotkeys } from "react-hotkeys-hook"
import {
    shallowEqual,
    useDispatch,
    useSelector,
    useStore
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
    selectExtraTracks,
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
    selectIsDrawMouseModeActive,
    selectIsFeatureEnabled as selectIsPluginFeatureEnabled,
    setIsDrawMouseModeActive
} from "@shared/redux/pluginSlice"
import { addDrawnMouse } from "@shared/redux/drawnMouseAnimSlice"
import {
    selectAllKeyboardLayouts,
    selectKeyboardLayoutDefaults
} from "@shared/redux/keyboardLayoutSlice"
import {
    selectAllMouseStyles,
    selectMouseStyleDefaults
} from "@shared/redux/mouseStyleAnimSlice"
import {
    selectAllDrawnMice,
    selectDrawnMouseDefaults
} from "@shared/redux/drawnMouseAnimSlice"
import {
    selectAllAppScenes
} from "@shared/redux/appSceneAnimSlice"
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

function PreviewClockBridge({ manager, screenVideoRef }) {
    const time = useSelector(selectTime)
    const isPlaying = useSelector(selectIsPlaying)
    const fallbackTimeRef = useRef(time)

    useEffect(() => {
        fallbackTimeRef.current = time
        if (!isPlaying) manager?.postTime(time)
    }, [isPlaying, manager, time])

    useEffect(() => {
        if (!manager || !isPlaying) return

        let animationFrame = null
        const publishPlaybackTime = () => {
            const currentTime = screenVideoRef.current?.currentTime
            manager.postTime(
                Number.isFinite(currentTime)
                    ? currentTime * 1000
                    : fallbackTimeRef.current
            )
            animationFrame = requestAnimationFrame(publishPlaybackTime)
        }

        publishPlaybackTime()
        return () => {
            if (animationFrame !== null) cancelAnimationFrame(animationFrame)
        }
    }, [isPlaying, manager, screenVideoRef])

    return null
}

PreviewClockBridge.propTypes = {
    manager: PropTypes.instanceOf(PreviewWorkerManager),
    screenVideoRef: PropTypes.object.isRequired,
}

export default function Preview() {

    const dispatch = useDispatch()
    const reduxStore = useStore()

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
    const mouseStyleDefaults = useSelector(selectMouseStyleDefaults, shallowEqual)
    const mouseStyleEntities = useSelector(selectAllMouseStyles, shallowEqual)
    const drawnMouseDefaults = useSelector(selectDrawnMouseDefaults, shallowEqual)
    const drawnMouseEntities = useSelector(selectAllDrawnMice, shallowEqual)
    const isDrawMouseModeActive = useSelector(selectIsDrawMouseModeActive)
    const isKeyboardOverlayEnabled = useSelector(selectIsPluginFeatureEnabled(PLUGIN_FEATURE_IDS.KEYBOARD_OVERLAY))
    const keyboardEvents = useSelector(selectKeyboardEvents)
    const keyboardLayoutEntities = useSelector(selectAllKeyboardLayouts, shallowEqual)
    const keyboardLayoutDefaults = useSelector(selectKeyboardLayoutDefaults, shallowEqual)
    const extraTracks = useSelector(selectExtraTracks)
    const appRecordingConfig = useSelector(selectPluginFeatureConfig(PLUGIN_FEATURE_IDS.APP_RECORDING), shallowEqual)
    const appScenes = useSelector(selectAllAppScenes, shallowEqual)

    const [manager, setManager] = useState(null)
    const isPlayable = useSelector(state => (
        Number.isFinite(videoDetails?.end) && selectTime(state) < videoDetails.end
    ))

    const canvasRef = useRef(null)
    const screenVideoRef = useRef(null)
    const cameraVideoRef = useRef(null)
    const extraVideoRefs = useRef([])
    const registeredExtrasRef = useRef(new Set())
    const hasManagerRef = useRef(false)
    const activeManagerRef = useRef(null)
    const isPreviewMountedRef = useRef(true)
    const rendererDimsRef = useRef(rendererDims)

    const [canvasRect, setCanvasRect] = useState(null)

    const { width: wrapperWidth, height: wrapperHeight, ref } = useResizeDetector()

    useEffect(() => {
        rendererDimsRef.current = rendererDims
    }, [rendererDims])

    useEffect(() => {
        isPreviewMountedRef.current = true
        return () => {
            isPreviewMountedRef.current = false
            activeManagerRef.current?.terminate()
            activeManagerRef.current = null
        }
    }, [])

    const createManager = useCallback(async () => {
        console.log("[Preview] createManager start", { duration, hasCameraVideo, projectId: id })
        let phase = "construct preview worker manager"
        let candidate = null
        try {
            candidate = new PreviewWorkerManager(screenVideoRef.current, cameraVideoRef.current)
            activeManagerRef.current = candidate
            console.log("[Preview] awaiting manager.init()")
            phase = "initialize preview worker manager"
            await candidate.init(
                canvasRef.current,
                duration,
                { cursorFill, cursorStroke, mouseEvents, hasCameraVideo, projectId: id })
            console.log("[Preview] manager.init() resolved")

            if (!isPreviewMountedRef.current) {
                candidate.terminate()
                if (activeManagerRef.current === candidate) activeManagerRef.current = null
                return
            }

            setManager(candidate)
            dispatch(setIsInitialized(true))
        } catch (error) {
            candidate?.terminate()
            if (activeManagerRef.current === candidate) activeManagerRef.current = null
            if (!isPreviewMountedRef.current) return

            const message = `${error?.message || String(error)} (during ${phase})`
            console.error("[Preview] createManager failed:", error?.stack || message)
            dispatch(addErrorToast("Failed to initialize preview: " + message))
            // The canvas may already have been transferred off-thread. Reopening
            // the project remounts Preview with a fresh canvas and retries safely.
            hasManagerRef.current = true
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
        [isPlaying, isPlayable, areHotkeysEnabled, onPause, onPlay])

    useEffect(() => {
        if (!manager && !hasManagerRef.current && areVideosReady && duration && mouseEvents) {
            hasManagerRef.current = true
            createManager()
        }
    }, [createManager, manager, areVideosReady, duration, mouseEvents])

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
        let resizeTimer = null
        let rectFrame = null

        if (wrapperWidth && wrapperHeight && canvasRef.current) {
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

            const currentRendererDims = rendererDimsRef.current
            const rendererChanged = !currentRendererDims
                || currentRendererDims.x !== dims.renderer.x
                || currentRendererDims.y !== dims.renderer.y

            if (rendererChanged) {
                const commitResize = () => {
                    rendererDimsRef.current = dims.renderer
                    dispatch(setRendererDims(dims.renderer))
                }

                // The first size is needed for initialization. Later resizes are
                // debounced so dragging panels does not repeatedly reallocate GPU buffers.
                if (!currentRendererDims?.x || !currentRendererDims?.y) commitResize()
                else resizeTimer = window.setTimeout(commitResize, 120)
            }

            // Update overlay canvas rect after layout settles
            rectFrame = requestAnimationFrame(() => {
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

        return () => {
            if (resizeTimer) window.clearTimeout(resizeTimer)
            if (rectFrame) cancelAnimationFrame(rectFrame)
        }
    }, [aspectRatio, dispatch, wrapperWidth, wrapperHeight])

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
        manager?.postUpdate({ type: 'plugin.mouseStyle.enabled', payload: isMouseStyleEnabled })
    }, [manager, isMouseStyleEnabled])

    useEffect(() => {
        manager?.postUpdate({ type: 'plugin.mouseStyle.defaults', payload: mouseStyleDefaults })
    }, [manager, mouseStyleDefaults])

    useEffect(() => {
        manager?.postUpdate({ type: 'plugin.mouseStyle.entities', payload: mouseStyleEntities })
    }, [manager, mouseStyleEntities])

    useEffect(() => {
        manager?.postUpdate({ type: 'plugin.drawnMouse.defaults', payload: drawnMouseDefaults })
    }, [manager, drawnMouseDefaults])

    useEffect(() => {
        manager?.postUpdate({ type: 'plugin.drawnMouse.entities', payload: drawnMouseEntities })
    }, [manager, drawnMouseEntities])

    useEffect(() => {
        manager?.postUpdate({ type: 'plugin.keyboardOverlay.enabled', payload: isKeyboardOverlayEnabled })
    }, [manager, isKeyboardOverlayEnabled])

    useEffect(() => {
        manager?.postUpdate({ type: 'plugin.keyboardOverlay.events', payload: keyboardEvents || [] })
    }, [manager, keyboardEvents])

    useEffect(() => {
        manager?.postUpdate({ type: 'plugin.keyboardLayout.defaults', payload: keyboardLayoutDefaults })
    }, [manager, keyboardLayoutDefaults])

    useEffect(() => {
        manager?.postUpdate({ type: 'plugin.keyboardLayout.entities', payload: keyboardLayoutEntities })
    }, [manager, keyboardLayoutEntities])

    // Register extra-app videos with the worker once their <video> elements are ready.
    // Polls briefly because Media's onReady fires asynchronously after src is set.
    useEffect(() => {
        if (!manager || !Array.isArray(extraTracks) || extraTracks.length === 0) return
        let cancelled = false
        const tryRegister = () => {
            if (cancelled) return
            extraTracks.forEach((track, i) => {
                if (registeredExtrasRef.current.has(i)) return
                const el = extraVideoRefs.current[i]
                if (el && el.readyState >= HTMLMediaElement.HAVE_METADATA) {
                    manager.registerExtraVideo(i, el, { x: track.width || el.videoWidth, y: track.height || el.videoHeight })
                    registeredExtrasRef.current.add(i)
                }
            })
            if (registeredExtrasRef.current.size < extraTracks.length) {
                setTimeout(tryRegister, 200)
            }
        }
        tryRegister()
        return () => { cancelled = true }
    }, [manager, extraTracks])

    // Sync visibility toggles from the Sources panel into the Pixi PiPs.
    useEffect(() => {
        if (!manager || !Array.isArray(extraTracks)) return
        const hidden = new Set(appRecordingConfig?.hiddenTrackIds || [])
        extraTracks.forEach((track, i) => {
            manager.setExtraVisibility(i, !hidden.has(track.id))
        })
    }, [manager, extraTracks, appRecordingConfig])

    // Push the active scene-block list + track ordering into the worker so the
    // Pixi compositor can resolve which app is "main" + where the others sit.
    useEffect(() => {
        if (!manager) return
        const trackOrder = (extraTracks || []).map(t => t.id)
        manager.postUpdate({
            type: 'plugin.appScene.blocks',
            payload: { blocks: appScenes, trackOrder }
        })
    }, [manager, appScenes, extraTracks])

    useEffect(() => {
        if (isCleaningUpScene) manager?.postUpdate({ type: 'isCleaningUpScene', payload: isCleaningUpScene })
    }, [manager, isCleaningUpScene])

    useEffect(() => {
        manager?.postIsPlaying(isPlaying)
    }, [manager, isPlaying])

    // Draw-mouse: capture freehand pointer drags on the preview canvas while
    // arming is active, then emit a new drawn-mouse segment at the playhead.
    // Points are stored in renderer-pixel space (matches the Pixi app.stage
    // coord system the DrawnMouseAnimator draws in).
    useEffect(() => {
        if (!isDrawMouseModeActive) return
        const canvas = canvasRef.current
        if (!canvas || !rendererDims) return

        let drawing = false
        let startWallTime = 0
        let points = []
        let pointerId = null

        const toRendererCoords = (e) => {
            const rect = canvas.getBoundingClientRect()
            if (!rect.width || !rect.height) return { x: 0, y: 0 }
            return {
                x: (e.clientX - rect.left) * (rendererDims.x / rect.width),
                y: (e.clientY - rect.top) * (rendererDims.y / rect.height),
            }
        }

        const onDown = (e) => {
            if (e.button !== 0) return
            drawing = true
            pointerId = e.pointerId
            startWallTime = performance.now()
            points = []
            const p = toRendererCoords(e)
            points.push({ x: p.x, y: p.y, t: 0 })
            try { canvas.setPointerCapture(e.pointerId) } catch (_) { /* ignore */ }
            e.preventDefault()
        }
        const onMove = (e) => {
            if (!drawing || e.pointerId !== pointerId) return
            const p = toRendererCoords(e)
            points.push({ x: p.x, y: p.y, t: performance.now() - startWallTime })
        }
        const onUp = (e) => {
            if (!drawing || e.pointerId !== pointerId) return
            drawing = false
            try { canvas.releasePointerCapture(e.pointerId) } catch (_) { /* ignore */ }
            const pathDuration = points.length > 1 ? points[points.length - 1].t : 0
            if (points.length >= 2 && pathDuration > 50) {
                const start = selectTime(reduxStore.getState())
                const end = Math.min(start + pathDuration, duration)
                dispatch(addDrawnMouse({
                    id: `dm-${crypto.randomUUID()}`,
                    start,
                    end,
                    points,
                    color: null,
                    label: null,
                    showLabel: null,
                    preset: null,
                    showTrail: true,
                }))
            }
            dispatch(setIsDrawMouseModeActive(false))
        }

        canvas.addEventListener("pointerdown", onDown)
        canvas.addEventListener("pointermove", onMove)
        canvas.addEventListener("pointerup", onUp)
        canvas.addEventListener("pointercancel", onUp)
        return () => {
            canvas.removeEventListener("pointerdown", onDown)
            canvas.removeEventListener("pointermove", onMove)
            canvas.removeEventListener("pointerup", onUp)
            canvas.removeEventListener("pointercancel", onUp)
        }
    }, [isDrawMouseModeActive, rendererDims, duration, dispatch, reduxStore])

    const toggleDrawMouseMode = useCallback(() => {
        dispatch(setIsDrawMouseModeActive(!isDrawMouseModeActive))
    }, [dispatch, isDrawMouseModeActive])

    return (
        <section className="flowtake-preview flex-1 min-w-0 min-h-0 flex flex-col relative" aria-label="Video preview">
            <PreviewClockBridge manager={manager} screenVideoRef={screenVideoRef} />
            <header className="flowtake-preview__chrome h-11 shrink-0 flex items-center justify-between gap-2 px-2">
                <div className="min-w-0 flex items-baseline gap-2">
                    <h2 className="text-xs font-semibold">Canvas</h2>
                    <span className="hidden sm:inline text-[10px] text-base-content/40">
                        {aspectRatio.replace("x", ":")}
                    </span>
                </div>
                <div className="flowtake-preview__toolbar inline-flex items-center gap-1 p-1 rounded-lg bg-base-100">
                    <AspectRatioDropdown />
                    <button
                        type="button"
                        onClick={toggleDrawMouseMode}
                        disabled={isPlaying}
                        aria-pressed={isDrawMouseModeActive}
                        aria-label={isDrawMouseModeActive ? "Finish drawing mouse path" : "Draw mouse path"}
                        className={`btn btn-xs ${isDrawMouseModeActive ? "btn-primary" : "btn-ghost"} gap-1`}
                        title={isDrawMouseModeActive ? "Finish drawing mouse path" : "Draw a mouse path"}
                    >
                        <PencilSquareIcon className="size-4" />
                        <span className="hidden md:inline">{isDrawMouseModeActive ? "Drawing" : "Draw mouse"}</span>
                    </button>
                </div>
            </header>

            <div ref={ref} data-drop-zone="preview" className="flowtake-preview__stage flex-1 min-h-0 flex items-center justify-center relative group p-2 sm:p-3">
                <canvas ref={canvasRef} className={`flowtake-preview__canvas rounded-lg overflow-hidden bg-black ${isDrawMouseModeActive ? "cursor-crosshair" : "cursor-none"}`} />
                <OverlayCanvas canvasRect={canvasRect} />
                {isDrawMouseModeActive && (
                    <div className="flowtake-preview__draw-hint absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-primary text-primary-content text-[11px] font-medium pointer-events-none">
                        Drag on the canvas, then release to finish
                    </div>
                )}
            </div>

            <footer className="flowtake-preview__controls h-12 shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2">
                <span className="hidden lg:block text-[10px] text-base-content/35">Space to play or pause</span>
                <div className="join flowtake-preview__transport">
                    {!isPlaying && (
                        <button
                            type="button"
                            onClick={onPlay}
                            disabled={!isPlayable}
                            className="btn btn-sm join-item"
                            aria-label="Play preview"
                            title="Play (Space)"
                        >
                            <PlayIcon className="size-4" />
                        </button>
                    )}
                    {isPlaying && (
                        <button type="button" onClick={onPause} className="btn btn-sm join-item" aria-label="Pause preview" title="Pause (Space)">
                            <PauseIcon className="size-4" />
                        </button>
                    )}
                    <button type="button" onClick={onStop} disabled={isStopped} className="btn btn-sm join-item" aria-label="Stop preview" title="Stop">
                        <StopIcon className="size-4" />
                    </button>
                </div>
                <div className="justify-self-end">
                    {(hasMicrophoneAudio || hasSystemAudio) && (
                        <button
                            type="button"
                            onClick={onToggleSound}
                            aria-label={isMuted ? "Unmute preview" : "Mute preview"}
                            title={isMuted ? "Unmute preview" : "Mute preview"}
                            className={`btn btn-sm btn-square swap swap-flip ${isMuted ? "swap-active" : ""}`}
                        >
                            <SpeakerXMarkIcon className="size-4 swap-on" />
                            <SpeakerWaveIcon className="size-4 swap-off" />
                        </button>
                    )}
                </div>
            </footer>

            <VideoWrapper screenVideoRef={screenVideoRef} cameraVideoRef={cameraVideoRef} extraVideoRefs={extraVideoRefs} />
        </section>
    )
}
