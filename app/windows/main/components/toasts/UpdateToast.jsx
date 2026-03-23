import { SparklesIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import Toast from "../../../../components/toasts/Toast"

export default function UpdateToast({ id, dismiss }) {
    const handleInstall = async () => {
        try {
            const info = await window.electron.ipcRenderer.invoke("check-for-updates")
            if (info?.download_url) {
                await window.electron.ipcRenderer.invoke("install-update", info.download_url)
            }
        } catch {
            // Fallback: open releases page
            await window.electron.ipcRenderer.invoke("open-url-in-browser", "https://github.com/JNX03/Flowtake/releases")
        }
    }

    return (<Toast
        id={id}
        autoDismiss={false}
        dismiss={dismiss}
        type="alert-info"
        icon={<SparklesIcon className="size-6" />}
        actions={[{ label: "Download update", callback: handleInstall }]}>
        A new version is available.
    </Toast>)
}

UpdateToast.propTypes = {
    id: PropTypes.string.isRequired,
    dismiss: PropTypes.func.isRequired
}