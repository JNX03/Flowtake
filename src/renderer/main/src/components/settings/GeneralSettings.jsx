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

    const onChangeIsIssueReportingEnabled = async (e) => {
        await window.electron.ipcRenderer.invoke("store-set", "isIssueReportingEnabled", e.target.checked)
        refetch()
    }

    const openLogsDirectory = () => { window.electron.ipcRenderer.invoke("open-logs-dir") }

    return (<>
        <h4 className="font-semibold text-lg mb-4">General</h4>

        <Fieldset legend="Issue reporting" description="Restart Flowtake for changes to issue reporting to go into effect.">
            <Toggle leftLabel="Automatically report issues" value={isPending || isError ? false : isIssueReportingEnabled}
                onChange={onChangeIsIssueReportingEnabled} disabled={isPending || isError}
                isIndeterminate={isPending || isError} />
        </Fieldset>

        <Button icon={FolderOpenIcon} className="mt-4" onClick={openLogsDirectory}>Open logs folder</Button>
    </>)
}