import { ArrowUpCircleIcon } from "@heroicons/react/16/solid"
import { useSelector } from "react-redux"
import { selectIsReceivingUpdates } from "@shared/redux/appSlice"

export default function UpgradeButton() {

    const isReceivingUpdates = useSelector(selectIsReceivingUpdates)

    return (<>
        {!isReceivingUpdates && <div className="tooltip tooltip-bottom" data-tip="Upgrade to use the latest features">
            <button className="mt-1 btn btn-xs btn-square btn-primary"
                onClick={() => window.electron.ipcRenderer.invoke("open-url-in-browser", "https://getflowtake.com/account/licenses")}>
                <ArrowUpCircleIcon className="size-4" />
            </button>
        </div>}
    </>)
}