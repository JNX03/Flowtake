import { useRef } from 'react'
import PropTypes from 'prop-types'

export default function WindowOutline({ activeWindow }) {
    const dpr = window.devicePixelRatio || 1
    const hasPrevious = useRef(false)
    const lastPos = useRef({ left: 0, top: 0, width: 0, height: 0 })

    if (activeWindow) {
        lastPos.current = {
            left: activeWindow.x / dpr,
            top: activeWindow.y / dpr,
            width: activeWindow.width / dpr,
            height: activeWindow.height / dpr,
        }
    }

    const { left, top, width, height } = lastPos.current
    const visible = !!activeWindow

    // First appearance: fade in only (no position slide from 0,0)
    // Subsequent switches: animate position + size + opacity
    const transition = !hasPrevious.current
        ? 'opacity 150ms ease-out'
        : 'left 200ms ease-out, top 200ms ease-out, width 200ms ease-out, height 200ms ease-out, opacity 150ms ease-out'

    if (visible && !hasPrevious.current) {
        hasPrevious.current = true
    }

    return (
        <div
            className="absolute border-4 border-primary bg-primary/10 rounded-md pointer-events-none flex justify-center items-center"
            style={{ left, top, width, height, opacity: visible ? 1 : 0, transition }}
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
}
