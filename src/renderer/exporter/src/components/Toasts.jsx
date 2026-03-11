import {
    useDispatch,
    useSelector
} from "react-redux"
import ErrorToast from "../../../components/toasts/ErrorToast"
import SuccessToast from "../../../components/toasts/SuccessToast"
import WarningToast from "../../../components/toasts/WarningToast"
import {
    TOAST_ERROR,
    TOAST_SUCCESS,
    TOAST_WARNING
} from "../../../src/helpers"
import {
    dismissToast,
    selectToasts
} from "../../../src/redux/renderSlice"
import { useCallback } from "react"

export default function Toasts() {

    const dispatch = useDispatch()

    const toasts = useSelector(selectToasts)

    const dismiss = useCallback(id => dispatch(dismissToast(id)), [dispatch])

    const listToasts = useCallback(() => {
        return toasts.map(({ type, id, text, autoDismiss }) => {
            switch (type) {
                case TOAST_ERROR: return <ErrorToast key={id} id={id} text={text} autoDismiss={autoDismiss}
                    dismiss={dismiss} />
                case TOAST_SUCCESS: return <SuccessToast key={id} id={id} text={text} autoDismiss={autoDismiss}
                    dismiss={dismiss} />
                case TOAST_WARNING: return <WarningToast key={id} id={id} text={text} autoDismiss={autoDismiss}
                    dismiss={dismiss} />
            }
        })
    }, [dismiss, toasts])

    return (<>
        {toasts.length > 0 && <div className="toast toast-top toast-end w-lg max-h-[calc(100vh-2rem)] mt-8 px-10 overflow-auto z-1000">
            {listToasts()}
        </div>}
    </>)
}