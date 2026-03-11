import { SparklesIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import Toast from "../../../../components/toasts/Toast"

export default function UpdateToast({ id, dismiss }) {
    return (<Toast
        id={id}
        autoDismiss={false}
        dismiss={dismiss}
        type="alert-info"
        icon={<SparklesIcon className="size-6" />}
        actions={[{ label: "Restart and install", callback: () => window.electron.ipcRenderer.invoke("install-update") }]}>
        Update downloaded.
    </Toast>)
}

UpdateToast.propTypes = {
    id: PropTypes.string.isRequired,
    dismiss: PropTypes.func.isRequired
}