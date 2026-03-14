import { WindowIcon } from "@heroicons/react/24/outline"
import PropTypes from 'prop-types'
import { useMemo } from "react"

export default function WindowOutline({ dimensions, onClick, label }) {
    const left = useMemo(() => dimensions.x / window.devicePixelRatio, [dimensions])
    const top = useMemo(() => dimensions.y / window.devicePixelRatio, [dimensions])
    const width = useMemo(() => dimensions.width / window.devicePixelRatio, [dimensions])
    const height = useMemo(() => dimensions.height / window.devicePixelRatio, [dimensions])

    return <>
        {left !== null && top !== null && width !== null && height !== null && (<div
            className="absolute border-transparent bg-transparent border-4 hover:border-primary hover:bg-primary/10 transition-colors rounded-md cursor-pointer flex flex-col justify-center items-center group z-10"
            style={{ left, top, width, height }} onClick={onClick} >
            {label && <div className="absolute -top-6 left-0 bg-base-300/80 text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-48 pointer-events-none">
                {label}
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
    onClick: PropTypes.func.isRequired,
    label: PropTypes.string
}
