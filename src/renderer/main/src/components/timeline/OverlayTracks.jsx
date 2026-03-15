import { useCallback, useMemo, useState } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { OVERLAY_TRACKS, pxToMs } from "../../../../src/helpers"
import {
    addOverlay,
    selectAllOverlays,
    selectOverlayTracks,
} from "../../../../src/redux/overlaySlice"
import {
    selectIsMaskingModeEnabled,
    selectPxPerMs
} from "../../../../src/redux/timelineSlice"
import { selectDuration } from "../../../../src/redux/editorSlice"
import OverlayItem from "./OverlayItem"
import Row from "./Row"

export default function OverlayTracks() {

    const dispatch = useDispatch()

    const tracks = useSelector(selectOverlayTracks)
    const allOverlays = useSelector(selectAllOverlays)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)
    const duration = useSelector(selectDuration)
    const pxPerMs = useSelector(selectPxPerMs)
    const [dragOverTrack, setDragOverTrack] = useState(null)

    const overlaysByTrack = useMemo(() => {
        const map = {}
        tracks.forEach(t => { map[t.id] = [] })
        allOverlays.forEach(o => {
            if (map[o.trackIndex] !== undefined) map[o.trackIndex].push(o)
        })
        return map
    }, [tracks, allOverlays])

    const handleDoubleClick = useCallback((time, trackId) => {
        const start = Math.max(time - 2000, 0)
        const end = Math.min(time + 2000, duration)
        dispatch(addOverlay({
            id: `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            start,
            end,
            trackIndex: trackId,
            overlayType: "text",
            text: "Text",
            fontSize: 32,
            fontWeight: 600,
            color: "#ffffff",
            position: { x: 0.5, y: 0.5 },
            opacity: 1,
        }))
    }, [dispatch, duration])

    const handleDrop = useCallback((e, trackId) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOverTrack(null)
        try {
            const data = JSON.parse(e.dataTransfer.getData("application/json"))
            const rect = e.currentTarget.getBoundingClientRect()
            const offsetX = e.clientX - rect.left
            const time = pxToMs(offsetX, pxPerMs)
            const start = Math.max(0, time)
            const end = Math.min(time + 4000, duration)
            const base = {
                id: `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                start, end, trackIndex: trackId, opacity: 1, position: { x: 0.5, y: 0.5 },
            }

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
        } catch { /* ignore */ }
    }, [dispatch, duration, pxPerMs])

    const handleDragOver = useCallback((e, trackId) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
        setDragOverTrack(trackId)
    }, [])

    const handleDragLeave = useCallback(() => setDragOverTrack(null), [])

    if (tracks.length === 0) return null

    return tracks.map(track => (
        <div key={`overlay-track-${track.id}`}
            onDrop={e => handleDrop(e, track.id)}
            onDragOver={e => handleDragOver(e, track.id)}
            onDragLeave={handleDragLeave}
            className={`relative transition-colors ${dragOverTrack === track.id ? "bg-accent/10 ring-1 ring-accent/30 ring-inset rounded" : ""}`}
        >
            <Row
                name={OVERLAY_TRACKS}
                className="h-12"
                animIds={(overlaysByTrack[track.id] || []).map(o => o.id)}
                action={OverlayItem}
                onDoubleClick={time => handleDoubleClick(time, track.id)}
                isMinimized={isMinimized}
            />
            {(overlaysByTrack[track.id] || []).length === 0 && !isMinimized && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] opacity-20">Double-click to add text, or drag from Assets</span>
                </div>
            )}
        </div>
    ))
}
