import PropTypes from 'prop-types'

export default function WindowOutline({ dimensions, name }) {
    // Coordinates from Rust GetWindowRect are in physical pixels (Tauri is DPI-aware)
    // The overlay CSS space is in logical pixels, so divide by devicePixelRatio
    const dpr = window.devicePixelRatio || 1
    const left = dimensions.x / dpr
    const top = dimensions.y / dpr
    const width = dimensions.width / dpr
    const height = dimensions.height / dpr

    return (
        <div
            className="absolute border-4 border-primary bg-primary/10 rounded-md pointer-events-none flex justify-center items-center"
            style={{ left, top, width, height }}
        >
            {name && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-base-300/90 rounded text-xs text-base-content max-w-[300px] truncate pointer-events-none">
                    {name}
                </div>
            )}
            <div className="btn btn-primary shadow-lg pointer-events-none">
                Record this window
            </div>
        </div>
    )
}

WindowOutline.propTypes = {
    dimensions: PropTypes.shape({
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired,
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired
    }).isRequired,
    name: PropTypes.string,
}
