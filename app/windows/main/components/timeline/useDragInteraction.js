import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { clamp, msToPx, pxToMs } from "@shared/helpers"
import { selectDuration } from "@shared/redux/editorSlice"
import {
    selectIsSnappingEnabled,
    selectOffset,
    selectPxPerMs,
    selectScrollLeft,
    selectSnappingLines,
    setActiveSnapLine
} from "@shared/redux/timelineSlice"

const MIN_DURATION = 100
const SNAP_THRESHOLD_PX = 10
const DRAG_THRESHOLD_PX = 3
const CROSS_TRACK_THROTTLE_PX = 5

// Find non-overlapping position on a track, closest to the desired start
function findNonOverlappingPosition(targetStart, clipDuration, existingClips, videoDuration) {
    const end = targetStart + clipDuration
    const overlaps = existingClips.some(c => c.start < end && c.end > targetStart)
    if (!overlaps) return targetStart

    const sorted = [...existingClips].sort((a, b) => a.start - b.start)
    const gaps = []

    const firstStart = sorted.length > 0 ? sorted[0].start : videoDuration
    if (firstStart > 0) gaps.push({ start: 0, end: firstStart })

    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].end < sorted[i + 1].start)
            gaps.push({ start: sorted[i].end, end: sorted[i + 1].start })
    }

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

// Snap threshold in ms, inversely proportional to zoom level.
// At default zoom (0.1 px/ms), threshold = SNAP_THRESHOLD_PX.
// At higher zoom, threshold shrinks (more precise). Floor of 5px.
function getSnapThresholdPx(pxPerMs) {
    return Math.max(SNAP_THRESHOLD_PX / Math.sqrt(pxPerMs / 0.1), 5)
}

export default function useDragInteraction({
    anim,
    anims,
    isMinimized = false,
    onChange,
    crossTrackEnabled = false,
    currentTrackId = null,
    trackDropZone = null,
    getTrackAnims = null,
    onTrackChange = null,
    color,
}) {
    const dispatch = useDispatch()

    const [isDragging, setIsDragging] = useState(false)

    const videoDuration = useSelector(selectDuration)
    const isSnappingEnabled = useSelector(selectIsSnappingEnabled)
    const scrollLeft = useSelector(selectScrollLeft)
    const offset = useSelector(selectOffset)
    const snappingLines = useSelector(selectSnappingLines)
    const pxPerMs = useSelector(selectPxPerMs)

    // DOM refs for handles
    const moveHandleRef = useRef(null)
    const leftResizeRef = useRef(null)
    const rightResizeRef = useRef(null)
    const actionElementRef = useRef(null)

    // Single drag state object — eliminates 17+ separate refs
    const drag = useRef({
        mode: null,           // "move" | "resize-left" | "resize-right"
        active: false,
        thresholdMet: false,
        initialMouseX: 0,
        initialMouseY: 0,
        initialStart: 0,
        initialDuration: 0,
        internalOffset: 0,
        currentStart: 0,
        currentDuration: 0,
        targetTrack: null,
        lastSnapLine: null,
        lastCrossTrackY: 0,
        rafId: 0,
        pendingUpdate: false,
        highlightedEl: null,
    })

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

    // Stable refs for values accessed in event handlers (avoids useEffect re-registration)
    const refs = useRef({})
    refs.current.pxPerMs = pxPerMs
    refs.current.scrollLeft = scrollLeft
    refs.current.offset = offset
    refs.current.minStart = minStart
    refs.current.maxEnd = maxEnd
    refs.current.lines = lines
    refs.current.videoDuration = videoDuration
    refs.current.anim = anim
    refs.current.onChange = onChange
    refs.current.onTrackChange = onTrackChange
    refs.current.getTrackAnims = getTrackAnims
    refs.current.crossTrackEnabled = crossTrackEnabled
    refs.current.currentTrackId = currentTrackId
    refs.current.trackDropZone = trackDropZone
    refs.current.color = color

    // Keep drag position in sync when not dragging
    if (!drag.current.active) {
        drag.current.currentStart = start
        drag.current.currentDuration = duration
    }

    // Stable helpers (read from refs, no deps needed)
    const getDelta = useCallback((e) =>
        pxToMs(e.clientX - refs.current.offset - drag.current.internalOffset + refs.current.scrollLeft, refs.current.pxPerMs)
        - drag.current.initialStart, [])

    const getClosestLine = useCallback((value) => {
        const l = refs.current.lines
        return l?.reduce((closest, current) =>
            Math.abs(current - value) < Math.abs(closest - value) ? current : closest) ?? null
    }, [])

    const isWithinSnappingThreshold = useCallback((value, closestLine) => {
        const p = refs.current.pxPerMs
        return msToPx(getDiff(value, closestLine), p) < getSnapThresholdPx(p)
    }, [])

    const clearTrackHighlight = useCallback(() => {
        const d = drag.current
        if (d.highlightedEl) {
            d.highlightedEl.style.outline = ""
            d.highlightedEl.style.outlineOffset = ""
            d.highlightedEl.style.borderRadius = ""
            d.highlightedEl = null
        }
    }, [])

    const scheduleDomUpdate = useCallback(() => {
        const d = drag.current
        if (d.pendingUpdate) return
        d.pendingUpdate = true
        d.rafId = requestAnimationFrame(() => {
            d.pendingUpdate = false
            if (actionElementRef.current) {
                const p = refs.current.pxPerMs
                actionElementRef.current.style.left = `${msToPx(d.currentStart, p)}px`
                actionElementRef.current.style.width = `${msToPx(d.currentDuration, p)}px`
            }
        })
    }, [])

    const dispatchSnapLine = useCallback((activeSnap) => {
        const d = drag.current
        if (activeSnap !== d.lastSnapLine) {
            d.lastSnapLine = activeSnap
            dispatch(setActiveSnapLine(activeSnap))
        }
    }, [dispatch])

    // Snap both start and end, returning { newStart, activeSnap }
    const snapMove = useCallback((newStart, dur) => {
        const closestLineToStart = getClosestLine(newStart)
        const closestLineToEnd = getClosestLine(newStart + dur)
        const canSnapStart = isWithinSnappingThreshold(newStart, closestLineToStart)
        const canSnapEnd = isWithinSnappingThreshold(newStart + dur, closestLineToEnd)

        let activeSnap = null
        if (canSnapStart && canSnapEnd) {
            if (getDiff(newStart, closestLineToStart) < getDiff(newStart + dur, closestLineToEnd)) {
                newStart = closestLineToStart; activeSnap = closestLineToStart
            } else {
                newStart = closestLineToEnd - dur; activeSnap = closestLineToEnd
            }
        } else if (canSnapStart) { newStart = closestLineToStart; activeSnap = closestLineToStart }
        else if (canSnapEnd) { newStart = closestLineToEnd - dur; activeSnap = closestLineToEnd }

        return { newStart, activeSnap }
    }, [getClosestLine, isWithinSnappingThreshold])

    // Snap a single edge value, returning { value, activeSnap }
    const snapEdge = useCallback((value) => {
        const closestLine = getClosestLine(value)
        let activeSnap = null
        if (isWithinSnappingThreshold(value, closestLine)) {
            value = closestLine
            activeSnap = closestLine
        }
        return { value, activeSnap }
    }, [getClosestLine, isWithinSnappingThreshold])

    // Cross-track detection for move mode
    const handleCrossTrack = useCallback((e, newStart) => {
        const d = drag.current
        const r = refs.current
        let effectiveMinStart = r.minStart
        let effectiveMaxEnd = r.maxEnd

        if (!r.crossTrackEnabled || !r.trackDropZone || !r.getTrackAnims) {
            return { effectiveMinStart, effectiveMaxEnd }
        }

        const yDelta = Math.abs(e.clientY - d.lastCrossTrackY)
        if (yDelta > CROSS_TRACK_THROTTLE_PX) {
            d.lastCrossTrackY = e.clientY
            const track = findTrackUnderMouse(e.clientX, e.clientY, r.trackDropZone)
            const hoveredTrackId = track?.trackId ?? null

            if (hoveredTrackId !== null && hoveredTrackId !== r.currentTrackId) {
                d.targetTrack = hoveredTrackId
                const targetAnims = r.getTrackAnims(hoveredTrackId).filter(a => a.id !== r.anim.id)
                const constraints = computeConstraints(
                    { start: newStart, end: newStart + d.initialDuration },
                    targetAnims, r.videoDuration
                )
                effectiveMinStart = constraints.minStart
                effectiveMaxEnd = constraints.maxEnd ?? r.maxEnd

                if (d.highlightedEl !== track.element) {
                    clearTrackHighlight()
                    track.element.style.outline = `2px solid color-mix(in oklab, var(--color-${r.color || "primary"}) 50%, transparent)`
                    track.element.style.outlineOffset = "-2px"
                    track.element.style.borderRadius = "6px"
                    d.highlightedEl = track.element
                }
            } else {
                d.targetTrack = null
                clearTrackHighlight()
            }
        } else if (d.targetTrack !== null && r.getTrackAnims) {
            const targetAnims = r.getTrackAnims(d.targetTrack).filter(a => a.id !== r.anim.id)
            const constraints = computeConstraints(
                { start: newStart, end: newStart + d.initialDuration },
                targetAnims, r.videoDuration
            )
            effectiveMinStart = constraints.minStart
            effectiveMaxEnd = constraints.maxEnd ?? r.maxEnd
        }

        return { effectiveMinStart, effectiveMaxEnd }
    }, [clearTrackHighlight])

    // Single unified effect for all drag interactions
    useEffect(() => {
        const d = drag.current

        const onMouseMove = (e) => {
            if (!d.thresholdMet) {
                const dx = e.clientX - d.initialMouseX
                const dy = e.clientY - d.initialMouseY
                const dist = d.mode === "move" ? dx * dx + dy * dy : dx * dx
                if (dist < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
                d.thresholdMet = true
            }

            const delta = getDelta(e)

            if (d.mode === "move") {
                let newStart = d.initialStart + delta
                const snap = snapMove(newStart, d.initialDuration)
                newStart = snap.newStart
                dispatchSnapLine(snap.activeSnap)

                const { effectiveMinStart, effectiveMaxEnd } = handleCrossTrack(e, newStart)
                d.currentStart = clamp(newStart, effectiveMinStart, effectiveMaxEnd - d.currentDuration)

            } else if (d.mode === "resize-left") {
                let newStart = d.initialStart + delta
                const snap = snapEdge(newStart)
                newStart = snap.value
                dispatchSnapLine(snap.activeSnap)

                const currentEnd = d.currentStart + d.currentDuration
                d.currentStart = clamp(newStart, refs.current.minStart, currentEnd - MIN_DURATION)
                d.currentDuration = clamp(
                    d.initialDuration + d.initialStart - newStart,
                    MIN_DURATION,
                    currentEnd - refs.current.minStart
                )

            } else if (d.mode === "resize-right") {
                let newEnd = d.initialStart + d.initialDuration + delta
                const snap = snapEdge(newEnd)
                newEnd = snap.value
                dispatchSnapLine(snap.activeSnap)

                d.currentDuration = clamp(
                    newEnd - d.initialStart,
                    MIN_DURATION,
                    refs.current.maxEnd - d.currentStart
                )
            }

            scheduleDomUpdate()

            if (!d.active) {
                d.active = true
                setIsDragging(true)
            }

            if (d.mode === "move") {
                moveHandleRef.current?.classList.add("cursor-grabbing")
            }
        }

        const onMouseUp = () => {
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseup", onMouseUp)
            cancelAnimationFrame(d.rafId)
            d.pendingUpdate = false
            clearTrackHighlight()

            if (d.active) {
                const s = d.currentStart
                const dur = d.currentDuration
                const end = s + dur
                const r = refs.current

                if (d.mode === "move" && r.crossTrackEnabled && d.targetTrack !== null
                    && d.targetTrack !== r.currentTrackId && r.onTrackChange && r.getTrackAnims) {
                    const targetAnims = r.getTrackAnims(d.targetTrack).filter(a => a.id !== r.anim.id)
                    const validStart = findNonOverlappingPosition(s, dur, targetAnims, Infinity)
                    if (validStart !== null) {
                        r.onTrackChange(validStart, validStart + dur, d.targetTrack)
                    } else {
                        r.onChange(r.anim.start, r.anim.end, r.anim.end - r.anim.start)
                    }
                } else {
                    r.onChange(s, end, dur)
                }
            }

            d.targetTrack = null
            d.active = false
            d.mode = null
            d.lastSnapLine = null
            setIsDragging(false)
            dispatch(setActiveSnapLine(null))
            moveHandleRef.current?.classList.remove("cursor-grabbing")
        }

        const createMouseDown = (mode) => (e) => {
            if (e.button !== 0) return
            d.mode = mode
            d.internalOffset = e.clientX - leftResizeRef.current.getBoundingClientRect().left
            d.initialDuration = d.currentDuration
            d.initialStart = d.currentStart
            d.initialMouseX = e.clientX
            d.initialMouseY = e.clientY
            d.lastCrossTrackY = e.clientY
            d.thresholdMet = false
            d.targetTrack = null
            d.lastSnapLine = null
            window.addEventListener("mousemove", onMouseMove)
            window.addEventListener("mouseup", onMouseUp)
        }

        const canDrag = refs.current.maxEnd !== null
        const moveEl = moveHandleRef.current
        const leftEl = leftResizeRef.current
        const rightEl = rightResizeRef.current

        const moveDown = createMouseDown("move")
        const leftDown = createMouseDown("resize-left")
        const rightDown = createMouseDown("resize-right")

        if (canDrag && !isMinimized) {
            moveEl?.addEventListener("mousedown", moveDown)
            leftEl?.addEventListener("mousedown", leftDown)
        }
        if (canDrag) {
            rightEl?.addEventListener("mousedown", rightDown)
        }

        return () => {
            moveEl?.removeEventListener("mousedown", moveDown)
            leftEl?.removeEventListener("mousedown", leftDown)
            rightEl?.removeEventListener("mousedown", rightDown)
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseup", onMouseUp)
            cancelAnimationFrame(d.rafId)
            d.pendingUpdate = false
            if (d.active) {
                d.active = false
                d.mode = null
                clearTrackHighlight()
            }
        }
    }, [isMinimized, dispatch, getDelta, snapMove, snapEdge, handleCrossTrack, scheduleDomUpdate, dispatchSnapLine, clearTrackHighlight])

    const setActionRef = useCallback(el => {
        actionElementRef.current = el
    }, [])

    return {
        moveHandleRef,
        leftResizeRef,
        rightResizeRef,
        actionElementRef: setActionRef,
        isDragging,
        start,
        duration,
    }
}
