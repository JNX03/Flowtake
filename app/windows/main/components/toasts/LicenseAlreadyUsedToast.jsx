import { LockClosedIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import Toast from "../../../../components/toasts/Toast"

export default function LicenseAlreadyUsedToast({ id, dismiss }) {
    return (<Toast
        id={id}
        autoDismiss={false}
        dismiss={dismiss}
        type="alert-warning"
        icon={<LockClosedIcon className="size-6" />}
        actions={[{ label: "Unlink license", url: "https://getflowtake.com/account/licenses" }]}>
        License is already linked to another device.
    </Toast>)
}

LicenseAlreadyUsedToast.propTypes = {
    id: PropTypes.string.isRequired,
    dismiss: PropTypes.func.isRequired
}