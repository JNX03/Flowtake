import {
    useCallback,
    useEffect,
    useMemo,
    useRef
} from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { useResizeDetector } from "react-resize-detector"
import {
    AUDIO_TRACKS,
    CLIPS,
    getGridBackgroundImage,
    msToPx,
    OVERLAY_TRACKS,
    pxToMs,
    SUBTITLES,
    ZOOMS
} from "../../../../src/helpers"
import {
    selectAudioClipIds,
    selectAudioTracks,
    toggleTrackLock,
    toggleTrackMute,
    removeTrack as removeAudioTrack
} from "../../../../src/redux/audioTrackSlice"
import { selectClipIds } from "../../../../src/redux/clipSlice"
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
} from "../../../../src/redux/contextMenuSlice"
import {
    selectAreHotkeysEnabled,
    selectDuration,
    selectIsPlaying
} from "../../../../src/redux/editorSlice"
import {
    selectOverlayIds,
    selectOverlayTracks,
    toggleOverlayTrackLock,
    toggleOverlayTrackVisibility,
    removeOverlayTrack
} from "../../../../src/redux/overlaySlice"
import {
    selectSubtitleIds,
    selectTotalSubtitles
} from "../../../../src/redux/subtitleSlice"
import {
    selectIsMaskingModeEnabled,
    selectPxPerMs,
    selectSelectedIds,
    selectSelectedRow,
    setOffset,
    setScrollLeft,
    setSelectedIds,
    setWidth
} from "../../../../src/redux/timelineSlice"
import { selectZoomIds } from "../../../../src/redux/zoomSlice"
import AddTrackButton from "./AddTrackButton"
import AudioTracks from "./AudioTracks"
import Clicks from "./Clicks"
import Clips from "./Clips"
import Controls from "./Controls"
import Cursor from "./Cursor"
import Masks from "./Masks"
import OverlayTracks from "./OverlayTracks"
import Subtitles from "./Subtitles"
import TimelineToolbar from "./TimelineToolbar"
import TimeScale from "./TimeScale"
import TrackHeader from "./TrackHeader"
import Zooms from "./Zooms"

export default function Timeline() {

    const dispatch = useDispatch()

    const duration = useSelector(selectDuration)

    const isPlaying = useSelector(selectIsPlaying)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const pxPerMs = useSelector(selectPxPerMs)
    const isMaskingModeEnabled = useSelector(selectIsMaskingModeEnabled)

    const totalSubtitles = useSelector(selectTotalSubtitles)
    const selectedIds = useSelector(selectSelectedIds)
    const selectedRow = useSelector(selectSelectedRow)
    const clipIds = useSelector(selectClipIds)
    const zoomIds = useSelector(selectZoomIds)
    const subtitleIds = useSelector(selectSubtitleIds)
    const audioClipIds = useSelector(selectAudioClipIds)
    const overlayIds = useSelector(selectOverlayIds)
    const audioTracks = useSelector(selectAudioTracks)
    const overlayTracks = useSelector(selectOverlayTracks)

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
        let ms = null
        if (pxPerMs < .05) ms = 300000
        else if (pxPerMs < .1) ms = 2000
        else ms = 1000
        return msToPx(ms, pxPerMs)
    }, [pxPerMs])

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
        if (timelineObservedWidth !== undefined && timelineObservedHeight !== undefined && container.current)
            dispatch(setOffset(timeline.current.getBoundingClientRect().left + container.current.scrollLeft))
    }, [timelineObservedWidth, timelineObservedHeight, dispatch])

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
        if (!isPlayingRef.current) el.addEventListener("scroll", onScroll)
        return () => el.removeEventListener("scroll", onScroll)
    }, [dispatch, pxPerMs, isClipMenuOpen, isClickMenuOpen, isZoomMenuOpen, isSubtitleMenuOpen, isNewClipMenuOpen,
        isNewZoomMenuOpen, isNewSubtitleMenuOpen, isMaskMenuOpen, isNewMaskMenuOpen])

    // Unselect deleted entities
    useEffect(() => {
        if (selectedIds.length >= 1) {
            let ids = null
            switch (selectedRow) {
                case SUBTITLES: ids = subtitleIds; break
                case CLIPS: ids = clipIds; break
                case ZOOMS: ids = zoomIds; break
                case AUDIO_TRACKS: ids = audioClipIds; break
                case OVERLAY_TRACKS: ids = overlayIds; break
            }
            if (ids) {
                const newSelectedIds = selectedIds.filter(id => ids.includes(id))
                if (newSelectedIds.length !== selectedIds.length) dispatch(setSelectedIds(newSelectedIds))
            }
        }
    }, [clipIds, dispatch, selectedIds, selectedIds.length, selectedRow, subtitleIds, zoomIds, audioClipIds, overlayIds])

    const scrollToStart = useCallback(() => {
        if (container.current) container.current.scrollLeft = 0
    }, [])

    const scrollToCursor = useCallback(t => {
        const scrollThreshold = pxToMs(container.current.clientWidth, pxPerMs) * 0.8
        const start = pxToMs(container.current.scrollLeft, pxPerMs)
        const end = start + pxToMs(container.current.clientWidth, pxPerMs)
        if (t < start || t > end) container.current.scrollLeft = msToPx(t - scrollThreshold, pxPerMs)
        else if (isPlaying && t > scrollThreshold) container.current.scrollLeft = msToPx(t - scrollThreshold, pxPerMs)
    }, [pxPerMs, isPlaying])

    const mini = isMaskingModeEnabled

    return (
        <div className="w-full p-2 flex-1 min-h-48 select-none">
            <div className="flex flex-col h-full bg-base-100 rounded-lg relative z-0">

                {/* Toolbar */}
                <TimelineToolbar />

                <div className="flex flex-1 min-h-0">
                    {/* Zoom/snap controls */}
                    <Controls onScrollToStart={scrollToStart} />

                    {/* Track headers - left column */}
                    <div ref={headerScroll}
                        className="w-28 shrink-0 flex-col border-r border-base-content/10 overflow-hidden hidden lg:flex">
                        {/* TimeScale spacer */}
                        <div className="h-4 shrink-0" />
                        <div className="h-4 shrink-0" />
                        {/* Clicks row spacer */}
                        <div className={`${mini ? "h-2" : "h-4"} shrink-0 flex items-center px-2`}>
                            {!mini && <span className="text-[9px] opacity-30 truncate">Clicks</span>}
                        </div>
                        {/* Built-in tracks */}
                        <TrackHeader name="Clips" color="primary" isMinimized={mini} />
                        <TrackHeader name="Zooms" color="secondary" isMinimized={mini} />
                        {totalSubtitles > 0 && <TrackHeader name="Subtitles" color="tertiary" isMinimized={mini} />}

                        {isMaskingModeEnabled && <TrackHeader name="Masks" color="neutral" isMinimized={false} />}

                        {/* Audio track headers */}
                        {audioTracks.length > 0 && (
                            <div className="border-t border-base-content/5 mt-1 pt-1">
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
                            <div className="border-t border-base-content/5 mt-1 pt-1">
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
                        className={`flex-1 px-20 ${isPlaying ? "overflow-x-hidden" : "overflow-x-auto scroll-smooth"} overflow-y-auto no-scrollbar`}>
                        {duration && <div ref={timeline}
                            className="grid grid-cols-1 gap-1 relative bg-size-[100%_100%] z-0 min-h-full"
                            style={{ width: `${timelineWidth}px`, backgroundImage: getGridBackgroundImage(gridSpacing) }}>

                            <Cursor onScrollToCursor={scrollToCursor} />
                            <TimeScale />

                            <Clicks />
                            <Clips />
                            <Zooms />
                            {totalSubtitles > 0 && <Subtitles />}
                            {isMaskingModeEnabled && <Masks />}

                            {/* Audio & Overlay tracks - rendered inline */}
                            <AudioTracks />
                            <OverlayTracks />
                        </div>}
                    </div>
                </div>
            </div>
        </div>
    )
}
