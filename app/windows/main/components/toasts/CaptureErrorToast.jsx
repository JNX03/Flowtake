import { Cog6ToothIcon } from "@heroicons/react/16/solid"
import { ExclamationCircleIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import Toast from "../../../../components/toasts/Toast"

export default function CaptureErrorToast({ id, dismiss }) {
    return (
        <Toast
            id={id}
            autoDismiss={false}
            dismiss={dismiss}
            type="alert-error"
            icon={<ExclamationCircleIcon className="size-6" />}>
            <span>There was a problem recording the screen. Please make sure your GPU drivers are up-to-date or select a
                different encoder in the settings <Cog6ToothIcon className="inline-block size-4" />.</span>
        </Toast>
    )
}

CaptureErrorToast.propTypes = {
    id: PropTypes.string.isRequired,
    dismiss: PropTypes.func.isRequired
}