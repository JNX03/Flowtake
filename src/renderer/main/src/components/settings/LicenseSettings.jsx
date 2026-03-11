import { LockOpenIcon as LockOpenIconSmall } from "@heroicons/react/16/solid"
import {
    CheckIcon,
    LockOpenIcon
} from "@heroicons/react/20/solid"
import { useQuery } from "@tanstack/react-query"
import {
    useCallback,
    useMemo,
    useRef,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import Button from "../../../../components/Button"
import Hint from "../../../../components/Hint"
import { TOAST_LICENSE_ACTIVATED } from "../../../../src/helpers"
import {
    addToast,
    setIsReceivingUpdates,
    setOpenSettings
} from "../../../../src/redux/appSlice"
import {
    selectEmail,
    selectHasLicense,
    setEmail,
    setHasLicense
} from "../../../../src/redux/licenseSlice"
import Fieldset from "../properties/Fieldset"

export default function LicenseSettings() {
    const dispatch = useDispatch()

    const licenseKeyInputRef = useRef(null)

    const [error, setError] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [userKey, setUserKey] = useState("")

    const hasLicense = useSelector(selectHasLicense)
    const email = useSelector(selectEmail)

    const { data: storedKey, isPending, isError } = useQuery({
        queryKey: ['licenseKey'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "licenseKey"),
        staleTime: Infinity
    })

    // Derive key from user input or stored value - no effects needed
    const key = useMemo(() => {
        if (userKey) return userKey
        if (!isPending && !isError && storedKey) return storedKey
        return ""
    }, [userKey, isPending, isError, storedKey])

    const isReadyToSubmit = useMemo(() => key !== "", [key])

    const onLicenseKeyChange = useCallback(e => {
        setUserKey(e.target.value)
        setError(null) // Reset error when user types - replaces the useEffect
    }, [])

    const onActivateClick = async () => {
        setIsLoading(true)
        const { isValid, isReceivingUpdates, email, message } = await window.electron.ipcRenderer.invoke("activate", key)

        let errorMessage = null

        switch (message) {
            case "no_network":
                errorMessage = "Unable to validate your license. Please check your internet connection."
                break
            case "no_license":
                errorMessage = "Please enter a license key."
                break
            case "subscription_expired":
                errorMessage = "Your subscription has expired."
                break
            case "invalid_license":
                errorMessage = "Invalid license key."
                break
            case "license_already_used":
                errorMessage = <>This license key is already used on another device. <a className="link"
                    href="https://getflowtake.com/account/licenses" target="_blank" rel="noreferrer">
                    Deactivate it before reusing it.</a></>
                break
            case "invalid_version":
                errorMessage = "Version not supported."
                break
            case "expired_lifetime_license":
                errorMessage = <>
                    Your update period has expired. <a className="link" href="https://getflowtake.com/account/licenses"
                        target="_blank" rel="noreferrer">Purchase a license renewal</a> or <a className="link"
                            href="https://getflowtake.com/releases" target="_blank" rel="noreferrer">downgrade to a
                        supported version</a>
                </>
                break
            case "ok":
                errorMessage = null
                break
            default:
                errorMessage = "Unknown error."
                break
        }

        setIsLoading(false)
        setError(errorMessage)
        dispatch(setHasLicense(isValid))
        dispatch(setIsReceivingUpdates(isReceivingUpdates))
        dispatch(setEmail(email))
        if (isValid) {
            dispatch(setOpenSettings(null))
            dispatch(addToast({ type: TOAST_LICENSE_ACTIVATED }))
        }
    }

    return (<>
        <h4 className="font-semibold text-lg mb-4">License</h4>
        {hasLicense && email && <>
            <p className="mb-4">Flowtake is licensed to {email}.</p>
            <Hint>
                To upgrade, switch to a different license and manage your account, go to <a className="link"
                    href="https://getflowtake.com/account/licenses" target="_blank" rel="noreferrer">
                    getflowtake.com</a>.
            </Hint>
        </>}
        {/* {!hasLicense && <> */}
            <span className="my-2 block">
                <div role="alert" className="alert alert-info shadow-lg">
                    <LockOpenIconSmall className="size-4" />
                    <span className="text-xs">Don&apos;t have a license yet? Activate Flowtake and unlock video exports!</span>
                    <a className="btn btn-sm btn-ghost" href="https://getflowtake.com" target="_blank" rel="noreferrer">
                        <CheckIcon className="size-5" />
                        Unlock video exports
                    </a>
                </div>
            </span>
        {/* </>} */}
        <Fieldset legend="License key">
            <div className="label">Enter your license key</div>
            <div className="join">
                <input onChange={onLicenseKeyChange} ref={licenseKeyInputRef} type="text" value={key}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className={`join-item input w-full ${error ? "input-error" : ""}`} />
                <Button
                    onClick={onActivateClick}
                    className="btn-primary join-item"
                    disabled={!isReadyToSubmit}
                    isLoading={isLoading}
                    icon={LockOpenIcon}
                >
                    Activate
                </Button>
            </div>
            {error !== null && <div className="label text-error block text-wrap">{error}</div>}
        </Fieldset>
    </>)
}