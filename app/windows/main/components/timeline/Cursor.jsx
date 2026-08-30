import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import {
    shallowEqual,
    useDispatch,
    useSelector
} from "react-redux"
import { useThrottledCallback } from "use-debounce"
import {
    msToPx
} from "@shared/helpers"
import {
    clampTimelineTime,
    formatTimelineTime,
    shouldResumeTimelinePlayback,
    timelineTimeFromClientX,
    timelineTimeFromKeyboard
} from "@shared/editor/timelineScrubbing"
import { createTimelineAutoScrollController } from "@shared/editor/timelineAutoScroll"
import {
    findActivePlaybackClip,
    normalizePlaybackRate
} from "@shared/editor/playbackClock"
import { selectAllClips } from "@shared/redux/clipSlice"
import {
    selectIsPlaying,
    selectIsStopped,
    selectMicrophoneAudioVolume,
    selectPlaybackRate,
    selectSystemAudioVolume,
    setIsPlaying,
    setIsStopped,
    setMicrophoneAudioVolume,
    setPlaybackRate,
    setSystemAudioVolume
} from "@shared/redux/editorSlice"
import {
    selectVideoDetails
} from "@shared/redux/projectSlice"
import {
    selectOffset,
    selectPxPerMs,
    selectTime,
    setTime
} from "@shared/redux/timelineSlice"

export default function Cursor({ onScrollToCursor, containerRef = null }) {

    const dispatch = useDispatch()

    const videoDetails = useSelector(selectVideoDetails, shallowEqual)

    const isPlaying = useSelector(selectIsPlaying)
    const isStopped = useSelector(selectIsStopped)
    const time = useSelector(selectTime)
    const pxPerMs = useSelector(selectPxPerMs)
    const offset = useSelector(selectOffset)
    const clips = useSelector(selectAllClips)
    const playbackRate = useSelector(selectPlaybackRate)
    const microphoneAudioVolume = useSelector(selectMicrophoneAudioVolume)
    const systemAudioVolume = useSelector(selectSystemAudioVolume)

    const [cursorInternalOffset, setCursorInternalOffset] = useState(null)
    const [isScrubbing, setIsScrubbing] = useState(false)

    const cursor = useRef(null)
    const timeRef = useRef(null)
    const scrubState = useRef({
        active: false,
        pointerId: null,
        pointerOffsetPx: 0,
        lastTime: null,
        wasPlaying: false
    })

    const getScrollContainer = useCallback(
        () => containerRef?.current
            || cursor.current?.closest(".flowtake-timeline-scroll")
            || null,
        [containerRef]
    )

    const setTimeThrottled = useThrottledCallback(t => dispatch(setTime(t)), 16, { 'trailing': true })

    const positionCursor = useCallback((unclampedTime, scrollToCursor = true) => {
        const t = clampTimelineTime(unclampedTime, videoDetails.start, videoDetails.end)
        timeRef.current = t

        if (cursor.current && cursorInternalOffset !== null)
            cursor.current.style.transform = `translateX(${msToPx(t, pxPerMs) - cursorInternalOffset}px)`

        if (scrollToCursor) onScrollToCursor(t)
        return t
    }, [cursorInternalOffset, onScrollToCursor, pxPerMs, videoDetails.end, videoDetails.start])

    const applyTime = useCallback((unclampedTime, scrollToCursor = true, throttled = false, force = false) => {
        const t = clampTimelineTime(unclampedTime, videoDetails.start, videoDetails.end)
        if (timeRef.current !== t || force) {
            if (throttled) setTimeThrottled(t)
            else dispatch(setTime(t))
            positionCursor(t, scrollToCursor)
        }
        return t
    }, [dispatch, positionCursor, setTimeThrottled, videoDetails.end, videoDetails.start])

    useEffect(() => {
        if (!isScrubbing) positionCursor(time)
    }, [isScrubbing, positionCursor, time])

    useEffect(() => {
        if (cursorInternalOffset === null && cursor.current)
            setCursorInternalOffset(cursor.current.getBoundingClientRect().width * .5)
    }, [cursorInternalOffset])

    // Timeline-specific effects
    useEffect(() => {
        if (videoDetails?.start !== undefined && time < videoDetails.start)
            dispatch(setTime(videoDetails.start))
    }, [videoDetails.start, time, dispatch])

    useEffect(() => {
        if (videoDetails?.end !== undefined && time >= videoDetails.end)
            dispatch(setIsPlaying(false))
    }, [dispatch, time, videoDetails.end])

    const getPointerTime = useCallback((
        clientX,
        pointerOffsetPx = 0,
        liveScrollLeft = null
    ) => {
        const currentScrollLeft = Number.isFinite(liveScrollLeft)
            ? liveScrollLeft
            : (getScrollContainer()?.scrollLeft || 0)
        return timelineTimeFromClientX({
            clientX,
            contentLeft: offset - currentScrollLeft,
            pointerOffsetPx,
            pxPerMs,
            start: videoDetails.start,
            end: videoDetails.end
        })
    }, [getScrollContainer, offset, pxPerMs, videoDetails.end, videoDetails.start])

    const scrubAutoScroll = useMemo(() => createTimelineAutoScrollController({
        getContainer: getScrollContainer,
        onScrollFrame: ({ pointer, container }) => {
            const scrub = scrubState.current
            if (!scrub.active) return
            const nextTime = getPointerTime(
                pointer.clientX,
                scrub.pointerOffsetPx,
                container.scrollLeft
            )
            scrub.lastTime = nextTime
            applyTime(nextTime, false, true)
        }
    }), [applyTime, getPointerTime, getScrollContainer])

    useEffect(() => () => {
        setTimeThrottled.cancel()
        scrubAutoScroll.stop()
    }, [scrubAutoScroll, setTimeThrottled])

    const handlePointerDown = useCallback(event => {
        if (!event.isPrimary || event.button !== 0 || cursorInternalOffset === null) return

        event.preventDefault()
        event.stopPropagation()

        const rect = event.currentTarget.getBoundingClientRect()
        const pointerOffsetPx = event.clientX - (rect.left + rect.width / 2)
        const nextTime = getPointerTime(event.clientX, pointerOffsetPx)

        scrubState.current = {
            active: true,
            pointerId: event.pointerId,
            pointerOffsetPx,
            lastTime: nextTime,
            wasPlaying: isPlaying
        }
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setIsScrubbing(true)
        scrubAutoScroll.start(event)

        if (isPlaying) dispatch(setIsPlaying(false))
        if (isStopped) dispatch(setIsStopped(false))
        applyTime(nextTime, false, false, true)
    }, [
        applyTime,
        cursorInternalOffset,
        dispatch,
        getPointerTime,
        isPlaying,
        isStopped,
        scrubAutoScroll
    ])

    const handlePointerMove = useCallback(event => {
        const scrub = scrubState.current
        if (!scrub.active || scrub.pointerId !== event.pointerId) return

        event.preventDefault()
        scrubAutoScroll.update(event)
        const nextTime = getPointerTime(event.clientX, scrub.pointerOffsetPx)
        scrub.lastTime = nextTime
        applyTime(nextTime, false, true)
    }, [applyTime, getPointerTime, scrubAutoScroll])

    const finishScrub = useCallback((event, commitPointerPosition) => {
        const scrub = scrubState.current
        if (!scrub.active || scrub.pointerId !== event.pointerId) return

        let finalTime = scrub.lastTime
        if (commitPointerPosition && Number.isFinite(event.clientX))
            finalTime = getPointerTime(event.clientX, scrub.pointerOffsetPx)

        scrub.active = false
        scrub.lastTime = finalTime
        scrubAutoScroll.stop()
        setTimeThrottled.cancel()
        applyTime(finalTime, false, false, true)
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
        applyTime,
        dispatch,
        getPointerTime,
        scrubAutoScroll,
        setTimeThrottled,
        videoDetails.end
    ])

    const handlePointerUp = useCallback(event => {
        finishScrub(event, true)
    }, [finishScrub])

    const handlePointerCancel = useCallback(event => {
        finishScrub(event, false)
    }, [finishScrub])

    const handleKeyDown = useCallback(event => {
        const nextTime = timelineTimeFromKeyboard({
            key: event.key,
            time,
            start: videoDetails.start,
            end: videoDetails.end,
            shiftKey: event.shiftKey
        })
        if (nextTime === null) return

        event.preventDefault()
        event.stopPropagation()
        if (isStopped) dispatch(setIsStopped(false))
        applyTime(nextTime, true, false, true)
    }, [applyTime, dispatch, isStopped, time, videoDetails.end, videoDetails.start])

    useEffect(() => {
        if (isPlaying) {
            const clip = findActivePlaybackClip(clips, time, videoDetails.end)
            if (clip) {
                const nextPlaybackRate = normalizePlaybackRate(clip.playbackRate)
                if (nextPlaybackRate !== playbackRate) dispatch(setPlaybackRate(nextPlaybackRate))
                if (clip.microphoneAudioVolume !== microphoneAudioVolume) dispatch(setMicrophoneAudioVolume(clip.microphoneAudioVolume))
                if (clip.systemAudioVolume !== systemAudioVolume) dispatch(setSystemAudioVolume(clip.systemAudioVolume))
            }
        }
    }, [isPlaying, clips, time, dispatch, playbackRate, microphoneAudioVolume, systemAudioVolume, videoDetails.end])

    return (
        <div
            ref={cursor}
            className={
                "pointer-events-none absolute bottom-0 z-50 flex h-full w-4 flex-col items-center"
            }
        >
            <div
                role="slider"
                tabIndex={0}
                aria-label="Timeline playhead"
                aria-orientation="horizontal"
                aria-valuemin={videoDetails.start}
                aria-valuemax={videoDetails.end}
                aria-valuenow={Math.round(clampTimelineTime(time, videoDetails.start, videoDetails.end))}
                aria-valuetext={formatTimelineTime(time)}
                data-scrubbing={isScrubbing ? "true" : "false"}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onLostPointerCapture={handlePointerCancel}
                onKeyDown={handleKeyDown}
                className={
                    `${isScrubbing ? "cursor-grabbing" : "cursor-grab"} ` +
                    "pointer-events-auto group flex h-5 w-5 shrink-0 touch-none items-start justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-info"
                }
            >
                <div className={`mt-0.5 h-3 w-3 rotate-45 rounded-sm shadow-sm transition-all ${isScrubbing ? "scale-125 bg-base-content" : "bg-info group-hover:scale-125 group-hover:bg-base-content"}`} />
            </div>
            <div className={
                `${isScrubbing ? "w-0.5 bg-base-content" : "w-px bg-info"} ` +
                "pointer-events-none flex-1 shadow-lg transition-all"
            } />
        </div>
    )
}

Cursor.propTypes = {
    onScrollToCursor: PropTypes.func.isRequired,
    containerRef: PropTypes.shape({ current: PropTypes.any }),
}
