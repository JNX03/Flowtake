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
    useSelector,
    useStore
} from "react-redux"
import { ActionCreators } from "redux-undo"
import {
    AUDIO_TRACKS,
    CLIPS,
    MASKS,
    OVERLAY_TRACKS,
    SUBTITLES,
    canSplit,
} from "@shared/helpers"
import {
    getGroup,
    withGroup
} from "@shared/redux/actionEnhancers"
import {
    removeClip,
    selectClipById,
    upsertClips
} from "@shared/redux/clipSlice"
import {
    selectAreHotkeysEnabled,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import {
    removeSubtitle,
    addSubtitle,
    updateSubtitle
} from "@shared/redux/subtitleSlice"
import {
    selectSelectedIds,
    selectSelectedRow,
    selectTime,
    setSelectedIds
} from "@shared/redux/timelineSlice"
import {
    removeAudioClip,
    addAudioClip,
    updateAudioClip
} from "@shared/redux/audioTrackSlice"
import {
    removeOverlay,
    addOverlay,
    updateOverlay
} from "@shared/redux/overlaySlice"
import {
    removeMask,
    addMask,
    updateMask
} from "@shared/redux/maskSlice"
import { selectAll } from "@shared/redux/animsAdapter"
import AddTrackButton from "./AddTrackButton"

const SLICE_MAP = {
    [CLIPS]: "clipAnims",
    [SUBTITLES]: "subtitleAnims",
    [AUDIO_TRACKS]: "audioTrackAnims",
    [OVERLAY_TRACKS]: "overlayAnims",
    [MASKS]: "maskAnims",
}

function getEntity(state, row, id) {
    const sliceName = SLICE_MAP[row]
    if (!sliceName) return null
    return state.undoableState.present[sliceName]?.entities?.[id] ?? null
}

function getAllEntities(state, row) {
    const sliceName = SLICE_MAP[row]
    if (!sliceName) return []
    return selectAll(state.undoableState.present[sliceName])
}

function getIdPrefix(row) {
    switch (row) {
        case CLIPS: return "clip"
        case SUBTITLES: return "subtitle"
        case AUDIO_TRACKS: return "audio"
        case OVERLAY_TRACKS: return "overlay"
        case MASKS: return "mask"
        default: return "entity"
    }
}

export default function TimelineToolbar() {

    const dispatch = useDispatch()
    const store = useStore()

    const selectedIds = useSelector(selectSelectedIds)
    const selectedRow = useSelector(selectSelectedRow)
    const isPlaying = useSelector(selectIsPlaying)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const time = useSelector(selectTime)
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
                case MASKS: dispatch(removeMask(id)); break
            }
        })
        dispatch(setSelectedIds([]))
    }, [dispatch, hasSelection, isPlaying, selectedIds, selectedRow])

    const handleSplit = useCallback(() => {
        if (!hasSelection || isPlaying) return
        const state = store.getState()
        const group = getGroup("split")
        const newIds = []

        selectedIds.forEach(id => {
            const entity = getEntity(state, selectedRow, id)
            if (!entity || !canSplit(entity, time)) return

            const newId = `${getIdPrefix(selectedRow)}-${crypto.randomUUID()}`
            const newEntity = { ...entity, id: newId, start: time }
            newIds.push(newId)

            switch (selectedRow) {
                case CLIPS:
                    dispatch(withGroup(upsertClips([
                        { id: entity.id, end: time },
                        newEntity
                    ]), group))
                    break
                case SUBTITLES:
                    dispatch(withGroup(updateSubtitle({ id: entity.id, changes: { end: time } }), group))
                    dispatch(withGroup(addSubtitle(newEntity), group))
                    break
                case AUDIO_TRACKS:
                    dispatch(withGroup(updateAudioClip({ id: entity.id, changes: { end: time } }), group))
                    dispatch(withGroup(addAudioClip(newEntity), group))
                    break
                case OVERLAY_TRACKS:
                    dispatch(withGroup(updateOverlay({ id: entity.id, changes: { end: time } }), group))
                    dispatch(withGroup(addOverlay(newEntity), group))
                    break
                case MASKS:
                    dispatch(withGroup(updateMask({ id: entity.id, changes: { end: time } }), group))
                    dispatch(withGroup(addMask(newEntity), group))
                    break
            }
        })

        dispatch(setSelectedIds(newIds.length > 0 ? newIds : []))
    }, [dispatch, store, hasSelection, isPlaying, selectedIds, selectedRow, time])

    const handleDuplicate = useCallback(() => {
        if (!hasSelection || isPlaying) return
        const state = store.getState()
        const group = getGroup("duplicate")
        const newIds = []
        const allEntities = getAllEntities(state, selectedRow)

        selectedIds.forEach(id => {
            const entity = getEntity(state, selectedRow, id)
            if (!entity) return

            const duration = entity.end - entity.start
            const newStart = entity.end
            const newEnd = newStart + duration

            // Check for overlap with existing entities
            const hasOverlap = allEntities.some(e =>
                e.id !== entity.id && e.start < newEnd && e.end > newStart
            )
            if (hasOverlap) return

            const newId = `${getIdPrefix(selectedRow)}-${crypto.randomUUID()}`
            const newEntity = { ...entity, id: newId, start: newStart, end: newEnd }
            newIds.push(newId)

            switch (selectedRow) {
                case CLIPS:
                    dispatch(withGroup(upsertClips([newEntity]), group))
                    break
                case SUBTITLES:
                    dispatch(withGroup(addSubtitle(newEntity), group))
                    break
                case AUDIO_TRACKS:
                    dispatch(withGroup(addAudioClip(newEntity), group))
                    break
                case OVERLAY_TRACKS:
                    dispatch(withGroup(addOverlay(newEntity), group))
                    break
                case MASKS:
                    dispatch(withGroup(addMask(newEntity), group))
                    break
            }
        })

        dispatch(setSelectedIds(newIds.length > 0 ? newIds : []))
    }, [dispatch, store, hasSelection, isPlaying, selectedIds, selectedRow])

    useHotkeys('delete', handleDelete, { enabled: areHotkeysEnabled && hasSelection && !isPlaying }, [handleDelete])
    useHotkeys('backspace', handleDelete, { enabled: areHotkeysEnabled && hasSelection && !isPlaying }, [handleDelete])
    useHotkeys('s', handleSplit, { enabled: areHotkeysEnabled && hasSelection && !isPlaying }, [handleSplit])
    useHotkeys('mod+d', handleDuplicate, { enabled: areHotkeysEnabled && hasSelection && !isPlaying, preventDefault: true }, [handleDuplicate])

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
            <button onClick={handleSplit}
                className="btn btn-ghost btn-xs btn-square tooltip tooltip-bottom"
                data-tip="Split (S)" disabled={!hasSelection || isPlaying}>
                <ScissorsIcon className="size-3.5" />
            </button>
            <button onClick={handleDelete}
                className="btn btn-ghost btn-xs btn-square tooltip tooltip-bottom"
                data-tip="Delete (Del)" disabled={!hasSelection || isPlaying}>
                <TrashIcon className="size-3.5" />
            </button>
            <button onClick={handleDuplicate}
                className="btn btn-ghost btn-xs btn-square tooltip tooltip-bottom"
                data-tip="Duplicate (Ctrl+D)" disabled={!hasSelection || isPlaying}>
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
