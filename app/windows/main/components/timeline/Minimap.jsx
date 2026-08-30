import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState
} from "react"
import { useSelector } from "react-redux"
import {
    buildTimelineMinimapSegments,
    formatMinimapViewportRange,
    getMinimapScrollLeftFromKeyboard,
    getMinimapScrollLeftFromPointer,
    getTimelineMinimapGeometry,
} from "@shared/editor/timelineMinimap"
import { selectAllAudioClips } from "@shared/redux/audioTrackSlice"
import { selectAllClips } from "@shared/redux/clipSlice"
import { selectDuration } from "@shared/redux/editorSlice"
import { selectAllMasks } from "@shared/redux/maskSlice"
import { selectAllOverlays } from "@shared/redux/overlaySlice"
import { selectAllSubtitles } from "@shared/redux/subtitleSlice"
import {
    selectPxPerMs
} from "@shared/redux/timelineSlice"
import { selectAllZooms } from "@shared/redux/zoomSlice"

const TRACK_COLORS = {
    clips: "bg-primary/60",
    zooms: "bg-secondary/60",
    subtitles: "bg-accent/60",
    masks: "bg-neutral/60",
    audio: "bg-info/60",
    overlays: "bg-warning/60",
}
const MAX_SEGMENTS_PER_TYPE = 96

export default function Minimap({ containerRef }) {

    const duration = useSelector(selectDuration)
    const pxPerMs = useSelector(selectPxPerMs)

    const clips = useSelector(selectAllClips)
    const zooms = useSelector(selectAllZooms)
    const subtitles = useSelector(selectAllSubtitles)
    const masks = useSelector(selectAllMasks)
    const audioClips = useSelector(selectAllAudioClips)
    const overlays = useSelector(selectAllOverlays)
    const entitySegments = useMemo(() => ({
        clips: buildTimelineMinimapSegments(
            clips,
            duration,
            MAX_SEGMENTS_PER_TYPE
        ),
        zooms: buildTimelineMinimapSegments(
            zooms,
            duration,
            MAX_SEGMENTS_PER_TYPE
        ),
        subtitles: buildTimelineMinimapSegments(
            subtitles,
            duration,
            MAX_SEGMENTS_PER_TYPE
        ),
        masks: buildTimelineMinimapSegments(
            masks,
            duration,
            MAX_SEGMENTS_PER_TYPE
        ),
        audio: buildTimelineMinimapSegments(
            audioClips,
            duration,
            MAX_SEGMENTS_PER_TYPE
        ),
        overlays: buildTimelineMinimapSegments(
            overlays,
            duration,
            MAX_SEGMENTS_PER_TYPE
        ),
    }), [
        audioClips,
        clips,
        duration,
        masks,
        overlays,
        subtitles,
        zooms,
    ])

    const barRef = useRef(null)
    const dragRef = useRef(null)
    const controlsId = `flowtake-timeline-scroll-${useId().replaceAll(":", "")}`
    const [isDragging, setIsDragging] = useState(false)
    const [containerGeometry, setContainerGeometry] = useState({
        clientWidth: 0,
        scrollWidth: 0,
        scrollLeft: 0,
    })

    useEffect(() => {
        const element = containerRef?.current
        if (!element) return undefined

        let animationFrame = null
        const hadId = Boolean(element.id)
        if (!hadId) element.id = controlsId

        const syncGeometry = () => {
            animationFrame = null
            const next = {
                clientWidth: element.clientWidth,
                scrollWidth: element.scrollWidth,
                scrollLeft: element.scrollLeft,
            }
            setContainerGeometry(previous => (
                previous.clientWidth === next.clientWidth
                && previous.scrollWidth === next.scrollWidth
                && previous.scrollLeft === next.scrollLeft
                    ? previous
                    : next
            ))
        }
        const scheduleGeometrySync = () => {
            if (animationFrame !== null) return
            animationFrame = requestAnimationFrame(syncGeometry)
        }

        const resizeObserver = typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(scheduleGeometrySync)

        element.addEventListener("scroll", scheduleGeometrySync, { passive: true })
        resizeObserver?.observe(element)
        if (!resizeObserver)
            window.addEventListener("resize", scheduleGeometrySync)
        scheduleGeometrySync()

        return () => {
            element.removeEventListener("scroll", scheduleGeometrySync)
            resizeObserver?.disconnect()
            if (!resizeObserver)
                window.removeEventListener("resize", scheduleGeometrySync)
            if (animationFrame !== null)
                cancelAnimationFrame(animationFrame)
            if (!hadId && element.id === controlsId)
                element.removeAttribute("id")
        }
    }, [containerRef, controlsId, duration, pxPerMs])

    const geometry = getTimelineMinimapGeometry({
        duration,
        pxPerMs,
        ...containerGeometry,
    })

    const scrollTo = useCallback(nextScrollLeft => {
        const element = containerRef?.current
        if (!element) return
        element.scrollLeft = Math.max(
            0,
            Math.min(nextScrollLeft, element.scrollWidth - element.clientWidth)
        )
    }, [containerRef])

    const scrollFromPointer = useCallback((event, options = {}) => {
        const element = containerRef?.current
        const bar = barRef.current
        if (!element || !bar) return

        const rect = bar.getBoundingClientRect()
        scrollTo(getMinimapScrollLeftFromPointer({
            clientX: event.clientX,
            barLeft: rect.left,
            barWidth: rect.width,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            ...options,
        }))
    }, [containerRef, scrollTo])

    const handleClick = useCallback(event => {
        if (!duration || event.button !== 0) return
        if (event.target.closest("[data-minimap-viewport]")) return
        scrollFromPointer(event, { centerViewport: true })
    }, [duration, scrollFromPointer])

    const finishDrag = useCallback(event => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return

        dragRef.current = null
        setIsDragging(false)
        if (event.currentTarget.hasPointerCapture?.(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId)
    }, [])

    const handleViewportPointerDown = useCallback(event => {
        if (event.button !== 0 || geometry.maxScrollLeft === 0) return

        event.preventDefault()
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        dragRef.current = {
            pointerId: event.pointerId,
            grabOffsetPx: Math.max(0, Math.min(event.clientX - rect.left, rect.width)),
        }
        setIsDragging(true)
        event.currentTarget.focus()
        event.currentTarget.setPointerCapture(event.pointerId)
    }, [geometry.maxScrollLeft])

    const handleViewportPointerMove = useCallback(event => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return

        event.preventDefault()
        scrollFromPointer(event, { grabOffsetPx: drag.grabOffsetPx })
    }, [scrollFromPointer])

    const handleViewportKeyDown = useCallback(event => {
        const element = containerRef?.current
        if (!element) return

        const nextScrollLeft = getMinimapScrollLeftFromKeyboard({
            key: event.key,
            shiftKey: event.shiftKey,
            scrollLeft: element.scrollLeft,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
        })
        if (nextScrollLeft === null) return

        event.preventDefault()
        scrollTo(nextScrollLeft)
    }, [containerRef, scrollTo])

    if (!duration) return null

    const renderSegments = (segments, colorClass) =>
        segments.map((segment, index) => {
            const left = segment.leftRatio * 100
            const width = Math.min(
                Math.max(segment.widthRatio * 100, 0.3),
                100 - left
            )
            return (
                <div
                    key={`${index}-${segment.leftRatio}-${segment.widthRatio}`}
                    className={`absolute h-full rounded-[1px] ${colorClass}`}
                    style={{
                        left: `${left}%`,
                        width: `${width}%`,
                    }}
                />
            )
        })

    const vpLeft = geometry.viewportLeftRatio * 100
    const vpWidth = geometry.viewportWidthRatio * 100
    const viewportRange = formatMinimapViewportRange(geometry)

    return (
        <div ref={barRef}
            className="h-4 shrink-0 relative cursor-pointer bg-base-300/80 border-y border-base-content/10"
            aria-label="Timeline overview"
            onClick={handleClick}>
            {/* Entity bars */}
            <div className="absolute inset-0 flex flex-col pointer-events-none" aria-hidden="true">
                <div className="flex-1 relative">
                    {renderSegments(entitySegments.clips, TRACK_COLORS.clips)}
                </div>
                <div className="flex-1 relative">
                    {renderSegments(entitySegments.zooms, TRACK_COLORS.zooms)}
                </div>
                <div className="flex-1 relative">
                    {renderSegments(entitySegments.subtitles, TRACK_COLORS.subtitles)}
                    {renderSegments(entitySegments.masks, TRACK_COLORS.masks)}
                    {renderSegments(entitySegments.audio, TRACK_COLORS.audio)}
                    {renderSegments(entitySegments.overlays, TRACK_COLORS.overlays)}
                </div>
            </div>

            {/* Viewport indicator */}
            <div
                data-minimap-viewport
                role="scrollbar"
                aria-label="Visible timeline range"
                aria-controls={containerRef?.current?.id || controlsId}
                aria-orientation="horizontal"
                aria-valuemin={0}
                aria-valuemax={Math.round(geometry.maxStartMs)}
                aria-valuenow={Math.round(geometry.startMs)}
                aria-valuetext={viewportRange}
                aria-disabled={geometry.maxScrollLeft === 0}
                tabIndex={0}
                title="Drag to scroll the timeline. Use arrow, Page Up, Page Down, Home, or End keys."
                className={`absolute top-0 bottom-0 border border-primary/40 bg-primary/10 rounded-sm z-10
                    outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset
                    hover:bg-primary/15 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                style={{
                    left: `${vpLeft}%`,
                    width: `${vpWidth}%`,
                    touchAction: "none",
                }}
                onClick={event => event.stopPropagation()}
                onKeyDown={handleViewportKeyDown}
                onPointerDown={handleViewportPointerDown}
                onPointerMove={handleViewportPointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onLostPointerCapture={finishDrag}
            />
        </div>
    )
}

Minimap.propTypes = {
    containerRef: PropTypes.shape({ current: PropTypes.any })
}
