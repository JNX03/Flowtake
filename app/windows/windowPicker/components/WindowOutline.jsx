import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

export default function WindowOutline({ activeWindow, liveOverlay = false }) {
    const dpr = window.devicePixelRatio || 1
    const [hasPrevious, setHasPrevious] = useState(false)
    const [lastPos, setLastPos] = useState({ left: 0, top: 0, width: 0, height: 0 })

    const activePos = useMemo(() => {
        if (!activeWindow) return null
        return {
            left: activeWindow.x / dpr,
            top: activeWindow.y / dpr,
            width: activeWindow.width / dpr,
            height: activeWindow.height / dpr,
        }
    }, [activeWindow, dpr])

    useEffect(() => {
        if (!activePos) return
        setLastPos(activePos)
        setHasPrevious(true)
    }, [activePos])

    const { left, top, width, height } = activePos ?? lastPos
    const visible = !!activeWindow

    // First appearance: fade in only (no position slide from 0,0)
    // Subsequent switches: animate position + size + opacity
    const transition = !hasPrevious
        ? 'opacity 150ms ease-out'
        : 'left 200ms ease-out, top 200ms ease-out, width 200ms ease-out, height 200ms ease-out, opacity 150ms ease-out'

    return (
        <div
            className="absolute border-4 border-primary rounded-md pointer-events-none flex justify-center items-center"
            style={{
                left,
                top,
                width,
                height,
                opacity: visible ? 1 : 0,
                transition,
                background: liveOverlay ? "rgba(108, 92, 231, 0.08)" : undefined,
                boxShadow: liveOverlay ? "0 0 0 9999px rgba(5, 8, 20, 0.34)" : undefined,
            }}
        >
            {activeWindow?.name && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-base-300/90 rounded text-xs text-base-content max-w-[300px] truncate pointer-events-none">
                    {activeWindow.name}
                </div>
            )}
            <div className="btn btn-primary shadow-lg pointer-events-none">
                Record this window
            </div>
        </div>
    )
}

WindowOutline.propTypes = {
    activeWindow: PropTypes.shape({
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired,
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired,
        name: PropTypes.string,
    }),
    liveOverlay: PropTypes.bool,
}
