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
    useSelector
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
import { getBookmarkSnapPoints } from "@shared/editor/timelineBookmarks"
import { getTimelineCanvasEnd } from "@shared/editor/timelineMovePlacement"
import {
    createAudioLaneItem,
    createOverlayLaneItem,
    getOverlayLaneInsertDuration,
    planTimelineLaneInsert,
} from "@shared/editor/timelineLaneInsert"
import { getGroup, withGroup } from "@shared/redux/actionEnhancers"
import {
    addAudioClip,
    addTrack as addAudioTrack,
    selectAudioClipIds,
    selectNextAudioTrackId,
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
import { selectActiveSceneBookmarks } from "@shared/redux/sceneSlice"
import {
    selectActiveSnapLine,
    selectIsMaskingModeEnabled,
    selectIsSnappingEnabled,
    selectOffset,
    selectPxPerMs,
    selectSelectedIds,
    selectSelectedRow,
    setOffset,
    setPxPerMs,
    setScrollLeft,
    setSelectedBookmarkId,
    setSelectedIds,
    setSelectedRow,
    setSnappingLines,
    setTime,
    setWidth
} from "@shared/redux/timelineSlice"
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
import Clicks from "./Clicks"
import AppScenes from "./AppScenes"
import Clips from "./Clips"
import Cursor from "./Cursor"
import KeyboardLayouts from "./KeyboardLayouts"
import Masks from "./Masks"
import MouseStyles from "./MouseStyles"
import DrawnMice from "./DrawnMice"
import Minimap from "./Minimap"
import MobileTrackControls from "./MobileTrackControls"
import OverlayTracks from "./OverlayTracks"
import SpatialClips from "./SpatialClips"
import Subtitles from "./Subtitles"
import TimelineToolbar from "./TimelineToolbar"
import TimelineMarkers, { TimelineMarkersHeader } from "./TimelineMarkers"
import TimeScale from "./TimeScale"
import TrackHeader from "./TrackHeader"
import Zooms from "./Zooms"

const TIMELINE_HORIZONTAL_PADDING_PX = 8

function SnappingLinesSync() {
    const dispatch = useDispatch()
    const isPlaying = useSelector(selectIsPlaying)
    const isSnappingEnabled = useSelector(selectIsSnappingEnabled)
    const isMaskingModeEnabled = useSelector(selectIsMaskingModeEnabled)
    const clicks = useSelector(selectAllClicks)
    const clips = useSelector(selectAllClips)
    const zooms = useSelector(selectAllZooms)
    const subtitles = useSelector(selectAllSubtitles)
    const masks = useSelector(selectAllMasks)
    const spatialAnims = useSelector(selectAllSpatials)
    const audioClips = useSelector(selectAllAudioClips)
    const overlays = useSelector(selectAllOverlays)
    const bookmarks = useSelector(selectActiveSceneBookmarks)

    const staticLines = useMemo(() => {
        const elements = [
            ...clicks,
            ...clips,
            ...zooms,
            ...spatialAnims,
            ...subtitles,
            ...audioClips,
            ...overlays,
            ...(isMaskingModeEnabled ? masks : [])
        ]
        return [...new Set([
            ...elements.flatMap(({ start, end }) => [start, end]),
            ...getBookmarkSnapPoints(bookmarks),
        ].filter(Number.isFinite))].sort((a, b) => a - b)
    }, [
        audioClips,
        bookmarks,
        clicks,
        clips,
        isMaskingModeEnabled,
        masks,
        overlays,
        spatialAnims,
        subtitles,
        zooms,
    ])

    useEffect(() => {
        if (!isSnappingEnabled || isPlaying) return
        dispatch(setSnappingLines(staticLines))
    }, [
        dispatch,
        isPlaying,
        isSnappingEnabled,
        staticLines,
    ])

    return null
}

export default function Timeline() {

    const dispatch = useDispatch()

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
    const nextAudioTrackId = useSelector(selectNextAudioTrackId)
    const allAudioClipsForDrop = useSelector(selectAllAudioClips)
    const overlayTracks = useSelector(selectOverlayTracks)
    const nextOverlayTrackId = useSelector(selectNextOverlayTrackId)
    const allOverlaysForDrop = useSelector(selectAllOverlaysForDrop)
    const activeSnapLine = useSelector(selectActiveSnapLine)
    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
    const activeAudioTrackIds = useMemo(() => new Set(
        allAudioClipsForDrop
            .filter(clip => selectedIdSet.has(clip.id))
            .map(clip => clip.trackIndex)
    ), [allAudioClipsForDrop, selectedIdSet])
    const activeOverlayTrackIds = useMemo(() => new Set(
        allOverlaysForDrop
            .filter(overlay => selectedIdSet.has(overlay.id))
            .map(overlay => overlay.trackIndex)
    ), [allOverlaysForDrop, selectedIdSet])
    const showZoomTrack = zoomIds.length > 0 || selectedRow === ZOOMS
    const showSpatialTrack = spatialIds.length > 0 || selectedRow === SPATIALS

    const isClipMenuOpen = useSelector(selectIsClipMenuOpen)
    const isClickMenuOpen = useSelector(selectIsClickMenuOpen)
    const isZoomMenuOpen = useSelector(selectIsZoomMenuOpen)
    const isSubtitleMenuOpen = useSelector(selectIsSubtitleMenuOpen)
    const isNewClipMenuOpen = useSelector(selectIsNewClipMenuOpen)
    const isNewZoomMenuOpen = useSelector(selectIsNewZoomMenuOpen)
    const isNewSubtitleMenuOpen = useSelector(selectIsNewSubtitleMenuOpen)
    const isMaskMenuOpen = useSelector(selectIsMaskMenuOpen)
    const isNewMaskMenuOpen = useSelector(selectIsNewMaskMenuOpen)

    // Keep a finite editable tail after the current sequence end. This gives
    // the final segment a visible drop area; committing a move grows duration
    // and the tail follows the new endpoint.
    const timelineWidth = useMemo(
        () => msToPx(getTimelineCanvasEnd(duration), pxPerMs),
        [duration, pxPerMs]
    )
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
    const [isFollowingPlayback, setIsFollowingPlayback] = useState(true)
    const [isOverviewOpen, setIsOverviewOpen] = useState(false)

    const timelineSurface = useRef(null)
    const container = useRef(null)
    const timeline = useRef(null)
    const headerScroll = useRef(null)
    const rulerContent = useRef(null)
    const playheadContent = useRef(null)
    const isPlayingRef = useRef(isPlaying)
    const scrollFrame = useRef(null)
    const didAutoFitRef = useRef(false)

    const { width: containerWidth } = useResizeDetector({ targetRef: container })
    const { width: timelineObservedWidth, height: timelineObservedHeight } = useResizeDetector({ targetRef: timeline })

    useEffect(() => {
        if (containerWidth !== undefined) dispatch(setWidth(containerWidth))
    }, [containerWidth, dispatch])

    useEffect(() => {
        if (timelineObservedWidth !== undefined && timelineObservedHeight !== undefined && container.current)
            dispatch(setOffset(timeline.current.getBoundingClientRect().left + container.current.scrollLeft))
    }, [timelineObservedWidth, timelineObservedHeight, dispatch])

    useHotkeys('esc', () => {
        dispatch(setSelectedIds([]))
        dispatch(setSelectedBookmarkId(null))
        dispatch(closeAllContextMenus())
    }, { enabled: areHotkeysEnabled }, [areHotkeysEnabled])

    useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

    // Sync vertical scroll between track headers and timeline content
    useEffect(() => {
        const el = container.current
        if (!el) return
        const onScroll = () => {
            if (headerScroll.current) headerScroll.current.scrollTop = el.scrollTop
            const horizontalTransform = `translate3d(${-el.scrollLeft}px, 0, 0)`
            if (rulerContent.current)
                rulerContent.current.style.transform = horizontalTransform
            if (playheadContent.current)
                playheadContent.current.style.transform = horizontalTransform
            if (scrollFrame.current === null) {
                scrollFrame.current = requestAnimationFrame(() => {
                    scrollFrame.current = null
                    dispatch(setScrollLeft(el.scrollLeft))
                })
            }

            if (!isPlayingRef.current
                && (isClipMenuOpen || isClickMenuOpen || isZoomMenuOpen
                    || isSubtitleMenuOpen || isNewClipMenuOpen || isNewZoomMenuOpen
                    || isNewSubtitleMenuOpen || isMaskMenuOpen || isNewMaskMenuOpen)) {
                dispatch(closeAllContextMenus())
            }
        }
        el.addEventListener("scroll", onScroll)
        onScroll()
        return () => {
            el.removeEventListener("scroll", onScroll)
            if (scrollFrame.current !== null) {
                cancelAnimationFrame(scrollFrame.current)
                scrollFrame.current = null
            }
        }
    }, [dispatch, isClipMenuOpen, isClickMenuOpen, isZoomMenuOpen, isSubtitleMenuOpen, isNewClipMenuOpen,
        isNewZoomMenuOpen, isNewSubtitleMenuOpen, isMaskMenuOpen, isNewMaskMenuOpen])

    useEffect(() => {
        const el = container.current
        if (!el) return
        const horizontalTransform = `translate3d(${-el.scrollLeft}px, 0, 0)`
        if (rulerContent.current)
            rulerContent.current.style.transform = horizontalTransform
        if (playheadContent.current)
            playheadContent.current.style.transform = horizontalTransform
    }, [timelineWidth])

    // Zoom steps for mousewheel zoom (same formula as Controls.jsx)
    const zoomSteps = useMemo(() => {
        const MIN_SCALE = 0.025, MAX_SCALE = 0.35, STEP = 0.025
        const availableWidth = Math.max(
            1,
            (containerWidth || 0) - TIMELINE_HORIZONTAL_PADDING_PX * 2
        )
        const result = [
            containerWidth && duration ? availableWidth / duration : MIN_SCALE
        ]
        for (let i = MIN_SCALE; i <= MAX_SCALE; i += STEP) result.push(i)
        result.sort()
        return result
    }, [duration, containerWidth])

    // Use the tracks viewport as the single scroll authority. Wheel input from
    // either the labels or the lanes moves the same viewport, then the normal
    // scroll listener mirrors vertical position to the labels.
    useEffect(() => {
        const surface = timelineSurface.current
        const el = container.current
        if (!surface || !el) return
        const onWheel = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                if (!duration || e.deltaY === 0) return
                const rect = el.getBoundingClientRect()
                const contentX = clamp(
                    e.clientX - rect.left - TIMELINE_HORIZONTAL_PADDING_PX,
                    0,
                    Math.max(
                        0,
                        el.clientWidth - TIMELINE_HORIZONTAL_PADDING_PX * 2
                    )
                )
                const mouseXMs = pxToMs(contentX + el.scrollLeft, pxPerMs)
                const delta = e.deltaY > 0 ? -1 : 1
                const currentIndex = zoomSteps.findIndex(step => step >= pxPerMs)
                const nextIndex = clamp(currentIndex + delta, 0, zoomSteps.length - 1)
                const newPxPerMs = zoomSteps[nextIndex]
                if (newPxPerMs !== pxPerMs) {
                    dispatch(setPxPerMs(newPxPerMs))
                    requestAnimationFrame(() => {
                        if (el)
                            el.scrollLeft = Math.max(
                                0,
                                msToPx(mouseXMs, newPxPerMs) - contentX
                            )
                    })
                }
                return
            }

            e.preventDefault()
            const lineMultiplier = e.deltaMode === 1 ? 16 : 1
            const deltaX = e.deltaX * lineMultiplier
            const deltaY = e.deltaY * lineMultiplier
            const isHorizontal = e.shiftKey || Math.abs(deltaX) > Math.abs(deltaY)

            if (isHorizontal) {
                const horizontalDelta = Math.abs(deltaX) > Math.abs(deltaY)
                    ? deltaX
                    : deltaY
                el.scrollLeft = Math.max(0, el.scrollLeft + horizontalDelta)
            } else {
                el.scrollTop = Math.max(0, el.scrollTop + deltaY)
                if (headerScroll.current)
                    headerScroll.current.scrollTop = el.scrollTop
            }
        }
        surface.addEventListener('wheel', onWheel, {
            passive: false,
            capture: true,
        })
        return () => surface.removeEventListener('wheel', onWheel, {
            capture: true,
        })
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
        const el = container.current
        if (!el || pxPerMs <= 0) return

        const viewportWidth = Math.max(
            1,
            el.clientWidth - TIMELINE_HORIZONTAL_PADDING_PX * 2
        )
        const playheadPx = msToPx(t, pxPerMs)
        const viewportStart = el.scrollLeft
        const viewportEnd = viewportStart + viewportWidth
        const followAnchor = viewportStart + viewportWidth * 0.72
        let nextScrollLeft = null

        if (playheadPx < viewportStart)
            nextScrollLeft = playheadPx
        else if (playheadPx > viewportEnd)
            nextScrollLeft = playheadPx - viewportWidth * 0.72
        else if (isPlaying && isFollowingPlayback && playheadPx > followAnchor)
            nextScrollLeft = playheadPx - viewportWidth * 0.72

        if (nextScrollLeft !== null
            && Math.abs(el.scrollLeft - nextScrollLeft) > 1) {
            el.scrollLeft = Math.max(0, nextScrollLeft)
        }
    }, [isFollowingPlayback, isPlaying, pxPerMs])

    // Click-to-seek: click on empty timeline area to jump playhead there
    const handleTimelineClick = useCallback(e => {
        if (isPlaying || !container.current) return
        // Only seek if clicking directly on the grid background (not on a clip/action)
        if (e.target.closest('[class*="absolute"]') && !e.target.dataset.dropZone) return
        const t = clamp(pxToMs(e.clientX - timelineOffset + container.current.scrollLeft, pxPerMs), 0, duration)
        dispatch(setSelectedBookmarkId(null))
        dispatch(setTime(t))
    }, [isPlaying, pxPerMs, timelineOffset, duration, dispatch])

    // Fit to view: set zoom so entire timeline fits in container
    const handleFitToView = useCallback(() => {
        if (containerWidth && duration) {
            const availableWidth = Math.max(
                1,
                containerWidth - TIMELINE_HORIZONTAL_PADDING_PX * 2
            )
            dispatch(setPxPerMs(availableWidth / duration))
            if (container.current) container.current.scrollLeft = 0
        }
    }, [dispatch, containerWidth, duration])

    // Start each editor session with the complete project visible. Once the
    // user adjusts zoom, later panel resizes leave that choice untouched.
    useEffect(() => {
        if (didAutoFitRef.current || !containerWidth || !duration) return
        didAutoFitRef.current = true
        const animationFrame = requestAnimationFrame(handleFitToView)
        return () => cancelAnimationFrame(animationFrame)
    }, [containerWidth, duration, handleFitToView])

    // Show drag-over indicator when a custom pointer drag is active
    useEffect(() => subscribe(() => setIsDragOver(isDragActive())), [])

    // Listen for custom drop events (from pointer-based drag system)
    // Only handles "timeline" zone — "preview"/"overlay-canvas" are handled by OverlayCanvas
    useEffect(() => {
        const handleDrop = (e) => {
            const { clientX, data, target } = e.detail
            if (!data || !target) return
            if (target.zone !== "timeline") return

            const time = container.current && Number.isFinite(clientX)
                ? clamp(
                    pxToMs(
                        clientX - timelineOffset + container.current.scrollLeft,
                        pxPerMs
                    ),
                    0,
                    duration
                )
                : 0
            const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

            if (data.type === "audio" || data.category === "audio") {
                const requestedDuration = Number(data.duration) > 0
                    ? Number(data.duration)
                    : 5000
                let placement = null

                for (const track of audioTracks) {
                    const plan = planTimelineLaneInsert({
                        requestedStart: time,
                        requestedDuration,
                        projectDuration: duration,
                        track,
                        items: allAudioClipsForDrop.filter(
                            clip => clip.trackIndex === track.id
                        ),
                        isPlaying,
                    })
                    if (!plan.ok) continue
                    if (!placement
                        || Math.abs(plan.start - time)
                            < Math.abs(placement.plan.start - time)) {
                        placement = { track, plan, needsNewTrack: false }
                    }
                }

                if (!placement) {
                    const track = {
                        id: nextAudioTrackId,
                        locked: false,
                    }
                    const plan = planTimelineLaneInsert({
                        requestedStart: time,
                        requestedDuration,
                        projectDuration: duration,
                        track,
                        items: [],
                        isPlaying,
                    })
                    if (!plan.ok) return
                    placement = { track, plan, needsNewTrack: true }
                }

                const clip = createAudioLaneItem({
                    id: `audio-${uid}`,
                    trackId: placement.track.id,
                    start: placement.plan.start,
                    end: placement.plan.end,
                    asset: data,
                })
                if (!clip) return

                const group = getGroup("timeline-audio-drop")
                if (placement.needsNewTrack) {
                    dispatch(withGroup(addAudioTrack(), group))
                }
                dispatch(withGroup(addAudioClip(clip), group))
                dispatch(withGroup(setSelectedIds([clip.id]), group))
                dispatch(withGroup(setSelectedRow(AUDIO_TRACKS), group))
            } else if (data.type === "text" || data.type === "shape" || data.type === "image" || data.type === "video") {
                const requestedDuration = getOverlayLaneInsertDuration(data)
                let placement = null

                for (const track of overlayTracks.filter(
                    candidate => candidate.visible !== false
                )) {
                    const plan = planTimelineLaneInsert({
                        requestedStart: time,
                        requestedDuration,
                        projectDuration: duration,
                        track,
                        items: allOverlaysForDrop.filter(
                            overlay => overlay.trackIndex === track.id
                        ),
                        isPlaying,
                    })
                    if (!plan.ok) continue
                    if (!placement
                        || Math.abs(plan.start - time)
                            < Math.abs(placement.plan.start - time)) {
                        placement = { track, plan, needsNewTrack: false }
                    }
                }

                if (!placement) {
                    const track = {
                        id: nextOverlayTrackId,
                        locked: false,
                        visible: true,
                    }
                    const plan = planTimelineLaneInsert({
                        requestedStart: time,
                        requestedDuration,
                        projectDuration: duration,
                        track,
                        items: [],
                        isPlaying,
                    })
                    if (!plan.ok) return
                    placement = { track, plan, needsNewTrack: true }
                }

                const overlay = createOverlayLaneItem({
                    id: `overlay-${uid}`,
                    trackId: placement.track.id,
                    start: placement.plan.start,
                    end: placement.plan.end,
                    asset: data,
                })
                if (!overlay) return

                const group = getGroup("timeline-overlay-drop")
                if (placement.needsNewTrack) {
                    dispatch(withGroup(addOverlayTrack(), group))
                }
                dispatch(withGroup(addOverlay(overlay), group))
                dispatch(withGroup(setSelectedIds([overlay.id]), group))
                dispatch(withGroup(setSelectedRow(OVERLAY_TRACKS), group))
            }
        }
        window.addEventListener("flowtake-drop", handleDrop)
        return () => window.removeEventListener("flowtake-drop", handleDrop)
    }, [
        allOverlaysForDrop,
        allAudioClipsForDrop,
        audioTracks,
        dispatch,
        duration,
        isPlaying,
        nextAudioTrackId,
        nextOverlayTrackId,
        overlayTracks,
        pxPerMs,
        timelineOffset,
    ])

    const mini = isMaskingModeEnabled

    return (
        <div className="flowtake-timeline w-full h-full min-h-0 px-3 pb-3 select-none">
            <div className="flowtake-timeline-surface flex flex-col h-full bg-base-100 rounded-md border border-base-content/10 relative z-0 overflow-hidden">
                <SnappingLinesSync />

                {/* Toolbar */}
                <TimelineToolbar
                    zoomSteps={zoomSteps}
                    onFitToView={handleFitToView}
                    isFollowingPlayback={isFollowingPlayback}
                    onToggleFollow={() => setIsFollowingPlayback(value => !value)}
                    isOverviewOpen={isOverviewOpen}
                    onToggleOverview={() => setIsOverviewOpen(value => !value)}
                />
                {isOverviewOpen && <Minimap containerRef={container} />}
                <MobileTrackControls />

                <div ref={timelineSurface} className="flex flex-1 min-h-0">

                    {/* Track labels. The ruler stays fixed while only the lane stack scrolls. */}
                    <div
                        className="hidden min-h-0 w-28 shrink-0 flex-col overflow-hidden border-r border-base-content/10 md:flex">
                        <div className="h-6 shrink-0 border-b border-base-content/8" aria-hidden="true" />
                        <div ref={headerScroll}
                            className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden overscroll-contain pb-1">
                            <TimelineMarkersHeader />
                            <div className={`${mini ? "h-2" : "h-4"} shrink-0 flex items-center px-2`}>
                                {!mini && <span className="text-[9px] opacity-30 truncate">Clicks</span>}
                            </div>
                            <TrackHeader name="Clips" color="primary" isMinimized={mini} isActive={selectedRow === CLIPS} height="h-16" />
                            {showZoomTrack && <TrackHeader name="Zooms" color="secondary" isMinimized={mini} isActive={selectedRow === ZOOMS} />}
                            {showSpatialTrack && <TrackHeader name="Spatial" color="accent" isMinimized={mini} isActive={selectedRow === SPATIALS} />}
                            {totalSubtitles > 0 && <TrackHeader name="Subtitles" color="tertiary" isMinimized={mini} isActive={selectedRow === SUBTITLES} />}

                            {keyboardLayoutIds.length > 0 && <TrackHeader name="Keyboard" color="primary" isMinimized={mini} />}
                            {mouseStyleIds.length > 0 && <TrackHeader name="Cursor" color="primary" isMinimized={mini} />}
                            {drawnMouseIds.length > 0 && <TrackHeader name="Drawn Mouse" color="accent" isMinimized={mini} />}
                            {appSceneIds.length > 0 && <TrackHeader name="Scene" color="accent" isMinimized={mini} />}
                            {isMaskingModeEnabled && <TrackHeader name="Masks" color="neutral" isMinimized={false} />}

                            {(audioTracks.length > 0 || overlayTracks.length > 0) && !mini && (
                                <div className="mx-2 h-px shrink-0 bg-base-content/10" />
                            )}

                            {audioTracks.length > 0 && (
                                <div className="flex shrink-0 flex-col gap-1">
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
                                            isActive={activeAudioTrackIds.has(track.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {overlayTracks.length > 0 && (
                                <div className="flex shrink-0 flex-col gap-1">
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
                                            isActive={activeOverlayTrackIds.has(track.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex h-12 shrink-0 items-center border-t border-base-content/5 px-1">
                            <AddTrackButton />
                        </div>
                    </div>

                    <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
                        {/* Horizontally follows the lanes, but never scrolls vertically. */}
                        <div className="h-6 shrink-0 overflow-hidden px-2">
                            {duration && (
                                <div
                                    ref={rulerContent}
                                    className="h-6 will-change-transform"
                                    style={{ width: `${timelineWidth}px` }}
                                >
                                    <TimeScale containerRef={container} />
                                </div>
                            )}
                        </div>

                        <div ref={container}
                            data-drop-zone="timeline"
                            data-follow-playhead={isFollowingPlayback ? "true" : "false"}
                            className="flowtake-timeline-scroll relative min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain px-2">
                            {duration && <div ref={timeline} onClick={handleTimelineClick}
                                className="grid grid-cols-1 content-start auto-rows-max gap-1 relative bg-size-[100%_100%] z-0 min-h-full"
                                style={{ width: `${timelineWidth}px`, backgroundImage: getGridBackgroundImage(gridSpacing) }}>

                                <TimelineMarkers />
                                <Clicks />
                                <Clips />
                                {showZoomTrack && <Zooms />}
                                {showSpatialTrack && <SpatialClips />}
                                {totalSubtitles > 0 && <Subtitles />}
                                {keyboardLayoutIds.length > 0 && <KeyboardLayouts />}
                                {mouseStyleIds.length > 0 && <MouseStyles />}
                                {drawnMouseIds.length > 0 && <DrawnMice />}
                                {appSceneIds.length > 0 && <AppScenes />}
                                {isMaskingModeEnabled && <Masks />}

                                {(audioTracks.length > 0 || overlayTracks.length > 0) && !mini && (
                                    <div className="-mx-1 h-px shrink-0 bg-base-content/8" />
                                )}

                                <AudioTracks />
                                <OverlayTracks />
                                <div className="h-12 shrink-0" aria-hidden="true" />

                                {activeSnapLine !== null && (
                                    <div className="absolute top-0 bottom-0 w-px bg-warning/70 z-50 pointer-events-none"
                                        style={{ left: `${msToPx(activeSnapLine, pxPerMs)}px` }}>
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-warning" />
                                    </div>
                                )}
                            </div>}

                            {isDragOver && (
                                <div className="absolute inset-0 z-40 flex items-end justify-center pb-4 pointer-events-none">
                                    <div className="bg-info/15 border-2 border-dashed border-info/50 rounded-lg px-6 py-3 backdrop-blur-sm">
                                        <span className="text-xs font-medium text-info">Drop here to add to timeline</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Fixed viewport overlay: the handle and line stay visible while lanes scroll. */}
                        {duration && (
                            <div className="pointer-events-none absolute inset-y-0 left-2 right-0 z-50 overflow-hidden">
                                <div
                                    ref={playheadContent}
                                    className="relative h-full will-change-transform"
                                    style={{ width: `${timelineWidth}px` }}
                                >
                                    <Cursor
                                        containerRef={container}
                                        onScrollToCursor={scrollToCursor}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
