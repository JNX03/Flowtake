import {
    CheckIcon,
    ExclamationTriangleIcon
} from "@heroicons/react/16/solid"
import { useSelector } from "react-redux"
import {
    SAVE_STATUS_ERROR,
    SAVE_STATUS_IDLE,
    SAVE_STATUS_PENDING,
    SAVE_STATUS_SAVED,
    selectSaveError,
    selectSaveStatus
} from "@shared/redux/editorSlice"

export default function SaveIndicator() {
    const saveStatus = useSelector(selectSaveStatus)
    const saveError = useSelector(selectSaveError)

    if (saveStatus === SAVE_STATUS_IDLE) return null

    if (saveStatus === SAVE_STATUS_ERROR) {
        const message = saveError || "Couldn't save project."

        return (
            <span
                className="inline-flex items-center px-1 text-error"
                role="alert"
                title={message}
            >
                <ExclamationTriangleIcon className="size-4" />
                <span className="sr-only">{message}</span>
            </span>
        )
    }

    if (saveStatus === SAVE_STATUS_SAVED) {
        return (
            <span
                className="inline-flex items-center px-1 text-success"
                role="status"
                title="Project saved"
            >
                <CheckIcon className="size-4" />
                <span className="sr-only">Project saved</span>
            </span>
        )
    }

    const message = saveStatus === SAVE_STATUS_PENDING
        ? "Waiting to save project"
        : "Saving project"

    return (
        <span
            className="inline-flex items-center px-1 text-base-content/70"
            role="status"
            title={message}
        >
            <span className="loading loading-spinner loading-xs" />
            <span className="sr-only">{message}</span>
        </span>
    )
}
