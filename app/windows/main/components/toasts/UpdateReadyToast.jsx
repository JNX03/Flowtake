import { ArrowDownTrayIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import { useState } from "react"
import { exit } from "@tauri-apps/plugin-process"
import Toast from "../../../../components/toasts/Toast"

export default function UpdateReadyToast({ id, dismiss, installerPath, version }) {
    const [installing, setInstalling] = useState(false)

    const handleInstall = async () => {
        if (installing) return
        setInstalling(true)
        try {
            await window.electron.ipcRenderer.invoke("store-set", "lastInstallerLaunchedAt", Date.now())
            await window.electron.ipcRenderer.invoke("launch-installer", installerPath)
            await exit(0)
        } catch (err) {
            setInstalling(false)
            console.error("[Flowtake] Failed to launch pending installer:", err)
        }
    }

    const label = installing
        ? "Installing..."
        : version
            ? `Install v${version}`
            : "Install now"

    return (<Toast
        id={id}
        autoDismiss={false}
        dismiss={dismiss}
        type="alert-info"
        icon={<ArrowDownTrayIcon className="size-6" />}
        actions={[{ label, callback: handleInstall }]}>
        An update is downloaded and ready to install.
    </Toast>)
}

UpdateReadyToast.propTypes = {
    id: PropTypes.string.isRequired,
    dismiss: PropTypes.func.isRequired,
    installerPath: PropTypes.string.isRequired,
    version: PropTypes.string,
}
