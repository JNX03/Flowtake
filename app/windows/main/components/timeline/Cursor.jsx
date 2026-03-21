import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
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
    clamp,
    msToPx,
    pxToMs
} from "@shared/helpers"
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
    selectScrollLeft,
    selectTime,
    setTime
} from "@shared/redux/timelineSlice"

export default function Cursor({ onScrollToCursor }) {

    const dispatch = useDispatch()

    const videoDetails = useSelector(selectVideoDetails, shallowEqual)

    const isPlaying = useSelector(selectIsPlaying)
    const isStopped = useSelector(selectIsStopped)
    const time = useSelector(selectTime)
    const pxPerMs = useSelector(selectPxPerMs)
    const offset = useSelector(selectOffset)
    const scrollLeft = useSelector(selectScrollLeft)
    const clips = useSelector(selectAllClips)
    const playbackRate = useSelector(selectPlaybackRate)
    const microphoneAudioVolume = useSelector(selectMicrophoneAudioVolume)
    const systemAudioVolume = useSelector(selectSystemAudioVolume)

    const [cursorInternalOffset, setCursorInternalOffset] = useState(null)
    const [isMouseDown, setIsMouseDown] = useState(false)

    const cursor = useRef(null)
    const background = useRef(null)
    const animationFrame = useRef(null)
    const timeRef = useRef(null)

    const isPlayingRef = useRef(isPlaying)
    const isStoppedRef = useRef(isStopped)

    const setTimeThrottled = useThrottledCallback(t => dispatch(setTime(t)), 100, { 'trailing': true })

    const applyTime = useCallback((unclampedTime, scrollToCursor = true, throttled = false) => {
        const t = clamp(unclampedTime, videoDetails.start, videoDetails.end)
        if (timeRef.current !== t && cursorInternalOffset !== null) {
            if (throttled) setTimeThrottled(t)
            else dispatch(setTime(t))
            timeRef.current = t
            cursor.current.style.transform = `translateX(${msToPx(t, pxPerMs) - cursorInternalOffset}px)`

            if ((!isStoppedRef.current && t === videoDetails.start) || (isStoppedRef.current && t > videoDetails.start))
                dispatch(setIsStopped(!isPlaying && t === videoDetails.start))

            if (scrollToCursor) onScrollToCursor(t)
        }
    }, [cursorInternalOffset, dispatch, isPlaying, onScrollToCursor, setTimeThrottled, videoDetails.end, videoDetails.start, pxPerMs])

    useEffect(() => {
        if (!isPlaying) {
            timeRef.current = null
            applyTime(time)
        }
    }, [pxPerMs, isPlaying, time, applyTime])

    useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

    useEffect(() => { isStoppedRef.current = isStopped }, [isStopped])

    useEffect(() => {
        if (!cursorInternalOffset) setCursorInternalOffset(cursor.current.getBoundingClientRect().width * .5)
    }, [cursorInternalOffset])

    // Timeline-specific effects
    useEffect(() => {
        if (videoDetails?.start && time < videoDetails.start) dispatch(setTime(videoDetails.start))
    }, [videoDetails.start, time, dispatch])

    useEffect(() => {
        if (videoDetails?.end && time >= videoDetails.end)
            dispatch(setIsPlaying(false))
    }, [dispatch, time, videoDetails.end])

    // handles clicking on TimeScale
    useEffect(() => {
        if (!isPlaying && !isMouseDown) applyTime(time)
    }, [time, isPlaying, applyTime, isMouseDown])

    // Handle cursor dragging - only enabled when not playing
    useEffect(() => {
        const handleMouseDown = () => {
            const handleMouseMove = (e) => {
                const t = pxToMs(e.clientX - offset + scrollLeft, pxPerMs)
                applyTime(t, false, true)
            }

            const handleMouseUp = () => {
                window.removeEventListener("mousemove", handleMouseMove)
                window.removeEventListener("mouseup", handleMouseUp)

                setIsMouseDown(false)
            }

            window.addEventListener("mousemove", handleMouseMove)
            window.addEventListener("mouseup", handleMouseUp)

            setIsMouseDown(true)
        }

        const c = cursor.current

        if (c && !isPlaying && videoDetails && cursorInternalOffset !== null && offset !== null)
            c.addEventListener("mousedown", handleMouseDown)

        return () => {
            c?.removeEventListener("mousedown", handleMouseDown)
        }
    }, [isPlaying, videoDetails, pxPerMs, cursorInternalOffset, offset, scrollLeft, applyTime])

    // Render loop for timeline time updates
    useEffect(() => {
        if (videoDetails && cursorInternalOffset !== null) {
            if (isPlaying && !isStopped && timeRef.current !== null) {
                let prevT = null
                const updateTime = t => {
                    if (timeRef.current >= videoDetails.end) return

                    animationFrame.current = requestAnimationFrame(updateTime)

                    // Continue the render loop
                    if (prevT === null) prevT = t
                    const tslf = (t - prevT) * playbackRate
                    applyTime(timeRef.current + tslf)
                    prevT = t
                }

                animationFrame.current = requestAnimationFrame(updateTime)
            } else if (isStopped || timeRef.current === null || timeRef.current < videoDetails.start)
                applyTime(videoDetails.start)
        }

        // Cleanup function
        return () => {
            if (animationFrame.current) {
                cancelAnimationFrame(animationFrame.current)
                animationFrame.current = null
            }
        }
    }, [isPlaying, isStopped, videoDetails, pxPerMs, cursorInternalOffset, playbackRate, applyTime])

    useEffect(() => {
        if (isPlaying) {
            const clip = clips.find(({ start, end }) => time >= start && time <= end)
            if (clip) {
                if (clip.playbackRate !== playbackRate) dispatch(setPlaybackRate(clip.playbackRate))
                if (clip.microphoneAudioVolume !== microphoneAudioVolume) dispatch(setMicrophoneAudioVolume(clip.microphoneAudioVolume))
                if (clip.systemAudioVolume !== systemAudioVolume) dispatch(setSystemAudioVolume(clip.systemAudioVolume))
            } else {
                const nextClip = clips.reduce(
                    (acc, clip) => time < clip.start && (!acc || clip.start < acc.start) ? clip : acc,
                    null
                )
                if (nextClip) applyTime(nextClip.start)
            }
        }
    }, [isPlaying, clips, time, dispatch, applyTime, playbackRate, microphoneAudioVolume, systemAudioVolume])

    return (<>
        <div ref={background} className={`${isMouseDown ? "block" : "hidden"} ` +
            "w-full h-full absolute left-0 top-0 z-20 cursor-grabbing"} />
        <div ref={cursor} className={
            `${isMouseDown ? "cursor-grabbing" : "cursor-grab"} ` +
            "group w-2 absolute bottom-0 z-30 flex justify-center h-full pt-4"
        }>
            <div className={
                `${isMouseDown ? "w-px bg-base-content" : "w-1 group-hover:w-2 bg-info group-hover:bg-base-content"} ` +
                "h-full shadow-lg rounded-lg transition-all"
            } />
        </div>
    </>)
}

Cursor.propTypes = {
    onScrollToCursor: PropTypes.func.isRequired
}