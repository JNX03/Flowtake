import {
    ArrowsPointingOutIcon,
    ArrowDownTrayIcon,
    BackwardIcon,
    ClipboardDocumentIcon,
    ForwardIcon,
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
import {
    shallowEqual,
    useDispatch,
    useSelector,
    useStore
} from "react-redux"
import { useResizeDetector } from "react-resize-detector"
import { MODE_SIDE_BY_SIDE } from "@shared/constants"
import {
    EDITOR_SHORTCUT_IDS,
    formatShortcut,
} from "@shared/editor/shortcutRegistry"
import {
    useEditorHotkey,
    useEditorShortcutBindings,
} from "@shared/editor/useEditorShortcuts"
import { addErrorToast } from "@shared/errorToastHelper"
import { addToast } from "@shared/redux/appSlice"
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
import {
    selectTime,
    setTime
} from "@shared/redux/timelineSlice"
import { selectProjectFps } from "@shared/redux/sceneSlice"
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

export default function Preview() {

    const dispatch = useDispatch()
    const store = useStore()

    // TODO: masks can also be used to highlight information. just draw a border. easy to do!

    const mouseEvents = useSelector(selectMouseEvents)
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
    const areVideosReady = useSelector(selectAreVideosReady)

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

    const canvasRef = useRef(null)
    const screenVideoRef = useRef(null)
    const cameraVideoRef = useRef(null)
    const extraVideoRefs = useRef([])
    const registeredExtrasRef = useRef(new Set())
    const hasManagerRef = useRef(false)

    const [canvasRect, setCanvasRect] = useState(null)
    const [viewportZoom, setViewportZoom] = useState(() => {
        try {
            const saved = window.localStorage.getItem("flowtake-preview-zoom")
            return ["fit", "0.25", "0.5", "1", "2"].includes(saved) ? saved : "fit"
        } catch {
            return "fit"
        }
    })

    const { width: wrapperWidth, height: wrapperHeight, ref } = useResizeDetector({
        // The library's default refresh interval can leave the canvas at its
        // pre-maximize size for roughly a second. Keep resize work bounded,
        // but make native window and panel resizing feel immediate.
        refreshMode: "throttle",
        refreshRate: 50,
        observerOptions: { box: "border-box" },
    })

    useEffect(() => {
        try {
            window.localStorage.setItem("flowtake-preview-zoom", viewportZoom)
        } catch {
            // Keep the in-memory zoom when webview storage is unavailable.
        }
    }, [viewportZoom])

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
            const availableWidth = Math.max(1, wrapperWidth - 32)
            const availableHeight = Math.max(1, wrapperHeight - 24)
            let css
            if (availableWidth / availableHeight > aspectWidth / aspectHeight)
                css = {
                    x: Math.floor(availableHeight / aspectHeight * aspectWidth),
                    y: Math.floor(availableHeight)
                }
            else
                css = {
                    x: Math.floor(availableWidth),
                    y: Math.floor(availableWidth / aspectWidth * aspectHeight)
                }
            return {
                css,
                native: {
                    x: maxRendererWidth,
                    y: maxRendererHeight,
                },
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
            const zoom = viewportZoom === "fit" ? null : Number(viewportZoom)
            const display = zoom
                ? {
                    x: Math.max(1, Math.round(dims.native.x * zoom)),
                    y: Math.max(1, Math.round(dims.native.y * zoom)),
                }
                : dims.css
            canvasRef.current.style.width = `${display.x}px`
            canvasRef.current.style.height = `${display.y}px`
            dispatch(setRendererDims(dims.renderer))
            setCanvasRect({
                left: 0,
                top: 0,
                width: display.x,
                height: display.y,
            })
        }
    }, [aspectRatio, dispatch, viewportZoom, wrapperWidth, wrapperHeight])

    useEffect(() => {
        if (!manager) return

        let lastTime = selectTime(store.getState())
        let pendingTime = lastTime
        let animationFrame = null
        manager.postTime(lastTime)

        const unsubscribe = store.subscribe(() => {
            const nextTime = selectTime(store.getState())
            if (nextTime === lastTime) return

            lastTime = nextTime
            pendingTime = nextTime
            if (animationFrame !== null) return
            animationFrame = requestAnimationFrame(() => {
                animationFrame = null
                manager.postTime(pendingTime)
            })
        })

        return () => {
            unsubscribe()
            if (animationFrame !== null) cancelAnimationFrame(animationFrame)
        }
    }, [manager, store])

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
        let timelineStart = 0
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
            timelineStart = selectTime(store.getState())
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
                const start = timelineStart
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
    }, [isDrawMouseModeActive, rendererDims, duration, dispatch, store])

    const toggleDrawMouseMode = useCallback(() => {
        dispatch(setIsDrawMouseModeActive(!isDrawMouseModeActive))
    }, [dispatch, isDrawMouseModeActive])

    return (
        <div className="flowtake-preview flex-1 min-w-[320px] min-h-0 flex flex-col relative">
            <div className="flowtake-preview__chrome h-10 shrink-0 flex items-center justify-center">
                <div className="flowtake-preview__toolbar inline-flex items-center gap-2 px-2 py-1 rounded-full bg-base-100/90">
                    <AspectRatioDropdown />
                    <select
                        value={viewportZoom}
                        onChange={event => setViewportZoom(event.target.value)}
                        className="select select-xs w-20"
                        aria-label="Preview zoom"
                        title="Preview zoom"
                    >
                        <option value="fit">Fit</option>
                        <option value="0.25">25%</option>
                        <option value="0.5">50%</option>
                        <option value="1">100%</option>
                        <option value="2">200%</option>
                    </select>
                    <button
                        onClick={toggleDrawMouseMode}
                        disabled={isPlaying}
                        className={`btn btn-xs ${isDrawMouseModeActive ? "btn-primary" : "btn-ghost"} gap-1`}
                        title={isDrawMouseModeActive ? "Drawing — drag on the canvas, or click to cancel" : "Draw a mouse path"}
                    >
                        <PencilSquareIcon className="size-4" />
                        <span className="hidden sm:inline">{isDrawMouseModeActive ? "Drawing…" : "Draw mouse"}</span>
                    </button>
                </div>
            </div>
            <div ref={ref} data-drop-zone="preview" className="flowtake-preview__stage flex-1 min-h-0 relative group overflow-auto">
                <div className="min-w-full min-h-full flex items-center justify-center px-4 py-3">
                    <div
                        className="relative shrink-0"
                        style={canvasRect ? { width: canvasRect.width, height: canvasRect.height } : undefined}
                    >
                        <canvas ref={canvasRef} className={`flowtake-preview__canvas block rounded-xl overflow-hidden bg-black ${isDrawMouseModeActive ? "cursor-crosshair" : "cursor-none"}`} />
                        <OverlayCanvas canvasRect={canvasRect} />
                    </div>
                </div>
                {isDrawMouseModeActive && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-content text-xs font-medium shadow-lg pointer-events-none">
                        Drag to draw a path — release to finish
                    </div>
                )}
            </div>
            <PreviewTransport manager={manager} />
            <VideoWrapper screenVideoRef={screenVideoRef} cameraVideoRef={cameraVideoRef} extraVideoRefs={extraVideoRefs} />
        </div>
    )
}

function formatPreviewTime(ms, fps) {
    if (!Number.isFinite(ms)) return "00:00:00:00"
    const clamped = Math.max(0, ms)
    const totalSeconds = Math.floor(clamped / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor(totalSeconds / 60) % 60
    const seconds = totalSeconds % 60
    const frames = Math.min(fps - 1, Math.floor((clamped % 1000) / 1000 * fps))
    return [
        hours,
        minutes,
        seconds,
        frames,
    ].map(value => String(value).padStart(2, "0")).join(":")
}

function parsePreviewTimecode(value, fps) {
    const trimmed = String(value).trim()
    const frameMatch = trimmed.match(/^(\d+):(\d{1,2}):(\d{1,2}):(\d{1,3})$/)
    if (frameMatch) {
        const [, hoursText, minutesText, secondsText, framesText] = frameMatch
        const hours = Number(hoursText)
        const minutes = Number(minutesText)
        const seconds = Number(secondsText)
        const frames = Number(framesText)
        if (minutes > 59 || seconds > 59 || frames >= fps) return null
        return ((hours * 60 + minutes) * 60 + seconds) * 1000 + frames / fps * 1000
    }

    const match = trimmed.match(/^(?:(\d+):)?(\d{1,2})(?:[.](\d{1,3}))?$/)
    if (!match) return null
    const minutes = Number(match[1] || 0)
    const seconds = Number(match[2])
    const fraction = match[3] || ""
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds > 59) return null

    const milliseconds = fraction.length === 0
        ? 0
        : Number(fraction.padEnd(3, "0").slice(0, 3))

    return (minutes * 60 + seconds) * 1000 + milliseconds
}

function PreviewTimecode({ time, duration, fps, onCommit }) {
    const [isEditing, setIsEditing] = useState(false)
    const [value, setValue] = useState(() => formatPreviewTime(time, fps))
    const cancelCommitRef = useRef(false)

    useEffect(() => {
        if (!isEditing) setValue(formatPreviewTime(time, fps))
    }, [fps, isEditing, time])

    const commit = useCallback(() => {
        if (cancelCommitRef.current) {
            cancelCommitRef.current = false
            setValue(formatPreviewTime(time, fps))
            setIsEditing(false)
            return
        }
        const nextTime = parsePreviewTimecode(value, fps)
        if (nextTime !== null) onCommit(nextTime)
        else setValue(formatPreviewTime(time, fps))
        setIsEditing(false)
    }, [fps, onCommit, time, value])

    return (
        <div className="flowtake-timecode flex items-baseline gap-1.5 min-w-32 justify-end font-mono tabular-nums">
            <input
                type="text"
                inputMode="numeric"
                aria-label="Current preview time"
                title="Enter time as hours:minutes:seconds:frames"
                value={value}
                onFocus={event => {
                    cancelCommitRef.current = false
                    setIsEditing(true)
                    event.currentTarget.select()
                }}
                onChange={event => setValue(event.target.value)}
                onBlur={commit}
                onKeyDown={event => {
                    if (event.key === "Enter") event.currentTarget.blur()
                    if (event.key === "Escape") {
                        cancelCommitRef.current = true
                        setValue(formatPreviewTime(time, fps))
                        event.currentTarget.blur()
                    }
                }}
                className="w-[6.8rem] bg-transparent border-0 rounded px-1 py-0.5 text-right text-[11px] font-semibold text-base-content/80 outline-none focus:bg-base-100 focus:ring-1 focus:ring-primary/40"
            />
            <span className="text-[9px] text-base-content/35">/ {formatPreviewTime(duration, fps)}</span>
        </div>
    )
}

async function dataUrlToPngBlob(dataUrl) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png")) {
        throw new Error("Preview frame could not be encoded")
    }
    const response = await fetch(dataUrl)
    return response.blob()
}

function PreviewTransport({ manager }) {
    const dispatch = useDispatch()
    const isPlaying = useSelector(selectIsPlaying)
    const isStopped = useSelector(selectIsStopped)
    const isMuted = useSelector(selectIsMuted)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const shortcutBindings = useEditorShortcutBindings()
    const hasMicrophoneAudio = useSelector(selectHasMicrophoneAudio)
    const hasSystemAudio = useSelector(selectHasSystemAudio)
    const videoDetails = useSelector(selectVideoDetails, shallowEqual)
    const duration = useSelector(selectDuration)
    const time = useSelector(selectTime)
    const fps = useSelector(selectProjectFps)
    const frameDuration = 1000 / fps
    const canPlay = Boolean(videoDetails && time < videoDetails.end)
    const timelineStart = videoDetails?.start ?? 0
    const timelineEnd = videoDetails?.end ?? duration ?? 0
    const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false)

    const seekTo = useCallback(nextTime => {
        const clampedTime = Math.min(timelineEnd, Math.max(timelineStart, nextTime))
        dispatch(setIsPlaying(false))
        dispatch(setIsStopped(false))
        dispatch(setTime(clampedTime))
    }, [dispatch, timelineEnd, timelineStart])

    const seekBy = useCallback(delta => {
        seekTo(time + delta)
    }, [seekTo, time])

    const toggleFullscreen = useCallback(async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen()
                return
            }
            await document.querySelector(".flowtake-preview")?.requestFullscreen?.()
        } catch (error) {
            console.warn("[Flowtake] Preview fullscreen unavailable", error)
        }
    }, [])

    const captureSnapshot = useCallback(async mode => {
        if (isCapturingSnapshot) return
        setIsCapturingSnapshot(true)
        try {
            if (!manager) throw new Error("Preview renderer is not ready")
            const dataUrl = await manager.captureSnapshot()
            const blob = await dataUrlToPngBlob(dataUrl)
            if (mode === "copy") {
                if (!navigator.clipboard?.write || typeof window.ClipboardItem !== "function") {
                    throw new Error("Image clipboard access is unavailable")
                }
                await navigator.clipboard.write([
                    new window.ClipboardItem({ "image/png": blob }),
                ])
                dispatch(addToast({
                    type: "toast-success",
                    text: "Preview frame copied",
                }))
                return
            }

            const url = URL.createObjectURL(blob)
            const anchor = document.createElement("a")
            anchor.href = url
            anchor.download = `flowtake-frame-${String(Math.round(time)).padStart(8, "0")}.png`
            anchor.click()
            window.setTimeout(() => URL.revokeObjectURL(url), 0)
            dispatch(addToast({
                type: "toast-success",
                text: "Preview frame saved",
            }))
        } catch (error) {
            dispatch(addErrorToast(`Couldn't capture preview frame: ${error?.message || error}`))
        } finally {
            setIsCapturingSnapshot(false)
        }
    }, [dispatch, isCapturingSnapshot, manager, time])

    const onPlay = useCallback(() => {
        if (!canPlay) return
        dispatch(setIsStopped(false))
        dispatch(setIsPlaying(true))
    }, [canPlay, dispatch])

    const onPause = useCallback(() => {
        dispatch(setIsPlaying(false))
    }, [dispatch])

    const onStop = useCallback(() => {
        dispatch(setIsStopped(true))
        dispatch(setIsPlaying(false))
        dispatch(setTime(timelineStart))
    }, [dispatch, timelineStart])

    const onToggleSound = useCallback(() => {
        dispatch(setIsMuted(!isMuted))
    }, [dispatch, isMuted])

    useEditorHotkey(EDITOR_SHORTCUT_IDS.PLAY_PAUSE, () => {
        if (isPlaying) onPause()
        else onPlay()
    }, {
        enabled: areHotkeysEnabled,
        preventDefault: true
    }, [areHotkeysEnabled, isPlaying, onPause, onPlay])

    useEditorHotkey(EDITOR_SHORTCUT_IDS.SEEK_BACK_ONE_SECOND, () => seekBy(-1000), {
        enabled: areHotkeysEnabled,
        preventDefault: true
    }, [areHotkeysEnabled, seekBy])
    useEditorHotkey(EDITOR_SHORTCUT_IDS.SEEK_FORWARD_ONE_SECOND, () => seekBy(1000), {
        enabled: areHotkeysEnabled,
        preventDefault: true
    }, [areHotkeysEnabled, seekBy])
    useEditorHotkey(EDITOR_SHORTCUT_IDS.PREVIOUS_FRAME, () => seekBy(-frameDuration), {
        enabled: areHotkeysEnabled,
        preventDefault: true
    }, [areHotkeysEnabled, frameDuration, seekBy])
    useEditorHotkey(EDITOR_SHORTCUT_IDS.NEXT_FRAME, () => seekBy(frameDuration), {
        enabled: areHotkeysEnabled,
        preventDefault: true
    }, [areHotkeysEnabled, frameDuration, seekBy])
    useEditorHotkey(EDITOR_SHORTCUT_IDS.SEEK_BACK_FIVE_SECONDS, () => seekBy(-5000), {
        enabled: areHotkeysEnabled,
        preventDefault: true
    }, [areHotkeysEnabled, seekBy])
    useEditorHotkey(EDITOR_SHORTCUT_IDS.SEEK_FORWARD_FIVE_SECONDS, () => seekBy(5000), {
        enabled: areHotkeysEnabled,
        preventDefault: true
    }, [areHotkeysEnabled, seekBy])
    useEditorHotkey(EDITOR_SHORTCUT_IDS.JUMP_TO_START, () => seekTo(timelineStart), {
        enabled: areHotkeysEnabled,
        preventDefault: true
    }, [areHotkeysEnabled, seekTo, timelineStart])
    useEditorHotkey(EDITOR_SHORTCUT_IDS.JUMP_TO_END, () => seekTo(timelineEnd), {
        enabled: areHotkeysEnabled,
        preventDefault: true
    }, [areHotkeysEnabled, seekTo, timelineEnd])

    const shortcutLabel = actionId => (shortcutBindings[actionId] || [])
        .map(binding => formatShortcut(binding))
        .join(" / ") || "Unassigned"

    return (
        <div className="flowtake-preview__controls h-12 shrink-0 flex items-center justify-center gap-2 px-2 overflow-x-auto no-scrollbar">
            <PreviewTimecode time={time} duration={duration} fps={fps} onCommit={seekTo} />
            <div className="join flowtake-transport shadow-sm">
                <button
                    type="button"
                    onClick={() => seekBy(-frameDuration)}
                    className="btn btn-sm join-item"
                    aria-label="Previous frame"
                    title={`Previous frame (${shortcutLabel(EDITOR_SHORTCUT_IDS.PREVIOUS_FRAME)})`}
                >
                    <BackwardIcon className="h-4 w-4" />
                </button>
                {!isPlaying ? (
                    <button
                        type="button"
                        onClick={onPlay}
                        disabled={!canPlay}
                        className="btn btn-sm join-item"
                        aria-label="Play"
                        title={`Play (${shortcutLabel(EDITOR_SHORTCUT_IDS.PLAY_PAUSE)})`}
                    >
                        <PlayIcon className="h-5 w-5" />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onPause}
                        className="btn btn-sm join-item"
                        aria-label="Pause"
                        title={`Pause (${shortcutLabel(EDITOR_SHORTCUT_IDS.PLAY_PAUSE)})`}
                    >
                        <PauseIcon className="h-5 w-5" />
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => seekBy(frameDuration)}
                    className="btn btn-sm join-item"
                    aria-label="Next frame"
                    title={`Next frame (${shortcutLabel(EDITOR_SHORTCUT_IDS.NEXT_FRAME)})`}
                >
                    <ForwardIcon className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={onStop}
                    disabled={isStopped}
                    className="btn btn-sm join-item"
                    aria-label="Stop"
                >
                    <StopIcon className="h-5 w-5" />
                </button>
            </div>
            {(hasMicrophoneAudio || hasSystemAudio) && (
                <button
                    type="button"
                    onClick={onToggleSound}
                    className={`btn btn-sm btn-ghost btn-square swap swap-flip ${isMuted ? "swap-active" : ""}`}
                    aria-label={isMuted ? "Unmute preview" : "Mute preview"}
                    aria-pressed={isMuted}
                >
                    <SpeakerXMarkIcon className="size-4 swap-on" />
                    <SpeakerWaveIcon className="size-4 swap-off" />
                </button>
            )}
            <button
                type="button"
                onClick={() => captureSnapshot("save")}
                disabled={!manager || isCapturingSnapshot}
                className="btn btn-sm btn-ghost btn-square"
                aria-label="Save preview snapshot"
                title="Save current frame as PNG"
            >
                <ArrowDownTrayIcon className="size-4" />
            </button>
            <button
                type="button"
                onClick={() => captureSnapshot("copy")}
                disabled={!manager || isCapturingSnapshot}
                className="btn btn-sm btn-ghost btn-square"
                aria-label="Copy preview snapshot"
                title="Copy current frame"
            >
                <ClipboardDocumentIcon className="size-4" />
            </button>
            <button
                type="button"
                onClick={toggleFullscreen}
                className="btn btn-sm btn-ghost btn-square"
                aria-label="Toggle preview fullscreen"
                title="Full screen"
            >
                <ArrowsPointingOutIcon className="size-4" />
            </button>
        </div>
    )
}
