import {
    DocumentDuplicateIcon,
    ScissorsIcon,
    TrashIcon
} from "@heroicons/react/16/solid"
import {
    ArrowUturnLeftIcon,
    ArrowUturnRightIcon
} from "@heroicons/react/16/solid"
import { useCallback } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { ActionCreators } from "redux-undo"
import {
    AUDIO_TRACKS,
    CLIPS,
    OVERLAY_TRACKS,
    SUBTITLES,
} from "../../../../src/helpers"
import { removeClip } from "../../../../src/redux/clipSlice"
import {
    selectAreHotkeysEnabled,
    selectIsPlaying
} from "../../../../src/redux/editorSlice"
import { removeSubtitle } from "../../../../src/redux/subtitleSlice"
import {
    selectSelectedIds,
    selectSelectedRow,
    setSelectedIds
} from "../../../../src/redux/timelineSlice"
import { removeAudioClip } from "../../../../src/redux/audioTrackSlice"
import { removeOverlay } from "../../../../src/redux/overlaySlice"
import AddTrackButton from "./AddTrackButton"

export default function TimelineToolbar() {

    const dispatch = useDispatch()

    const selectedIds = useSelector(selectSelectedIds)
    const selectedRow = useSelector(selectSelectedRow)
    const isPlaying = useSelector(selectIsPlaying)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const hasSelection = selectedIds.length > 0

    const handleUndo = useCallback(() => dispatch(ActionCreators.undo()), [dispatch])
    const handleRedo = useCallback(() => dispatch(ActionCreators.redo()), [dispatch])

    const handleDelete = useCallback(() => {
        if (!hasSelection || isPlaying) return
        selectedIds.forEach(id => {
            switch (selectedRow) {
                case CLIPS: dispatch(removeClip(id)); break
                case SUBTITLES: dispatch(removeSubtitle(id)); break
                case AUDIO_TRACKS: dispatch(removeAudioClip(id)); break
                case OVERLAY_TRACKS: dispatch(removeOverlay(id)); break
            }
        })
        dispatch(setSelectedIds([]))
    }, [dispatch, hasSelection, isPlaying, selectedIds, selectedRow])

    useHotkeys('delete', handleDelete, { enabled: areHotkeysEnabled && hasSelection && !isPlaying }, [handleDelete])
    useHotkeys('backspace', handleDelete, { enabled: areHotkeysEnabled && hasSelection && !isPlaying }, [handleDelete])

    return (
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-base-content/10 shrink-0">
            {/* Undo / Redo */}
            <button onClick={handleUndo}
                className="btn btn-ghost btn-xs btn-square tooltip tooltip-bottom" data-tip="Undo">
                <ArrowUturnLeftIcon className="size-3.5" />
            </button>
            <button onClick={handleRedo}
                className="btn btn-ghost btn-xs btn-square tooltip tooltip-bottom" data-tip="Redo">
                <ArrowUturnRightIcon className="size-3.5" />
            </button>

            <div className="w-px h-4 bg-base-content/10 mx-1" />

            {/* Editing tools */}
            <button className="btn btn-ghost btn-xs btn-square tooltip tooltip-bottom"
                data-tip="Split (S)" disabled={!hasSelection || isPlaying}>
                <ScissorsIcon className="size-3.5" />
            </button>
            <button onClick={handleDelete}
                className="btn btn-ghost btn-xs btn-square tooltip tooltip-bottom"
                data-tip="Delete (Del)" disabled={!hasSelection || isPlaying}>
                <TrashIcon className="size-3.5" />
            </button>
            <button className="btn btn-ghost btn-xs btn-square tooltip tooltip-bottom"
                data-tip="Duplicate" disabled={!hasSelection || isPlaying}>
                <DocumentDuplicateIcon className="size-3.5" />
            </button>

            <div className="flex-1" />

            {/* Selection info */}
            {hasSelection && (
                <span className="text-[10px] opacity-30 mr-2">
                    {selectedIds.length} selected
                </span>
            )}

            {/* Add track - visible on small screens where left panel is hidden */}
            <div className="lg:hidden">
                <AddTrackButton />
            </div>
        </div>
    )
}
