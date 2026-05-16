import {
    ArrowUturnLeftIcon,
    ArrowUturnRightIcon,
    DocumentDuplicateIcon,
    ForwardIcon,
    LinkIcon,
    LinkSlashIcon,
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
    PauseIcon,
    ScissorsIcon,
    TrashIcon,
    ViewfinderCircleIcon
} from "@heroicons/react/16/solid"
import { Bars4Icon } from "@heroicons/react/24/outline"
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
    selectDuration,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import {
    removeSubtitle,
    addSubtitle,
    updateSubtitle
} from "@shared/redux/subtitleSlice"
import {
    selectEditingMode,
    selectIsMaskingModeEnabled,
    selectIsSnappingEnabled,
    selectPxPerMs,
    selectSelectedIds,
    selectSelectedRow,
    selectTime,
    setEditingMode,
    setIsMaskingModeEnabled,
    setIsSnappingEnabled,
    setPxPerMs,
    setSelectedIds,
    setSelectedRow
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

function formatTimecode(ms) {
    if (ms == null || isNaN(ms)) return "00:00.00"
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const centiseconds = Math.floor((ms % 1000) / 10)
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`
}

export default function TimelineToolbar({ zoomSteps, onFitToView }) {

    const dispatch = useDispatch()
    const store = useStore()

    const selectedIds = useSelector(selectSelectedIds)
    const selectedRow = useSelector(selectSelectedRow)
    const isPlaying = useSelector(selectIsPlaying)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)
    const pxPerMs = useSelector(selectPxPerMs)
    const isSnappingEnabled = useSelector(selectIsSnappingEnabled)
    const isMaskingModeEnabled = useSelector(selectIsMaskingModeEnabled)
    const editingMode = useSelector(selectEditingMode)
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

    // Freeze frame: split at playhead and set playbackRate=0 on new clip
    const handleFreezeFrame = useCallback(() => {
        if (!hasSelection || isPlaying || selectedRow !== CLIPS) return
        const state = store.getState()
        const group = getGroup("freeze")

        selectedIds.forEach(id => {
            const entity = getEntity(state, selectedRow, id)
            if (!entity || !canSplit(entity, time)) return

            const newId = `clip-${crypto.randomUUID()}`
            const freezeEnd = Math.min(time + 2000, entity.end)
            const afterId = `clip-${crypto.randomUUID()}`

            dispatch(withGroup(upsertClips([
                { id: entity.id, end: time },
                { ...entity, id: newId, start: time, end: freezeEnd, playbackRate: 0 },
                { ...entity, id: afterId, start: freezeEnd, end: entity.end }
            ]), group))
        })
    }, [dispatch, store, hasSelection, isPlaying, selectedIds, selectedRow, time])

    // Zoom slider
    const zoomIndex = zoomSteps ? zoomSteps.findIndex(step => step >= pxPerMs) : 0
    const handleZoomChange = useCallback(e => {
        const idx = Number(e.target.value)
        if (zoomSteps?.[idx] != null) dispatch(setPxPerMs(zoomSteps[idx]))
    }, [dispatch, zoomSteps])

    // Toggles
    const handleToggleSnap = useCallback(() => dispatch(setIsSnappingEnabled(!isSnappingEnabled)), [dispatch, isSnappingEnabled])
    const handleToggleRipple = useCallback(() => dispatch(setEditingMode(editingMode === "normal" ? "ripple" : "normal")), [dispatch, editingMode])
    const handleToggleMasking = useCallback(() => {
        dispatch(setSelectedIds([]))
        dispatch(setIsMaskingModeEnabled(!isMaskingModeEnabled))
        dispatch(setSelectedRow(null))
    }, [dispatch, isMaskingModeEnabled])

    useHotkeys('delete', handleDelete, { enabled: areHotkeysEnabled && hasSelection && !isPlaying }, [handleDelete])
    useHotkeys('backspace', handleDelete, { enabled: areHotkeysEnabled && hasSelection && !isPlaying }, [handleDelete])
    useHotkeys('s', handleSplit, { enabled: areHotkeysEnabled && hasSelection && !isPlaying }, [handleSplit])
    useHotkeys('mod+d', handleDuplicate, { enabled: areHotkeysEnabled && hasSelection && !isPlaying, preventDefault: true }, [handleDuplicate])

    return (
        <div className="flowtake-timeline-toolbar flex items-center gap-0.5 px-2 py-1.5 border-b border-base-content/10 shrink-0">
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

            <div className="w-px h-4 bg-base-content/10 mx-1" />

            {/* Extended tools */}
            <button onClick={handleFreezeFrame}
                className="btn btn-ghost btn-xs btn-square tooltip tooltip-bottom"
                data-tip="Freeze Frame" disabled={!hasSelection || isPlaying || selectedRow !== CLIPS}>
                <PauseIcon className="size-3.5" />
            </button>
            <button onClick={() => {/* Speed control - just a visual shortcut hint */}}
                className="btn btn-ghost btn-xs btn-square tooltip tooltip-bottom"
                data-tip="Speed (select clip)" disabled={!hasSelection || selectedRow !== CLIPS}>
                <ForwardIcon className="size-3.5" />
            </button>

            {/* Time display - center */}
            <div className="flex-1 flex justify-center">
                <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-md bg-base-200/60">
                    <span className="text-xs font-mono tracking-tight opacity-90" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatTimecode(time)}
                    </span>
                    <span className="text-[10px] opacity-30">/</span>
                    <span className="text-[10px] font-mono tracking-tight opacity-50" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatTimecode(duration)}
                    </span>
                </div>
            </div>

            {/* Selection info + keyboard hints */}
            {hasSelection && (
                <div className="flex items-center gap-2 mr-2 text-[10px] opacity-60">
                    <span className="font-medium">{selectedIds.length} selected</span>
                    <span className="opacity-40">·</span>
                    <span className="flex items-center gap-1">
                        <kbd className="kbd kbd-xs">Del</kbd> remove
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="kbd kbd-xs">S</kbd> split
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="kbd kbd-xs">Ctrl</kbd>+<kbd className="kbd kbd-xs">D</kbd> copy
                    </span>
                </div>
            )}

            {/* Toggle buttons */}
            <button className={`btn btn-xs btn-square ${isSnappingEnabled ? "btn-info" : "btn-ghost"} tooltip tooltip-bottom`}
                data-tip={isSnappingEnabled ? "Snap on" : "Snap off"}
                onClick={handleToggleSnap} disabled={isPlaying}>
                {isSnappingEnabled ? <LinkSlashIcon className="size-3.5" /> : <LinkIcon className="size-3.5" />}
            </button>
            <button className={`btn btn-xs btn-square ${isMaskingModeEnabled ? "btn-info" : "btn-ghost"} tooltip tooltip-bottom`}
                data-tip={isMaskingModeEnabled ? "Masking on" : "Masking off"}
                onClick={handleToggleMasking}>
                <Bars4Icon className="size-3.5" />
            </button>
            <button className={`btn btn-xs btn-square ${editingMode === "ripple" ? "btn-warning" : "btn-ghost"} tooltip tooltip-bottom`}
                data-tip={editingMode === "ripple" ? "Ripple on" : "Ripple off"}
                onClick={handleToggleRipple} disabled={isPlaying}>
                <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 8h3l2-4 2 8 2-4h3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            <div className="w-px h-4 bg-base-content/10 mx-1" />

            {/* Zoom controls */}
            <button className="btn btn-ghost btn-xs btn-square tooltip tooltip-bottom" data-tip="Fit"
                onClick={onFitToView}>
                <ViewfinderCircleIcon className="size-3.5" />
            </button>
            <MagnifyingGlassMinusIcon className="size-3 opacity-30 shrink-0" />
            {zoomSteps && (
                <input type="range" className="range range-xs w-20"
                    min={0} max={zoomSteps.length - 1} step={1}
                    value={zoomIndex >= 0 ? zoomIndex : 0}
                    onChange={handleZoomChange} />
            )}
            <MagnifyingGlassPlusIcon className="size-3 opacity-30 shrink-0" />

            {/* Add track - visible on small screens where left panel is hidden */}
            <div className="lg:hidden ml-1">
                <AddTrackButton />
            </div>
        </div>
    )
}
