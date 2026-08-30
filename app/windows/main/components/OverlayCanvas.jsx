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
import { resolveOverlayAtTime } from "@shared/editor/overlayKeyframes"
import { snapPreviewPosition } from "@shared/editor/previewSnapping"
import { createOverlayLaneItem } from "@shared/editor/timelineLaneInsert"
import {
    clampVideoOverlayEnd,
    getVideoOverlaySourceTime
} from "@shared/editor/videoOverlay"
import {
    getGroup,
    withGroup,
    withPreventUndo
} from "@shared/redux/actionEnhancers"
import { selectAssetById } from "@shared/redux/assetSlice"
import {
    addOverlay,
    addOverlayTrack,
    selectAllOverlays,
    selectOverlayTracks,
    selectNextOverlayTrackId,
    updateOverlay
} from "@shared/redux/overlaySlice"
import {
    selectDuration,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import {
    selectSelectedIds,
    selectTime,
    setSelectedIds,
    setSelectedRow,
    setOpenSection
} from "@shared/redux/timelineSlice"

const colorWithOpacity = (color, opacity) => {
    const normalized = /^#[0-9a-f]{6}$/i.test(color || "") ? color : "#000000"
    const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
        .toString(16)
        .padStart(2, "0")
    return `${normalized}${alpha}`
}

const getOverlayVisualSize = overlay => {
    const scale = overlay.scale || 1
    if (overlay.overlayType === "text") {
        const fontSize = (overlay.fontSize || 32) * scale
        const lines = (overlay.text || "Text").split("\n")
        const longestLine = Math.max(...lines.map(line => line.length))
        const padding = overlay.textBackgroundEnabled
            ? (overlay.textBackgroundPadding ?? 12) * 2 * scale
            : 0
        return {
            w: Math.max(fontSize * 0.6 * longestLine, 40) + padding,
            h: fontSize * lines.length * (overlay.lineHeight || 1.3) + padding,
        }
    }
    if (overlay.overlayType === "shape") {
        if (overlay.shapeType === "circle") {
            const diameter = (overlay.radius || 60) * 2 * scale
            return { w: diameter, h: diameter }
        }
        return {
            w: (overlay.width || 200) * scale,
            h: (overlay.height || 100) * scale,
        }
    }
    if (overlay.overlayType === "image" || overlay.overlayType === "video") {
        return {
            w: (overlay.width || 320) * scale,
            h: (overlay.height || 240) * scale,
        }
    }
    return { w: 100, h: 50 }
}

export default function OverlayCanvas({ canvasRect }) {

    const dispatch = useDispatch()
    const allOverlays = useSelector(selectAllOverlays)
    const overlayTracks = useSelector(selectOverlayTracks)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)
    const isPlaying = useSelector(selectIsPlaying)
    const selectedIds = useSelector(selectSelectedIds)

    const [isDragOver, setIsDragOver] = useState(false)
    const [snapGuides, setSnapGuides] = useState([])
    const nextTrackId = useSelector(selectNextOverlayTrackId)

    // Filter overlays visible at current time
    const visibleOverlays = useMemo(() =>
        allOverlays
            .filter(o => o.visible !== false && time >= o.start && time <= o.end)
            .map(o => resolveOverlayAtTime(o, time)),
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
            const start = Math.max(0, time - 500)
            const sourceDuration = Number.isFinite(Number(data.duration)) && Number(data.duration) > 0
                ? Number(data.duration)
                : null
            const end = data.type === "video"
                ? clampVideoOverlayEnd({ start, projectDuration: duration, sourceDuration })
                : Math.min(start + 4000, duration)

            // Find an available track or auto-create one
            let trackId
            if (overlayTracks.length > 0) {
                // Find a track that doesn't have an overlap at this time range
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
            setTimeout(() => {
                const overlay = createOverlayLaneItem({
                    id: uid,
                    trackId,
                    start,
                    end,
                    asset: {
                        ...data,
                        sourceDuration,
                    },
                    position: { x, y },
                })
                if (!overlay) return
                dispatch(addOverlay({
                    ...overlay,
                    rotation: 0,
                    scale: 1,
                }))

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

            {snapGuides.map((guide, index) => (
                <div
                    key={`${guide.axis}-${guide.value}-${index}`}
                    data-preview-snap-guide={guide.axis}
                    className="absolute z-40 bg-info/80 pointer-events-none shadow-sm"
                    style={guide.axis === "x"
                        ? {
                            left: `${guide.value * 100}%`,
                            top: 0,
                            bottom: 0,
                            width: 1,
                        }
                        : {
                            top: `${guide.value * 100}%`,
                            left: 0,
                            right: 0,
                            height: 1,
                        }}
                />
            ))}

            {/* Render each visible overlay */}
            {hasRect && visibleOverlays.map(overlay => (
                <OverlayElement
                    key={overlay.id}
                    overlay={overlay}
                    containerWidth={canvasRect.width}
                    containerHeight={canvasRect.height}
                    editorTime={time}
                    isPlaying={isPlaying}
                    projectDuration={duration}
                    snapOverlays={visibleOverlays}
                    isSelected={selectedIds.includes(overlay.id)}
                    onSelect={e => selectOverlay(overlay.id, e)}
                    onSnapGuidesChange={setSnapGuides}
                    dispatch={dispatch}
                />
            ))}
        </div>
    )
}

function OverlayElement({
    overlay,
    containerWidth,
    containerHeight,
    editorTime,
    isPlaying,
    projectDuration,
    snapOverlays,
    isSelected,
    onSelect,
    onSnapGuidesChange,
    dispatch
}) {

    const elRef = useRef(null)
    const [isDragging, setIsDragging] = useState(false)
    const [, setIsResizing] = useState(false)
    const [, setIsRotating] = useState(false)
    const [isEditingText, setIsEditingText] = useState(false)
    const [draftText, setDraftText] = useState(overlay.text || "Text")
    const dragStart = useRef(null)
    const textEditorRef = useRef(null)
    const textEditCanceledRef = useRef(false)
    const mediaAsset = useSelector(state =>
        overlay.mediaId ? selectAssetById(state, overlay.mediaId) : null)

    useEffect(() => {
        if (!isEditingText) setDraftText(overlay.text || "Text")
    }, [isEditingText, overlay.text])

    useEffect(() => {
        if (!isEditingText) return
        textEditorRef.current?.focus()
        textEditorRef.current?.select()
    }, [isEditingText])

    const pos = useMemo(
        () => overlay.position || { x: 0.5, y: 0.5 },
        [overlay.position]
    )
    const rotation = overlay.rotation || 0
    const scale = overlay.scale || 1
    const opacity = overlay.opacity ?? 1

    const size = getOverlayVisualSize(overlay)
    // Scale element sizes relative to canvas (assume renderer is ~1280 wide)
    const canvasScale = containerWidth / 1280
    const w = size.w * canvasScale
    const h = size.h * canvasScale
    const cx = pos.x * containerWidth
    const cy = pos.y * containerHeight
    const textStyle = {
        fontFamily: overlay.fontFamily || "Inter, Arial, Helvetica, sans-serif",
        fontSize: `${(overlay.fontSize || 32) * scale * canvasScale}px`,
        fontWeight: overlay.fontWeight || 400,
        fontStyle: overlay.fontStyle || "normal",
        textAlign: overlay.textAlign || "center",
        letterSpacing: `${(overlay.letterSpacing || 0) * scale * canvasScale}px`,
        color: overlay.color || "#ffffff",
        whiteSpace: "pre-wrap",
        lineHeight: overlay.lineHeight || 1.3,
        maxWidth: `${(overlay.textMaxWidth || 800) * scale * canvasScale}px`,
        background: overlay.textBackgroundEnabled
            ? colorWithOpacity(
                overlay.textBackgroundColor || "#000000",
                overlay.textBackgroundOpacity ?? 0.65
            )
            : "transparent",
        padding: overlay.textBackgroundEnabled
            ? `${(overlay.textBackgroundPadding ?? 12) * scale * canvasScale}px`
            : 0,
        borderRadius: overlay.textBackgroundEnabled
            ? `${(overlay.textBackgroundRadius ?? 8) * scale * canvasScale}px`
            : 0,
        textShadow: "0 1px 4px rgba(0,0,0,0.5)",
    }

    // Move via drag
    const handleMoveStart = useCallback(e => {
        e.stopPropagation()
        onSelect(e)
        if (isEditingText || (overlay.overlayType === "text" && e.detail > 1)) return
        setIsDragging(true)
        dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
        const group = getGroup("overlay-move")
        const otherBounds = snapOverlays
            .filter(item => item.id !== overlay.id)
            .map(item => {
                const otherSize = getOverlayVisualSize(item)
                const otherWidth = otherSize.w * canvasScale
                const otherHeight = otherSize.h * canvasScale
                const otherPosition = item.position || { x: 0.5, y: 0.5 }
                const halfWidth = otherWidth / containerWidth / 2
                const halfHeight = otherHeight / containerHeight / 2
                return {
                    id: item.id,
                    left: otherPosition.x - halfWidth,
                    centerX: otherPosition.x,
                    right: otherPosition.x + halfWidth,
                    top: otherPosition.y - halfHeight,
                    centerY: otherPosition.y,
                    bottom: otherPosition.y + halfHeight,
                }
            })

        const onMove = ev => {
            if (!dragStart.current) return
            const dx = (ev.clientX - dragStart.current.mx) / containerWidth
            const dy = (ev.clientY - dragStart.current.my) / containerHeight
            const nx = Math.max(0, Math.min(1, dragStart.current.px + dx))
            const ny = Math.max(0, Math.min(1, dragStart.current.py + dy))
            const snapped = snapPreviewPosition({
                position: { x: nx, y: ny },
                movingSize: { width: w, height: h },
                containerSize: {
                    width: containerWidth,
                    height: containerHeight,
                },
                otherBounds,
            })
            onSnapGuidesChange(snapped.guides)
            dispatch(withGroup(
                updateOverlay({
                    id: overlay.id,
                    changes: { position: snapped.position },
                }),
                group
            ))
        }
        const onUp = () => {
            setIsDragging(false)
            dragStart.current = null
            onSnapGuidesChange([])
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onUp)
        }
        window.addEventListener("mousemove", onMove)
        window.addEventListener("mouseup", onUp)
    }, [
        containerHeight,
        containerWidth,
        canvasScale,
        dispatch,
        h,
        isEditingText,
        onSelect,
        onSnapGuidesChange,
        overlay.id,
        overlay.overlayType,
        pos,
        snapOverlays,
        w,
    ])

    // Resize via corner drag
    const handleResizeStart = useCallback(e => {
        e.stopPropagation()
        e.preventDefault()
        setIsResizing(true)
        const startScale = overlay.scale || 1
        const startX = e.clientX
        const startY = e.clientY
        const group = getGroup("overlay-resize")

        const onMove = ev => {
            const dx = ev.clientX - startX
            const dy = ev.clientY - startY
            const dist = Math.sqrt(dx * dx + dy * dy) * (dx + dy > 0 ? 1 : -1)
            const newScale = Math.max(0.1, Math.min(5, startScale + dist / 200))
            dispatch(withGroup(
                updateOverlay({ id: overlay.id, changes: { scale: Math.round(newScale * 100) / 100 } }),
                group
            ))
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
        const group = getGroup("overlay-rotate")

        const onMove = ev => {
            const angle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX) * (180 / Math.PI) + 90
            const snapped = Math.abs(angle % 45) < 5 ? Math.round(angle / 45) * 45 : Math.round(angle)
            dispatch(withGroup(
                updateOverlay({ id: overlay.id, changes: { rotation: snapped } }),
                group
            ))
        }
        const onUp = () => {
            setIsRotating(false)
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onUp)
        }
        window.addEventListener("mousemove", onMove)
        window.addEventListener("mouseup", onUp)
    }, [dispatch, overlay.id])

    const startTextEdit = useCallback(e => {
        if (overlay.overlayType !== "text" || isPlaying) return
        e.stopPropagation()
        onSelect(e)
        textEditCanceledRef.current = false
        setDraftText(overlay.text || "Text")
        setIsEditingText(true)
    }, [isPlaying, onSelect, overlay.overlayType, overlay.text])

    const commitTextEdit = useCallback(() => {
        if (textEditCanceledRef.current) {
            textEditCanceledRef.current = false
            setIsEditingText(false)
            return
        }
        const nextText = draftText.trim().length > 0 ? draftText : "Text"
        if (nextText !== overlay.text) {
            dispatch(withGroup(
                updateOverlay({ id: overlay.id, changes: { text: nextText } }),
                getGroup("overlay-text-edit")
            ))
        }
        setDraftText(nextText)
        setIsEditingText(false)
    }, [dispatch, draftText, overlay.id, overlay.text])

    const cancelTextEdit = useCallback(() => {
        textEditCanceledRef.current = true
        setDraftText(overlay.text || "Text")
        setIsEditingText(false)
    }, [overlay.text])

    const onTextEditorKeyDown = useCallback(event => {
        event.stopPropagation()
        if (event.key === "Escape") {
            event.preventDefault()
            cancelTextEdit()
        } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            event.currentTarget.blur()
        }
    }, [cancelTextEdit])

    const renderContent = () => {
        if (overlay.overlayType === "text") {
            if (isEditingText) {
                return (
                    <textarea
                        ref={textEditorRef}
                        value={draftText}
                        onChange={event => setDraftText(event.target.value)}
                        onBlur={commitTextEdit}
                        onKeyDown={onTextEditorKeyDown}
                        onMouseDown={event => event.stopPropagation()}
                        onClick={event => event.stopPropagation()}
                        onDoubleClick={event => event.stopPropagation()}
                        aria-label="Edit text overlay"
                        spellCheck
                        style={{
                            ...textStyle,
                            width: `${Math.max(w, 120 * canvasScale)}px`,
                            minHeight: `${Math.max(h, 48 * canvasScale)}px`,
                            boxSizing: "border-box",
                            resize: "none",
                            overflow: "hidden",
                        }}
                        className="block border-0 outline outline-2 outline-info/80"
                    />
                )
            }
            return (
                <div style={textStyle} className="select-none pointer-events-none">
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
        if (overlay.overlayType === "image" && (mediaAsset?.src || overlay.src)) {
            return <img src={mediaAsset?.src || overlay.src} draggable={false}
                style={{ width: `${w}px`, height: `${h}px`, objectFit: "contain" }}
                className="pointer-events-none" />
        }
        if (overlay.overlayType === "video") {
            return <VideoOverlayPreview
                overlay={overlay}
                src={mediaAsset?.src || overlay.src || null}
                editorTime={editorTime}
                isPlaying={isPlaying}
                projectDuration={projectDuration}
                width={w}
                height={h}
                dispatch={dispatch}
            />
        }
        return <div style={{ width: `${w}px`, height: `${h}px`, background: "rgba(108,92,231,0.3)" }}
            className="pointer-events-none rounded" />
    }

    return (
        <div
            ref={elRef}
            className={`absolute ${isDragging ? "z-20" : "z-10"}`}
            style={{
                left: `${cx}px`,
                top: `${cy}px`,
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                opacity,
                mixBlendMode: overlay.blendMode || "normal",
                pointerEvents: "auto",
                cursor: isEditingText ? "text" : "move",
            }}
            onMouseDown={handleMoveStart}
            onDoubleClick={startTextEdit}
            title={overlay.overlayType === "text" ? "Double-click to edit text" : undefined}
        >
            {renderContent()}

            {/* Selection handles */}
            {isSelected && !isEditingText && (
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
                            onMouseDown={handleResizeStart}
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
                        {Math.round(rotation)} deg | {Math.round(scale * 100)}%
                    </div>
                </>
            )}
        </div>
    )
}

function VideoOverlayPreview({
    overlay,
    src,
    editorTime,
    isPlaying,
    projectDuration,
    width,
    height,
    dispatch
}) {
    const videoRef = useRef(null)
    const [hasLoadError, setHasLoadError] = useState(false)
    const sourceTime = getVideoOverlaySourceTime(overlay, editorTime)

    const syncVideo = useCallback((force = false) => {
        const video = videoRef.current
        if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) return

        const maxTime = Number.isFinite(video.duration)
            ? Math.max(0, video.duration - 0.001)
            : sourceTime / 1000
        const targetTime = Math.min(sourceTime / 1000, maxTime)
        const playbackRate = Number(overlay.playbackRate) > 0 ? Number(overlay.playbackRate) : 1
        video.playbackRate = playbackRate

        if (force || !isPlaying || Math.abs(video.currentTime - targetTime) > 0.15) {
            try { video.currentTime = targetTime } catch { /* metadata may still be settling */ }
        }

        if (isPlaying) {
            if (video.paused) video.play().catch(() => {})
        } else if (!video.paused) {
            video.pause()
        }
    }, [isPlaying, overlay.playbackRate, sourceTime])

    useEffect(() => {
        syncVideo()
    }, [syncVideo])

    useEffect(() => {
        setHasLoadError(false)
        const video = videoRef.current
        return () => video?.pause()
    }, [src])

    const onLoadedMetadata = useCallback(() => {
        const video = videoRef.current
        if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return

        const sourceDuration = Math.round(video.duration * 1000)
        const changes = {
            sourceDuration,
            videoWidth: video.videoWidth || null,
            videoHeight: video.videoHeight || null,
            durationEstimated: false,
        }
        if (overlay.durationEstimated) {
            changes.end = clampVideoOverlayEnd({
                start: overlay.start,
                projectDuration,
                sourceDuration,
                sourceStart: overlay.sourceStart,
                playbackRate: overlay.playbackRate,
            })
        }

        const metadataChanged = overlay.sourceDuration !== changes.sourceDuration
            || overlay.videoWidth !== changes.videoWidth
            || overlay.videoHeight !== changes.videoHeight
            || overlay.durationEstimated === true
        if (metadataChanged) {
            dispatch(withPreventUndo(updateOverlay({ id: overlay.id, changes })))
        }
        setHasLoadError(false)
        syncVideo(true)
    }, [dispatch, overlay, projectDuration, syncVideo])

    if (!src || hasLoadError) {
        return (
            <div
                style={{ width: `${width}px`, height: `${height}px` }}
                className="pointer-events-none rounded bg-base-300/80 border border-warning/30 flex items-center justify-center px-3 text-center text-[10px] text-warning"
            >
                {hasLoadError ? "Video could not be loaded" : "Video media is unavailable"}
            </div>
        )
    }

    return (
        <video
            ref={videoRef}
            src={src}
            muted
            playsInline
            preload="auto"
            draggable={false}
            onLoadedMetadata={onLoadedMetadata}
            onError={() => setHasLoadError(true)}
            aria-label={overlay.name || "Video overlay"}
            style={{ width: `${width}px`, height: `${height}px`, objectFit: "contain" }}
            className="pointer-events-none bg-black/20"
        />
    )
}
