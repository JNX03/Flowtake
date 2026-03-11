import { WindowIcon } from "@heroicons/react/24/outline"
import PropTypes from 'prop-types'
import { useMemo } from "react"

export default function WindowOutline({ dimensions, onClick }) {
    const left = useMemo(() => dimensions.x / window.devicePixelRatio, [dimensions])
    const top = useMemo(() => dimensions.y / window.devicePixelRatio, [dimensions])
    const width = useMemo(() => dimensions.width / window.devicePixelRatio, [dimensions])
    const height = useMemo(() => dimensions.height / window.devicePixelRatio, [dimensions])

    return <>
        {left !== null && top !== null && width !== null && height !== null && (<div
            className="absolute border-transparent bg-transparent border-4 hover:border-primary hover:bg-primary/10 transition-colors rounded-md cursor-pointer flex justify-center items-center group"
            style={{ left, top, width, height }} onClick={onClick} >
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
    onClick: PropTypes.func.isRequired
}