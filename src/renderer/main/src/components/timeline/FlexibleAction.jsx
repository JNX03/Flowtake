import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import {
    useSelector
} from "react-redux"
import {
    clamp,
    msToPx,
    pxToMs
} from "../../../../src/helpers"
import { selectDuration } from "../../../../src/redux/editorSlice"
import {
    selectIsSnappingEnabled,
    selectOffset,
    selectPxPerMs,
    selectScrollLeft,
    selectSelectedIds,
    selectSnappingLines
} from "../../../../src/redux/timelineSlice"
import Action from "./Action"

export default function FlexibleAction({
    anim,
    anims,
    isRowSelected,
    color,
    children,
    onChange,
    onSelect,
    onContextMenu,
    isMinimized = false
}) {

    const MIN_DURATION = 100
    const SNAP_THRESHOLD_PX = 10

    const [userDuration, setUserDuration] = useState(null)
    const [userStart, setUserStart] = useState(null)

    const [isDragging, setIsDragging] = useState(false)

    // Derive start and duration - use user values while dragging, otherwise use anim props
    const start = useMemo(() => {
        if (userStart !== null) return userStart
        return anim?.start || 0
    }, [userStart, anim?.start])

    const duration = useMemo(() => {
        if (userDuration !== null) return userDuration
        return anim ? (anim.end - anim.start) : 0
    }, [userDuration, anim])

    const videoDuration = useSelector(selectDuration)
    const isSnappingEnabled = useSelector(selectIsSnappingEnabled)

    const scrollLeft = useSelector(selectScrollLeft)
    const offset = useSelector(selectOffset)
    const snappingLines = useSelector(selectSnappingLines)
    const pxPerMs = useSelector(selectPxPerMs)
    const selectedIds = useSelector(selectSelectedIds)

    const moveHandle = useRef(null)
    const leftResizeHandle = useRef(null)
    const rightResizeHandle = useRef(null)

    const startRef = useRef(0)
    const durationRef = useRef(0)
    const internalOffset = useRef(0)
    const initialDuration = useRef(0)
    const initialStart = useRef(0)
    const scrollLeftRef = useRef(scrollLeft)
    const offsetRef = useRef(offset)
    const isDraggingRef = useRef(false)

    const minStart = useMemo(
        () => anims.reduce((closest, current) =>
            current.end > closest && current.end <= anim.start ? current.end : closest, 0),
        [anim, anims])

    const maxEnd = useMemo(
        () => videoDuration
            ? anims.reduce((closest, current) =>
                current.start < closest && current.start >= anim.end ? current.start : closest, videoDuration)
            : null,
        [anim, anims, videoDuration])

    const lines = useMemo(() => {
        if (!isSnappingEnabled) return null
        const filteredLines = snappingLines.filter(line => line !== anim.start && line !== anim.end)
        return filteredLines.length > 0 ? filteredLines : null
    }, [snappingLines, anim, isSnappingEnabled])

    const getDelta = useCallback(e =>
        pxToMs(e.clientX - offsetRef.current - internalOffset.current + scrollLeftRef.current, pxPerMs) - initialStart.current,
        [pxPerMs]
    )

    const getDiff = (a, b) => b !== null ? Math.abs(b - a) : Infinity

    const handleMouseUp = useCallback((onMouseMove, onMouseUp) => {
        // Remove mousemove and mouseup listeners when drag ends
        window.removeEventListener("mousemove", onMouseMove)
        window.removeEventListener("mouseup", onMouseUp)

        // Check if it was a click (same position)
        if (isDraggingRef.current) {
            const start = startRef.current
            const end = start + durationRef.current
            onChange(start, end, durationRef.current)
        }

        // Reset user state to allow anim props to take over
        setUserStart(null)
        setUserDuration(null)

        moveHandle.current.classList.remove("cursor-grabbing")
    }, [onChange])

    const getClosestLine = useCallback(value =>
        lines?.reduce((closest, current) =>
            Math.abs(current - value) < Math.abs(closest - value) ? current : closest) ?? null, [lines])

    const isWithinSnappingThreshold = useCallback(
        (value, closestLine) => msToPx(getDiff(value, closestLine), pxPerMs) < SNAP_THRESHOLD_PX,
        [pxPerMs]
    )

    const handleMouseDown = useCallback((e, onMouseMove, onMouseUp) => {
        if (e.button === 0) {
            internalOffset.current = e.clientX - leftResizeHandle.current.getBoundingClientRect().left
            initialDuration.current = durationRef.current
            initialStart.current = startRef.current
            setIsDragging(false)
            window.addEventListener("mousemove", onMouseMove)
            window.addEventListener("mouseup", onMouseUp)
        }
    }, [])

    // Update refs when state changes

    useEffect(() => { startRef.current = start }, [start])

    useEffect(() => { durationRef.current = duration }, [duration])

    useEffect(() => { scrollLeftRef.current = scrollLeft }, [scrollLeft])

    useEffect(() => { offsetRef.current = offset }, [offset])

    useEffect(() => { isDraggingRef.current = isDragging }, [isDragging])

    // Handle mouse events for moving the action
    useEffect(() => {
        const onMouseMove = e => {
            const delta = getDelta(e)

            let newStart = initialStart.current + delta
            let newEnd = initialStart.current + initialDuration.current + delta

            const closestLineToStart = getClosestLine(newStart)
            const closestLineToEnd = getClosestLine(newEnd)

            const canSnapToStart = isWithinSnappingThreshold(newStart, closestLineToStart)
            const canSnapToEnd = isWithinSnappingThreshold(newEnd, closestLineToEnd)

            if (canSnapToStart && canSnapToEnd) {
                const startDiff = getDiff(newStart, closestLineToStart)
                const endDiff = getDiff(newEnd, closestLineToEnd)
                if (startDiff < endDiff) newStart = closestLineToStart
                else newStart = closestLineToEnd - initialDuration.current
            } else if (canSnapToStart) newStart = closestLineToStart
            else if (canSnapToEnd) newStart = closestLineToEnd - initialDuration.current

            setUserStart(clamp(newStart, minStart, maxEnd - durationRef.current))
            setIsDragging(true)

            moveHandle.current.classList.add("cursor-grabbing")
        }

        const onMouseUp = () => handleMouseUp(onMouseMove, onMouseUp)

        const onMouseDown = e => handleMouseDown(e, onMouseMove, onMouseUp)

        const handle = moveHandle.current

        if (maxEnd !== null && !isMinimized) handle?.addEventListener("mousedown", onMouseDown)

        // Cleanup function to remove event listeners
        return () => {
            handle?.removeEventListener("mousedown", onMouseDown)
            // Also clean up any remaining window listeners in case component unmounts during drag
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseup", onMouseUp)
        }
    }, [minStart, maxEnd, lines, selectedIds, pxPerMs, isMinimized, getClosestLine, isWithinSnappingThreshold, handleMouseUp, handleMouseDown, getDelta])

    // Handle mouse events for resizing the action from the left
    useEffect(() => {
        const onMouseMove = e => {
            const delta = getDelta(e)
            let newStart = initialStart.current + delta
            const closestLine = getClosestLine(newStart)
            if (isWithinSnappingThreshold(newStart, closestLine)) newStart = closestLine

            setUserStart(clamp(
                newStart,
                minStart,
                startRef.current + durationRef.current - MIN_DURATION
            ))
            setUserDuration(clamp(
                initialDuration.current + initialStart.current - newStart,
                MIN_DURATION,
                startRef.current + durationRef.current - minStart
            ))
            setIsDragging(true)
        }

        const onMouseUp = () => handleMouseUp(onMouseMove, onMouseUp)

        const onMouseDown = e => handleMouseDown(e, onMouseMove, onMouseUp)

        const handle = leftResizeHandle.current

        if (maxEnd !== null && !isMinimized) handle?.addEventListener("mousedown", onMouseDown)

        // Cleanup function to remove event listeners
        return () => {
            handle?.removeEventListener("mousedown", onMouseDown)
            // Also clean up any remaining window listeners in case component unmounts during drag
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseup", onMouseUp)
        }
    }, [minStart, maxEnd, lines, selectedIds, isMinimized, getClosestLine, isWithinSnappingThreshold, handleMouseUp, handleMouseDown, getDelta])

    // Handle mouse events for resizing the action from the right
    useEffect(() => {
        const onMouseMove = e => {
            const delta = getDelta(e)
            let newEnd = initialStart.current + initialDuration.current + delta
            const closestLine = getClosestLine(newEnd)
            if (isWithinSnappingThreshold(newEnd, closestLine)) newEnd = closestLine

            setUserDuration(clamp(
                newEnd - initialStart.current,
                MIN_DURATION,
                maxEnd - startRef.current
            ))
            setIsDragging(true)
        }

        const onMouseUp = () => handleMouseUp(onMouseMove, onMouseUp)

        const onMouseDown = e => handleMouseDown(e, onMouseMove, onMouseUp)

        const handle = rightResizeHandle.current

        if (maxEnd !== null) handle?.addEventListener("mousedown", onMouseDown)

        // Cleanup function to remove event listeners
        return () => {
            handle?.removeEventListener("mousedown", onMouseDown)
            // Also clean up any remaining window listeners in case component unmounts during drag
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseup", onMouseUp)
        }
    }, [minStart, maxEnd, lines, selectedIds, pxPerMs, getClosestLine, isWithinSnappingThreshold, handleMouseUp, handleMouseDown, getDelta])

    const onSelectAction = useCallback(() => {
        if (isDragging) setIsDragging(false)
        else onSelect?.()
    }, [isDragging, onSelect])

    return (
        <Action anim={anim} anims={anims} start={start} duration={duration} onSelect={onSelectAction}
            onContextMenu={onContextMenu} isRowSelected={isRowSelected} isClickEnabled={!isDragging} color={color}
            isMinimized={isMinimized}>
            <div ref={leftResizeHandle}
                className={`w-2 ${isMinimized ? "" : "hover:bg-base-content/60 transition-colors cursor-ew-resize"} shrink-0`} />
            <div ref={moveHandle} className="flex-1 flex flex-col justify-evenly min-w-0" >
                {children}
            </div>
            <div ref={rightResizeHandle}
                className={`w-2 ${isMinimized ? "" : "hover:bg-base-content/60 transition-colors cursor-ew-resize"} shrink-0`} />
        </Action>
    )
}

FlexibleAction.propTypes = {
    anim: PropTypes.shape({
        start: PropTypes.number.isRequired,
        end: PropTypes.number.isRequired
    }).isRequired,
    anims: PropTypes.arrayOf(PropTypes.shape({
        start: PropTypes.number.isRequired,
        end: PropTypes.number.isRequired,
        reduce: PropTypes.func
    })).isRequired,
    isRowSelected: PropTypes.bool.isRequired,
    color: PropTypes.oneOf(["primary", "secondary", "tertiary", "accent", "neutral"]),
    children: PropTypes.node,
    onChange: PropTypes.func.isRequired,
    onSelect: PropTypes.func,
    onContextMenu: PropTypes.func,
    isMinimized: PropTypes.bool
}