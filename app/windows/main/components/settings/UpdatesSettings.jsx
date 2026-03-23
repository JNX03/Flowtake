import { ArrowDownTrayIcon, ArrowPathIcon, CheckCircleIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import Markdown from "react-markdown"
import Button from "../../../../components/Button"
import Fieldset from "../properties/Fieldset"
import Toggle from "../properties/Toggle"

const markdownComponents = {
    a: ({ href, children }) => (
        <button className="link link-primary"
            onClick={(e) => { e.preventDefault(); window.electron.ipcRenderer.invoke("open-url-in-browser", href) }}>
            {children}
        </button>
    ),
}

export default function UpdatesSettings() {

    const [checking, setChecking] = useState(false)
    const [updateInfo, setUpdateInfo] = useState(null)

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

    const onChangeAutoUpdate = async (e) => {
        await window.electron.ipcRenderer.invoke("store-set", "autoUpdateEnabled", e.target.checked)
        refetchAutoUpdate()
    }

    const onCheckForUpdates = async () => {
        setChecking(true)
        try {
            const info = await window.electron.ipcRenderer.invoke("check-for-updates")
            setUpdateInfo(info)
        } catch {
            setUpdateInfo(null)
        }
        setChecking(false)
    }

    const onDownloadUpdate = () => {
        if (updateInfo?.download_url) {
            window.electron.ipcRenderer.invoke("install-update", updateInfo.download_url)
        }
    }

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
                <Button icon={ArrowPathIcon} onClick={onCheckForUpdates} disabled={checking}>
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
                            <div className="text-sm text-base-content/70 mb-3 max-h-32 overflow-y-auto prose prose-sm prose-headings:text-base-content prose-p:text-base-content/70 prose-li:text-base-content/70 prose-strong:text-base-content/80 prose-a:text-primary max-w-none">
                                <Markdown components={markdownComponents}>{updateInfo.release_notes}</Markdown>
                            </div>
                        )}
                        <Button icon={ArrowDownTrayIcon} onClick={onDownloadUpdate}>
                            Download Update
                        </Button>
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
                                <div className="text-sm text-base-content/70 prose prose-sm prose-headings:text-base-content prose-p:text-base-content/70 prose-li:text-base-content/70 prose-strong:text-base-content/80 prose-a:text-primary max-w-none">
                                    <Markdown components={markdownComponents}>{entry.release_notes}</Markdown>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Fieldset>
    </div>)
}
