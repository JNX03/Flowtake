import { ArrowUpCircleIcon } from "@heroicons/react/16/solid"
import { useSelector } from "react-redux"
import { selectIsReceivingUpdates } from "../../../../src/redux/appSlice"

export default function UpgradeButton() {

    const isReceivingUpdates = useSelector(selectIsReceivingUpdates)

    return (<>
        {!isReceivingUpdates && <div className="tooltip tooltip-bottom" data-tip="Upgrade to use the latest features">
            <a className="mt-1 btn btn-xs btn-square btn-primary" href="https://getflowtake.com/account/licenses"
                target="_blank" rel="noreferrer">
                <ArrowUpCircleIcon className="size-4" />
            </a>
        </div>}
    </>)
}