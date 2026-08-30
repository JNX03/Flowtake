import {
    easeBackOut,
    easeBounceOut,
    easeCubicInOut,
    easeElasticOut,
    easeExpOut,
    easeLinear
} from "d3-ease"
import { PROJECT_SCREEN_VIDEO } from "./constants"
import { getClipSplitTiming } from "./editor/playbackClock"
import {
    hydrateProjectMedia,
    rebindTimelineMediaEntities
} from "./editor/projectMedia"
import { migrateProjectDocument } from "./editor/projectSchema"
import shallowEqual from "./shallowEqual"
import {
    getGroup,
    withGroup
} from "./redux/actionEnhancers"
import { selectAll } from "./redux/animsAdapter"
import {
    setHasProject,
    setLoaderMessage
} from "./redux/appSlice"
import { setAssets } from "./redux/assetSlice"
import {
    addCameraZoom,
    applyProperties as applyCameraZoomAnimsProperties,
    removeCameraZoom,
    removeCameraZooms,
    setCameraZooms,
    updateCameraZoom,
    upsertCameraZooms
} from "./redux/cameraZoomSlice"
import {
    applyProperties as applyClickAnimsProperties,
    setClicks
} from "./redux/clickSlice"
import {
    addClip,
    applyProperties as applyClipAnimsProperties,
    setClips
} from "./redux/clipSlice"
import { setIsZoomMenuOpen } from "./redux/contextMenuSlice"
import { applyProperties as applyCursorCoordsProperties } from "./redux/cursorCoordsSlice"
import {
    applyProperties as applyCursorTypeAnimsProperties,
    setCursorTypes
} from "./redux/cursorTypeSlice"
import {
    setAreCameraZoomAnimEntitiesGenerated,
    setArePanAnimEntitiesGenerated,
    setAreZoomAnimEntitiesGenerated,
    setDuration
} from "./redux/editorSlice"
import {
    addMask,
    setMasks
} from "./redux/maskSlice"
import {
    applyProperties as applyAudioTrackAnimsProperties,
    setAudioClips
} from "./redux/audioTrackSlice"
import {
    applyProperties as applyOverlayAnimsProperties,
    setOverlays
} from "./redux/overlaySlice"
import {
    addPan,
    applyProperties as applyPanAnimsProperties,
    removePan,
    removePans,
    setPans,
    updatePan,
    upsertPans
} from "./redux/panSlice"
import {
    applyProperties as applyProjectProperties,
    setBackground
} from "./redux/projectSlice"
import {
    applyProperties as applyEditorDomainProperties
} from "./redux/sceneSlice"
import {
    addSubtitle,
    applyProperties as applySubtitleAnimsProperties,
    setSubtitles
} from "./redux/subtitleSlice"
import {
    setSelectedIds
} from "./redux/timelineSlice"
import {
    addSpatial,
    applyProperties as applySpatialAnimsProperties,
    removeSpatial,
    removeSpatials,
    setSpatials,
    updateSpatial,
    upsertSpatials
} from "./redux/spatialSlice"
import {
    addZoom,
    applyProperties as applyZoomAnimsProperties,
    removeZoom,
    removeZooms,
    setZooms,
    updateZoom,
    upsertZooms
} from "./redux/zoomSlice"
import {
    addKeyboardLayout,
    applyProperties as applyKeyboardLayoutProperties,
    setKeyboardLayouts
} from "./redux/keyboardLayoutSlice"
import {
    applyProperties as applyMouseStyleProperties,
    setMouseStyles
} from "./redux/mouseStyleAnimSlice"
import {
    applyProperties as applyDrawnMouseProperties,
    setDrawnMice
} from "./redux/drawnMouseAnimSlice"
import {
    applyProperties as applyAppSceneProperties,
    setAppScenes
} from "./redux/appSceneAnimSlice"

// Lazy-loaded heavy scene modules (Pixi.js, configs, etc.)
// These are only needed when opening/editing a project, not at startup.
const _configs = {}
async function loadConfigs() {
    if (_configs.loaded) return _configs
    const [RIR, CC, CkC, ClC, CtC, MC, PC, SC, SpC, ZC] = await Promise.all([
        import("./RendererInputReader"),
        import("./scene/cameraZoom/CameraZoomConfig"),
        import("./scene/click/ClickConfig"),
        import("./scene/clip/ClipConfig"),
        import("./scene/cursorType/CursorTypeConfig"),
        import("./scene/mask/MaskConfig"),
        import("./scene/pan/PanConfig"),
        import("./scene/subtitle/SubtitleConfig"),
        import("./scene/spatial/SpatialConfig"),
        import("./scene/zoom/ZoomConfig"),
    ])
    _configs.RendererInputReader = RIR.default
    _configs.CameraZoomConfig = CC.default
    _configs.ClickConfig = CkC.default
    _configs.ClipConfig = ClC.default
    _configs.CursorTypeConfig = CtC.default
    _configs.MaskConfig = MC.default
    _configs.PanConfig = PC.default
    _configs.SubtitleConfig = SC.default
    _configs.SpatialConfig = SpC.default
    _configs.ZoomConfig = ZC.default
    _configs.loaded = true
    return _configs
}

export const TOAST_UPDATE = "toast-update"
export const TOAST_UPDATE_READY = "toast-update-ready"
export const TOAST_EXPORT_COMPLETED = "toast-export-completed"
export const TOAST_SUCCESS = "toast-success"
export const TOAST_WARNING = "toast-warning"
export const TOAST_ERROR = "toast-error"
export const TOAST_ERROR_CAPTURE = "toast-error-capture"

export const RENDER_PENDING = "pending"
export const RENDER_STARTING = "starting"
export const RENDER_INITIALIZING = "initializing"
export const RENDER_RENDERING = "rendering"
export const RENDER_PROCESSING_AUDIO = "processing-audio"
export const RENDER_UPLOADING = "uploading"
export const RENDER_COMPLETED = "completed"
export const RENDER_CANCELING = "canceling"
export const RENDER_CANCELED = "canceled"

export const EXPORTER_SECTION_QUEUE = "queue"
export const EXPORTER_SECTION_NEW_RENDER = "new-render"

export const CLICKS = "clicks"
export const CLIPS = "clips"
export const ZOOMS = "zooms"
export const SUBTITLES = "subtitles"
export const MASKS = "masks"
export const AUDIO_TRACKS = "audio-tracks"
export const OVERLAY_TRACKS = "overlay-tracks"
export const SPATIALS = "spatials"
export const SCREEN_RECORDING = "screen-recording"
export const CAMERA_RECORDING = "camera-recording"
export const BACKGROUND = "background"
export const CURSOR = "cursor"
export const TRANSCRIPT = "transcript"
export const SOURCES = "sources"
export const KEYBOARD_LAYOUTS = "keyboard-layouts"
export const MOUSE_STYLES = "mouse-styles"
export const DRAWN_MICE = "drawn-mice"
export const APP_SCENES = "app-scenes"
export const PLUGINS = "plugins"

export const INERTIA_FPS = 60

export const CONSTRAINTS_VIDEO = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
    facingMode: { ideal: "user" },
}

export const CONSTRAINTS_AUDIO = {
    channelCount: { ideal: 1 },
    autoGainControl: { ideal: true },
    noiseSuppression: { ideal: true },
    echoCancellation: { ideal: true },
}

export const openProject = async (id, isNew, defaultClipLayout, defaultClipMicrophoneAudioVolume, defaultClipSystemAudioVolume, defaultZoomBlurStrength, defaultCameraZoomTargetScale,
    defaultClipPlaybackRate, defaultMaskBlurStrength, defaultMaskAlpha, defaultMaskBorderRadius, defaultMaskFill,
    defaultZoomIntro, defaultZoomOutro, defaultZoomTargetScale, onError = null) => {

    // Load configs and project data in parallel
    const [cfgs, rawJson] = await Promise.all([
        loadConfigs(),
        window.electron.ipcRenderer.invoke("open-project", id)
    ])

    const actions = []
    if (rawJson) {
        let duration
        try {
            // Add timeout to prevent hanging on corrupted video files
            const durationPromise = cfgs.RendererInputReader.getDuration(PROJECT_SCREEN_VIDEO, { projectId: id })
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("getDuration timeout")), 5000))
            duration = await Promise.race([durationPromise, timeoutPromise])
        } catch (e) {
            console.warn("[Flowtake] Failed to get video duration, using fallback:", e)
            duration = rawJson?.project?.videoDetails?.end || 10000
        }
        const json = migrateProjectDocument(rawJson, { projectId: id, duration })
        const hydratedProjectMedia = await hydrateProjectMedia(json.editorDomain.media)
        const hydratedAudioClips = rebindTimelineMediaEntities(
            json.audioTrackAnims,
            hydratedProjectMedia
        )
        const hydratedOverlays = rebindTimelineMediaEntities(
            json.overlayAnims,
            hydratedProjectMedia
        )
        actions.push(setDuration(duration))

        // This prevents initialization, which is necessary only for new projects
        actions.push(setAreZoomAnimEntitiesGenerated(!isNew))
        actions.push(setArePanAnimEntitiesGenerated(!isNew))
        actions.push(setAreCameraZoomAnimEntitiesGenerated(!isNew))

        actions.push(applyProjectProperties(json.project))
        actions.push(applyEditorDomainProperties(json.editorDomain))
        actions.push(setAssets(hydratedProjectMedia))
        actions.push(applyClipAnimsProperties(json.clipAnims))
        actions.push(applyClickAnimsProperties(json.clickAnims))
        actions.push(applyCursorTypeAnimsProperties(json.cursorTypeAnims))
        actions.push(applySubtitleAnimsProperties(json.subtitleAnims))
        actions.push(applyPanAnimsProperties(json.panAnims))
        actions.push(applyZoomAnimsProperties(json.zoomAnims))
        actions.push(applyCameraZoomAnimsProperties(json.cameraZoomAnims))
        if (json.cursorCoords) actions.push(applyCursorCoordsProperties(json.cursorCoords))
        if (json.spatialAnims) actions.push(applySpatialAnimsProperties(json.spatialAnims))
        if (json.audioTrackAnims) actions.push(applyAudioTrackAnimsProperties(json.audioTrackAnims))
        if (json.overlayAnims) actions.push(applyOverlayAnimsProperties(json.overlayAnims))
        if (json.keyboardLayoutAnims) actions.push(applyKeyboardLayoutProperties(json.keyboardLayoutAnims))
        if (json.mouseStyleAnims) actions.push(applyMouseStyleProperties(json.mouseStyleAnims))
        if (json.drawnMouseAnims) actions.push(applyDrawnMouseProperties(json.drawnMouseAnims))
        if (json.appSceneAnims) actions.push(applyAppSceneProperties(json.appSceneAnims))

        try {
            if (json.project?.background) {
                const synchedBackground = await window.electron.ipcRenderer.invoke("sync-background", json.project.background)
                if (synchedBackground && !shallowEqual(json.project.background, synchedBackground))
                    actions.push(setBackground(synchedBackground))
            } else {
                const gradients = await window.electron.ipcRenderer.invoke("store-get", "backgroundGradients")
                if (gradients && gradients[0]) {
                    actions.push(setBackground({ type: "gradient", config: gradients[0] }))
                }
            }
        } catch (e) {
            console.warn("[Flowtake] Background setup failed, using default:", e)
        }

        // upgrade configs
        if (json.clipAnims?.entities)
            actions.push(setClips(
                json.clipAnims.entities.map(config => new cfgs.ClipConfig(config, defaultClipPlaybackRate, defaultClipLayout,
                    defaultClipMicrophoneAudioVolume, defaultClipSystemAudioVolume).serialize())))

        if (json.clickAnims?.entities)
            actions.push(setClicks(
                json.clickAnims.entities.map(config => new cfgs.ClickConfig(config).serialize())))

        if (json.cursorTypeAnims?.entities)
            actions.push(setCursorTypes(
                json.cursorTypeAnims.entities.map(config => new cfgs.CursorTypeConfig(config).serialize())))

        if (json.subtitleAnims?.entities)
            actions.push(setSubtitles(
                json.subtitleAnims.entities.map(config => new cfgs.SubtitleConfig(config).serialize())))

        if (json.panAnims?.entities)
            actions.push(setPans(
                json.panAnims.entities.map(config => new cfgs.PanConfig(config, defaultZoomIntro, defaultZoomOutro,
                    defaultZoomTargetScale).serialize())))

        if (json.zoomAnims?.entities)
            actions.push(setZooms(
                json.zoomAnims.entities.map(config => new cfgs.ZoomConfig(config, defaultZoomIntro, defaultZoomOutro,
                    defaultZoomTargetScale, defaultZoomBlurStrength).serialize())))

        if (json.cameraZoomAnims?.entities)
            actions.push(setCameraZooms(
                json.cameraZoomAnims.entities.map(config => new cfgs.CameraZoomConfig(config, defaultZoomIntro,
                    defaultZoomOutro, defaultCameraZoomTargetScale).serialize())))

        if (json.maskAnims?.entities)
            actions.push(setMasks(
                json.maskAnims.entities.map(config => new cfgs.MaskConfig(config, defaultMaskBlurStrength, defaultMaskAlpha,
                    defaultMaskBorderRadius, defaultMaskFill).serialize())))

        if (json.audioTrackAnims?.entities) {
            actions.push(setAudioClips(hydratedAudioClips))
        }

        if (json.overlayAnims?.entities) {
            actions.push(setOverlays(hydratedOverlays))
        }

        if (json.spatialAnims?.entities)
            actions.push(setSpatials(
                json.spatialAnims.entities.map(config => new cfgs.SpatialConfig(config,
                    json.spatialAnims.intro ?? 1500, json.spatialAnims.outro ?? 1500,
                    json.spatialAnims.rotateX ?? 15, json.spatialAnims.rotateY ?? 0, json.spatialAnims.rotateZ ?? 0,
                    json.spatialAnims.perspective ?? 800, json.spatialAnims.cameraDistance ?? 1.5,
                    json.spatialAnims.eyeContactEnabled ?? true).serialize())))

        // Plugin: mouse style. Load saved entities (per-span overrides). The
        // global default color/tag still drives the cursor for spans not
        // covered by an override.
        if (json.mouseStyleAnims?.entities) {
            actions.push(setMouseStyles(json.mouseStyleAnims.entities))
        }

        // Plugin: app scenes. Each entity defines main app + secondary corner
        // placements for a time span.
        if (json.appSceneAnims?.entities) {
            actions.push(setAppScenes(json.appSceneAnims.entities))
        }

        if (json.drawnMouseAnims?.entities) {
            actions.push(setDrawnMice(json.drawnMouseAnims.entities))
        }

        // Plugin: keyboard layout. Load saved entities, then auto-seed one full-video span
        // if the recording captured key events but no entities exist yet.
        const savedKbEntities = json.keyboardLayoutAnims?.entities
        if (savedKbEntities) actions.push(setKeyboardLayouts(savedKbEntities))
        const hasKeyEvents = (json.project?.keyboardEvents?.length ?? 0) > 0
        const hasSavedKbEntities = Array.isArray(savedKbEntities)
            ? savedKbEntities.length > 0
            : !!(savedKbEntities && Object.keys(savedKbEntities).length > 0)
        if (hasKeyEvents && !hasSavedKbEntities && json.project?.videoDetails?.end) {
            actions.push(addKeyboardLayout({
                id: `kb-${crypto.randomUUID()}`,
                start: 0,
                end: json.project.videoDetails.end,
            }))
        }

        actions.push(setHasProject(true))
        return actions
    } else {
        actions.push(setLoaderMessage(null))
        onError?.()
        return actions
    }
}

export const toS = ms => Math.round(ms) * 0.001
export const toMs = s => Math.round(s * 1000)

export const getAdjacentConfigLeft = (config, configs) => {
    if (canMergeLeft(config, configs)) {
        const i = configs.indexOf(config)
        return configs[i - 1]
    }
}

export const getAdjacentConfigRight = (config, configs) => {
    if (canMergeRight(config, configs)) {
        const i = configs.indexOf(config)
        return configs[i + 1]
    }
}

export const canMergeLeft = (config, configs) => {
    if (!config || !configs) return false
    const i = configs.indexOf(config)
    const prevConfig = configs[i - 1]
    return config.start === prevConfig?.end
}

export const canMergeZoomLeft = (zoom, zooms, pan, pans, cameraZoom, cameraZooms) =>
    canMergeLeft(zoom, zooms) && canMergeLeft(pan, pans) && canMergeLeft(cameraZoom, cameraZooms)

export const canMergeRight = (config, configs) => {
    if (!config || !configs) return false
    const i = configs.indexOf(config)
    const nextConfig = configs[i + 1]
    return config.end === nextConfig?.start
}

export const canMergeZoomRight = (zoom, zooms, pan, pans, cameraZoom, cameraZooms) =>
    canMergeRight(zoom, zooms) && canMergeRight(pan, pans) && canMergeRight(cameraZoom, cameraZooms)

export const canSplit = (config, time) => {
    if (!config) return false
    return time > config.start + 1000 && time < config.end - 1000
}

export const canSplitZoom = (zoom, pan, cameraZoom, time) =>
    canSplit(zoom, time) && canSplit(pan, time) && canSplit(cameraZoom, time)

export const canMaximize = (duration, config, configs) => {
    if (!config || !configs) return false
    const prev = getAdjacentConfigLeft(config, configs)
    const next = getAdjacentConfigRight(config, configs)
    return (prev == null && config.start > 0) || (next == null && config.end < duration)
}

export const canMaximizeZoom = (duration, zoom, zooms, pan, pans, cameraZoom, cameraZooms) =>
    canMaximize(duration, zoom, zooms) && canMaximize(duration, pan, pans) &&
    canMaximize(duration, cameraZoom, cameraZooms)

export const mergeLeft = (config, configs) => {
    const index = configs.findIndex(({ id }) => id === config.id)
    const prevConfig = configs[index - 1]
    return { removeId: prevConfig.id, updateArgs: { id: config.id, changes: { start: prevConfig.start } } }
}

export const mergeRight = (config, configs) => {
    const index = configs.findIndex(({ id }) => id === config.id)
    const nextConfig = configs[index + 1]
    return { removeId: nextConfig.id, updateArgs: { id: config.id, changes: { end: nextConfig.end } } }
}

const merge = ({ removeId: removeZoomId, updateArgs: updateZoomArgs },
    { removeId: removePanId, updateArgs: updatePanArgs },
    { removeId: removeCameraZoomId, updateArgs: updateCameraZoomArgs }) => {
    const group = getGroup("merge")
    return [
        setIsZoomMenuOpen(false),
        withGroup(removeZoom(removeZoomId), group),
        withGroup(removePan(removePanId), group),
        withGroup(removeCameraZoom(removeCameraZoomId), group),
        withGroup(updateZoom(updateZoomArgs), group),
        withGroup(updatePan(updatePanArgs), group),
        withGroup(updateCameraZoom(updateCameraZoomArgs), group),
        setSelectedIds([])
    ]
}

export const mergeZoomLeft = (zoom, zooms, pan, pans, cameraZoom, cameraZooms) =>
    merge(mergeLeft(zoom, zooms), mergeLeft(pan, pans), mergeLeft(cameraZoom, cameraZooms))

export const mergeZoomRight = (zoom, zooms, pan, pans, cameraZoom, cameraZooms) =>
    merge(mergeRight(zoom, zooms), mergeRight(pan, pans), mergeRight(cameraZoom, cameraZooms))

export const split = (config, Class, time, args = []) => {
    const isClip = Class === _configs.ClipConfig
    const clipTiming = isClip ? getClipSplitTiming(config, time) : null
    const args1 = {
        id: config.id,
        end: time,
        ...(clipTiming ? { sourceEnd: clipTiming.left.sourceEnd } : {}),
    }
    const newConfig = { ...config, start: time }
    if (clipTiming) {
        newConfig.sourceStart = clipTiming.right.sourceStart
        newConfig.sourceEnd = clipTiming.right.sourceEnd
    }
    delete newConfig.id
    const args2 = new Class(newConfig, ...args).serialize()
    return [args1, args2]
}

export const splitZoom = (zoom, pan, cameraZoom, time, defaultCameraZoomTargetScale, defaultIntro, defaultOutro,
    defaultZoomTargetScale, defaultZoomBlurStrength) => {

    const group = getGroup("split")
    return [
        setIsZoomMenuOpen(false),
        withGroup(upsertZooms(
            split(zoom, _configs.ZoomConfig, time, [defaultIntro, defaultOutro, defaultZoomTargetScale, defaultZoomBlurStrength])), group),
        withGroup(upsertPans(
            split(pan, _configs.PanConfig, time, [defaultIntro, defaultOutro, defaultZoomTargetScale])), group),
        withGroup(upsertCameraZooms(
            split(cameraZoom, _configs.CameraZoomConfig, time, [defaultIntro, defaultOutro, defaultCameraZoomTargetScale])), group),
        setSelectedIds([])
    ]
}

export const maximize = (duration, config, configs) => {
    const i = configs.findIndex(({ id }) => id === config.id)
    const start = configs[i - 1]?.end ?? 0
    const end = configs[i + 1]?.start ?? duration
    return { id: config.id, changes: { start, end } }
}


export const maximizeZoom = (duration, zoom, zooms, pan, pans, cameraZoom, cameraZooms) => {
    const group = getGroup("maximize")
    return [
        setIsZoomMenuOpen(false),
        withGroup(updateZoom(maximize(duration, zoom, zooms)), group),
        withGroup(updatePan(maximize(duration, pan, pans)), group),
        withGroup(updateCameraZoom(maximize(duration, cameraZoom, cameraZooms)), group),
        setSelectedIds([])
    ]
}

export const removeZoomConfigs = (zooms, pans, cameraZooms) => {
    const group = getGroup("remove")
    return [
        setIsZoomMenuOpen(false),
        withGroup(removeZooms(zooms.map(({ id }) => id)), group),
        withGroup(removePans(pans.map(({ id }) => id)), group),
        withGroup(removeCameraZooms(cameraZooms.map(({ id }) => id)), group),
        setSelectedIds([])
    ]
}

const getStartAndEnd = (duration, configs, time) => {
    const start = configs.reduce((closest, current) =>
        current.end > closest && current.end < time ? current.end : closest, 0)

    const end = configs.reduce((closest, current) =>
        current.start < closest && current.start > time ? current.start : closest, duration)

    return { start: Math.max(time - 2000, start), end: Math.min(time + 2000, end) }
}

export const createClip = (time, clips, playbackRate, layout, microphoneAudioVolume, systemAudioVolume, duration) =>
    addClip((new _configs.ClipConfig({ ...getStartAndEnd(duration, clips, time) }, playbackRate, layout, microphoneAudioVolume,
        systemAudioVolume)).serialize())

export const createZoom = (time, configs, duration, defaultCameraZoomTargetScale, defaultBlurStrength,
    defaultZoomIntro, defaultZoomOutro, defaultZoomTargetScale) => {

    const args = getStartAndEnd(duration, configs, time)

    const zoom = (new _configs.ZoomConfig(args, defaultZoomIntro, defaultZoomOutro, defaultZoomTargetScale, defaultBlurStrength))
        .serialize()
    const pan = (new _configs.PanConfig(args, defaultZoomIntro, defaultZoomOutro, defaultZoomTargetScale))
        .serialize()
    const cameraZoom = (new _configs.CameraZoomConfig(args, defaultZoomIntro, defaultZoomOutro, defaultCameraZoomTargetScale))
        .serialize()

    const group = getGroup("add")
    return [
        withGroup(addZoom(zoom), group),
        withGroup(addPan(pan), group),
        withGroup(addCameraZoom(cameraZoom), group)
    ]
}

export const createSpatial = (time, configs, duration, defaultRotateX, defaultRotateY, defaultRotateZ,
    defaultPerspective, defaultCameraDistance, defaultEyeContactEnabled, defaultIntro, defaultOutro) => {

    const args = getStartAndEnd(duration, configs, time)

    return addSpatial((new _configs.SpatialConfig(args, defaultIntro, defaultOutro, defaultRotateX, defaultRotateY,
        defaultRotateZ, defaultPerspective, defaultCameraDistance, defaultEyeContactEnabled)).serialize())
}

export const createSubtitle = (time, subtitles, duration) =>
    addSubtitle((new _configs.SubtitleConfig({ ...getStartAndEnd(duration, subtitles, time), text: "Subtitle" })).serialize())

export const createMask = (time, row, leftTrim, rightTrim, topTrim, bottomTrim, videoDims, duration, masks,
    defaultMaskBlurStrength, defaultMaskAlpha, defaultMaskBorderRadius, defaultMaskFill) => {
    const configs = masks.filter(({ row: configRow }) => configRow === row)

    const maskDims = {
        x: Math.min(600, videoDims.x - leftTrim - rightTrim),
        y: Math.min(200, videoDims.y - topTrim - bottomTrim)
    }

    const trimmedVideoDims = {
        x: videoDims.x - leftTrim - rightTrim,
        y: videoDims.y - topTrim - bottomTrim
    }

    return addMask((new _configs.MaskConfig(
        {
            ...getStartAndEnd(duration, configs, time),
            row,
            left: leftTrim + (trimmedVideoDims.x - maskDims.x) / 2,
            right: rightTrim + (trimmedVideoDims.x - maskDims.x) / 2,
            top: topTrim + (trimmedVideoDims.y - maskDims.y) / 2,
            bottom: bottomTrim + (trimmedVideoDims.y - maskDims.y) / 2
        },
        defaultMaskBlurStrength,
        defaultMaskAlpha,
        defaultMaskBorderRadius,
        defaultMaskFill
    )).serialize())
}

export const getPresettableData = presentState => {
    const {
        project,
        zoomAnims,
        clipAnims,
        clickAnims,
        panAnims,
        cursorTypeAnims,
        cameraZoomAnims,
        subtitleAnims,
        cursorCoords,
        maskAnims,
        audioTrackAnims,
        overlayAnims,
        spatialAnims
    } = presentState

    const presettableData = {
        project: { ...project },
        clipAnims: serializeEntitySlice(clipAnims, false),
        clickAnims: serializeEntitySlice(clickAnims, false),
        cursorTypeAnims: serializeEntitySlice(cursorTypeAnims, false),
        subtitleAnims: serializeEntitySlice(subtitleAnims, false),
        panAnims: serializeEntitySlice(panAnims, false),
        zoomAnims: serializeEntitySlice(zoomAnims, false),
        cameraZoomAnims: serializeEntitySlice(cameraZoomAnims, false),
        cursorCoords: serializeEntitySlice(cursorCoords, false),
        maskAnims: serializeEntitySlice(maskAnims, false),
        audioTrackAnims: serializeEntitySlice(audioTrackAnims, false),
        overlayAnims: serializeEntitySlice(overlayAnims, false),
        spatialAnims: serializeEntitySlice(spatialAnims, false)
    }

    delete presettableData.project.name
    delete presettableData.project.id
    delete presettableData.project.mouseEvents
    delete presettableData.project.hasCameraVideo
    delete presettableData.project.hasMicrophoneAudio
    delete presettableData.project.hasSystemAudio
    delete presettableData.project.videoDetails
    delete presettableData.project.leftTrim
    delete presettableData.project.rightTrim
    delete presettableData.project.topTrim
    delete presettableData.project.bottomTrim
    delete presettableData.subtitleAnims.transcript

    return presettableData
}

export const interpolate = (from, to, interpolator, easingFunction = easeExpOut) => {
    return from + easingFunction(interpolator) * (to - from)
}

export const interpolateCoords = (from, to, interpolator, easingFunction = easeExpOut) => {
    return {
        x: interpolate(from.x, to.x, interpolator, easingFunction),
        y: interpolate(from.y, to.y, interpolator, easingFunction)
    }
}

export const interpolateRect = (from, to, interpolator, easingFunction = easeExpOut) => {
    const rect = {
        x: interpolate(from.x, to.x, interpolator, easingFunction),
        y: interpolate(from.y, to.y, interpolator, easingFunction),
        width: interpolate(from.width, to.width, interpolator, easingFunction),
        height: interpolate(from.height, to.height, interpolator, easingFunction),
    }
    if (from.radius != null && to.radius != null) rect.radius = interpolate(from.radius, to.radius, interpolator, easingFunction)
    return rect
}

const EASING_MAP = {
    linear: easeLinear,
    smooth: easeCubicInOut,
    expOut: easeExpOut,
    snap: easeBackOut,
    bounce: easeBounceOut,
    elastic: easeElasticOut,
}

export const EASING_OPTIONS = [
    { id: "linear", name: "Linear" },
    { id: "smooth", name: "Smooth" },
    { id: "expOut", name: "Exponential" },
    { id: "snap", name: "Snap" },
    { id: "bounce", name: "Bounce" },
    { id: "elastic", name: "Elastic" },
]

export const getEasingFunction = (name) => EASING_MAP[name] || easeExpOut

const normalizeCursorCoords = (coords = []) => coords
    .filter(event => event && Number.isFinite(event.x) && Number.isFinite(event.y) && Number.isFinite(event.timestamp))
    .map(({ x, y, timestamp }) => ({ x, y, timestamp }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .reduce((events, event) => {
        if (events.at(-1)?.timestamp === event.timestamp) events[events.length - 1] = event
        else events.push(event)
        return events
    }, [])

export const applyInertia = (coords, duration, inertia = 400) => {
    const coordsWithInertia = []
    const frameDuration = 1000 / INERTIA_FPS
    const input = normalizeCursorCoords(coords)

    if (input.length > 0) {
        // Interpolate between captured mouse events before applying inertia.
        // This keeps motion smooth even when OS tracking delivers uneven samples.
        const SMOOTHING_SCALE = 0.25
        const tau = Math.max(inertia * SMOOTHING_SCALE, frameDuration)
        const baseAlpha = 1 - Math.exp(-frameDuration / tau)

        let position = { x: input[0].x, y: input[0].y }
        const velocity = { x: 0, y: 0 }
        let nextIndex = 1
        let prevTarget = input[0]

        for (let timestamp = 0; timestamp <= duration / frameDuration; timestamp += 1) {
            const frameTime = timestamp * frameDuration

            while (nextIndex < input.length - 1 && input[nextIndex].timestamp < frameTime) {
                nextIndex += 1
            }

            let target
            if (frameTime <= input[0].timestamp) target = input[0]
            else if (frameTime >= input.at(-1).timestamp) target = input.at(-1)
            else {
                const from = input[nextIndex - 1]
                const to = input[nextIndex]
                const span = Math.max(to.timestamp - from.timestamp, 1)
                const interpolator = (frameTime - from.timestamp) / span
                target = {
                    x: from.x + (to.x - from.x) * interpolator,
                    y: from.y + (to.y - from.y) * interpolator,
                    timestamp: frameTime,
                }
            }

            const dx = target.x - position.x
            const dy = target.y - position.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            const inputDx = target.x - prevTarget.x
            const inputDy = target.y - prevTarget.y
            const inputSpeed = Math.sqrt(inputDx * inputDx + inputDy * inputDy)

            const MAX_DIST = 180
            const distFactor = Math.min(dist / MAX_DIST, 1.0)
            const MAX_SPEED = 60
            const speedFactor = Math.min(inputSpeed / MAX_SPEED, 1.0)
            const adaptiveFactor = Math.max(distFactor, speedFactor)
            const alpha = baseAlpha + (1 - baseAlpha) * adaptiveFactor * 0.45

            const VELOCITY_DECAY = 0.72
            velocity.x = velocity.x * VELOCITY_DECAY + dx * alpha * (1 - VELOCITY_DECAY)
            velocity.y = velocity.y * VELOCITY_DECAY + dy * alpha * (1 - VELOCITY_DECAY)

            const predictFactor = Math.min(adaptiveFactor * 0.18, 0.16)

            position = {
                x: position.x + dx * alpha + velocity.x * predictFactor,
                y: position.y + dy * alpha + velocity.y * predictFactor,
            }

            // Snap when very close to avoid infinite asymptotic approach
            if (dist < 1.0) {
                position.x = target.x
                position.y = target.y
            }

            position.timestamp = timestamp * frameDuration
            position.t = timestamp
            coordsWithInertia.push(position)
            prevTarget = target
        }
    } else {
        for (let timestamp = 0; timestamp <= duration / frameDuration; timestamp += 1) {
            coordsWithInertia.push({ x: 0, y: 0, timestamp: timestamp * frameDuration, t: timestamp })
        }
    }

    const map = new Map()
    let lastCoord = { t: 0, timestamp: 0, x: 0, y: 0 }
    for (const coord of coordsWithInertia) {
        map.set(coord.t, coord)
        lastCoord = coord
    }
    map.set("last", lastCoord)

    return map
}

export const getInertiaCoords = (timestamp, map) => {
    const frameTime = Math.max(timestamp, 0) / (1000 / INERTIA_FPS)
    const f0 = Math.max(0, Math.floor(frameTime))
    const interpolator = frameTime - f0

    let a = map.get(f0)
    if (!a) a = map.get("last")
    const b = map.get(f0 + 1) || a

    return {
        x: a.x + (b.x - a.x) * interpolator,
        y: a.y + (b.y - a.y) * interpolator,
    }
}

export const serializeEntitySlice = (slice, serializeEntities = true, selector = selectAll) => {
    const serialized = { ...slice }
    delete serialized.ids
    delete serialized.entities
    if (serializeEntities) serialized.entities = selector(slice)
    return serialized
}

export const getCoords = (screenVideoDimensions, videoDetails, timestamp, map, normalize = false) => {
    // Linearly interpolate between adjacent cursor frames instead of rounding to
    // the nearest one. Rounding quantizes the output to 16.67ms steps which
    // shows up as horizontal stepping under zoom magnification.
    const clamped = Math.max(0, Math.min(timestamp, videoDetails.end))
    const { x, y } = getInertiaCoords(clamped, map)

    if (normalize) return { x: x / screenVideoDimensions.x, y: y / screenVideoDimensions.y }
    return { x, y }
}

export const getFullScreenScale = (cameraVideoDimensions, rendererDims) => {
    const cameraMask = cropToCenteredRect(
        { width: rendererDims.x, height: rendererDims.y },
        { width: cameraVideoDimensions.x, height: cameraVideoDimensions.y },
    )

    if (rendererDims.x / rendererDims.y > cameraMask.width / cameraMask.height)
        return rendererDims.x / cameraMask.width
    else
        return rendererDims.y / cameraMask.height
}

export const cropToCenteredRect = (outputRect, inputRect, borderRadius = 0) => {
    let cropParams
    if (outputRect.width / outputRect.height > inputRect.width / inputRect.height) {
        // video container is narrower than box
        const height = inputRect.width * outputRect.height / outputRect.width
        cropParams = {
            x: 0,
            y: (inputRect.height - height) * .5,
            width: inputRect.width,
            height
        }
    } else {
        // video container is wider than box
        const width = inputRect.height * outputRect.width / outputRect.height
        cropParams = {
            x: (inputRect.width - width) * .5,
            y: 0,
            width,
            height: inputRect.height
        }
    }
    if (typeof borderRadius === "number")
        cropParams.radius = Math.min(cropParams.width, cropParams.height) * borderRadius
    return cropParams
}

export const getRenderQualityLabel = value => {
    switch (value) {
        case "very_high": return "Very high"
        case "high": return "High"
        case "medium": return "Medium"
        case "low": return "Low"
        case "very_low": return "Very low"
        default: return "Medium"
    }
}

export const isRenderRendering = render =>
    render.status === RENDER_STARTING ||
    render.status === RENDER_INITIALIZING ||
    render.status === RENDER_RENDERING ||
    render.status === RENDER_PROCESSING_AUDIO ||
    render.status === RENDER_UPLOADING ||
    render.status === RENDER_CANCELING

export const getProjectState = (state = null) => {
    // Pass null as state if hasProject is false
    const clonedState = state ? structuredClone(state) : null

    if (clonedState) {
        delete clonedState.undoableState.past
        delete clonedState.undoableState.future
    }

    return clonedState
}

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export const pxToMs = (px, pxPerMs) => px / pxPerMs

export const msToPx = (ms, pxPerMs) => ms * pxPerMs

// drawGradient and getGroupedMouseEvents moved to ./sceneHelpers so the
// preview web worker (Scene → Background → ...) can import them without
// dragging the rest of this file (every redux slice, react-redux, d3-ease)
// into the worker bundle. Re-exported here so main-thread consumers that
// still import them from @shared/helpers keep working.
export { drawGradient, getGroupedMouseEvents } from "./sceneHelpers"

export const formatX = value => `${Number(value).toFixed(2)}×`
export const formatPx = value => `${value}px`
export const formatPercent = value => `${Math.round(Number(value) * 100)}%`
export const formatFixed = value => Number(value).toFixed(2)
export const formatMs = value => `${toS(Number(value)).toFixed(2)}s`

export const svgToBmp = async (svg, size = { x: 150, y: 150 }) => {
    const img = new Image()

    await new Promise((resolve, reject) => {
        img.addEventListener("load", resolve, { once: true })
        img.addEventListener("error", reject, { once: true })
        img.src = svg
    })

    const canvas = new OffscreenCanvas(size.x, size.y)
    canvas.getContext("2d").drawImage(img, 0, 0, size.x, size.y)

    return createImageBitmap(canvas)
}

export const getGridBackgroundImage = gridSpacing =>
    `repeating-linear-gradient(
        to right,
        color-mix(in oklab, var(--color-base-content) 10%, transparent) 0,
        color-mix(in oklab, var(--color-base-content) 10%, transparent) 1px,
        transparent 1px,
        transparent ${gridSpacing}px
    )`
