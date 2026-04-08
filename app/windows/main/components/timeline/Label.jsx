import PropTypes from "prop-types"

export default function Label({ isMinimized = false, line1, line2, badge }) {
    return (<>
        <div className={`${isMinimized ? "hidden" : "hidden @min-[1.5rem]:flex"} px-3 text-sm text-nowrap text-start font-semibold items-center drop-shadow-sm`}>
            {line1}
            {badge && <span className="ml-auto text-[10px] font-normal opacity-60 pl-2">{badge}</span>}
        </div>
        <div className={`${isMinimized ? "hidden" : "hidden @min-[1.5rem]:flex"} px-3 text-xs text-nowrap text-start items-center gap-2 opacity-80 drop-shadow-sm`}>
            {line2}
        </div>
    </>)
}

Label.propTypes = {
    line1: PropTypes.node,
    line2: PropTypes.node,
    badge: PropTypes.node,
    isMinimized: PropTypes.bool
}