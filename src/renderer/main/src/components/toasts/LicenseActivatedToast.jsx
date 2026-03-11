import { LockOpenIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import Toast from "../../../../components/toasts/Toast"

export default function LicenseActivatedToast({ id, dismiss }) {
    return (<Toast
        id={id}
        autoDismiss={true}
        dismiss={dismiss}
        type="alert-success"
        icon={<LockOpenIcon className="size-6" />}>
        Video exports unlocked!
    </Toast>)
}

LicenseActivatedToast.propTypes = {
    id: PropTypes.string.isRequired,
    dismiss: PropTypes.func.isRequired
}