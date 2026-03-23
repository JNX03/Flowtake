import { FolderOpenIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import Button from "../../../../components/Button"
import Fieldset from "../properties/Fieldset"
import Toggle from "../properties/Toggle"

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

    const onChangeIsIssueReportingEnabled = async (e) => {
        await window.electron.ipcRenderer.invoke("store-set", "isIssueReportingEnabled", e.target.checked)
        refetch()
    }

    const onChangeAutoStart = async (e) => {
        await window.electron.ipcRenderer.invoke("set-autostart", e.target.checked)
        refetchAutoStart()
    }

    const openLogsDirectory = () => { window.electron.ipcRenderer.invoke("open-logs-dir") }

    return (<div className="flex flex-col gap-4">
        <h4 className="font-semibold text-lg">General</h4>

        <Fieldset legend="Startup" description="Configure how Flowtake launches.">
            <Toggle leftLabel="Launch Flowtake on system startup" value={isAutoStartPending ? false : (isAutoStartEnabled ?? false)}
                onChange={onChangeAutoStart} disabled={isAutoStartPending}
                isIndeterminate={isAutoStartPending} />
        </Fieldset>

        <Fieldset legend="Issue reporting" description="Restart Flowtake for changes to issue reporting to go into effect.">
            <Toggle leftLabel="Automatically report issues" value={isPending || isError ? false : isIssueReportingEnabled}
                onChange={onChangeIsIssueReportingEnabled} disabled={isPending || isError}
                isIndeterminate={isPending || isError} />
        </Fieldset>

        <Button icon={FolderOpenIcon} onClick={openLogsDirectory}>Open logs folder</Button>
    </div>)
}
