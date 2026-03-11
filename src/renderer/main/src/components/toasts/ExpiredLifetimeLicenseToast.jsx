import { LockClosedIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import Toast from "../../../../components/toasts/Toast"

export default function ExpiredLifetimeLicenseToast({ id, dismiss }) {
    return (<Toast
        id={id}
        autoDismiss={false}
        dismiss={dismiss}
        type="alert-warning"
        icon={<LockClosedIcon className="size-6" />}
        actions={[{ label: "Manage licenses", url: "https://getflowtake.com/account/licenses" }]}>
        Update period expired. Please download an older version, renew your lifetime license or switch to a subscription.
    </Toast>)
}

ExpiredLifetimeLicenseToast.propTypes = {
    id: PropTypes.string.isRequired,
    dismiss: PropTypes.func.isRequired
}