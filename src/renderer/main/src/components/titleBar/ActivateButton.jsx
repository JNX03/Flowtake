import { LockOpenIcon } from "@heroicons/react/16/solid"
import { useDispatch, useSelector } from "react-redux"
import Button from "../../../../components/Button"
import { setOpenSettings } from "../../../../src/redux/appSlice"
import { selectHasLicense, selectIsChecking } from "../../../../src/redux/licenseSlice"
import { SETTINGS_LICENSE } from "../settings/settings"

export default function ActivateButton() {

    const dispatch = useDispatch()
    const hasLicense = useSelector(selectHasLicense)
    const isChecking = useSelector(selectIsChecking)

    return (<>
        {!hasLicense && <Button
            onClick={() => dispatch(setOpenSettings(SETTINGS_LICENSE))}
            disabled={isChecking}
            isLoading={isChecking}
            icon={LockOpenIcon}
            className="mt-1 btn-primary"
            size="xs"
        >
            Unlock video exports
        </Button>}
    </>)
}

