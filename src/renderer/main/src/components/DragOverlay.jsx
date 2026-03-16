import { useEffect, useState } from "react"
import { subscribe, isDragActive, getDragItem, getDragPos } from "../dragState"

/**
 * Floating ghost element that follows the cursor during asset drag.
 * Rendered at the app root level so it's always on top.
 */
export default function DragOverlay() {
    const [, setTick] = useState(0)

    useEffect(() => subscribe(() => setTick(t => t + 1)), [])

    if (!isDragActive()) return null

    const pos = getDragPos()
    const { data } = getDragItem()
    if (!pos || !data) return null

    const label = data.name || data.type || "Asset"

    return (
        <div
            className="fixed z-[9999] pointer-events-none"
            style={{ left: pos.x + 12, top: pos.y - 16 }}
        >
            <div className="bg-base-100 border border-base-content/20 shadow-xl rounded-lg px-3 py-1.5 flex items-center gap-2 opacity-90">
                <span className="text-xs font-medium truncate max-w-32">{label}</span>
            </div>
        </div>
    )
}
