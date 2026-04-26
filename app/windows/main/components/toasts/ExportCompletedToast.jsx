import { CheckIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import Toast from "../../../../components/toasts/Toast"
import {
    EXPORTER_SECTION_QUEUE,
    TOAST_EXPORT_COMPLETED
} from "@shared/helpers"
import { createRenderableProjectState } from "@shared/renderState"
import {
    dismissToastsByType,
    selectHasProject
} from "@shared/redux/appSlice"

export default function ExportCompletedToast({ text, id, dismiss }) {

    const dispatch = useDispatch()
    const hasProject = useSelector(selectHasProject)
    const entireState = useSelector(state => state)

    const handleShowQueue = useCallback(async () => {
        await window.electron.ipcRenderer.invoke(
            "open-export-window",
            hasProject ? createRenderableProjectState(entireState) : null,
            EXPORTER_SECTION_QUEUE
        )
        dispatch(dismissToastsByType(TOAST_EXPORT_COMPLETED))
    }, [hasProject, entireState, dispatch])

    return (<Toast
        id={id}
        autoDismiss={false}
        dismiss={dismiss}
        type="alert-success"
        icon={<CheckIcon className="size-6" />}
        actions={[{
            label: "Show queue",
            callback: handleShowQueue
        }]}>
        Export completed ({text}).
    </Toast>)
}

ExportCompletedToast.propTypes = {
    text: PropTypes.string.isRequired,
    id: PropTypes.string.isRequired,
    dismiss: PropTypes.func.isRequired
}
