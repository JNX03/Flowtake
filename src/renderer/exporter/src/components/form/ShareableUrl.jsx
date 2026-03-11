import PropTypes from "prop-types"
import CopyButton from "../CopyButton"

export default function ShareableUrl({ useShareableUrl, objectId }) {
    const url = () => objectId ? `https://getflowtake.com/videos/${objectId}` : ""

    return (<div className="join">
        <input type="text" className="join-item input" placeholder="Link"
            disabled={(useShareableUrl && !objectId) || !useShareableUrl} readOnly value={url()} />
        <CopyButton value={url()} className="join-item" tooltip="Copy link"
            disabled={(useShareableUrl && !objectId) || !useShareableUrl} isLoading={useShareableUrl && !objectId} />
    </div>)
}


ShareableUrl.propTypes = {
    useShareableUrl: PropTypes.bool.isRequired,
    objectId: PropTypes.string
}