import PropTypes from "prop-types"

export default function Label({ isMinimized = false, line1, line2, badge }) {
    if (isMinimized) return null
    return (
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 overflow-hidden pointer-events-none px-2">
            <div className="flex items-center gap-1 text-sm font-semibold drop-shadow-sm bg-base-100/40 backdrop-blur-[2px] rounded-sm px-1 py-0.5 self-start max-w-full min-w-0">
                <div className="truncate min-w-0">{line1}</div>
                {badge && <div className="shrink-0 text-[10px] font-normal opacity-60 pl-1">{badge}</div>}
            </div>
            <div className="text-xs opacity-80 drop-shadow-sm self-start max-w-full min-w-0 truncate">
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
