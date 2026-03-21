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
    TOAST_EXPORT_COMPLETED,
    TOAST_SUCCESS,
    TOAST_UPDATE,
    TOAST_WARNING
} from "@shared/helpers"
import {
    dismissToast,
    selectToasts
} from "@shared/redux/appSlice"
import CaptureErrorToast from "./CaptureErrorToast"
import ExportCompletedToast from "./ExportCompletedToast"
import UpdateToast from "./UpdateToast"

export default function Toasts() {

    const dispatch = useDispatch()

    const toasts = useSelector(selectToasts)

    const dismiss = useCallback(id => dispatch(dismissToast(id)), [dispatch])

    const listToasts = () => {
        return toasts.map(({ type, id, text, autoDismiss }) => {
            switch (type) {
                case TOAST_UPDATE: return <UpdateToast key={id} id={id}
                    dismiss={dismiss} />
                case TOAST_EXPORT_COMPLETED: return <ExportCompletedToast key={id} id={id} text={text}
                    dismiss={dismiss} />
                case TOAST_ERROR_CAPTURE: return <CaptureErrorToast key={id} id={id}
                    dismiss={dismiss} />
                case TOAST_ERROR: return <ErrorToast key={id} id={id} text={text} autoDismiss={autoDismiss}
                    dismiss={dismiss} />
                case TOAST_SUCCESS: return <SuccessToast key={id} id={id} text={text} autoDismiss={autoDismiss}
                    dismiss={dismiss} />
                case TOAST_WARNING: return <WarningToast key={id} id={id} text={text} autoDismiss={autoDismiss}
                    dismiss={dismiss} />
            }
        })
    }

    return (<>
        {toasts.length > 0 && <div className="toast toast-top toast-end w-full max-w-lg max-h-[calc(100vh-2rem)] mt-8 px-10 overflow-auto z-1000">
            {listToasts()}
        </div>}
    </>)
}
