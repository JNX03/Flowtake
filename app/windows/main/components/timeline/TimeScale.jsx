import moment from "moment"
import momentDurationFormatSetup from "moment-duration-format"
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
import {
    clamp,
    getGridBackgroundImage,
    msToPx,
    pxToMs
} from "@shared/helpers"
import { selectDuration } from "@shared/redux/editorSlice"
import { selectVideoDetails } from "@shared/redux/projectSlice"
import {
    selectPxPerMs,
    setTime
} from "@shared/redux/timelineSlice"

function formatLabel(ms) {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, "0")}`
    return `${seconds}s`
}

export default function TimeScale() {

    const dispatch = useDispatch()

    const scale = useRef(null)
    const marker = useRef(null)
    const tooltip = useRef(null)

    const pxPerMs = useSelector(selectPxPerMs)
    const videoDetails = useSelector(selectVideoDetails, shallowEqual)
    const duration = useSelector(selectDuration)

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

    // Generate time label positions
    const timeLabels = useMemo(() => {
        if (!duration || !labelIntervalMs) return []
        const labels = []
        for (let ms = 0; ms <= duration; ms += labelIntervalMs) {
            labels.push({ ms, px: msToPx(ms, pxPerMs) })
        }
        return labels
    }, [duration, labelIntervalMs, pxPerMs])

    const [internalOffset, setInternalOffset] = useState(null)

    useEffect(() => {
        momentDurationFormatSetup(moment)
    }, [])

    useEffect(() => {
        if (!internalOffset) setInternalOffset(marker.current.getBoundingClientRect().width * .5)
    }, [internalOffset])

    useEffect(() => {
        const handleMouseMove = e => {
            const time = clamp(pxToMs(e.offsetX, pxPerMs), videoDetails.start, videoDetails.end)

            if (marker.current) marker.current.style.transform = `translateX(${msToPx(time, pxPerMs) - internalOffset}px)`

            if (tooltip.current)
                tooltip.current.dataset.tip = moment.duration(time).format("mm:ss:SSS", { trim: false })
        }

        const element = scale.current

        if (videoDetails?.start !== undefined && videoDetails?.end !== undefined && internalOffset !== null)
            element?.addEventListener('mousemove', handleMouseMove)

        return () => { element?.removeEventListener('mousemove', handleMouseMove) }
    }, [pxPerMs, videoDetails?.start, videoDetails?.end, internalOffset])

    const onClick = useCallback(e => {
        dispatch(setTime(pxToMs(e.nativeEvent.offsetX, pxPerMs)))
    }, [dispatch, pxPerMs])

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
            <div ref={scale} onClick={onClick} className="w-full h-full z-40 group absolute left-0 top-0 cursor-pointer">
                <div ref={marker} className="w-1 h-full bg-info opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex rounded-lg">
                    <div ref={tooltip} className="tooltip tooltip-open tooltip-bottom tooltip-info">
                        <div className="w-1 h-full" />
                    </div>
                </div>
            </div>
        </div>
    )
}
