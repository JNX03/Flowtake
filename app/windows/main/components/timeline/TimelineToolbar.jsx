import {
    DocumentDuplicateIcon,
    EllipsisHorizontalIcon,
    ForwardIcon,
    LinkIcon,
    LinkSlashIcon,
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
    MapPinIcon,
    PauseIcon,
    ScissorsIcon,
    TrashIcon,
    ViewfinderCircleIcon
} from "@heroicons/react/16/solid"
import {
    ArrowsRightLeftIcon,
    Bars3BottomLeftIcon,
    Bars3BottomRightIcon,
    Bars4Icon,
    ClipboardDocumentCheckIcon,
    ClipboardDocumentIcon,
    MapIcon
} from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import { useCallback, useState } from "react"
import {
    useDispatch,
    useSelector,
    useStore
} from "react-redux"
import {
    APP_SCENES,
    CLIPS,
    canSplit,
} from "@shared/helpers"
import {
    copyEditorSelection,
    deleteEditorSelection,
    duplicateEditorSelection,
    getEditorClipboard,
    isEditorCommandRow,
    pasteEditorClipboard,
    retainLeftEditorSelection,
    retainRightEditorSelection,
    splitEditorSelection,
} from "@shared/editor/editorCommands"
import {
    EDITOR_SHORTCUT_IDS,
    formatShortcut,
} from "@shared/editor/shortcutRegistry"
import {
    useEditorHotkey,
    useEditorShortcutBindings,
} from "@shared/editor/useEditorShortcuts"
import {
    getGroup,
    withGroup
} from "@shared/redux/actionEnhancers"
import {
    selectClipById,
    upsertClips
} from "@shared/redux/clipSlice"
import {
    selectAreHotkeysEnabled,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import { selectActiveScene } from "@shared/redux/sceneSlice"
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
    setOpenSection,
    setPxPerMs,
    setSelectedIds,
    setSelectedRow
} from "@shared/redux/timelineSlice"

function closeTimelineMenu(event) {
    event.currentTarget.closest("details")?.removeAttribute("open")
}

export default function TimelineToolbar({
    zoomSteps,
    onFitToView,
    isFollowingPlayback,
    onToggleFollow,
    isOverviewOpen,
    onToggleOverview,
}) {

    const dispatch = useDispatch()
    const store = useStore()

    const selectedIds = useSelector(selectSelectedIds)
    const selectedRow = useSelector(selectSelectedRow)
    const isPlaying = useSelector(selectIsPlaying)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const pxPerMs = useSelector(selectPxPerMs)
    const isSnappingEnabled = useSelector(selectIsSnappingEnabled)
    const isMaskingModeEnabled = useSelector(selectIsMaskingModeEnabled)
    const editingMode = useSelector(selectEditingMode)
    const activeScene = useSelector(selectActiveScene)
    const shortcutBindings = useEditorShortcutBindings()
    const hasSelection = selectedIds.length > 0
    const canEditSelection = hasSelection && isEditorCommandRow(selectedRow)
    const [hasClipboard, setHasClipboard] = useState(() => Boolean(getEditorClipboard()))

    const handleDelete = useCallback(() => {
        if (!canEditSelection || isPlaying) return
        dispatch(deleteEditorSelection())
    }, [canEditSelection, dispatch, isPlaying])

    const handleSplit = useCallback(() => {
        if (!canEditSelection || isPlaying) return
        dispatch(splitEditorSelection())
    }, [canEditSelection, dispatch, isPlaying])

    const handleTrimLeft = useCallback(() => {
        if (!canEditSelection || isPlaying) return
        dispatch(retainRightEditorSelection())
    }, [canEditSelection, dispatch, isPlaying])

    const handleTrimRight = useCallback(() => {
        if (!canEditSelection || isPlaying) return
        dispatch(retainLeftEditorSelection())
    }, [canEditSelection, dispatch, isPlaying])

    const handleDuplicate = useCallback(() => {
        if (!canEditSelection || isPlaying) return
        dispatch(duplicateEditorSelection())
    }, [canEditSelection, dispatch, isPlaying])

    const handleCopy = useCallback(() => {
        if (!canEditSelection || isPlaying) return
        const result = dispatch(copyEditorSelection())
        if (result?.ok) setHasClipboard(true)
    }, [canEditSelection, dispatch, isPlaying])

    const handlePaste = useCallback(() => {
        if (!hasClipboard || isPlaying) return
        dispatch(pasteEditorClipboard())
    }, [dispatch, hasClipboard, isPlaying])

    const handleOpenSpeed = useCallback(() => {
        if (!hasSelection || selectedRow !== CLIPS) return
        dispatch(setOpenSection(CLIPS))
        requestAnimationFrame(() => {
            document.getElementById("clip-speed-control")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            })
        })
    }, [dispatch, hasSelection, selectedRow])

    // Freeze frame: split at playhead and set playbackRate=0 on new clip
    const handleFreezeFrame = useCallback(() => {
        if (!hasSelection || isPlaying || selectedRow !== CLIPS) return
        const state = store.getState()
        const time = selectTime(state)
        const group = getGroup("freeze")

        selectedIds.forEach(id => {
            const entity = selectClipById(state, id)
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
    }, [dispatch, store, hasSelection, isPlaying, selectedIds, selectedRow])

    // Zoom slider
    const zoomIndex = zoomSteps ? zoomSteps.findIndex(step => step >= pxPerMs) : 0
    const handleZoomChange = useCallback(e => {
        const idx = Number(e.target.value)
        if (zoomSteps?.[idx] != null) dispatch(setPxPerMs(zoomSteps[idx]))
    }, [dispatch, zoomSteps])
    const handleZoomStep = useCallback(direction => {
        if (!zoomSteps?.length) return
        const currentIndex = Math.max(0, zoomSteps.findIndex(step => step >= pxPerMs))
        const nextIndex = Math.max(0, Math.min(zoomSteps.length - 1, currentIndex + direction))
        dispatch(setPxPerMs(zoomSteps[nextIndex]))
    }, [dispatch, pxPerMs, zoomSteps])

    // Toggles
    const handleToggleSnap = useCallback(() => dispatch(setIsSnappingEnabled(!isSnappingEnabled)), [dispatch, isSnappingEnabled])
    const handleToggleRipple = useCallback(() => dispatch(setEditingMode(editingMode === "normal" ? "ripple" : "normal")), [dispatch, editingMode])
    const handleToggleMasking = useCallback(() => {
        dispatch(setSelectedIds([]))
        dispatch(setIsMaskingModeEnabled(!isMaskingModeEnabled))
        dispatch(setSelectedRow(null))
    }, [dispatch, isMaskingModeEnabled])
    const handleOpenScene = useCallback(() => {
        dispatch(setSelectedIds([]))
        dispatch(setSelectedRow(null))
        dispatch(setOpenSection(APP_SCENES))
    }, [dispatch])

    useEditorHotkey(EDITOR_SHORTCUT_IDS.DELETE, handleDelete, {
        enabled: areHotkeysEnabled && canEditSelection && !isPlaying,
    }, [handleDelete])
    useEditorHotkey(EDITOR_SHORTCUT_IDS.SPLIT, handleSplit, {
        enabled: areHotkeysEnabled && canEditSelection && !isPlaying,
    }, [handleSplit])
    useEditorHotkey(EDITOR_SHORTCUT_IDS.TRIM_START, handleTrimLeft, {
        enabled: areHotkeysEnabled && canEditSelection && !isPlaying,
    }, [handleTrimLeft])
    useEditorHotkey(EDITOR_SHORTCUT_IDS.TRIM_END, handleTrimRight, {
        enabled: areHotkeysEnabled && canEditSelection && !isPlaying,
    }, [handleTrimRight])
    useEditorHotkey(EDITOR_SHORTCUT_IDS.COPY, handleCopy, {
        enabled: areHotkeysEnabled && canEditSelection && !isPlaying,
        preventDefault: true,
    }, [handleCopy])
    useEditorHotkey(EDITOR_SHORTCUT_IDS.PASTE, handlePaste, {
        enabled: areHotkeysEnabled && hasClipboard && !isPlaying,
        preventDefault: true,
    }, [handlePaste])
    useEditorHotkey(EDITOR_SHORTCUT_IDS.DUPLICATE, handleDuplicate, {
        enabled: areHotkeysEnabled && canEditSelection && !isPlaying,
        preventDefault: true,
    }, [handleDuplicate])

    const shortcutLabel = actionId => (shortcutBindings[actionId] || [])
        .map(binding => formatShortcut(binding))
        .join(" / ") || "Unassigned"

    const toolButtonClass = "btn btn-ghost btn-xs h-8 min-h-8 w-8 shrink-0 p-0 tooltip tooltip-bottom"
    const menuItemClass = "flex min-h-8 items-center gap-2 text-xs"

    return (
        <div className="flowtake-timeline-toolbar relative flex h-10 shrink-0 items-center gap-1 border-b border-base-content/10 px-2">
            <div className="flex min-w-0 shrink-0 items-center gap-0.5">
                <button type="button" onClick={handleSplit}
                    className={toolButtonClass}
                    data-tip={'Split (' + shortcutLabel(EDITOR_SHORTCUT_IDS.SPLIT) + ')'}
                    aria-label="Split selection at playhead"
                    disabled={!canEditSelection || isPlaying}>
                    <ScissorsIcon className="size-3.5" />
                </button>
                <button type="button" onClick={handleTrimLeft}
                    className={`${toolButtonClass} hidden lg:inline-flex`}
                    data-tip={'Trim start (' + shortcutLabel(EDITOR_SHORTCUT_IDS.TRIM_START) + ')'}
                    aria-label="Trim selection start to playhead"
                    disabled={!canEditSelection || isPlaying}>
                    <Bars3BottomRightIcon className="size-3.5" />
                </button>
                <button type="button" onClick={handleTrimRight}
                    className={`${toolButtonClass} hidden lg:inline-flex`}
                    data-tip={'Trim end (' + shortcutLabel(EDITOR_SHORTCUT_IDS.TRIM_END) + ')'}
                    aria-label="Trim selection end to playhead"
                    disabled={!canEditSelection || isPlaying}>
                    <Bars3BottomLeftIcon className="size-3.5" />
                </button>
                <button type="button" onClick={handleDuplicate}
                    className={toolButtonClass}
                    data-tip={'Duplicate (' + shortcutLabel(EDITOR_SHORTCUT_IDS.DUPLICATE) + ')'}
                    aria-label="Duplicate selection"
                    disabled={!canEditSelection || isPlaying}>
                    <DocumentDuplicateIcon className="size-3.5" />
                </button>
                <button type="button" onClick={handleDelete}
                    className={`${toolButtonClass} hover:text-error`}
                    data-tip={'Delete (' + shortcutLabel(EDITOR_SHORTCUT_IDS.DELETE) + ')'}
                    aria-label="Delete selection"
                    disabled={!canEditSelection || isPlaying}>
                    <TrashIcon className="size-3.5" />
                </button>

                <details className="dropdown relative shrink-0">
                    <summary
                        className={`${toolButtonClass} list-none [&::-webkit-details-marker]:hidden`}
                        aria-label="More timeline actions"
                        title="More timeline actions"
                    >
                        <EllipsisHorizontalIcon className="size-4" />
                    </summary>
                    <ul className="dropdown-content menu menu-sm z-[90] mt-1 w-56 rounded-lg border border-base-content/10 bg-base-100 p-1.5 shadow-xl">
                        <li className="lg:hidden">
                            <button type="button" className={menuItemClass}
                                onClick={event => { handleTrimLeft(); closeTimelineMenu(event) }}
                                disabled={!canEditSelection || isPlaying}>
                                <Bars3BottomRightIcon className="size-3.5" />
                                <span className="flex-1">Trim start</span>
                                <kbd className="kbd kbd-xs">{shortcutLabel(EDITOR_SHORTCUT_IDS.TRIM_START)}</kbd>
                            </button>
                        </li>
                        <li className="lg:hidden">
                            <button type="button" className={menuItemClass}
                                onClick={event => { handleTrimRight(); closeTimelineMenu(event) }}
                                disabled={!canEditSelection || isPlaying}>
                                <Bars3BottomLeftIcon className="size-3.5" />
                                <span className="flex-1">Trim end</span>
                                <kbd className="kbd kbd-xs">{shortcutLabel(EDITOR_SHORTCUT_IDS.TRIM_END)}</kbd>
                            </button>
                        </li>
                        <li>
                            <button type="button" className={menuItemClass}
                                onClick={event => { handleCopy(); closeTimelineMenu(event) }}
                                disabled={!canEditSelection || isPlaying}>
                                <ClipboardDocumentIcon className="size-3.5" />
                                <span className="flex-1">Copy</span>
                                <kbd className="kbd kbd-xs">{shortcutLabel(EDITOR_SHORTCUT_IDS.COPY)}</kbd>
                            </button>
                        </li>
                        <li>
                            <button type="button" className={menuItemClass}
                                onClick={event => { handlePaste(); closeTimelineMenu(event) }}
                                aria-label="Paste at playhead"
                                disabled={!hasClipboard || isPlaying}>
                                <ClipboardDocumentCheckIcon className="size-3.5" />
                                <span className="flex-1">Paste at playhead</span>
                                <kbd className="kbd kbd-xs">{shortcutLabel(EDITOR_SHORTCUT_IDS.PASTE)}</kbd>
                            </button>
                        </li>
                        <li>
                            <button type="button" className={menuItemClass}
                                onClick={event => { handleFreezeFrame(); closeTimelineMenu(event) }}
                                disabled={!hasSelection || isPlaying || selectedRow !== CLIPS}>
                                <PauseIcon className="size-3.5" />
                                <span>Freeze frame</span>
                            </button>
                        </li>
                        <li>
                            <button type="button" className={menuItemClass}
                                onClick={event => { handleOpenSpeed(); closeTimelineMenu(event) }}
                                disabled={!hasSelection || selectedRow !== CLIPS}>
                                <ForwardIcon className="size-3.5" />
                                <span>Speed controls</span>
                            </button>
                        </li>
                        <li>
                            <button type="button" className={menuItemClass}
                                onClick={event => { handleToggleMasking(); closeTimelineMenu(event) }}
                                aria-pressed={isMaskingModeEnabled}>
                                <Bars4Icon className="size-3.5" />
                                <span className="flex-1">Mask lanes</span>
                                <span className={`badge badge-xs ${isMaskingModeEnabled ? "badge-info" : "badge-ghost"}`}>
                                    {isMaskingModeEnabled ? "On" : "Off"}
                                </span>
                            </button>
                        </li>
                    </ul>
                </details>
            </div>

            <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 min-[1120px]:flex">
                <button
                    type="button"
                    onClick={handleOpenScene}
                    className="pointer-events-auto flex h-8 items-center gap-2 rounded-md border border-base-content/10 bg-base-200/35 px-3 text-[11px] font-medium text-base-content/80 transition hover:bg-base-content/5 hover:text-base-content"
                    aria-label={`Open ${activeScene?.name || "Main scene"}`}
                    title="Open scene controls"
                >
                    <span className="max-w-28 truncate">{activeScene?.name || "Main scene"}</span>
                    <Bars4Icon className="size-3.5 opacity-55" />
                </button>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <button type="button"
                    className={`${toolButtonClass} ${isSnappingEnabled ? "bg-info/15 text-info" : ""}`}
                    data-tip={isSnappingEnabled ? "Snapping on" : "Snapping off"}
                    aria-label="Toggle timeline snapping"
                    aria-pressed={isSnappingEnabled}
                    onClick={handleToggleSnap}
                    disabled={isPlaying}>
                    {isSnappingEnabled ? <LinkIcon className="size-3.5" /> : <LinkSlashIcon className="size-3.5" />}
                </button>
                <button type="button"
                    className={`${toolButtonClass} ${editingMode === "ripple" ? "bg-warning/15 text-warning" : ""}`}
                    data-tip={editingMode === "ripple" ? "Ripple editing on" : "Ripple editing off"}
                    aria-label="Toggle ripple editing"
                    aria-pressed={editingMode === "ripple"}
                    onClick={handleToggleRipple}
                    disabled={isPlaying}>
                    <ArrowsRightLeftIcon className="size-3.5" />
                </button>
                <button type="button"
                    className={`${toolButtonClass} ${isFollowingPlayback ? "bg-info/15 text-info" : ""}`}
                    data-tip={isFollowingPlayback ? "Following playhead" : "Follow playhead"}
                    aria-label="Follow playhead"
                    aria-pressed={isFollowingPlayback}
                    onClick={onToggleFollow}>
                    <MapPinIcon className="size-3.5" />
                </button>
                <button type="button"
                    className={`${toolButtonClass} ${isOverviewOpen ? "bg-info/15 text-info" : ""}`}
                    data-tip={isOverviewOpen ? "Hide timeline overview" : "Show timeline overview"}
                    aria-label="Toggle timeline overview"
                    aria-pressed={isOverviewOpen}
                    onClick={onToggleOverview}>
                    <MapIcon className="size-3.5" />
                </button>

                <div className="mx-1 hidden h-5 w-px bg-base-content/10 sm:block" />

                <button type="button" className={toolButtonClass} data-tip="Fit timeline"
                    aria-label="Fit timeline to view" onClick={onFitToView}>
                    <ViewfinderCircleIcon className="size-3.5" />
                </button>
                <button type="button" className={toolButtonClass} data-tip="Zoom out"
                    aria-label="Zoom timeline out" onClick={() => handleZoomStep(-1)}>
                    <MagnifyingGlassMinusIcon className="size-3.5" />
                </button>
                {zoomSteps && (
                    <input type="range" className="range range-xs hidden w-20 md:block"
                        aria-label="Timeline zoom"
                        min={0} max={zoomSteps.length - 1} step={1}
                        value={zoomIndex >= 0 ? zoomIndex : 0}
                        onChange={handleZoomChange} />
                )}
                <button type="button" className={toolButtonClass} data-tip="Zoom in"
                    aria-label="Zoom timeline in" onClick={() => handleZoomStep(1)}>
                    <MagnifyingGlassPlusIcon className="size-3.5" />
                </button>
            </div>
        </div>
    )
}

TimelineToolbar.propTypes = {
    zoomSteps: PropTypes.arrayOf(PropTypes.number),
    onFitToView: PropTypes.func.isRequired,
    isFollowingPlayback: PropTypes.bool.isRequired,
    onToggleFollow: PropTypes.func.isRequired,
    isOverviewOpen: PropTypes.bool.isRequired,
    onToggleOverview: PropTypes.func.isRequired,
}
