import { WindowIcon } from "@heroicons/react/24/outline"
import PropTypes from 'prop-types'

export default function WindowOutline({ dimensions, name, onClick }) {
    // Coordinates are in logical pixels (DPI-unaware, matching FFmpeg and overlay window)
    const left = dimensions.x
    const top = dimensions.y
    const width = dimensions.width
    const height = dimensions.height

    return <>
        {width > 0 && height > 0 && (<div
            className="absolute border-4 border-transparent hover:border-primary hover:bg-primary/10 transition-colors rounded-md cursor-pointer flex flex-col justify-center items-center group"
            style={{
                left, top, width, height,
                backgroundColor: 'rgba(128,128,128,0.01)'
            }}
            onClick={onClick} >
            {name && <div className="absolute top-2 left-2 px-2 py-1 bg-base-300/80 rounded text-xs text-base-content opacity-0 group-hover:opacity-100 transition-opacity max-w-[250px] truncate">
                {name}
            </div>}
            <button className="btn btn-primary opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" >
                <WindowIcon className="size-6 scale-x-[-1]" />
                Record window
            </button>
        </div>)}
    </>
}

WindowOutline.propTypes = {
    dimensions: PropTypes.shape({
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired,
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired
    }).isRequired,
    name: PropTypes.string,
    onClick: PropTypes.func.isRequired
}
