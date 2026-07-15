import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
    useDispatch,
    useSelector,
    useStore
} from "react-redux"
import { useResizeDetector } from "react-resize-detector"
import {
    AUDIO_TRACKS,
    clamp,
    CLIPS,
    getGridBackgroundImage,
    msToPx,
    OVERLAY_TRACKS,
    pxToMs,
    SPATIALS,
    SUBTITLES,
    ZOOMS
} from "@shared/helpers"
import {
    addAudioClip,
    addTrack as addAudioTrack,
    selectAudioClipIds,
    selectAudioTracks,
    toggleTrackLock,
    toggleTrackMute,
    removeTrack as removeAudioTrack,
    selectAllAudioClips
} from "@shared/redux/audioTrackSlice"
import { selectAllClicks } from "@shared/redux/clickSlice"
import { selectAllClips, selectClipIds } from "@shared/redux/clipSlice"
import {
    closeAllContextMenus,
    selectIsClickMenuOpen,
    selectIsClipMenuOpen,
    selectIsMaskMenuOpen,
    selectIsNewClipMenuOpen,
    selectIsNewMaskMenuOpen,
    selectIsNewSubtitleMenuOpen,
    selectIsNewZoomMenuOpen,
    selectIsSubtitleMenuOpen,
    selectIsZoomMenuOpen
} from "@shared/redux/contextMenuSlice"
import {
    selectAreHotkeysEnabled,
    selectDuration,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import {
    addOverlay,
    addOverlayTrack,
    selectAllOverlays as selectAllOverlaysForDrop,
    selectOverlayIds,
    selectOverlayTracks,
    selectNextOverlayTrackId,
    toggleOverlayTrackLock,
    toggleOverlayTrackVisibility,
    removeOverlayTrack
} from "@shared/redux/overlaySlice"
import {
    selectSubtitleIds,
    selectTotalSubtitles
} from "@shared/redux/subtitleSlice"
import {
    selectActiveSnapLine,
    selectIsMaskingModeEnabled,
    selectIsSnappingEnabled,
    selectOffset,
    selectPxPerMs,
    selectSelectedIds,
    selectSelectedRow,
    selectTime,
    setOffset,
    setPxPerMs,
    setScrollLeft,
    setSelectedIds,
    setSnappingLines,
    setTime,
    setWidth
} from "@shared/redux/timelineSlice"
import { getGroup, withGroup } from "@shared/redux/actionEnhancers"
import { selectAllMasks } from "@shared/redux/maskSlice"
import { selectAllOverlays } from "@shared/redux/overlaySlice"
import { selectAllSpatials } from "@shared/redux/spatialSlice"
import { selectAllSubtitles } from "@shared/redux/subtitleSlice"
import { selectSpatialIds } from "@shared/redux/spatialSlice"
import { selectAllZooms, selectZoomIds } from "@shared/redux/zoomSlice"
import { selectKeyboardLayoutIds } from "@shared/redux/keyboardLayoutSlice"
import { selectMouseStyleIds } from "@shared/redux/mouseStyleAnimSlice"
import { selectDrawnMouseIds } from "@shared/redux/drawnMouseAnimSlice"
import { selectAppSceneIds } from "@shared/redux/appSceneAnimSlice"
import { subscribe, isDragActive } from "../../dragState"
import AddTrackButton from "./AddTrackButton"
import AudioTracks from "./AudioTracks"
import { resolveAudioTrackPlacement } from "./audioTrackPlacement"
import Clicks from "./Clicks"
import AppScenes from "./AppScenes"
import Clips from "./Clips"
import Cursor from "./Cursor"
import KeyboardLayouts from "./KeyboardLayouts"
import Masks from "./Masks"
import MouseStyles from "./MouseStyles"
import DrawnMice from "./DrawnMice"
import Minimap from "./Minimap"
import OverlayTracks from "./OverlayTracks"
import SpatialClips from "./SpatialClips"
import Subtitles from "./Subtitles"
import TimelineToolbar from "./TimelineToolbar"
import TimeScale from "./TimeScale"
import TrackHeader from "./TrackHeader"
import Zooms from "./Zooms"

function TimelineClockSnapBridge({ entitySnapLines, isPlaying, isSnappingEnabled }) {
    const dispatch = useDispatch()
    const time = useSelector(selectTime)

    useEffect(() => {
        if (!isSnappingEnabled || isPlaying) return
        const timer = window.setTimeout(() => {
            const lines = entitySnapLines.slice()
            let low = 0
            let high = lines.length
            while (low < high) {
                const middle = (low + high) >> 1
                if (lines[middle] < time) low = middle + 1
                else high = middle
            }
            if (lines[low] !== time) lines.splice(low, 0, time)
            dispatch(setSnappingLines(lines))
        }, 80)
        return () => window.clearTimeout(timer)
    }, [dispatch, entitySnapLines, isPlaying, isSnappingEnabled, time])

    return null
}

export default function Timeline({ onRequestOpenInspector }) {

    const dispatch = useDispatch()
    const store = useStore()

    const duration = useSelector(selectDuration)

    const isPlaying = useSelector(selectIsPlaying)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const pxPerMs = useSelector(selectPxPerMs)
    const isMaskingModeEnabled = useSelector(selectIsMaskingModeEnabled)
    const timelineOffset = useSelector(selectOffset)

    const totalSubtitles = useSelector(selectTotalSubtitles)
    const selectedIds = useSelector(selectSelectedIds)
    const selectedRow = useSelector(selectSelectedRow)
    const clipIds = useSelector(selectClipIds)
    const zoomIds = useSelector(selectZoomIds)
    const spatialIds = useSelector(selectSpatialIds)
    const subtitleIds = useSelector(selectSubtitleIds)
    const audioClipIds = useSelector(selectAudioClipIds)
    const overlayIds = useSelector(selectOverlayIds)
    const keyboardLayoutIds = useSelector(selectKeyboardLayoutIds)
    const mouseStyleIds = useSelector(selectMouseStyleIds)
    const drawnMouseIds = useSelector(selectDrawnMouseIds)
    const appSceneIds = useSelector(selectAppSceneIds)
    const audioTracks = useSelector(selectAudioTracks)
    const overlayTracks = useSelector(selectOverlayTracks)
    const activeSnapLine = useSelector(selectActiveSnapLine)
    const isSnappingEnabled = useSelector(selectIsSnappingEnabled)

    // Snapping data selectors (moved from Controls.jsx)
    const clicks = useSelector(selectAllClicks)
    const clips = useSelector(selectAllClips)
    const zooms = useSelector(selectAllZooms)
    const subtitles = useSelector(selectAllSubtitles)
    const masks = useSelector(selectAllMasks)
    const spatialAnims = useSelector(selectAllSpatials)
    const audioClips = useSelector(selectAllAudioClips)
    const overlays = useSelector(selectAllOverlays)

    const isClipMenuOpen = useSelector(selectIsClipMenuOpen)
    const isClickMenuOpen = useSelector(selectIsClickMenuOpen)
    const isZoomMenuOpen = useSelector(selectIsZoomMenuOpen)
    const isSubtitleMenuOpen = useSelector(selectIsSubtitleMenuOpen)
    const isNewClipMenuOpen = useSelector(selectIsNewClipMenuOpen)
    const isNewZoomMenuOpen = useSelector(selectIsNewZoomMenuOpen)
    const isNewSubtitleMenuOpen = useSelector(selectIsNewSubtitleMenuOpen)
    const isMaskMenuOpen = useSelector(selectIsMaskMenuOpen)
    const isNewMaskMenuOpen = useSelector(selectIsNewMaskMenuOpen)

    const timelineWidth = useMemo(() => msToPx(duration, pxPerMs), [duration, pxPerMs])
    const gridSpacing = useMemo(() => {
        let ms
        if (pxPerMs < 0.01) ms = 600000
        else if (pxPerMs < 0.02) ms = 300000
        else if (pxPerMs < 0.04) ms = 60000
        else if (pxPerMs < 0.06) ms = 30000
        else if (pxPerMs < 0.08) ms = 10000
        else if (pxPerMs < 0.1) ms = 5000
        else if (pxPerMs < 0.15) ms = 2000
        else if (pxPerMs < 0.2) ms = 1000
        else ms = 500
        return msToPx(ms, pxPerMs)
    }, [pxPerMs])

    const [isDragOver, setIsDragOver] = useState(false)

    const container = useRef(null)
    const timeline = useRef(null)
    const headerScroll = useRef(null)
    const isPlayingRef = useRef(isPlaying)

    const { width: containerWidth } = useResizeDetector({ targetRef: container })
    const { width: timelineObservedWidth, height: timelineObservedHeight } = useResizeDetector({ targetRef: timeline })

    useEffect(() => {
        if (containerWidth !== undefined) dispatch(setWidth(containerWidth))
    }, [containerWidth, dispatch])

    useEffect(() => {
        if (timelineObservedWidth !== undefined && timelineObservedHeight !== undefined && container.current && timeline.current)
            dispatch(setOffset(timeline.current.getBoundingClientRect().left + container.current.scrollLeft))
    }, [timelineObservedWidth, timelineObservedHeight, containerWidth, dispatch])

    useHotkeys('esc', () => {
        dispatch(setSelectedIds([]))
        dispatch(closeAllContextMenus())
    }, { enabled: areHotkeysEnabled }, [areHotkeysEnabled])

    useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

    // Sync vertical scroll between track headers and timeline content
    useEffect(() => {
        const el = container.current
        if (!el) return
        const onScroll = () => {
            if (headerScroll.current) headerScroll.current.scrollTop = el.scrollTop

            if (!isPlayingRef.current) {
                dispatch(setScrollLeft(el.scrollLeft))
                if (isClipMenuOpen || isClickMenuOpen || isZoomMenuOpen || isSubtitleMenuOpen || isNewClipMenuOpen ||
                    isNewZoomMenuOpen || isNewSubtitleMenuOpen || isMaskMenuOpen || isNewMaskMenuOpen)
                    dispatch(closeAllContextMenus())
            }
        }
        el.addEventListener("scroll", onScroll)
        return () => el.removeEventListener("scroll", onScroll)
    }, [dispatch, pxPerMs, isClipMenuOpen, isClickMenuOpen, isZoomMenuOpen, isSubtitleMenuOpen, isNewClipMenuOpen,
        isNewZoomMenuOpen, isNewSubtitleMenuOpen, isMaskMenuOpen, isNewMaskMenuOpen])

    // Zoom steps for mousewheel zoom (same formula as Controls.jsx)
    const zoomSteps = useMemo(() => {
        const MIN_SCALE = 0.025, MAX_SCALE = 0.35, STEP = 0.025
        const result = [containerWidth ? containerWidth / duration : MIN_SCALE]
        for (let i = MIN_SCALE; i <= MAX_SCALE; i += STEP) result.push(i)
        result.sort()
        return result
    }, [duration, containerWidth])

    // Ctrl+Mousewheel zoom centered on mouse position
    useEffect(() => {
        const el = container.current
        if (!el || !duration) return
        const onWheel = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                const rect = el.getBoundingClientRect()
                const mouseXMs = pxToMs(e.clientX - rect.left + el.scrollLeft, pxPerMs)
                const delta = e.deltaY > 0 ? -1 : 1
                const currentIndex = zoomSteps.findIndex(step => step >= pxPerMs)
                const nextIndex = clamp(currentIndex + delta, 0, zoomSteps.length - 1)
                const newPxPerMs = zoomSteps[nextIndex]
                if (newPxPerMs !== pxPerMs) {
                    dispatch(setPxPerMs(newPxPerMs))
                    requestAnimationFrame(() => {
                        if (el) el.scrollLeft = msToPx(mouseXMs, newPxPerMs) - (e.clientX - rect.left)
                    })
                }
            }
        }
        el.addEventListener('wheel', onWheel, { passive: false })
        return () => el.removeEventListener('wheel', onWheel)
    }, [dispatch, pxPerMs, zoomSteps, duration])

    // Unselect deleted entities
    useEffect(() => {
        if (selectedIds.length >= 1) {
            let ids = null
            switch (selectedRow) {
                case SUBTITLES: ids = subtitleIds; break
                case CLIPS: ids = clipIds; break
                case ZOOMS: ids = zoomIds; break
                case SPATIALS: ids = spatialIds; break
                case AUDIO_TRACKS: ids = audioClipIds; break
                case OVERLAY_TRACKS: ids = overlayIds; break
            }
            if (ids) {
                const newSelectedIds = selectedIds.filter(id => ids.includes(id))
                if (newSelectedIds.length !== selectedIds.length) dispatch(setSelectedIds(newSelectedIds))
            }
        }
    }, [clipIds, dispatch, selectedIds, selectedIds.length, selectedRow, subtitleIds, zoomIds, spatialIds, audioClipIds, overlayIds])

    const scrollToCursor = useCallback(t => {
        const scrollThreshold = pxToMs(container.current.clientWidth, pxPerMs) * 0.8
        const start = pxToMs(container.current.scrollLeft, pxPerMs)
        const end = start + pxToMs(container.current.clientWidth, pxPerMs)
        if (t < start || t > end) container.current.scrollLeft = msToPx(t - scrollThreshold, pxPerMs)
        else if (isPlaying && t > scrollThreshold) container.current.scrollLeft = msToPx(t - scrollThreshold, pxPerMs)
    }, [pxPerMs, isPlaying])

    // Click-to-seek: click on empty timeline area to jump playhead there
    const handleTimelineClick = useCallback(e => {
        if (isPlaying || !container.current) return
        // Only seek if clicking directly on the grid background (not on a clip/action)
        if (e.target.closest('[class*="absolute"]') && !e.target.dataset.dropZone) return
        const t = clamp(pxToMs(e.clientX - timelineOffset + container.current.scrollLeft, pxPerMs), 0, duration)
        dispatch(setTime(t))
    }, [isPlaying, pxPerMs, timelineOffset, duration, dispatch])

    const entitySnapLines = useMemo(() => {
        const allElements = [...clicks, ...clips, ...zooms, ...spatialAnims, ...subtitles, ...audioClips, ...overlays]
        if (isMaskingModeEnabled) allElements.push(...masks)
        return [...new Set(allElements.flatMap(({ start, end }) => [start, end]))]
            .sort((a, b) => a - b)
    }, [clicks, clips, zooms, spatialAnims, subtitles, masks, audioClips, overlays, isMaskingModeEnabled])

    // Fit to view: set zoom so entire timeline fits in container
    const handleFitToView = useCallback(() => {
        if (containerWidth && duration) dispatch(setPxPerMs(containerWidth / duration))
    }, [dispatch, containerWidth, duration])

    // Show drag-over indicator when a custom pointer drag is active
    useEffect(() => subscribe(() => setIsDragOver(isDragActive())), [])

    // Listen for custom drop events (from pointer-based drag system)
    // Only handles "timeline" zone — "preview"/"overlay-canvas" are handled by OverlayCanvas
    useEffect(() => {
        const handleDrop = (e) => {
            const { data, target } = e.detail
            if (!data || !target) return
            if (target.zone !== "timeline") return

            if (!duration) return

            const isAudio = data.type === "audio" || data.category === "audio"
            const assetDuration = isAudio ? (data.duration || 5000) : 4000
            const currentState = store.getState()
            const pointerTime = Number.isFinite(e.detail.clientX) && container.current
                ? pxToMs(e.detail.clientX - timelineOffset + container.current.scrollLeft, pxPerMs)
                : selectTime(currentState)
            const dropTime = clamp(
                pointerTime,
                0,
                Math.max(0, duration - Math.min(assetDuration, duration))
            )
            const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            const group = getGroup("asset-drop")
            const currentAudioTracks = selectAudioTracks(currentState)
            const currentAudioClips = selectAllAudioClips(currentState)
            const currentOverlayTracks = selectOverlayTracks(currentState)
            const currentOverlays = selectAllOverlaysForDrop(currentState)
            const currentNextAudioTrackId = currentState.undoableState.present.audioTrackAnims.nextTrackId
            const currentNextOverlayTrackId = selectNextOverlayTrackId(currentState)

            if (isAudio) {
                const audioEnd = Math.min(dropTime + assetDuration, duration)
                const placement = resolveAudioTrackPlacement({
                    tracks: currentAudioTracks,
                    audioClips: currentAudioClips,
                    start: dropTime,
                    end: audioEnd,
                    nextTrackId: currentNextAudioTrackId,
                })
                if (placement.needsNewTrack) dispatch(withGroup(addAudioTrack(), group))
                dispatch(withGroup(addAudioClip({
                    id: `audio-${uid}`,
                    start: dropTime,
                    end: audioEnd,
                    trackIndex: placement.trackId,
                    name: data.name || "Audio",
                    volume: 1,
                    src: data.src || null
                }), group))
            } else if (data.type === "text" || data.type === "shape" || data.type === "image") {
                // Find a track without overlapping items, or create a new one
                const start = dropTime
                const end = Math.min(dropTime + 4000, duration)
                let trackId = null
                let needsNewTrack = false

                if (currentOverlayTracks.length > 0) {
                    const available = currentOverlayTracks.find(track => {
                        if (track.locked) return false
                        const trackOverlays = currentOverlays.filter(o => o.trackIndex === track.id)
                        return !trackOverlays.some(o => o.start < end && o.end > start)
                    })
                    trackId = available ? available.id : null
                }

                if (trackId === null) {
                    needsNewTrack = true
                    trackId = currentNextOverlayTrackId
                }

                const base = {
                    id: `overlay-${uid}`,
                    start, end, trackIndex: trackId,
                    opacity: 1, position: { x: 0.5, y: 0.5 },
                }
                if (needsNewTrack) dispatch(withGroup(addOverlayTrack(), group))
                if (data.type === "text") {
                    dispatch(withGroup(addOverlay({ ...base, overlayType: "text", text: data.config?.text || "Text",
                        fontSize: data.config?.fontSize || 32, fontWeight: data.config?.fontWeight || 600,
                        color: data.config?.color || "#ffffff" }), group))
                } else if (data.type === "shape") {
                    dispatch(withGroup(addOverlay({ ...base, overlayType: "shape", shapeType: data.config?.shapeType || "rect",
                        fill: data.config?.fill || "#6C5CE7", stroke: data.config?.stroke || "none",
                        strokeWidth: data.config?.strokeWidth || 0, width: data.config?.width || 200,
                        height: data.config?.height || 100, borderRadius: data.config?.borderRadius || 0,
                        radius: data.config?.radius || 0 }), group))
                } else {
                    dispatch(withGroup(addOverlay({ ...base, overlayType: "image", name: data.name || "Image",
                        src: data.src || null, width: 320, height: 240 }), group))
                }
            }
        }
        window.addEventListener("flowtake-drop", handleDrop)
        return () => window.removeEventListener("flowtake-drop", handleDrop)
    }, [dispatch, duration, pxPerMs, timelineOffset, store])

    const mini = isMaskingModeEnabled

    return (
        <div className="w-full h-full px-2 pb-2 pt-1 min-h-0 select-none">
            <TimelineClockSnapBridge
                entitySnapLines={entitySnapLines}
                isPlaying={isPlaying}
                isSnappingEnabled={isSnappingEnabled}
            />
            <div className="flowtake-timeline-surface flex flex-col h-full bg-base-100 rounded-xl relative z-0 overflow-hidden">

                {/* Toolbar */}
                <TimelineToolbar
                    zoomSteps={zoomSteps}
                    onFitToView={handleFitToView}
                    onRequestOpenInspector={onRequestOpenInspector}
                />
                <Minimap containerRef={container} />

                <div className="flex flex-1 min-h-0">

                    {/* Track headers - left column */}
                    <div ref={headerScroll}
                        className="w-36 shrink-0 flex-col border-r border-base-content/10 overflow-hidden hidden md:flex">
                        {/* TimeScale spacer */}
                        <div className="h-6 shrink-0" />
                        {/* Clicks row spacer */}
                        <div className={`${mini ? "h-2" : "h-4"} shrink-0 flex items-center px-2`}>
                            {!mini && <span className="text-[9px] opacity-30 truncate">Clicks</span>}
                        </div>
                        {/* Built-in tracks */}
                        <TrackHeader name="Clips" color="primary" isMinimized={mini} height="h-16" />
                        <TrackHeader name="Zooms" color="secondary" isMinimized={mini} />
                        <TrackHeader name="Spatial" color="accent" isMinimized={mini} />
                        {totalSubtitles > 0 && <TrackHeader name="Subtitles" color="tertiary" isMinimized={mini} />}

                        {keyboardLayoutIds.length > 0 && <TrackHeader name="Keyboard" color="primary" isMinimized={mini} />}
                        {mouseStyleIds.length > 0 && <TrackHeader name="Cursor" color="primary" isMinimized={mini} />}
                        {drawnMouseIds.length > 0 && <TrackHeader name="Drawn Mouse" color="accent" isMinimized={mini} />}
                        {appSceneIds.length > 0 && <TrackHeader name="Scene" color="accent" isMinimized={mini} />}

                        {isMaskingModeEnabled && <TrackHeader name="Masks" color="neutral" isMinimized={false} />}

                        {/* Track group separator */}
                        {(audioTracks.length > 0 || overlayTracks.length > 0) && !mini && (
                            <div className="h-px bg-base-content/10 mx-2 my-1" />
                        )}

                        {/* Audio track headers */}
                        {audioTracks.length > 0 && (
                            <div>
                                {audioTracks.map(track => (
                                    <TrackHeader
                                        key={`ah-${track.id}`}
                                        name={track.name}
                                        color="secondary"
                                        isMuted={track.muted}
                                        isLocked={track.locked}
                                        onToggleMute={() => dispatch(toggleTrackMute(track.id))}
                                        onToggleLock={() => dispatch(toggleTrackLock(track.id))}
                                        onRemove={() => dispatch(removeAudioTrack(track.id))}
                                        isRemovable
                                        isMinimized={mini}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Overlay track headers */}
                        {overlayTracks.length > 0 && (
                            <div>
                                {overlayTracks.map(track => (
                                    <TrackHeader
                                        key={`oh-${track.id}`}
                                        name={track.name}
                                        color="accent"
                                        isLocked={track.locked}
                                        isVisible={track.visible}
                                        onToggleLock={() => dispatch(toggleOverlayTrackLock(track.id))}
                                        onToggleVisible={() => dispatch(toggleOverlayTrackVisibility(track.id))}
                                        onRemove={() => dispatch(removeOverlayTrack(track.id))}
                                        isRemovable
                                        isMinimized={mini}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Add Track */}
                        <div className="mt-auto py-1.5 px-1 border-t border-base-content/5">
                            <AddTrackButton />
                        </div>
                    </div>

                    {/* Timeline tracks content */}
                    <div ref={container}
                        data-drop-zone="timeline"
                        className={`flowtake-timeline-scroll flex-1 px-8 ${isPlaying ? "overflow-x-hidden" : "overflow-x-auto scroll-smooth"} overflow-y-auto no-scrollbar relative`}>
                        {duration && <div ref={timeline} onClick={handleTimelineClick}
                            className="grid grid-cols-1 gap-1 relative bg-size-[100%_100%] z-0 min-h-full"
                            style={{ width: `${timelineWidth}px`, backgroundImage: getGridBackgroundImage(gridSpacing) }}>

                            <Cursor onScrollToCursor={scrollToCursor} />
                            <TimeScale />

                            <Clicks />
                            <Clips />
                            <Zooms />
                            <SpatialClips />
                            {totalSubtitles > 0 && <Subtitles />}
                            {keyboardLayoutIds.length > 0 && <KeyboardLayouts />}
                            {mouseStyleIds.length > 0 && <MouseStyles />}
                            {drawnMouseIds.length > 0 && <DrawnMice />}
                            {appSceneIds.length > 0 && <AppScenes />}
                            {isMaskingModeEnabled && <Masks />}

                            {/* Track group separator */}
                            {(audioTracks.length > 0 || overlayTracks.length > 0) && !mini && (
                                <div className="h-px bg-base-content/8 -mx-1" />
                            )}

                            {/* Audio & Overlay tracks - rendered inline */}
                            <AudioTracks />
                            <OverlayTracks />

                            {/* Snap line indicator */}
                            {activeSnapLine !== null && (
                                <div className="absolute top-0 bottom-0 w-px bg-warning/70 z-50 pointer-events-none"
                                    style={{ left: `${msToPx(activeSnapLine, pxPerMs)}px` }}>
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-warning" />
                                </div>
                            )}
                        </div>}

                        {/* Drop zone indicator */}
                        {isDragOver && (
                            <div className="absolute inset-0 z-40 flex items-end justify-center pb-4 pointer-events-none">
                                <div className="bg-info/15 border-2 border-dashed border-info/50 rounded-lg px-6 py-3 backdrop-blur-sm">
                                    <span className="text-xs font-medium text-info">Drop here to add to timeline</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
