import PropTypes from "prop-types"

export default function Label({ isMinimized = false, line1, line2, badge }) {
    if (isMinimized) return null
    return (
        <div className="pointer-events-none flex min-w-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden px-1.5">
            <div className="flex min-w-0 max-w-full items-center gap-1 text-[11px] font-semibold leading-tight drop-shadow-sm">
                <div className="min-w-0 truncate">{line1}</div>
                {badge && <div className="shrink-0 text-[9px] font-normal opacity-65">{badge}</div>}
            </div>
            <div className="min-w-0 max-w-full truncate text-[9px] leading-tight opacity-70 drop-shadow-sm">
                {line2}
            </div>
        </div>
    )
}

Label.propTypes = {
    line1: PropTypes.node,
    line2: PropTypes.node,
    badge: PropTypes.node,
    isMinimized: PropTypes.bool
}
