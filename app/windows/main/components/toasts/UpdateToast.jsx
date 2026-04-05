import { SparklesIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import { useDispatch } from "react-redux"
import { setOpenSettings } from "@shared/redux/appSlice"
import { SETTINGS_UPDATES } from "../settings/constants"
import Toast from "../../../../components/toasts/Toast"

export default function UpdateToast({ id, dismiss }) {
    const dispatch = useDispatch()

    const handleViewUpdate = () => {
        dispatch(setOpenSettings(SETTINGS_UPDATES))
        dismiss(id)
    }

    return (<Toast
        id={id}
        autoDismiss={false}
        dismiss={dismiss}
        type="alert-info"
        icon={<SparklesIcon className="size-6" />}
        actions={[{ label: "View update", callback: handleViewUpdate }]}>
        A new version is available.
    </Toast>)
}

UpdateToast.propTypes = {
    id: PropTypes.string.isRequired,
    dismiss: PropTypes.func.isRequired
}