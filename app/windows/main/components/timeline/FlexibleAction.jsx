import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    clamp,
    msToPx,
    pxToMs
} from "@shared/helpers"
import { selectDuration } from "@shared/redux/editorSlice"
import {
    selectIsSnappingEnabled,
    selectOffset,
    selectPxPerMs,
    selectScrollLeft,
    selectSelectedIds,
    selectSnappingLines,
    setActiveSnapLine
} from "@shared/redux/timelineSlice"
import Action from "./Action"

// Find non-overlapping position on a track, closest to the desired start
function findNonOverlappingPosition(targetStart, clipDuration, existingClips, videoDuration) {
    const end = targetStart + clipDuration
    const overlaps = existingClips.some(c => c.start < end && c.end > targetStart)
    if (!overlaps) return targetStart

    const sorted = [...existingClips].sort((a, b) => a.start - b.start)
    const gaps = []

    // Gap before first clip
    const firstStart = sorted.length > 0 ? sorted[0].start : videoDuration
    if (firstStart > 0) gaps.push({ start: 0, end: firstStart })

    // Gaps between clips
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].end < sorted[i + 1].start)
            gaps.push({ start: sorted[i].end, end: sorted[i + 1].start })
    }

    // Gap after last clip
    if (sorted.length > 0 && sorted[sorted.length - 1].end < videoDuration)
        gaps.push({ start: sorted[sorted.length - 1].end, end: videoDuration })

    if (sorted.length === 0)
        gaps.push({ start: 0, end: videoDuration })

    let bestPos = null
    let bestDist = Infinity

    for (const gap of gaps) {
        if (gap.end - gap.start >= clipDuration) {
            const clampedStart = clamp(targetStart, gap.start, gap.end - clipDuration)
            const dist = Math.abs(clampedStart - targetStart)
            if (dist < bestDist) {
                bestDist = dist
                bestPos = clampedStart
            }
        }
    }

    return bestPos
}

// Find track element under mouse via elementsFromPoint
function findTrackUnderMouse(x, y, dropZone) {
    const elements = document.elementsFromPoint(x, y)
    for (const el of elements) {
        if (el.dataset.dropZone === dropZone) {
            return {
                trackId: el.dataset.dropTrackId != null ? Number(el.dataset.dropTrackId) : null,
                element: el
            }
        }
    }
    return null
}

// Compute minStart/maxEnd constraints from a list of anims relative to a clip
function computeConstraints(anim, trackAnims, videoDuration) {
    const minStart = trackAnims.reduce((closest, current) =>
        current.end > closest && current.end <= anim.start ? current.end : closest, 0)
    const maxEnd = videoDuration
        ? trackAnims.reduce((closest, current) =>
            current.start < closest && current.start >= anim.end ? current.start : closest, videoDuration)
        : null
    return { minStart, maxEnd }
}

const getDiff = (a, b) => b !== null ? Math.abs(b - a) : Infinity

export default function FlexibleAction({
    anim,
    anims,
    isRowSelected,
    color,
    children,
    onChange,
    onSelect,
    onContextMenu,
    isMinimized = false,
    // Cross-track drag props (opt-in)
    crossTrackEnabled = false,
    currentTrackId = null,
    trackDropZone = null,
    getTrackAnims = null,
    onTrackChange = null,
}) {

    const MIN_DURATION = 100
    const SNAP_THRESHOLD_PX = 10
    const DRAG_THRESHOLD_PX = 3
    const CROSS_TRACK_THROTTLE_PX = 5

    const dispatch = useDispatch()

    const [isDragging, setIsDragging] = useState(false)

    const videoDuration = useSelector(selectDuration)
    const isSnappingEnabled = useSelector(selectIsSnappingEnabled)
    const scrollLeft = useSelector(selectScrollLeft)
    const offset = useSelector(selectOffset)
    const snappingLines = useSelector(selectSnappingLines)
    const pxPerMs = useSelector(selectPxPerMs)
    const selectedIds = useSelector(selectSelectedIds)

    // DOM refs for handles
    const moveHandle = useRef(null)
    const leftResizeHandle = useRef(null)
    const rightResizeHandle = useRef(null)
    const actionElementRef = useRef(null)

    // Drag operation refs
    const internalOffset = useRef(0)
    const initialDuration = useRef(0)
    const initialStart = useRef(0)
    const isDraggingRef = useRef(false)
    const initialMouseX = useRef(0)
    const initialMouseY = useRef(0)
    const dragThresholdMet = useRef(false)
    const targetTrackRef = useRef(null)
    const highlightedEl = useRef(null)

    // RAF refs for direct DOM updates
    const rafIdRef = useRef(0)
    const pendingUpdateRef = useRef(false)
    const dragStartRef = useRef(0)
    const dragDurationRef = useRef(0)
    const lastSnapLineRef = useRef(null)
    const lastCrossTrackYRef = useRef(0)

    // Stable refs for values accessed in mousemove handlers (avoids useEffect re-registration)
    const pxPerMsRef = useRef(pxPerMs)
    const scrollLeftRef = useRef(scrollLeft)
    const offsetRef = useRef(offset)
    const minStartRef = useRef(0)
    const maxEndRef = useRef(null)
    const linesRef = useRef(null)
    const videoDurationRef = useRef(videoDuration)
    const animRef = useRef(anim)
    const onChangeRef = useRef(onChange)
    const onTrackChangeRef = useRef(onTrackChange)
    const getTrackAnimsRef = useRef(getTrackAnims)
    const crossTrackEnabledRef = useRef(crossTrackEnabled)
    const currentTrackIdRef = useRef(currentTrackId)
    const trackDropZoneRef = useRef(trackDropZone)
    const colorRef = useRef(color)

    // Derived values
    const start = useMemo(() => anim?.start || 0, [anim?.start])
    const duration = useMemo(() => anim ? (anim.end - anim.start) : 0, [anim])

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

    // Synchronous ref updates (no useEffect delay)
    pxPerMsRef.current = pxPerMs
    scrollLeftRef.current = scrollLeft
    offsetRef.current = offset
    minStartRef.current = minStart
    maxEndRef.current = maxEnd
    linesRef.current = lines
    videoDurationRef.current = videoDuration
    animRef.current = anim
    onChangeRef.current = onChange
    onTrackChangeRef.current = onTrackChange
    getTrackAnimsRef.current = getTrackAnims
    crossTrackEnabledRef.current = crossTrackEnabled
    currentTrackIdRef.current = currentTrackId
    trackDropZoneRef.current = trackDropZone
    colorRef.current = color

    if (!isDraggingRef.current) {
        dragStartRef.current = start
        dragDurationRef.current = duration
    }

    // Helper functions that read from refs (stable, no deps)
    const getDelta = (e) =>
        pxToMs(e.clientX - offsetRef.current - internalOffset.current + scrollLeftRef.current, pxPerMsRef.current) - initialStart.current

    const getClosestLine = (value) => {
        const l = linesRef.current
        return l?.reduce((closest, current) =>
            Math.abs(current - value) < Math.abs(closest - value) ? current : closest) ?? null
    }

    const isWithinSnappingThreshold = (value, closestLine) => {
        const p = pxPerMsRef.current
        const scaledThreshold = Math.max(SNAP_THRESHOLD_PX / Math.sqrt(p / 0.1), 5)
        return msToPx(getDiff(value, closestLine), p) < scaledThreshold
    }

    const clearTrackHighlight = () => {
        if (highlightedEl.current) {
            highlightedEl.current.style.outline = ""
            highlightedEl.current.style.outlineOffset = ""
            highlightedEl.current.style.borderRadius = ""
            highlightedEl.current = null
        }
    }

    // Schedule a direct DOM update via requestAnimationFrame
    const scheduleDomUpdate = () => {
        if (pendingUpdateRef.current) return
        pendingUpdateRef.current = true
        rafIdRef.current = requestAnimationFrame(() => {
            pendingUpdateRef.current = false
            if (actionElementRef.current) {
                const p = pxPerMsRef.current
                const left = msToPx(dragStartRef.current, p)
                const width = msToPx(dragDurationRef.current, p)
                actionElementRef.current.style.left = `${left}px`
                actionElementRef.current.style.width = `${width}px`
            }
        })
    }

    const dispatchSnapLine = (activeSnap) => {
        if (activeSnap !== lastSnapLineRef.current) {
            lastSnapLineRef.current = activeSnap
            dispatch(setActiveSnapLine(activeSnap))
        }
    }


    // Handle mouse events for moving the action
    useEffect(() => {
        const onMouseMove = e => {
            if (!dragThresholdMet.current) {
                const dx = e.clientX - initialMouseX.current
                const dy = e.clientY - initialMouseY.current
                if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
                dragThresholdMet.current = true
            }

            const delta = getDelta(e)

            let newStart = initialStart.current + delta
            let newEnd = initialStart.current + initialDuration.current + delta

            const closestLineToStart = getClosestLine(newStart)
            const closestLineToEnd = getClosestLine(newEnd)

            const canSnapToStart = isWithinSnappingThreshold(newStart, closestLineToStart)
            const canSnapToEnd = isWithinSnappingThreshold(newEnd, closestLineToEnd)

            let activeSnap = null
            if (canSnapToStart && canSnapToEnd) {
                const startDiff = getDiff(newStart, closestLineToStart)
                const endDiff = getDiff(newEnd, closestLineToEnd)
                if (startDiff < endDiff) { newStart = closestLineToStart; activeSnap = closestLineToStart }
                else { newStart = closestLineToEnd - initialDuration.current; activeSnap = closestLineToEnd }
            } else if (canSnapToStart) { newStart = closestLineToStart; activeSnap = closestLineToStart }
            else if (canSnapToEnd) { newStart = closestLineToEnd - initialDuration.current; activeSnap = closestLineToEnd }

            dispatchSnapLine(activeSnap)

            // Cross-track detection (throttled by Y movement)
            let effectiveMinStart = minStartRef.current
            let effectiveMaxEnd = maxEndRef.current
            if (crossTrackEnabledRef.current && trackDropZoneRef.current && getTrackAnimsRef.current) {
                const yDelta = Math.abs(e.clientY - lastCrossTrackYRef.current)
                if (yDelta > CROSS_TRACK_THROTTLE_PX) {
                    lastCrossTrackYRef.current = e.clientY
                    const track = findTrackUnderMouse(e.clientX, e.clientY, trackDropZoneRef.current)
                    const hoveredTrackId = track?.trackId ?? null

                    if (hoveredTrackId !== null && hoveredTrackId !== currentTrackIdRef.current) {
                        targetTrackRef.current = hoveredTrackId
                        const targetAnims = getTrackAnimsRef.current(hoveredTrackId).filter(a => a.id !== animRef.current.id)
                        const constraints = computeConstraints(
                            { start: newStart, end: newStart + initialDuration.current },
                            targetAnims, videoDurationRef.current
                        )
                        effectiveMinStart = constraints.minStart
                        effectiveMaxEnd = constraints.maxEnd ?? maxEndRef.current

                        if (highlightedEl.current !== track.element) {
                            clearTrackHighlight()
                            track.element.style.outline = `2px solid color-mix(in oklab, var(--color-${colorRef.current || "primary"}) 50%, transparent)`
                            track.element.style.outlineOffset = "-2px"
                            track.element.style.borderRadius = "6px"
                            highlightedEl.current = track.element
                        }
                    } else {
                        targetTrackRef.current = null
                        clearTrackHighlight()
                    }
                } else if (targetTrackRef.current !== null && getTrackAnimsRef.current) {
                    // Reuse last cross-track constraints without DOM query
                    const targetAnims = getTrackAnimsRef.current(targetTrackRef.current).filter(a => a.id !== animRef.current.id)
                    const constraints = computeConstraints(
                        { start: newStart, end: newStart + initialDuration.current },
                        targetAnims, videoDurationRef.current
                    )
                    effectiveMinStart = constraints.minStart
                    effectiveMaxEnd = constraints.maxEnd ?? maxEndRef.current
                }
            }

            dragStartRef.current = clamp(newStart, effectiveMinStart, effectiveMaxEnd - dragDurationRef.current)
            scheduleDomUpdate()

            if (!isDraggingRef.current) {
                isDraggingRef.current = true
                setIsDragging(true)
            }

            moveHandle.current?.classList.add("cursor-grabbing")
        }

        const onMouseUp = () => {
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseup", onMouseUp)
            cancelAnimationFrame(rafIdRef.current)
            pendingUpdateRef.current = false
            clearTrackHighlight()

            if (isDraggingRef.current) {
                const s = dragStartRef.current
                const d = dragDurationRef.current
                const end = s + d
                const target = targetTrackRef.current

                if (crossTrackEnabledRef.current && target !== null && target !== currentTrackIdRef.current
                    && onTrackChangeRef.current && getTrackAnimsRef.current) {
                    const targetAnims = getTrackAnimsRef.current(target).filter(a => a.id !== animRef.current.id)
                    const validStart = findNonOverlappingPosition(s, d, targetAnims, end + 10000)
                    if (validStart !== null) {
                        onTrackChangeRef.current(validStart, validStart + d, target)
                    } else {
                        onChangeRef.current(animRef.current.start, animRef.current.end, animRef.current.end - animRef.current.start)
                    }
                } else {
                    onChangeRef.current(s, end, d)
                }
            }

            targetTrackRef.current = null
            isDraggingRef.current = false
            setIsDragging(false)
            lastSnapLineRef.current = null
            dispatch(setActiveSnapLine(null))
            moveHandle.current?.classList.remove("cursor-grabbing")
        }

        const onMouseDown = e => {
            if (e.button === 0) {
                internalOffset.current = e.clientX - leftResizeHandle.current.getBoundingClientRect().left
                initialDuration.current = dragDurationRef.current
                initialStart.current = dragStartRef.current
                initialMouseX.current = e.clientX
                initialMouseY.current = e.clientY
                lastCrossTrackYRef.current = e.clientY
                dragThresholdMet.current = false
                targetTrackRef.current = null
                lastSnapLineRef.current = null
                window.addEventListener("mousemove", onMouseMove)
                window.addEventListener("mouseup", onMouseUp)
            }
        }

        const handle = moveHandle.current

        if (maxEndRef.current !== null && !isMinimized) handle?.addEventListener("mousedown", onMouseDown)

        return () => {
            handle?.removeEventListener("mousedown", onMouseDown)
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseup", onMouseUp)
        }
    }, [isMinimized, dispatch])

    // Handle mouse events for resizing the action from the left
    useEffect(() => {
        const onMouseMove = e => {
            // Drag threshold for resize too
            if (!dragThresholdMet.current) {
                const dx = e.clientX - initialMouseX.current
                if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
                dragThresholdMet.current = true
            }

            const delta = getDelta(e)
            let newStart = initialStart.current + delta
            const closestLine = getClosestLine(newStart)
            let activeSnap = null
            if (isWithinSnappingThreshold(newStart, closestLine)) { newStart = closestLine; activeSnap = closestLine }
            setSnappedLine(activeSnap)
            dispatch(setActiveSnapLine(activeSnap))

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
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseup", onMouseUp)
        }
    }, [minStart, maxEnd, lines, selectedIds, isMinimized, getClosestLine, isWithinSnappingThreshold, handleMouseUp, handleMouseDown, getDelta, dispatch])

    // Handle mouse events for resizing the action from the right
    useEffect(() => {
        const onMouseMove = e => {
            // Drag threshold for resize too
            if (!dragThresholdMet.current) {
                const dx = e.clientX - initialMouseX.current
                if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
                dragThresholdMet.current = true
            }

            const delta = getDelta(e)
            let newEnd = initialStart.current + initialDuration.current + delta
            const closestLine = getClosestLine(newEnd)
            let activeSnap = null
            if (isWithinSnappingThreshold(newEnd, closestLine)) { newEnd = closestLine; activeSnap = closestLine }
            setSnappedLine(activeSnap)
            dispatch(setActiveSnapLine(activeSnap))

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
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseup", onMouseUp)
        }
    }, [minStart, maxEnd, lines, selectedIds, pxPerMs, getClosestLine, isWithinSnappingThreshold, handleMouseUp, handleMouseDown, getDelta, dispatch])

    const onSelectAction = useCallback(() => {
        if (isDragging) setIsDragging(false)
        else onSelect?.()
    }, [isDragging, onSelect])

    return (
        <Action anim={anim} anims={anims} start={start} duration={duration} onSelect={onSelectAction}
            onContextMenu={onContextMenu} isRowSelected={isRowSelected} isClickEnabled={!isDragging} color={color}
            isMinimized={isMinimized}>
            <div ref={leftResizeHandle}
                className={`w-3.5 ${isMinimized ? "" : "hover:bg-base-content/40 transition-colors cursor-ew-resize"} shrink-0 flex items-center justify-center`}>
                {!isMinimized && <div className="w-0.5 h-3 rounded-full bg-base-content/20" />}
            </div>
            <div ref={moveHandle} className={`flex-1 flex flex-col justify-evenly min-w-0 ${isMinimized ? "" : "cursor-grab"}`}>
                {children}
            </div>
            <div ref={rightResizeHandle}
                className={`w-3.5 ${isMinimized ? "" : "hover:bg-base-content/40 transition-colors cursor-ew-resize"} shrink-0 flex items-center justify-center`}>
                {!isMinimized && <div className="w-0.5 h-3 rounded-full bg-base-content/20" />}
            </div>
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
    isMinimized: PropTypes.bool,
    crossTrackEnabled: PropTypes.bool,
    currentTrackId: PropTypes.number,
    trackDropZone: PropTypes.string,
    getTrackAnims: PropTypes.func,
    onTrackChange: PropTypes.func,
}