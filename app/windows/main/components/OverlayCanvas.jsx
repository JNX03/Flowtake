import {
    ArrowPathIcon
} from "@heroicons/react/16/solid"
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
import { subscribe, isDragActive } from "../dragState"
import { OVERLAY_TRACKS } from "@shared/helpers"
import {
    addOverlay,
    addOverlayTrack,
    selectAllOverlays,
    selectOverlayTracks,
    selectNextOverlayTrackId,
    updateOverlay
} from "@shared/redux/overlaySlice"
import { selectDuration } from "@shared/redux/editorSlice"
import {
    selectSelectedIds,
    selectTime,
    setSelectedIds,
    setSelectedRow,
    setOpenSection
} from "@shared/redux/timelineSlice"

function lerpKeyframes(overlay, time) {
    const kf = overlay.keyframes
    if (!kf || kf.length === 0) return overlay
    const relTime = time - overlay.start
    if (kf.length === 1) return { ...overlay, ...kf[0] }
    // Find bracketing keyframes
    let before = kf[0], after = kf[kf.length - 1]
    for (let i = 0; i < kf.length; i++) {
        if (kf[i].time <= relTime) before = kf[i]
        if (kf[i].time >= relTime) { after = kf[i]; break }
    }
    if (before === after || before.time === after.time) return { ...overlay, ...before }
    const t = (relTime - before.time) / (after.time - before.time)
    const lerp = (a, b) => a != null && b != null ? a + (b - a) * t : (b ?? a)
    return {
        ...overlay,
        position: {
            x: lerp(before.position?.x ?? overlay.position?.x, after.position?.x ?? overlay.position?.x),
            y: lerp(before.position?.y ?? overlay.position?.y, after.position?.y ?? overlay.position?.y),
        },
        rotation: lerp(before.rotation ?? overlay.rotation ?? 0, after.rotation ?? overlay.rotation ?? 0),
        scale: lerp(before.scale ?? overlay.scale ?? 1, after.scale ?? overlay.scale ?? 1),
        opacity: lerp(before.opacity ?? overlay.opacity ?? 1, after.opacity ?? overlay.opacity ?? 1),
    }
}

export default function OverlayCanvas({ canvasRect }) {

    const dispatch = useDispatch()
    const allOverlays = useSelector(selectAllOverlays)
    const overlayTracks = useSelector(selectOverlayTracks)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)
    const selectedIds = useSelector(selectSelectedIds)

    const [isDragOver, setIsDragOver] = useState(false)
    const nextTrackId = useSelector(selectNextOverlayTrackId)

    // Filter overlays visible at current time
    const visibleOverlays = useMemo(() =>
        allOverlays.filter(o => time >= o.start && time <= o.end).map(o => lerpKeyframes(o, time)),
        [allOverlays, time]
    )

    const selectOverlay = useCallback((id, e) => {
        e.stopPropagation()
        dispatch(setSelectedIds([id]))
        dispatch(setSelectedRow(OVERLAY_TRACKS))
        dispatch(setOpenSection(OVERLAY_TRACKS))
    }, [dispatch])

    const deselectAll = useCallback(() => {
        dispatch(setSelectedIds([]))
    }, [dispatch])

    // Show drag-over highlight when pointer drag hovers over preview
    useEffect(() => subscribe(() => setIsDragOver(isDragActive())), [])

    // Listen for custom drop events from pointer-based drag system
    useEffect(() => {
        const handleDrop = (e) => {
            const { data, target, clientX, clientY } = e.detail
            if (!data || !target) return
            // Only handle drops on the "preview" or "overlay-canvas" zone
            if (target.zone !== "preview" && target.zone !== "overlay-canvas") return

            // Skip audio - doesn't go on preview
            if (data.type === "audio" || data.category === "audio") return

            // Calculate normalized position from drop point
            const rect = target.rect
            const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
            const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))

            // Find an available track or auto-create one
            let trackId
            if (overlayTracks.length > 0) {
                // Find a track that doesn't have an overlap at this time range
                const start = Math.max(0, time - 500)
                const end = Math.min(start + 4000, duration)
                const available = overlayTracks.find(track => {
                    const trackOverlays = allOverlays.filter(o => o.trackIndex === track.id)
                    return !trackOverlays.some(o => o.start < end && o.end > start)
                })
                trackId = available ? available.id : null
                if (trackId === null) {
                    // All tracks overlap — create a new one
                    dispatch(addOverlayTrack())
                    trackId = nextTrackId
                }
            } else {
                dispatch(addOverlayTrack())
                trackId = nextTrackId
            }

            const uid = `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            const start = Math.max(0, time - 500)
            const end = Math.min(start + 4000, duration)
            const base = {
                id: uid, start, end, trackIndex: trackId,
                opacity: 1, position: { x, y }, rotation: 0, scale: 1,
            }

            setTimeout(() => {
                if (data.type === "text") {
                    dispatch(addOverlay({ ...base, overlayType: "text", text: data.config?.text || "Text",
                        fontSize: data.config?.fontSize || 32, fontWeight: data.config?.fontWeight || 600,
                        color: data.config?.color || "#ffffff" }))
                } else if (data.type === "shape") {
                    dispatch(addOverlay({ ...base, overlayType: "shape", shapeType: data.config?.shapeType || "rect",
                        fill: data.config?.fill || "#6C5CE7", stroke: data.config?.stroke || "none",
                        strokeWidth: data.config?.strokeWidth || 0, width: data.config?.width || 200,
                        height: data.config?.height || 100, borderRadius: data.config?.borderRadius || 0,
                        radius: data.config?.radius || 0 }))
                } else if (data.type === "image" || data.type === "video") {
                    dispatch(addOverlay({ ...base, overlayType: "image", name: data.name || "Image",
                        src: data.src || null, width: 320, height: 240 }))
                }

                // Auto-select the new overlay
                setTimeout(() => {
                    dispatch(setSelectedIds([uid]))
                    dispatch(setSelectedRow(OVERLAY_TRACKS))
                    dispatch(setOpenSection(OVERLAY_TRACKS))
                }, 10)
            }, overlayTracks.length === 0 ? 10 : 0)
        }
        window.addEventListener("flowtake-drop", handleDrop)
        return () => window.removeEventListener("flowtake-drop", handleDrop)
    }, [dispatch, duration, time, overlayTracks, allOverlays, nextTrackId])

    // Use canvas rect if available, otherwise cover full parent for drop target
    const hasRect = canvasRect && canvasRect.width > 0
    const style = hasRect
        ? { left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height }
        : { inset: 0 }

    return (
        <div
            className="absolute"
            data-drop-zone="overlay-canvas"
            style={style}
            onClick={deselectAll}
        >
            {/* Drop indicator */}
            {isDragOver && (
                <div className="absolute inset-0 z-30 border-2 border-dashed border-info/60 bg-info/10 rounded-md flex items-center justify-center pointer-events-none">
                    <span className="text-sm font-medium text-info bg-base-300/80 px-3 py-1.5 rounded-lg">
                        Drop to add overlay here
                    </span>
                </div>
            )}

            {/* Render each visible overlay */}
            {hasRect && visibleOverlays.map(overlay => (
                <OverlayElement
                    key={overlay.id}
                    overlay={overlay}
                    containerWidth={canvasRect.width}
                    containerHeight={canvasRect.height}
                    isSelected={selectedIds.includes(overlay.id)}
                    onSelect={e => selectOverlay(overlay.id, e)}
                    dispatch={dispatch}
                />
            ))}
        </div>
    )
}

function OverlayElement({ overlay, containerWidth, containerHeight, isSelected, onSelect, dispatch }) {

    const elRef = useRef(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [isRotating, setIsRotating] = useState(false)
    const dragStart = useRef(null)

    const pos = overlay.position || { x: 0.5, y: 0.5 }
    const rotation = overlay.rotation || 0
    const scale = overlay.scale || 1
    const opacity = overlay.opacity ?? 1

    // Get overlay visual dimensions
    const getSize = () => {
        if (overlay.overlayType === "text") {
            const fs = (overlay.fontSize || 32) * scale
            const charWidth = fs * 0.6
            const lines = (overlay.text || "Text").split("\n")
            const maxLen = Math.max(...lines.map(l => l.length))
            return { w: Math.max(charWidth * maxLen, 40), h: fs * lines.length * 1.3 }
        }
        if (overlay.overlayType === "shape") {
            if (overlay.shapeType === "circle") {
                const d = (overlay.radius || 60) * 2 * scale
                return { w: d, h: d }
            }
            return { w: (overlay.width || 200) * scale, h: (overlay.height || 100) * scale }
        }
        if (overlay.overlayType === "image") {
            return { w: (overlay.width || 320) * scale, h: (overlay.height || 240) * scale }
        }
        return { w: 100, h: 50 }
    }

    const size = getSize()
    // Scale element sizes relative to canvas (assume renderer is ~1280 wide)
    const canvasScale = containerWidth / 1280
    const w = size.w * canvasScale
    const h = size.h * canvasScale
    const cx = pos.x * containerWidth
    const cy = pos.y * containerHeight

    // Move via drag
    const handleMoveStart = useCallback(e => {
        e.stopPropagation()
        onSelect(e)
        setIsDragging(true)
        dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }

        const onMove = ev => {
            if (!dragStart.current) return
            const dx = (ev.clientX - dragStart.current.mx) / containerWidth
            const dy = (ev.clientY - dragStart.current.my) / containerHeight
            const nx = Math.max(0, Math.min(1, dragStart.current.px + dx))
            const ny = Math.max(0, Math.min(1, dragStart.current.py + dy))
            dispatch(updateOverlay({ id: overlay.id, changes: { position: { x: nx, y: ny } } }))
        }
        const onUp = () => {
            setIsDragging(false)
            dragStart.current = null
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onUp)
        }
        window.addEventListener("mousemove", onMove)
        window.addEventListener("mouseup", onUp)
    }, [dispatch, overlay.id, pos, containerWidth, containerHeight, onSelect])

    // Resize via corner drag
    const handleResizeStart = useCallback((e, corner) => {
        e.stopPropagation()
        e.preventDefault()
        setIsResizing(true)
        const startScale = overlay.scale || 1
        const startX = e.clientX
        const startY = e.clientY

        const onMove = ev => {
            const dx = ev.clientX - startX
            const dy = ev.clientY - startY
            const dist = Math.sqrt(dx * dx + dy * dy) * (dx + dy > 0 ? 1 : -1)
            const newScale = Math.max(0.1, Math.min(5, startScale + dist / 200))
            dispatch(updateOverlay({ id: overlay.id, changes: { scale: Math.round(newScale * 100) / 100 } }))
        }
        const onUp = () => {
            setIsResizing(false)
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onUp)
        }
        window.addEventListener("mousemove", onMove)
        window.addEventListener("mouseup", onUp)
    }, [dispatch, overlay.id, overlay.scale])

    // Rotate via handle drag
    const handleRotateStart = useCallback(e => {
        e.stopPropagation()
        e.preventDefault()
        setIsRotating(true)
        const elRect = elRef.current?.getBoundingClientRect()
        if (!elRect) return
        const centerX = elRect.left + elRect.width / 2
        const centerY = elRect.top + elRect.height / 2

        const onMove = ev => {
            const angle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX) * (180 / Math.PI) + 90
            const snapped = Math.abs(angle % 45) < 5 ? Math.round(angle / 45) * 45 : Math.round(angle)
            dispatch(updateOverlay({ id: overlay.id, changes: { rotation: snapped } }))
        }
        const onUp = () => {
            setIsRotating(false)
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onUp)
        }
        window.addEventListener("mousemove", onMove)
        window.addEventListener("mouseup", onUp)
    }, [dispatch, overlay.id])

    const renderContent = () => {
        if (overlay.overlayType === "text") {
            return (
                <div style={{
                    fontSize: `${(overlay.fontSize || 32) * canvasScale}px`,
                    fontWeight: overlay.fontWeight || 400,
                    color: overlay.color || "#ffffff",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.3,
                    textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                }} className="select-none pointer-events-none">
                    {overlay.text || "Text"}
                </div>
            )
        }
        if (overlay.overlayType === "shape") {
            const style = {
                width: `${w}px`,
                height: `${h}px`,
                backgroundColor: overlay.fill !== "none" ? overlay.fill : "transparent",
                border: overlay.stroke !== "none" ? `${(overlay.strokeWidth || 2) * canvasScale}px solid ${overlay.stroke}` : "none",
                borderRadius: overlay.shapeType === "circle" ? "50%" : `${(overlay.borderRadius || 0) * canvasScale}px`,
            }
            return <div style={style} className="pointer-events-none" />
        }
        if (overlay.overlayType === "image" && overlay.src) {
            return <img src={overlay.src} draggable={false}
                style={{ width: `${w}px`, height: `${h}px`, objectFit: "contain" }}
                className="pointer-events-none" />
        }
        return <div style={{ width: `${w}px`, height: `${h}px`, background: "rgba(108,92,231,0.3)" }}
            className="pointer-events-none rounded" />
    }

    return (
        <div
            ref={elRef}
            className={`absolute cursor-move ${isDragging ? "z-20" : "z-10"}`}
            style={{
                left: `${cx}px`,
                top: `${cy}px`,
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                opacity,
                pointerEvents: "auto",
            }}
            onMouseDown={handleMoveStart}
        >
            {renderContent()}

            {/* Selection handles */}
            {isSelected && (
                <>
                    {/* Selection border */}
                    <div className="absolute -inset-1 border-2 border-info rounded pointer-events-none" />

                    {/* Corner resize handles */}
                    {[
                        "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
                        "top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
                        "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
                        "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
                    ].map((cls, i) => (
                        <div key={i}
                            className={`absolute ${cls} w-2.5 h-2.5 bg-info border border-white rounded-sm z-30`}
                            onMouseDown={e => handleResizeStart(e, i)}
                        />
                    ))}

                    {/* Rotation handle */}
                    <div
                        className="absolute left-1/2 -translate-x-1/2 -top-7 flex flex-col items-center z-30 cursor-grab active:cursor-grabbing"
                        onMouseDown={handleRotateStart}
                    >
                        <div className="w-5 h-5 bg-info rounded-full flex items-center justify-center shadow-md">
                            <ArrowPathIcon className="size-3 text-white" />
                        </div>
                        <div className="w-px h-2 bg-info" />
                    </div>

                    {/* Info label */}
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] bg-base-300/90 text-info px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
                        {Math.round(rotation)}° · {Math.round(scale * 100)}%
                    </div>
                </>
            )}
        </div>
    )
}
