import { FolderOpenIcon, ChatBubbleLeftRightIcon, LightBulbIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import Button from "../../../../components/Button"
import Fieldset from "../properties/Fieldset"
import Toggle from "../properties/Toggle"

const RESOLUTIONS = [
    { value: "1280x720", label: "720p (1280x720)" },
    { value: "1920x1080", label: "1080p (1920x1080)" },
    { value: "2560x1440", label: "1440p (2560x1440)" },
    { value: "3840x2160", label: "4K (3840x2160)" },
]

const AUTO_SAVE_OPTIONS = [
    { value: 0, label: "Disabled" },
    { value: 60, label: "1 minute" },
    { value: 120, label: "2 minutes" },
    { value: 300, label: "5 minutes" },
    { value: 600, label: "10 minutes" },
]

export default function GeneralSettings() {

    const { data: isIssueReportingEnabled, isPending, isError, refetch } = useQuery({
        queryKey: ['isIssueReportingEnabled'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "isIssueReportingEnabled"),
        staleTime: Infinity
    })

    const { data: isAutoStartEnabled, isPending: isAutoStartPending, refetch: refetchAutoStart } = useQuery({
        queryKey: ['autostart'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-autostart"),
        staleTime: Infinity
    })

    const { data: defaultResolution, isPending: isResolutionPending, refetch: refetchResolution } = useQuery({
        queryKey: ['defaultResolution'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultResolution"),
        staleTime: Infinity
    })

    const { data: autoSaveInterval, isPending: isAutoSavePending, refetch: refetchAutoSave } = useQuery({
        queryKey: ['autoSaveInterval'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "autoSaveInterval"),
        staleTime: Infinity
    })

    const { data: notificationsEnabled, isPending: isNotifPending, refetch: refetchNotif } = useQuery({
        queryKey: ['notificationsEnabled'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "notificationsEnabled"),
        staleTime: Infinity
    })

    const onChangeIsIssueReportingEnabled = async (e) => {
        await window.electron.ipcRenderer.invoke("store-set", "isIssueReportingEnabled", e.target.checked)
        refetch()
    }

    const onChangeAutoStart = async (e) => {
        await window.electron.ipcRenderer.invoke("set-autostart", e.target.checked)
        refetchAutoStart()
    }

    const onChangeResolution = async (e) => {
        await window.electron.ipcRenderer.invoke("store-set", "defaultResolution", e.target.value)
        refetchResolution()
    }

    const onChangeAutoSave = async (e) => {
        await window.electron.ipcRenderer.invoke("store-set", "autoSaveInterval", Number(e.target.value))
        refetchAutoSave()
    }

    const onChangeNotifications = async (e) => {
        await window.electron.ipcRenderer.invoke("store-set", "notificationsEnabled", e.target.checked)
        refetchNotif()
    }

    const openLogsDirectory = () => { window.electron.ipcRenderer.invoke("open-logs-dir") }

    return (<div className="flex flex-col gap-4">
        <h4 className="font-semibold text-lg">General</h4>

        <Fieldset legend="Startup" description="Configure how Flowtake launches.">
            <Toggle leftLabel="Launch Flowtake on system startup" value={isAutoStartPending ? false : (isAutoStartEnabled ?? false)}
                onChange={onChangeAutoStart} disabled={isAutoStartPending}
                isIndeterminate={isAutoStartPending} />
        </Fieldset>

        <Fieldset legend="Default recording resolution" description="Set the default resolution for new recordings.">
            <select className="select select-sm w-full"
                value={isResolutionPending ? "1920x1080" : (defaultResolution || "1920x1080")}
                onChange={onChangeResolution}
                disabled={isResolutionPending}>
                {RESOLUTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                ))}
            </select>
        </Fieldset>

        <Fieldset legend="Auto-save" description="Automatically save your project at a regular interval.">
            <select className="select select-sm w-full"
                value={isAutoSavePending ? 300 : (autoSaveInterval ?? 300)}
                onChange={onChangeAutoSave}
                disabled={isAutoSavePending}>
                {AUTO_SAVE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                ))}
            </select>
        </Fieldset>

        <Fieldset legend="Notifications" description="Show system notifications for recording and export events.">
            <Toggle leftLabel="Enable notifications" value={isNotifPending ? false : (notificationsEnabled ?? true)}
                onChange={onChangeNotifications} disabled={isNotifPending}
                isIndeterminate={isNotifPending} />
        </Fieldset>

        <Fieldset legend="Issue reporting" description="Restart Flowtake for changes to issue reporting to go into effect.">
            <Toggle leftLabel="Automatically report issues" value={isPending || isError ? false : isIssueReportingEnabled}
                onChange={onChangeIsIssueReportingEnabled} disabled={isPending || isError}
                isIndeterminate={isPending || isError} />
        </Fieldset>

        <Button icon={FolderOpenIcon} onClick={openLogsDirectory}>Open logs folder</Button>

        <Fieldset legend="Help & Feedback">
            <div className="flex flex-wrap gap-2">
                <a className="btn btn-sm btn-ghost gap-2"
                    href="https://github.com/JNX03/Flowtake/issues"
                    target="_blank" rel="noopener noreferrer">
                    <ChatBubbleLeftRightIcon className="size-4" />
                    Send Feedback
                </a>
                <a className="btn btn-sm btn-ghost gap-2"
                    href="https://github.com/JNX03/Flowtake/issues"
                    target="_blank" rel="noopener noreferrer">
                    <LightBulbIcon className="size-4" />
                    Request a Feature
                </a>
            </div>
        </Fieldset>
    </div>)
}
