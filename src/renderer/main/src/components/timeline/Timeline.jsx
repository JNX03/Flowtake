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
    CLIPS,
    getGridBackgroundImage,
    msToPx,
    pxToMs,
    SUBTITLES,
    ZOOMS
} from "../../../../src/helpers"
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
import Clicks from "./Clicks"
import Clips from "./Clips"
import Controls from "./Controls"
import Cursor from "./Cursor"
import Masks from "./Masks"
import Subtitles from "./Subtitles"
import TimeScale from "./TimeScale"
import Zooms from "./Zooms"

export default function Timeline() {

    const dispatch = useDispatch()

    const duration = useSelector(selectDuration)

    const isPlaying = useSelector(selectIsPlaying)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const pxPerMs = useSelector(selectPxPerMs)
    const isMaskingModeEnabled = useSelector(selectIsMaskingModeEnabled)

    // Additional selectors for timeline functionality
    const totalSubtitles = useSelector(selectTotalSubtitles)
    const selectedIds = useSelector(selectSelectedIds)
    const selectedRow = useSelector(selectSelectedRow)
    const clipIds = useSelector(selectClipIds)
    const zoomIds = useSelector(selectZoomIds)
    const subtitleIds = useSelector(selectSubtitleIds)

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

    // Timeline refs and state
    const container = useRef(null)
    const timeline = useRef(null)
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
    },
        { enabled: areHotkeysEnabled },
        [areHotkeysEnabled])

    useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

    // Handle timeline scroll position tracking
    useEffect(() => {
        const onScroll = () => {
            if (container.current && timeline.current && !isPlayingRef.current) {
                dispatch(setScrollLeft(container.current.scrollLeft))

                if (isClipMenuOpen || isClickMenuOpen || isZoomMenuOpen || isSubtitleMenuOpen || isNewClipMenuOpen ||
                    isNewZoomMenuOpen || isNewSubtitleMenuOpen || isMaskMenuOpen || isNewMaskMenuOpen)
                    dispatch(closeAllContextMenus())
            }
        }

        const scrollContainer = container.current

        if (!isPlayingRef.current) {
            scrollContainer?.addEventListener("scroll", onScroll)
        }

        return () => { scrollContainer?.removeEventListener("scroll", onScroll) }
    }, [dispatch, pxPerMs, isClipMenuOpen, isClickMenuOpen, isZoomMenuOpen, isSubtitleMenuOpen, isNewClipMenuOpen,
        isNewZoomMenuOpen, isNewSubtitleMenuOpen, isMaskMenuOpen, isNewMaskMenuOpen])

    // handle unselecting an id if its entity was deleted
    useEffect(() => {
        if (selectedIds.length >= 1) {
            let ids = null
            switch (selectedRow) {
                case SUBTITLES: {
                    ids = subtitleIds
                    break
                }
                case CLIPS: {
                    ids = clipIds
                    break
                }
                case ZOOMS: {
                    ids = zoomIds
                    break
                }
            }
            if (ids) {
                const newSelectedIds = selectedIds.filter(id => ids.includes(id))
                if (newSelectedIds.length !== selectedIds.length) dispatch(setSelectedIds(newSelectedIds))
            }
        }
    }, [clipIds, dispatch, selectedIds, selectedIds.length, selectedRow, subtitleIds, zoomIds])

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

    // TODO: disable all timeline actions when isPlaying

    const getHeight = () => {
        if (totalSubtitles > 0 && isMaskingModeEnabled) return "h-50"
        if (totalSubtitles === 0 && isMaskingModeEnabled) return "h-47"
        if (totalSubtitles === 0) return "h-43"
        return "h-56"
    }

    return (
        <div className={`w-full p-2 ${getHeight()} transition-all select-none`}>
            <div className="flex h-full bg-base-100 rounded-lg relative z-0">

                <Controls onScrollToStart={scrollToStart} />

                <div ref={container} className={`px-20 ${isPlaying ? "overflow-x-hidden" : "overflow-x-auto scroll-smooth"}`}>
                    {duration && <div ref={timeline} className="grid grid-cols-1 gap-1 relative bg-size-[100%_100%] z-0"
                        style={{ width: `${timelineWidth}px`, backgroundImage: getGridBackgroundImage(gridSpacing) }}>

                        <Cursor onScrollToCursor={scrollToCursor} />

                        <TimeScale />

                        <Clicks />
                        <Clips />
                        <Zooms />
                        {totalSubtitles > 0 && <Subtitles />}

                        {isMaskingModeEnabled && <Masks />}
                    </div>}
                </div>
            </div>
        </div>
    )
}