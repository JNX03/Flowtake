import { XCircleIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import Toast from "./Toast"

export default function ErrorToast({ text, autoDismiss, dismiss, id }) {
    return (
        <Toast
            id={id}
            autoDismiss={autoDismiss}
            dismiss={dismiss}
            type="alert-error"
            icon={<XCircleIcon className="size-6" />}>
            {text}
        </Toast>
    )
}

ErrorToast.propTypes = {
    id: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    autoDismiss: PropTypes.bool,
    dismiss: PropTypes.func.isRequired
}