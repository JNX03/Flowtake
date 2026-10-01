import {
    CheckCircleIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    ArrowTopRightOnSquareIcon,
    ArrowDownTrayIcon,
    ClipboardDocumentIcon
} from "@heroicons/react/24/outline"
import { useState } from "react"
import useRecorderReadiness from "@shared/hooks/useRecorderReadiness"
import { buildRecorderReadinessReport, getPermissionStatus } from "@shared/recorderReadiness"

export default function PermissionsStep() {
    const [installState, setInstallState] = useState({ pending: false, message: "", success: false })
    const readiness = useRecorderReadiness()
    const { permissions, dependencies, platform, isLoading, isError, allPermsOk, allDepsOk, ready, installCommand } = readiness
    const [copyMessage, setCopyMessage] = useState("")
    const [actionMessage, setActionMessage] = useState("")
    const refresh = () => {
        setCopyMessage("")
        setActionMessage("")
        return readiness.refresh()
    }
    const copyReport = async () => {
        try {
            await navigator.clipboard.writeText(buildRecorderReadinessReport(readiness))
            setCopyMessage("Report copied. Local paths and device identifiers are omitted.")
        } catch {
            setCopyMessage("Could not copy the report. Allow clipboard access, then try again.")
        }
    }

    const openSystemSettings = () => {
        window.electron.ipcRenderer.invoke(
            "open-url-in-browser",
            "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
        ).catch(() => setActionMessage("Open System Settings → Privacy & Security → Screen & System Audio Recording, then enable this Flowtake app."))
    }

    const installDependencies = async () => {
        setInstallState({ pending: true, message: "Installing the required tools…", success: false })
        try {
            const result = await window.electron.ipcRenderer.invoke("install-dependencies")
            setInstallState({
                pending: false,
                message: result?.message || (result?.success ? "Installation finished. Restart Flowtake." : "Installation did not finish."),
                success: Boolean(result?.success)
            })
            await readiness.refresh()
        } catch {
            setInstallState({ pending: false, message: "Automatic installation failed. Use the manual FFmpeg setup link.", success: false })
        }
    }

    const openFfmpegSetup = () => {
        window.electron.ipcRenderer.invoke("open-url-in-browser", "https://ffmpeg.org/download.html")
            .catch(() => setActionMessage("Visit ffmpeg.org/download.html for manual FFmpeg setup."))
    }

    return (
        <div className="flex flex-col gap-5 max-w-lg mx-auto">
            <div>
                <h3 className="text-lg font-semibold">Recorder readiness</h3>
                <p className="text-sm text-base-content/60 mt-1">
                    Flowtake checks the local capture tools now. Camera and microphone access are requested only if you choose those devices.
                </p>
            </div>

            {isError && (
                <p className="text-sm text-warning" role="alert">
                    Could not verify recorder readiness. Refresh to retry; previous results may be outdated.
                </p>
            )}
            {platform === "darwin" && !allPermsOk && !isLoading && !isError && (
                <p className="text-sm text-warning">
                    Enable this Flowtake app in System Settings → Privacy &amp; Security → Screen &amp; System Audio Recording.
                    Then refresh these checks. Quit and reopen Flowtake if macOS still blocks capture.
                </p>
            )}
            {platform === "linux" && !allPermsOk && !isLoading && !isError && (
                <p className="text-sm text-warning">Screen capture requires X11 or XWayland. Pure Wayland capture is unsupported.</p>
            )}
            {!readiness.hasEngines && !isLoading && !isError && (
                <p className="text-sm text-warning">No capture engine is available. Restart Flowtake after installing the required tools.</p>
            )}

            {/* Permissions */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium text-base-content/70 uppercase tracking-wider">Permissions</h4>
                {isLoading ? (
                    <div className="flex items-center gap-2 py-4">
                        <span className="loading loading-spinner loading-sm" />
                        <span className="text-sm text-base-content/60">Checking permissions...</span>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {permissions?.map((perm, i) => {
                            const status = getPermissionStatus(perm)
                            const isCheckedOnUse = status === "Checked when enabled"
                            return (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-base-200/50">
                                {perm.hasPermission || isCheckedOnUse ? (
                                    <CheckCircleIcon className={`w-5 h-5 ${isCheckedOnUse ? "text-base-content/40" : "text-success"} flex-none`} />
                                ) : (
                                    <ExclamationTriangleIcon className="w-5 h-5 text-warning flex-none" />
                                )}
                                <span className="text-sm flex-1">{perm.label}</span>
                                <span className={`badge badge-sm ${isCheckedOnUse ? "badge-ghost" : perm.hasPermission ? "badge-success" : "badge-warning"}`}>
                                    {status}
                                </span>
                            </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Dependencies */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium text-base-content/70 uppercase tracking-wider">Dependencies</h4>
                {isLoading ? (
                    <div className="flex items-center gap-2 py-4">
                        <span className="loading loading-spinner loading-sm" />
                        <span className="text-sm text-base-content/60">Checking dependencies...</span>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {dependencies?.map((dep, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-base-200/50">
                                {dep.installed ? (
                                    <CheckCircleIcon className="w-5 h-5 text-success flex-none" />
                                ) : (
                                    <ExclamationTriangleIcon className={`w-5 h-5 flex-none ${dep.required ? "text-error" : "text-warning"}`} />
                                )}
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium">{dep.name}</span>
                                    <p className="text-xs text-base-content/50">{dep.description}</p>
                                </div>
                                <span className={`badge badge-sm ${dep.installed ? "badge-success" : dep.required ? "badge-error" : "badge-warning"}`}>
                                    {dep.installed ? "Found" : dep.required ? "Required" : "Optional"}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
                <button className="btn btn-ghost btn-sm gap-1" onClick={refresh} disabled={isLoading}>
                    <ArrowPathIcon className="w-4 h-4" />
                    Refresh
                </button>
                {!allDepsOk && !isLoading && !isError && installCommand && (
                    <button className="btn btn-primary btn-sm gap-1" onClick={installDependencies} disabled={installState.pending}>
                        {installState.pending ? <span className="loading loading-spinner loading-xs" /> : <ArrowDownTrayIcon className="w-4 h-4" />}
                        {installState.pending ? "Installing…" : "Install required tools"}
                    </button>
                )}
                {!allDepsOk && !isLoading && !isError && !installCommand && (
                    <button className="btn btn-ghost btn-sm gap-1" onClick={openFfmpegSetup}>
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        Manual FFmpeg setup
                    </button>
                )}
                <button className="btn btn-ghost btn-sm gap-1" onClick={copyReport} disabled={isLoading}>
                    <ClipboardDocumentIcon className="w-4 h-4" />
                    Copy readiness report
                </button>
                {!allPermsOk && platform === "darwin" && (
                    <button className="btn btn-ghost btn-sm gap-1" onClick={openSystemSettings}>
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        Open System Settings
                    </button>
                )}
            </div>

            {(copyMessage || actionMessage) && (
                <p className="text-sm text-base-content/70" role="status">{actionMessage || copyMessage}</p>
            )}

            {installState.message && (
                <div className={`text-sm ${installState.success ? "text-success" : "text-warning"}`} role="status">
                    {installState.message}
                </div>
            )}

            {ready && (
                <div className="text-sm text-success font-medium">
                    Core recording tools are ready. Device access is still your choice.
                </div>
            )}
            {!ready && !isLoading && !isError && (
                <div className="text-sm text-warning font-medium">
                    A required item needs attention. Resolve missing items before recording.
                </div>
            )}
        </div>
    )
}
