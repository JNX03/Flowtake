import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import ErrorToast from "../../../../components/toasts/ErrorToast"
import SuccessToast from "../../../../components/toasts/SuccessToast"
import WarningToast from "../../../../components/toasts/WarningToast"
import {
    TOAST_ERROR,
    TOAST_ERROR_CAPTURE,
    TOAST_EXPIRED_LIFETIME_LICENSE,
    TOAST_EXPIRED_SUBSCRIPTION,
    TOAST_EXPORT_COMPLETED,
    TOAST_LICENSE_ACTIVATED,
    TOAST_LICENSE_ALREADY_USED,
    TOAST_SUCCESS,
    TOAST_UPDATE,
    TOAST_WARNING
} from "@shared/helpers"
import {
    dismissToast,
    selectToasts
} from "@shared/redux/appSlice"
import CaptureErrorToast from "./CaptureErrorToast"
import ExpiredLifetimeLicenseToast from "./ExpiredLifetimeLicenseToast"
import ExpiredSubscriptionToast from "./ExpiredSubscriptionToast"
import ExportCompletedToast from "./ExportCompletedToast"
import LicenseActivatedToast from "./LicenseActivatedToast"
import LicenseAlreadyUsedToast from "./LicenseAlreadyUsedToast"
import UpdateToast from "./UpdateToast"

export default function Toasts() {

    const dispatch = useDispatch()

    const toasts = useSelector(selectToasts)

    const dismiss = useCallback(id => dispatch(dismissToast(id)), [dispatch])

    const listToasts = () => {
        return toasts.map(({ type, id, text, autoDismiss, actions }) => {
            switch (type) {
                case TOAST_UPDATE: return <UpdateToast key={id} id={id}
                    dismiss={dismiss} />
                case TOAST_EXPORT_COMPLETED: return <ExportCompletedToast key={id} id={id} text={text}
                    dismiss={dismiss} />
                case TOAST_ERROR_CAPTURE: return <CaptureErrorToast key={id} id={id}
                    dismiss={dismiss} />
                case TOAST_ERROR: return <ErrorToast key={id} id={id} text={text} autoDismiss={autoDismiss}
                    actions={actions} dismiss={dismiss} />
                case TOAST_SUCCESS: return <SuccessToast key={id} id={id} text={text} autoDismiss={autoDismiss}
                    dismiss={dismiss} />
                case TOAST_WARNING: return <WarningToast key={id} id={id} text={text} autoDismiss={autoDismiss}
                    dismiss={dismiss} />
                case TOAST_LICENSE_ACTIVATED: return <LicenseActivatedToast key={id} id={id}
                    dismiss={dismiss} />
                case TOAST_LICENSE_ALREADY_USED: return <LicenseAlreadyUsedToast key={id} id={id}
                    dismiss={dismiss} />
                case TOAST_EXPIRED_LIFETIME_LICENSE: return <ExpiredLifetimeLicenseToast key={id} id={id}
                    dismiss={dismiss} />
                case TOAST_EXPIRED_SUBSCRIPTION: return <ExpiredSubscriptionToast key={id} id={id}
                    dismiss={dismiss} />
                default: return null
            }
        })
    }

    return (<>
        {toasts.length > 0 && <div className="toast toast-top toast-end w-full max-w-lg max-h-[calc(100vh-2rem)] mt-8 px-10 overflow-auto z-1000">
            {listToasts()}
        </div>}
    </>)
}
