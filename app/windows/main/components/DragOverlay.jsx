import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { FilmIcon, MusicalNoteIcon } from "@heroicons/react/16/solid"
import { subscribe, isDragActive, getDragItem, getDragPos } from "../dragState"

/**
 * Floating ghost element that follows the cursor during asset drag.
 * Shows a visual preview of the actual shape/image/text being dragged.
 * Rendered via portal to document.body so it's never clipped by overflow-hidden parents.
 */
export default function DragOverlay() {
    const [, setTick] = useState(0)

    useEffect(() => subscribe(() => setTick(t => t + 1)), [])

    if (!isDragActive()) return null

    const pos = getDragPos()
    const { data } = getDragItem()
    if (!pos || !data) return null

    return createPortal(
        <div
            className="fixed z-[9999] pointer-events-none"
            style={{ left: pos.x + 12, top: pos.y - 12 }}
        >
            <div className="opacity-80 drop-shadow-xl">
                <GhostPreview data={data} />
            </div>
        </div>,
        document.body
    )
}

function GhostPreview({ data }) {
    // Text overlay
    if (data.type === "text") {
        return (
            <div className="bg-base-300/80 border border-base-content/20 rounded-lg px-3 py-2 max-w-40">
                <span style={{
                    fontSize: Math.min(data.config?.fontSize || 32, 18),
                    fontWeight: data.config?.fontWeight || 400,
                    color: data.config?.color || "#fff",
                    whiteSpace: "nowrap",
                }} className="truncate block">
                    {data.name || data.config?.text || "Text"}
                </span>
            </div>
        )
    }

    // Shape overlay
    if (data.type === "shape") {
        const config = data.config || {}
        const { shapeType, fill, stroke, strokeWidth = 0, borderRadius = 0, radius } = config
        const style = {
            backgroundColor: fill !== "none" ? fill : "transparent",
            border: stroke !== "none" ? `${strokeWidth || 2}px solid ${stroke}` : "none",
        }
        if (shapeType === "circle") {
            const d = Math.min((radius || 60) * 2, 48)
            return <div style={{ ...style, width: d, height: d, borderRadius: "50%" }} />
        }
        if (shapeType === "arrow") {
            return <div style={{
                ...style, width: 56, height: 24, borderRadius: 4,
                clipPath: "polygon(0 30%, 70% 30%, 70% 0, 100% 50%, 70% 100%, 70% 70%, 0 70%)",
            }} />
        }
        return <div style={{
            ...style,
            width: Math.min(config.width || 80, 80),
            height: Math.min(config.height || 48, 48),
            borderRadius: borderRadius || 0,
        }} />
    }

    // Image
    if (data.type === "image" && data.src) {
        return (
            <div className="w-20 h-14 rounded-lg overflow-hidden bg-base-200 border border-base-content/20">
                <img src={data.src} alt={data.name || "Image"}
                    className="w-full h-full object-cover" draggable={false} />
            </div>
        )
    }

    // Video
    if (data.type === "video") {
        return (
            <div className="w-20 h-14 rounded-lg overflow-hidden bg-base-200 border border-base-content/20 flex items-center justify-center">
                <FilmIcon className="size-6 opacity-40" />
                <span className="text-[9px] opacity-50 absolute bottom-1">{data.name || "Video"}</span>
            </div>
        )
    }

    // Audio
    if (data.type === "audio" || data.category === "audio") {
        return (
            <div className="bg-secondary/20 border border-secondary/40 rounded-lg px-3 py-1.5 flex items-center gap-2">
                <MusicalNoteIcon className="size-4 text-secondary" />
                <span className="text-xs font-medium truncate max-w-24">{data.name || "Audio"}</span>
            </div>
        )
    }

    // Fallback
    return (
        <div className="bg-base-100 border border-base-content/20 shadow-xl rounded-lg px-3 py-1.5">
            <span className="text-xs font-medium truncate max-w-32">{data.name || data.type || "Asset"}</span>
        </div>
    )
}
