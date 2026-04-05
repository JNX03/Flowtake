import PropTypes from "prop-types"

export default function Label({ isMinimized = false, line1, line2 }) {
    return (<>
        <div className={`${isMinimized ? "hidden" : "hidden @min-[2rem]:flex"} px-4 text-sm text-nowrap text-start font-semibold items-center drop-shadow-xs`}>
            {line1}
        </div>
        <div className={`${isMinimized ? "hidden" : "hidden @min-[2rem]:flex"} px-4 text-xs text-nowrap text-start items-center gap-2 opacity-80 drop-shadow-xs`}>
            {line2}
        </div>
    </>)
}

Label.propTypes = {
    line1: PropTypes.node,
    line2: PropTypes.node,
    isMinimized: PropTypes.bool
}