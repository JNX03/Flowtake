import PropTypes from "prop-types"
import { useCallback, useRef } from "react"

export default function AssetItem({ asset, icon, onDragStart }) {

    const itemRef = useRef(null)

    const handleDragStart = useCallback(e => {
        e.dataTransfer.setData("application/json", JSON.stringify(asset))
        e.dataTransfer.effectAllowed = "copy"
        itemRef.current?.classList.add("opacity-50")
        onDragStart?.(asset)
    }, [asset, onDragStart])

    const handleDragEnd = useCallback(() => {
        itemRef.current?.classList.remove("opacity-50")
    }, [])

    return (
        <div
            ref={itemRef}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing
                hover:bg-base-content/10 transition-colors group select-none"
            title={asset.name}
        >
            <div className="w-8 h-8 rounded-md bg-base-content/10 flex items-center justify-center shrink-0
                group-hover:bg-base-content/20 transition-colors">
                {icon}
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium truncate">{asset.name}</span>
                {asset.duration && (
                    <span className="text-[10px] opacity-50">{formatDuration(asset.duration)}</span>
                )}
            </div>
        </div>
    )
}

function formatDuration(ms) {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
}

AssetItem.propTypes = {
    asset: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        type: PropTypes.string.isRequired,
        duration: PropTypes.number,
    }).isRequired,
    icon: PropTypes.node,
    onDragStart: PropTypes.func,
}
