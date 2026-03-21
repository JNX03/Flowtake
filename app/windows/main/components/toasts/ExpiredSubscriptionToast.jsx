import { LockClosedIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import Toast from "../../../../components/toasts/Toast"

export default function ExpiredSubscriptionToast({ id, dismiss }) {
    return (<Toast
        id={id}
        autoDismiss={false}
        dismiss={dismiss}
        type="alert-warning"
        icon={<LockClosedIcon className="size-6" />}
        actions={[{ label: "Unlock exports", url: "https://getflowtake.com/account/licenses" }]}>
        Expired subscription. Resubscribe to keep using Flowtake.
    </Toast>)
}

ExpiredSubscriptionToast.propTypes = {
    id: PropTypes.string.isRequired,
    dismiss: PropTypes.func.isRequired
}