import { XMarkIcon } from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import { useCallback } from "react"
import { useDispatch } from "react-redux"
import { setSelectedIds } from "@shared/redux/timelineSlice"
import useDeleteSelection from "@shared/hooks/useDeleteSelection"

export default function ClipDeleteButton({ animId }) {
    const dispatch = useDispatch()
    const { handleDelete, isSupportedRow } = useDeleteSelection()

    const onClick = useCallback(e => {
        e.stopPropagation()
        // Ensure THIS clip is the selection target before deleting
        dispatch(setSelectedIds([animId]))
        // Defer one tick so the new selection is committed before handleDelete reads it
        setTimeout(handleDelete, 0)
    }, [animId, dispatch, handleDelete])

    if (!isSupportedRow) return null

    return (
        <button
            type="button"
            title="Delete this clip (Del)"
            onClick={onClick}
            onMouseDown={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            className="absolute top-1 right-7 z-30 size-5 rounded-full bg-error text-error-content shadow-md flex items-center justify-center hover:scale-110 hover:bg-error/90 transition-transform pointer-events-auto"
        >
            <XMarkIcon className="size-3.5" />
        </button>
    )
}

ClipDeleteButton.propTypes = {
    animId: PropTypes.string.isRequired,
}
