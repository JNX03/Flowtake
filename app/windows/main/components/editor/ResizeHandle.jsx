import PropTypes from "prop-types"

export default function ResizeHandle({
    orientation,
    onResizeStart,
    onNudge,
    onReset,
    label,
    value,
    min,
    max,
    hidden = false
}) {
    if (hidden) return null

    const isVertical = orientation === "vertical"
    const handleKeyDown = event => {
        const negativeKey = isVertical ? "ArrowLeft" : "ArrowUp"
        const positiveKey = isVertical ? "ArrowRight" : "ArrowDown"
        if (event.key !== negativeKey && event.key !== positiveKey) return

        event.preventDefault()
        onNudge(event.key === negativeKey ? -12 : 12)
    }

    return (
        <button
            type="button"
            role="separator"
            aria-label={label}
            aria-orientation={orientation}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={Math.round(value)}
            className={isVertical
                ? "flowtake-resize-handle flowtake-resize-handle--vertical"
                : "flowtake-resize-handle flowtake-resize-handle--horizontal"}
            onPointerDown={onResizeStart}
            onKeyDown={handleKeyDown}
            onDoubleClick={onReset}
        >
            <span aria-hidden="true" />
        </button>
    )
}

ResizeHandle.propTypes = {
    orientation: PropTypes.oneOf(["horizontal", "vertical"]).isRequired,
    onResizeStart: PropTypes.func.isRequired,
    onNudge: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired,
    label: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired,
    min: PropTypes.number.isRequired,
    max: PropTypes.number.isRequired,
    hidden: PropTypes.bool
}
