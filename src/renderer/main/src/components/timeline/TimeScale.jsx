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
} from "../../../../src/helpers"
import { selectVideoDetails } from "../../../../src/redux/projectSlice"
import {
    selectPxPerMs,
    setTime
} from "../../../../src/redux/timelineSlice"

export default function TimeScale() {

    const dispatch = useDispatch()

    const scale = useRef(null)
    const marker = useRef(null)
    const tooltip = useRef(null)

    const pxPerMs = useSelector(selectPxPerMs)
    const videoDetails = useSelector(selectVideoDetails, shallowEqual)

    const gridSpacing = useMemo(() => {
        let ms = null
        if (pxPerMs < .05) ms = 60000
        else if (pxPerMs < .1) ms = 500
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