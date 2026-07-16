import { ArrowPathIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import Button from "../../../../components/Button"
import MarkdownRenderer from "../../../../components/MarkdownRenderer"
import Fieldset from "../properties/Fieldset"

export default function UpdatesSettings() {
    const [checking, setChecking] = useState(false)
    const [openingReleasePage, setOpeningReleasePage] = useState(false)
    const [updateInfo, setUpdateInfo] = useState(null)
    const [updateError, setUpdateError] = useState(null)

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

    const onCheckForUpdates = async () => {
        setChecking(true)
        setUpdateError(null)
        try {
            const info = await window.electron.ipcRenderer.invoke("check-for-updates")
            setUpdateInfo(info)
        } catch (error) {
            setUpdateInfo(null)
            setUpdateError(error?.message || "Could not check for updates")
        } finally {
            setChecking(false)
        }
    }

    const onOpenOfficialRelease = async () => {
        setOpeningReleasePage(true)
        setUpdateError(null)
        try {
            await window.electron.ipcRenderer.invoke("install-update")
        } catch (error) {
            setUpdateError(error?.message || "Could not open the official release page")
        } finally {
            setOpeningReleasePage(false)
        }
    }

    return (<div className="flex flex-col gap-4">
        <h4 className="font-semibold text-lg">Updates</h4>

        <Fieldset legend="Check for Updates" description={`Current version: ${version || "..."}`}>
            <div className="flex flex-col gap-3">
                <p className="text-sm text-base-content/60">
                    Updates are installed manually from the official Flowtake GitHub Releases page.
                    Flowtake will not download or launch installers for you.
                </p>

                <Button icon={ArrowPathIcon} onClick={onCheckForUpdates} disabled={checking}>
                    {checking ? "Checking..." : "Check for Updates"}
                </Button>

                {updateError && (
                    <div className="text-sm text-error">{updateError}</div>
                )}

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
                        <Button
                            icon={ArrowTopRightOnSquareIcon}
                            onClick={onOpenOfficialRelease}
                            disabled={openingReleasePage}>
                            {openingReleasePage ? "Opening..." : "Open Official GitHub Release"}
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
