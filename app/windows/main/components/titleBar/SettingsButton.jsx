import { Cog6ToothIcon } from "@heroicons/react/16/solid"
import { useDispatch } from "react-redux"
import { setOpenSettings } from "@shared/redux/appSlice"
import { SETTINGS_GENERAL } from "../settings/constants"

export default function SettingsButton() {
    const dispatch = useDispatch()

    return (
        <button className="btn btn-ghost btn-xs btn-square" onClick={() => { dispatch(setOpenSettings(SETTINGS_GENERAL)) }}>
            <Cog6ToothIcon className="size-4" />
        </button>
    )
}

