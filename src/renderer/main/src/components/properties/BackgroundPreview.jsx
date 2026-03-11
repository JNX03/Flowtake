import PropTypes from 'prop-types'

export default function BackgroundPreview({ isLoading, children }) {
    return (<>
        {!isLoading && children}
        {isLoading && <div className="aspect-video rounded-md border-2 border-transparent bg-base-300 flex items-center justify-center" >
            <span className="loading loading-spinner loading-xs text-primary"></span>
        </div>}
    </>)
}

BackgroundPreview.propTypes = {
    isLoading: PropTypes.bool.isRequired,
    children: PropTypes.node
}