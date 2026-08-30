import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import PropTypes from "prop-types"
import {
    shallowEqual,
    useDispatch,
    useSelector
} from "react-redux"
import { useThrottledCallback } from "use-debounce"
import {
    getGridBackgroundImage,
    msToPx
} from "@shared/helpers"
import {
    formatTimelineTime,
    getVisibleTimelineLabels,
    shouldResumeTimelinePlayback,
    timelineTimeFromClientX
} from "@shared/editor/timelineScrubbing"
import { createTimelineAutoScrollController } from "@shared/editor/timelineAutoScroll"
import {
    selectDuration,
    selectIsPlaying,
    selectIsStopped,
    setIsPlaying,
    setIsStopped
} from "@shared/redux/editorSlice"
import { selectVideoDetails } from "@shared/redux/projectSlice"
import {
    selectPxPerMs,
    selectScrollLeft,
    selectWidth,
    setTime
} from "@shared/redux/timelineSlice"

function formatLabel(ms) {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, "0")}`
    return `${seconds}s`
}

export default function TimeScale({ containerRef = null }) {

    const dispatch = useDispatch()

    const scale = useRef(null)
    const marker = useRef(null)
    const tooltip = useRef(null)

    const pxPerMs = useSelector(selectPxPerMs)
    const videoDetails = useSelector(selectVideoDetails, shallowEqual)
    const duration = useSelector(selectDuration)
    const isPlaying = useSelector(selectIsPlaying)
    const isStopped = useSelector(selectIsStopped)
    const scrollLeft = useSelector(selectScrollLeft)
    const viewportWidth = useSelector(selectWidth)
    const [isScrubbing, setIsScrubbing] = useState(false)
    const scrubState = useRef({
        active: false,
        pointerId: null,
        lastTime: null,
        wasPlaying: false
    })
    const getScrollContainer = useCallback(
        () => containerRef?.current
            || scale.current?.closest(".flowtake-timeline-scroll")
            || null,
        [containerRef]
    )
    const setTimeThrottled = useThrottledCallback(
        nextTime => dispatch(setTime(nextTime)),
        16,
        { trailing: true }
    )

    const gridSpacing = useMemo(() => {
        let ms
        if (pxPerMs < 0.01) ms = 300000
        else if (pxPerMs < 0.02) ms = 120000
        else if (pxPerMs < 0.04) ms = 30000
        else if (pxPerMs < 0.06) ms = 10000
        else if (pxPerMs < 0.08) ms = 5000
        else if (pxPerMs < 0.1) ms = 1000
        else if (pxPerMs < 0.15) ms = 500
        else if (pxPerMs < 0.2) ms = 200
        else ms = 100
        return msToPx(ms, pxPerMs)
    }, [pxPerMs])

    // Compute the ms interval for labels
    const labelIntervalMs = useMemo(() => {
        if (pxPerMs < 0.01) return 300000
        if (pxPerMs < 0.02) return 120000
        if (pxPerMs < 0.04) return 30000
        if (pxPerMs < 0.06) return 10000
        if (pxPerMs < 0.08) return 5000
        if (pxPerMs < 0.1) return 1000
        if (pxPerMs < 0.15) return 500
        if (pxPerMs < 0.2) return 200
        return 100
    }, [pxPerMs])

    // Render only the labels around the visible viewport. Long, highly zoomed
    // projects otherwise create tens of thousands of DOM nodes.
    const timeLabels = useMemo(() => {
        if (!duration || !labelIntervalMs) return []
        return getVisibleTimelineLabels({
            duration,
            intervalMs: labelIntervalMs,
            pxPerMs,
            scrollLeft,
            viewportWidth
        })
    }, [duration, labelIntervalMs, pxPerMs, scrollLeft, viewportWidth])

    const getPointerTime = useCallback(clientX => {
        const rect = scale.current?.getBoundingClientRect()
        return timelineTimeFromClientX({
            clientX,
            contentLeft: rect?.left,
            pxPerMs,
            start: videoDetails.start,
            end: videoDetails.end
        })
    }, [pxPerMs, videoDetails.end, videoDetails.start])

    const updateHoverMarker = useCallback(nextTime => {
        if (marker.current)
            marker.current.style.transform = `translateX(${msToPx(nextTime, pxPerMs)}px)`
        if (tooltip.current)
            tooltip.current.dataset.tip = formatTimelineTime(nextTime)
    }, [pxPerMs])

    const scrubAutoScroll = useMemo(() => createTimelineAutoScrollController({
        getContainer: getScrollContainer,
        onScrollFrame: ({ pointer }) => {
            const scrub = scrubState.current
            if (!scrub.active) return
            const nextTime = getPointerTime(pointer.clientX)
            scrub.lastTime = nextTime
            updateHoverMarker(nextTime)
            setTimeThrottled(nextTime)
        }
    }), [getPointerTime, getScrollContainer, setTimeThrottled, updateHoverMarker])

    const handlePointerDown = useCallback(event => {
        if (!event.isPrimary || event.button !== 0) return

        event.preventDefault()
        event.stopPropagation()

        const nextTime = getPointerTime(event.clientX)
        scrubState.current = {
            active: true,
            pointerId: event.pointerId,
            lastTime: nextTime,
            wasPlaying: isPlaying
        }
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setIsScrubbing(true)
        scrubAutoScroll.start(event)

        if (isPlaying) dispatch(setIsPlaying(false))
        if (isStopped) dispatch(setIsStopped(false))
        updateHoverMarker(nextTime)
        dispatch(setTime(nextTime))
    }, [
        dispatch,
        getPointerTime,
        isPlaying,
        isStopped,
        scrubAutoScroll,
        updateHoverMarker
    ])

    const handlePointerMove = useCallback(event => {
        if (!event.isPrimary) return

        const nextTime = getPointerTime(event.clientX)
        updateHoverMarker(nextTime)
        scrubAutoScroll.update(event)

        const scrub = scrubState.current
        if (!scrub.active || scrub.pointerId !== event.pointerId) return
        event.preventDefault()
        scrub.lastTime = nextTime
        setTimeThrottled(nextTime)
    }, [
        getPointerTime,
        scrubAutoScroll,
        setTimeThrottled,
        updateHoverMarker
    ])

    const finishScrub = useCallback((event, commitPointerPosition) => {
        const scrub = scrubState.current
        if (!scrub.active || scrub.pointerId !== event.pointerId) return

        let finalTime = scrub.lastTime
        if (commitPointerPosition && Number.isFinite(event.clientX)) {
            finalTime = getPointerTime(event.clientX)
            updateHoverMarker(finalTime)
        }

        scrub.active = false
        scrub.lastTime = finalTime
        scrubAutoScroll.stop()
        setTimeThrottled.cancel()
        dispatch(setTime(finalTime))
        setIsScrubbing(false)

        if (event.currentTarget.hasPointerCapture?.(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId)

        if (shouldResumeTimelinePlayback({
            wasPlaying: scrub.wasPlaying,
            time: finalTime,
            end: videoDetails.end
        })) {
            dispatch(setIsStopped(false))
            dispatch(setIsPlaying(true))
        }
    }, [
        dispatch,
        getPointerTime,
        scrubAutoScroll,
        setTimeThrottled,
        updateHoverMarker,
        videoDetails.end
    ])

    const handlePointerUp = useCallback(event => {
        finishScrub(event, true)
    }, [finishScrub])

    const handlePointerCancel = useCallback(event => {
        finishScrub(event, false)
    }, [finishScrub])

    useEffect(() => () => {
        scrubAutoScroll.stop()
        setTimeThrottled.cancel()
    }, [scrubAutoScroll, setTimeThrottled])

    return (
        <div className="relative w-full h-6 z-10 shrink-0 border-b border-base-content/8">
            {/* Grid background */}
            <div className="w-full h-full absolute inset-0" style={{
                backgroundImage: getGridBackgroundImage(gridSpacing),
                backgroundSize: '100% 100%'
            }} />

            {/* Time labels */}
            <div className="absolute inset-0 pointer-events-none">
                {timeLabels.map(({ ms, px }) => (
                    <span key={ms} className="absolute bottom-0.5 text-[9px] opacity-40 leading-none select-none"
                        style={{ left: `${px}px`, transform: "translateX(2px)" }}>
                        {formatLabel(ms)}
                    </span>
                ))}
            </div>

            {/* Hover marker */}
            <div
                ref={scale}
                aria-label="Timeline ruler. Drag to scrub."
                data-scrubbing={isScrubbing ? "true" : "false"}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onLostPointerCapture={handlePointerCancel}
                className={`w-full h-full z-40 group absolute left-0 top-0 touch-none ${isScrubbing ? "cursor-grabbing" : "cursor-ew-resize"}`}
            >
                <div ref={marker} className={`w-1 h-full bg-info transition-opacity pointer-events-none flex rounded-lg ${isScrubbing ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                    <div ref={tooltip} className="tooltip tooltip-open tooltip-bottom tooltip-info">
                        <div className="w-1 h-full" />
                    </div>
                </div>
            </div>
        </div>
    )
}

TimeScale.propTypes = {
    containerRef: PropTypes.shape({ current: PropTypes.any }),
}
