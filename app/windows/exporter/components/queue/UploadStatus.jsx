import PropTypes from "prop-types"
import { useSelector } from "react-redux"
import { RENDER_UPLOADING } from "@shared/helpers"
import { selectRenderById } from "@shared/redux/renderSlice"

export default function UploadStatus({ id, uploadProgress }) {
    const render = useSelector(state => selectRenderById(state, id))

    return (<>
        {render.status === RENDER_UPLOADING ? ` · Uploading ${Math.round(uploadProgress * 100)}%` : ""}
        {uploadProgress === -1 ? " · Upload failed" : ""}
    </>)
}


UploadStatus.propTypes = {
    id: PropTypes.string.isRequired,
    uploadProgress: PropTypes.number.isRequired
}