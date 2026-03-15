import PropTypes from "prop-types"
import { useCallback, useState } from "react"

export default function DropZoneIndicator({ onDrop, acceptTypes = [], className = "", children }) {

    const [isDragOver, setIsDragOver] = useState(false)

    const handleDragOver = useCallback(e => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
        setIsDragOver(true)
    }, [])

    const handleDragLeave = useCallback(e => {
        if (e.currentTarget.contains(e.relatedTarget)) return
        setIsDragOver(false)
    }, [])

    const handleDrop = useCallback(e => {
        e.preventDefault()
        setIsDragOver(false)
        try {
            const data = JSON.parse(e.dataTransfer.getData("application/json"))
            if (acceptTypes.length === 0 || acceptTypes.includes(data.type) || acceptTypes.includes(data.category)) {
                onDrop?.(data, e)
            }
        } catch { /* ignore invalid drops */ }
    }, [onDrop, acceptTypes])

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`${className} relative transition-all ${isDragOver ? "drop-zone-active" : ""}`}
        >
            {children}
            {isDragOver && (
                <div className="absolute inset-0 border-2 border-dashed border-info/60 bg-info/5 rounded-lg
                    flex items-center justify-center pointer-events-none z-30">
                    <span className="text-xs font-medium text-info/80">Drop here</span>
                </div>
            )}
        </div>
    )
}

DropZoneIndicator.propTypes = {
    onDrop: PropTypes.func,
    acceptTypes: PropTypes.arrayOf(PropTypes.string),
    className: PropTypes.string,
    children: PropTypes.node,
}
