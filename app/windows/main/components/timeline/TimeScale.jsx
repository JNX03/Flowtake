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
import { selectVideoDetails } from "@shared/redux/projectSlice"
import {
    selectPxPerMs,
    setTime
} from "@shared/redux/timelineSlice"

export default function TimeScale() {

    const dispatch = useDispatch()

    const scale = useRef(null)
    const marker = useRef(null)
    const tooltip = useRef(null)

    const pxPerMs = useSelector(selectPxPerMs)
    const videoDetails = useSelector(selectVideoDetails, shallowEqual)

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

    return (<>
        <div className="w-full h-4 z-10" style={{
            backgroundImage: getGridBackgroundImage(gridSpacing),
            backgroundSize: '100% 100%'
        }} />
        <div ref={scale} onClick={onClick} className="w-full h-4 z-40 group absolute left-0 top-0 cursor-pointer"  >
            <div ref={marker} className="w-1 h-4 bg-info opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex rounded-lg" >
                <div ref={tooltip} className="tooltip tooltip-open tooltip-bottom tooltip-info">
                    <div className="w-1 h-4" />
                </div>
            </div>
        </div>
    </>)
}