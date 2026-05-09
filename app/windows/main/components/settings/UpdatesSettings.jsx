import { ArrowDownTrayIcon, ArrowPathIcon, CheckCircleIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { exit } from "@tauri-apps/plugin-process"
import Button from "../../../../components/Button"
import MarkdownRenderer from "../../../../components/MarkdownRenderer"
import Fieldset from "../properties/Fieldset"
import Toggle from "../properties/Toggle"

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UpdatesSettings() {

    const [checking, setChecking] = useState(false)
    const [updateInfo, setUpdateInfo] = useState(null)
    const [downloadProgress, setDownloadProgress] = useState(null)
    const [downloadError, setDownloadError] = useState(null)
    const [installerPath, setInstallerPath] = useState(null)
    const [isInstalling, setIsInstalling] = useState(false)
    const unlistenRef = useRef(null)

    const { data: autoUpdateEnabled, isPending: isAutoUpdatePending, refetch: refetchAutoUpdate } = useQuery({
        queryKey: ['autoUpdateEnabled'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "autoUpdateEnabled"),
        staleTime: Infinity
    })

    const { data: version } = useQuery({
        queryKey: ['version'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-version"),
        staleTime: Infinity
    })

    const { data: changelog, isPending: isChangelogPending } = useQuery({
        queryKey: ['changelog'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-changelog"),
        staleTime: 5 * 60 * 1000
    })

    useEffect(() => {
        return () => {
            if (unlistenRef.current) {
                unlistenRef.current()
                unlistenRef.current = null
            }
        }
    }, [])

    const onChangeAutoUpdate = async (e) => {
        await window.electron.ipcRenderer.invoke("store-set", "autoUpdateEnabled", e.target.checked)
        refetchAutoUpdate()
    }

    const onCheckForUpdates = async () => {
        setChecking(true)
        setDownloadProgress(null)
        setDownloadError(null)
        setInstallerPath(null)
        try {
            const info = await window.electron.ipcRenderer.invoke("check-for-updates")
            setUpdateInfo(info)
        } catch {
            setUpdateInfo(null)
        }
        setChecking(false)
    }

    const onDownloadUpdate = async () => {
        if (!updateInfo?.download_url) return

        setDownloadProgress({ bytesDownloaded: 0, totalBytes: 0, percent: 0 })
        setDownloadError(null)
        setInstallerPath(null)

        // Listen for progress events
        if (unlistenRef.current) {
            unlistenRef.current()
        }
        unlistenRef.current = window.electron.ipcRenderer.on("update-download-progress", (_event, data) => {
            setDownloadProgress({
                bytesDownloaded: data.bytes_downloaded,
                totalBytes: data.total_bytes,
                percent: data.percent,
            })
        })

        try {
            const result = await window.electron.ipcRenderer.invoke("download-update", updateInfo.download_url)
            setInstallerPath(result?.installerPath || null)
            setDownloadProgress(null)
        } catch (err) {
            setDownloadError(err?.message || String(err) || "Download failed")
            setDownloadProgress(null)
        } finally {
            if (unlistenRef.current) {
                unlistenRef.current()
                unlistenRef.current = null
            }
        }
    }

    const onInstallAndRestart = async () => {
        if (!installerPath) return
        setIsInstalling(true)
        try {
            await window.electron.ipcRenderer.invoke("store-set", "lastInstallerLaunchedAt", Date.now())
            await window.electron.ipcRenderer.invoke("launch-installer", installerPath)
            await exit(0)
        } catch (err) {
            setIsInstalling(false)
            setDownloadError(err?.message || "Failed to launch installer")
        }
    }

    const onOpenInBrowser = () => {
        if (updateInfo?.download_url) {
            window.electron.ipcRenderer.invoke("install-update", updateInfo.download_url)
        }
    }

    const isDownloading = downloadProgress !== null

    return (<div className="flex flex-col gap-4">
        <h4 className="font-semibold text-lg">Updates</h4>

        <Fieldset legend="Auto Update" description="Automatically check for updates when Flowtake starts.">
            <Toggle leftLabel="Check for updates automatically"
                value={isAutoUpdatePending ? false : (autoUpdateEnabled ?? true)}
                onChange={onChangeAutoUpdate}
                disabled={isAutoUpdatePending}
                isIndeterminate={isAutoUpdatePending} />
        </Fieldset>

        <Fieldset legend="Check for Updates" description={`Current version: ${version || "..."}`}>
            <div className="flex flex-col gap-3">
                <Button icon={ArrowPathIcon} onClick={onCheckForUpdates} disabled={checking || isDownloading}>
                    {checking ? "Checking..." : "Check for Updates"}
                </Button>

                {updateInfo && !updateInfo.has_update && (
                    <div className="flex items-center gap-2 text-sm text-success">
                        <CheckCircleIcon className="size-5" />
                        You are up to date! (v{updateInfo.current_version})
                    </div>
                )}

                {updateInfo?.has_update && (
                    <div className="bg-primary/10 border border-primary/20 rounded-box p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm">
                                v{updateInfo.latest_version} available
                            </span>
                            <span className="text-xs text-base-content/40">
                                {updateInfo.published_at ? new Date(updateInfo.published_at).toLocaleDateString() : ""}
                            </span>
                        </div>
                        {updateInfo.release_notes && (
                            <div className="text-sm mb-3 max-h-32 overflow-y-auto">
                                <MarkdownRenderer>{updateInfo.release_notes}</MarkdownRenderer>
                            </div>
                        )}

                        {/* Download progress */}
                        {isDownloading && (
                            <div className="flex flex-col gap-1.5 mb-3">
                                <progress
                                    className="progress progress-primary w-full"
                                    value={downloadProgress.percent}
                                    max="100"
                                />
                                <div className="flex items-center justify-between text-xs text-base-content/50">
                                    <span>Downloading... {Math.round(downloadProgress.percent)}%</span>
                                    <span>
                                        {formatBytes(downloadProgress.bytesDownloaded)}
                                        {downloadProgress.totalBytes > 0 && ` / ${formatBytes(downloadProgress.totalBytes)}`}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Download error */}
                        {downloadError && (
                            <div className="text-sm text-error mb-3">
                                {downloadError}
                            </div>
                        )}

                        {/* Action buttons */}
                        {!isDownloading && !installerPath && !isInstalling && (
                            <div className="flex items-center gap-2">
                                <Button icon={ArrowDownTrayIcon} onClick={onDownloadUpdate}>
                                    Download Update
                                </Button>
                                <button className="btn btn-ghost btn-sm gap-1" onClick={onOpenInBrowser}>
                                    <ArrowTopRightOnSquareIcon className="size-4" />
                                    Open in browser
                                </button>
                            </div>
                        )}

                        {/* Ready to install */}
                        {installerPath && !isInstalling && (
                            <Button icon={ArrowDownTrayIcon} onClick={onInstallAndRestart}>
                                Install and Restart
                            </Button>
                        )}

                        {/* Installing */}
                        {isInstalling && (
                            <div className="flex items-center gap-2 text-sm text-base-content/60">
                                <span className="loading loading-spinner loading-sm" />
                                Installing update...
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Fieldset>

        <Fieldset legend="Changelog" description="Release history from GitHub.">
            {isChangelogPending && (
                <p className="text-sm text-base-content/40">Loading changelog...</p>
            )}
            {!isChangelogPending && (!changelog || changelog.length === 0) && (
                <p className="text-sm text-base-content/40">No releases found.</p>
            )}
            {changelog && changelog.length > 0 && (
                <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
                    {changelog.map((entry, i) => (
                        <div key={entry.version || i}
                            className="bg-base-200/50 border border-base-content/5 rounded-box p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-sm">{entry.version}</span>
                                <span className="text-xs text-base-content/40">
                                    {entry.published_at ? new Date(entry.published_at).toLocaleDateString() : ""}
                                </span>
                            </div>
                            {entry.release_notes && (
                                <div className="text-sm">
                                    <MarkdownRenderer>{entry.release_notes}</MarkdownRenderer>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Fieldset>
    </div>)
}
