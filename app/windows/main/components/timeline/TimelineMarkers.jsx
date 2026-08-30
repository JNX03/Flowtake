import {
    BookmarkIcon,
    PlusIcon,
    TrashIcon,
    XMarkIcon,
} from "@heroicons/react/16/solid"
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import PropTypes from "prop-types"
import {
    useDispatch,
    useSelector,
} from "react-redux"
import {
    formatBookmarkTime,
    resolveBookmarkDragTime,
} from "@shared/editor/timelineBookmarks"
import { msToPx, pxToMs } from "@shared/helpers"
import {
    DEFAULT_BOOKMARK_COLOR,
} from "@shared/editor/projectSchema"
import {
    addBookmark,
    createBookmarkId,
    removeBookmark,
    selectActiveSceneBookmarks,
    updateBookmark,
} from "@shared/redux/sceneSlice"
import {
    selectDuration,
    selectIsPlaying,
} from "@shared/redux/editorSlice"
import {
    selectIsSnappingEnabled,
    selectPxPerMs,
    selectSelectedBookmarkId,
    selectSnappingLines,
    selectTime,
    setActiveSnapLine,
    setSelectedBookmarkId,
    setSelectedIds,
    setSelectedRow,
    setTime,
} from "@shared/redux/timelineSlice"
import {
    getGroup,
    withGroup,
} from "@shared/redux/actionEnhancers"

const DRAG_THRESHOLD_PX = 3
const EDITOR_WIDTH = 260

function useAddBookmarkAtPlayhead() {
    const dispatch = useDispatch()
    const bookmarks = useSelector(selectActiveSceneBookmarks)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)
    const isPlaying = useSelector(selectIsPlaying)
    const canAdd = Number.isFinite(duration) && duration > 0 && !isPlaying

    const addBookmarkAtPlayhead = useCallback(event => {
        event?.stopPropagation()
        if (!canAdd) return
        const id = createBookmarkId()
        const markerTime = Math.round(Math.min(Math.max(time, 0), duration))
        dispatch(withGroup(addBookmark({
            bookmark: {
                id,
                time: markerTime,
                note: `Marker ${bookmarks.length + 1}`,
                color: DEFAULT_BOOKMARK_COLOR,
            },
            projectDuration: duration,
        }), getGroup("bookmark-add")))
        dispatch(setSelectedIds([]))
        dispatch(setSelectedRow(null))
        dispatch(setSelectedBookmarkId(id))
    }, [bookmarks.length, canAdd, dispatch, duration, time])

    return { addBookmarkAtPlayhead, canAdd }
}

export function TimelineMarkersHeader() {
    const { addBookmarkAtPlayhead, canAdd } = useAddBookmarkAtPlayhead()

    return (
        <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-base-content/8 px-2">
            <BookmarkIcon className="size-3 text-primary/70" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[9px] text-base-content/50">
                Markers
            </span>
            <button
                type="button"
                onClick={addBookmarkAtPlayhead}
                disabled={!canAdd}
                className="btn btn-ghost btn-xs h-6 min-h-6 w-6 p-0"
                aria-label="Add marker at playhead"
                title="Add marker at playhead"
            >
                <PlusIcon className="size-3.5" />
            </button>
        </div>
    )
}

export default function TimelineMarkers() {
    const dispatch = useDispatch()
    const rowRef = useRef(null)
    const bookmarks = useSelector(selectActiveSceneBookmarks)
    const selectedBookmarkId = useSelector(selectSelectedBookmarkId)
    const pxPerMs = useSelector(selectPxPerMs)
    const projectDuration = useSelector(selectDuration)
    const snappingLines = useSelector(selectSnappingLines)
    const playheadTime = useSelector(selectTime)
    const isSnappingEnabled = useSelector(selectIsSnappingEnabled)
    const isPlaying = useSelector(selectIsPlaying)
    const { addBookmarkAtPlayhead, canAdd } = useAddBookmarkAtPlayhead()
    const [editorViewport, setEditorViewport] = useState({
        minimum: 0,
        maximum: 0,
    })

    const sortedBookmarks = useMemo(
        () => [...bookmarks].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id)),
        [bookmarks]
    )
    const dragSnappingLines = useMemo(
        () => Number.isFinite(playheadTime)
            ? [...new Set([...snappingLines, playheadTime])]
            : snappingLines,
        [playheadTime, snappingLines]
    )
    const selectedBookmark = bookmarks.find(bookmark => bookmark.id === selectedBookmarkId)
    const timelineWidth = msToPx(projectDuration, pxPerMs)
    const editorLeft = selectedBookmark
        ? Math.min(
            Math.max(
                msToPx(selectedBookmark.time, pxPerMs) - 10,
                editorViewport.minimum
            ),
            editorViewport.maximum
        )
        : 0

    useEffect(() => {
        if (!selectedBookmark || !rowRef.current) return
        const row = rowRef.current
        const container = row.closest(".flowtake-timeline-scroll")
        if (!container) return

        const updateViewport = () => {
            const rowRect = row.getBoundingClientRect()
            const containerRect = container.getBoundingClientRect()
            const timelineMaximum = Math.max(0, timelineWidth - EDITOR_WIDTH)
            const minimum = Math.max(0, containerRect.left - rowRect.left + 8)
            const maximum = Math.max(
                minimum,
                Math.min(
                    timelineMaximum,
                    containerRect.right - rowRect.left - EDITOR_WIDTH - 8
                )
            )
            setEditorViewport(current =>
                current.minimum === minimum && current.maximum === maximum
                    ? current
                    : { minimum, maximum })
        }

        updateViewport()
        container.addEventListener("scroll", updateViewport, { passive: true })
        const observer = typeof ResizeObserver === "function"
            ? new ResizeObserver(updateViewport)
            : null
        observer?.observe(container)
        window.addEventListener("resize", updateViewport)
        return () => {
            container.removeEventListener("scroll", updateViewport)
            observer?.disconnect()
            window.removeEventListener("resize", updateViewport)
        }
    }, [selectedBookmark, timelineWidth])

    useEffect(() => {
        if (selectedBookmarkId && !selectedBookmark) {
            dispatch(setSelectedBookmarkId(null))
        }
    }, [dispatch, selectedBookmark, selectedBookmarkId])

    useEffect(() => {
        if (isPlaying && selectedBookmarkId) {
            dispatch(setSelectedBookmarkId(null))
        }
    }, [dispatch, isPlaying, selectedBookmarkId])

    const selectBookmark = useCallback((id, markerTime) => {
        dispatch(setSelectedIds([]))
        dispatch(setSelectedRow(null))
        dispatch(setSelectedBookmarkId(id))
        dispatch(setTime(markerTime))
    }, [dispatch])

    const retimeBookmark = useCallback((id, markerTime, group) => {
        if (isPlaying) return
        dispatch(withGroup(updateBookmark({
            id,
            changes: { time: markerTime },
            projectDuration,
        }), group))
        dispatch(setTime(markerTime))
    }, [dispatch, isPlaying, projectDuration])

    const saveBookmark = useCallback((id, changes) => {
        if (isPlaying) return
        dispatch(withGroup(updateBookmark({
            id,
            changes,
            projectDuration,
        }), getGroup("bookmark-edit")))
    }, [dispatch, isPlaying, projectDuration])

    const deleteBookmark = useCallback(id => {
        if (isPlaying) return
        dispatch(withGroup(removeBookmark(id), getGroup("bookmark-remove")))
        dispatch(setSelectedBookmarkId(null))
    }, [dispatch, isPlaying])

    return (
        <div
            ref={rowRef}
            className="relative h-8 w-full shrink-0 border-b border-base-content/8 bg-base-200/20"
            role="list"
            aria-label="Timeline markers"
            data-timeline-marker-row
        >
            <button
                type="button"
                onClick={addBookmarkAtPlayhead}
                disabled={!canAdd}
                className="btn btn-ghost btn-xs sticky left-1 top-1 z-40 h-6 min-h-6 w-6 p-0 md:hidden"
                aria-label="Add marker at playhead"
                title="Add marker at playhead"
            >
                <PlusIcon className="size-3.5" />
            </button>

            {sortedBookmarks.length === 0 && (
                <span className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-[9px] text-base-content/35 md:left-2">
                    Add a marker at the playhead
                </span>
            )}

            {sortedBookmarks.map(bookmark => (
                <TimelineMarker
                    key={bookmark.id}
                    bookmark={bookmark}
                    isSelected={bookmark.id === selectedBookmarkId}
                    isDisabled={isPlaying}
                    pxPerMs={pxPerMs}
                    projectDuration={projectDuration}
                    snappingLines={dragSnappingLines}
                    isSnappingEnabled={isSnappingEnabled}
                    onSelect={selectBookmark}
                    onRetime={retimeBookmark}
                    onDelete={deleteBookmark}
                />
            ))}

            {selectedBookmark && !isPlaying && (
                <BookmarkEditor
                    key={selectedBookmark.id}
                    bookmark={selectedBookmark}
                    projectDuration={projectDuration}
                    left={editorLeft}
                    onSave={saveBookmark}
                    onDelete={deleteBookmark}
                    onClose={() => dispatch(setSelectedBookmarkId(null))}
                />
            )}
        </div>
    )
}

function TimelineMarker({
    bookmark,
    isSelected,
    isDisabled,
    pxPerMs,
    projectDuration,
    snappingLines,
    isSnappingEnabled,
    onSelect,
    onRetime,
    onDelete,
}) {
    const dispatch = useDispatch()
    const drag = useRef(null)
    const suppressClick = useRef(false)
    const [previewTime, setPreviewTime] = useState(null)
    const displayTime = previewTime ?? bookmark.time
    const rangeWidth = bookmark.duration
        ? Math.max(3, msToPx(bookmark.duration, pxPerMs))
        : 0
    const label = bookmark.note || "Marker"
    const durationLabel = bookmark.duration
        ? `, duration ${formatBookmarkTime(bookmark.duration)}`
        : ""

    const handlePointerDown = useCallback(event => {
        if (isDisabled || (event.pointerType === "mouse" && event.button !== 0)) return
        event.preventDefault()
        event.stopPropagation()
        onSelect(bookmark.id, bookmark.time)
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = {
            pointerId: event.pointerId,
            initialClientX: event.clientX,
            previewTime: bookmark.time,
            moved: false,
            snapLine: null,
            group: getGroup("bookmark-retime"),
        }
    }, [bookmark.id, bookmark.time, isDisabled, onSelect])

    const handlePointerMove = useCallback(event => {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        const deltaPx = event.clientX - current.initialClientX
        if (!current.moved && Math.abs(deltaPx) < DRAG_THRESHOLD_PX) return
        current.moved = true

        const result = resolveBookmarkDragTime({
            initialTime: bookmark.time,
            duration: bookmark.duration,
            deltaMs: pxToMs(deltaPx, pxPerMs),
            projectDuration,
            snappingLines,
            pxPerMs,
            isSnappingEnabled,
        })
        current.previewTime = result.time
        setPreviewTime(result.time)
        if (current.snapLine !== result.snapLine) {
            current.snapLine = result.snapLine
            dispatch(setActiveSnapLine(result.snapLine))
        }
    }, [
        bookmark.duration,
        bookmark.time,
        dispatch,
        isSnappingEnabled,
        projectDuration,
        pxPerMs,
        snappingLines,
    ])

    const finishPointerDrag = useCallback((event, shouldCommit) => {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
        }

        if (shouldCommit && current.moved) {
            suppressClick.current = true
            if (current.previewTime !== bookmark.time) {
                onRetime(bookmark.id, current.previewTime, current.group)
            }
            onSelect(bookmark.id, current.previewTime)
        }

        drag.current = null
        setPreviewTime(null)
        dispatch(setActiveSnapLine(null))
    }, [bookmark.id, bookmark.time, dispatch, onRetime, onSelect])

    const handleClick = useCallback(event => {
        event.stopPropagation()
        if (suppressClick.current) {
            suppressClick.current = false
            return
        }
        onSelect(bookmark.id, bookmark.time)
    }, [bookmark.id, bookmark.time, onSelect])

    const handleKeyDown = useCallback(event => {
        if (event.key !== "Delete" && event.key !== "Backspace") return
        event.preventDefault()
        event.stopPropagation()
        onDelete(bookmark.id)
    }, [bookmark.id, onDelete])

    return (
        <div
            className="absolute left-0 top-0 h-8"
            style={{
                left: `${msToPx(displayTime, pxPerMs)}px`,
                zIndex: isSelected ? 35 : 20,
            }}
            role="listitem"
        >
            {rangeWidth > 0 && (
                <div
                    className="pointer-events-none absolute left-0 top-[13px] h-1.5 rounded-r-full border-y border-r"
                    style={{
                        width: `${rangeWidth}px`,
                        backgroundColor: `${bookmark.color}38`,
                        borderColor: bookmark.color,
                    }}
                    aria-hidden="true"
                />
            )}
            <button
                type="button"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={event => finishPointerDrag(event, true)}
                onPointerCancel={event => finishPointerDrag(event, false)}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                disabled={isDisabled}
                className={[
                    "absolute left-0 top-1 flex size-5 -translate-x-1/2 touch-none items-center justify-center rounded-md",
                    "cursor-ew-resize border border-white/40 text-white shadow-sm transition-transform",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                    isSelected ? "scale-110 ring-2 ring-primary ring-offset-1 ring-offset-base-100" : "hover:scale-110",
                    isDisabled ? "cursor-not-allowed opacity-60" : "",
                ].join(" ")}
                style={{ backgroundColor: bookmark.color }}
                aria-label={`${label} at ${formatBookmarkTime(displayTime)}${durationLabel}`}
                aria-pressed={isSelected}
                title={`${label} - ${formatBookmarkTime(displayTime)}`}
            >
                <BookmarkIcon className="size-3" aria-hidden="true" />
            </button>
        </div>
    )
}

TimelineMarker.propTypes = {
    bookmark: PropTypes.shape({
        id: PropTypes.string.isRequired,
        time: PropTypes.number.isRequired,
        note: PropTypes.string,
        color: PropTypes.string.isRequired,
        duration: PropTypes.number,
    }).isRequired,
    isSelected: PropTypes.bool.isRequired,
    isDisabled: PropTypes.bool.isRequired,
    pxPerMs: PropTypes.number.isRequired,
    projectDuration: PropTypes.number.isRequired,
    snappingLines: PropTypes.arrayOf(PropTypes.number).isRequired,
    isSnappingEnabled: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired,
    onRetime: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
}

function BookmarkEditor({
    bookmark,
    projectDuration,
    left,
    onSave,
    onDelete,
    onClose,
}) {
    const formRef = useRef(null)
    const noteRef = useRef(null)
    const [note, setNote] = useState(bookmark.note)
    const [color, setColor] = useState(bookmark.color)
    const [durationSeconds, setDurationSeconds] = useState(
        bookmark.duration ? String(bookmark.duration / 1000) : ""
    )

    useEffect(() => {
        setNote(bookmark.note)
        setColor(bookmark.color)
        setDurationSeconds(bookmark.duration ? String(bookmark.duration / 1000) : "")
    }, [bookmark.color, bookmark.duration, bookmark.id, bookmark.note])

    useEffect(() => {
        const previousFocus = document.activeElement
        const focusFrame = requestAnimationFrame(() => {
            noteRef.current?.focus()
            noteRef.current?.select()
        })
        return () => {
            cancelAnimationFrame(focusFrame)
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
                previousFocus.focus()
            }
        }
    }, [bookmark.id])

    const maximumDurationMs = Math.max(0, projectDuration - bookmark.time)
    const parsedDuration = durationSeconds.trim() === ""
        ? null
        : Number(durationSeconds) * 1000
    const isDurationInvalid = parsedDuration !== null
        && (!Number.isFinite(parsedDuration)
            || parsedDuration < 0
            || parsedDuration > maximumDurationMs)

    const handleSubmit = event => {
        event.preventDefault()
        event.stopPropagation()
        if (isDurationInvalid) return
        onSave(bookmark.id, {
            note,
            color,
            duration: parsedDuration && parsedDuration > 0
                ? Math.round(parsedDuration)
                : null,
        })
        onClose()
    }

    const stopPropagation = event => event.stopPropagation()
    const handleDialogKeyDown = event => {
        event.stopPropagation()
        if (event.key === "Escape") {
            event.preventDefault()
            onClose()
            return
        }
        if (event.key !== "Tab" || !formRef.current) return

        const focusable = [...formRef.current.querySelectorAll(
            "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
        )]
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
        }
    }

    return (
        <form
            ref={formRef}
            onSubmit={handleSubmit}
            onClick={stopPropagation}
            onPointerDown={stopPropagation}
            onKeyDown={handleDialogKeyDown}
            className="absolute top-8 z-[70] w-[260px] max-w-[calc(100vw-2rem)] rounded-xl border border-base-content/15 bg-base-100 p-2.5 shadow-xl"
            style={{ left: `${left}px` }}
            role="dialog"
            aria-label="Edit timeline marker"
        >
            <div className="mb-2 flex items-start gap-2">
                <div
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">Edit marker</p>
                    <p className="text-[10px] text-base-content/45">
                        {formatBookmarkTime(bookmark.time)}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-ghost btn-xs h-6 min-h-6 w-6 p-0"
                    aria-label="Close marker editor"
                    title="Close"
                >
                    <XMarkIcon className="size-3.5" />
                </button>
            </div>

            <label className="mb-2 block">
                <span className="mb-1 block text-[10px] font-medium text-base-content/60">
                    Note
                </span>
                <textarea
                    ref={noteRef}
                    value={note}
                    onChange={event => setNote(event.target.value)}
                    maxLength={240}
                    rows={2}
                    className="textarea textarea-bordered textarea-xs min-h-14 w-full resize-none"
                    aria-label="Marker note"
                />
            </label>

            <div className="grid grid-cols-[auto_1fr] gap-2">
                <label>
                    <span className="mb-1 block text-[10px] font-medium text-base-content/60">
                        Color
                    </span>
                    <input
                        type="color"
                        value={color}
                        onChange={event => setColor(event.target.value)}
                        className="h-8 w-10 cursor-pointer rounded-md border border-base-content/15 bg-base-100 p-1"
                        aria-label="Marker color"
                    />
                </label>
                <label>
                    <span className="mb-1 block text-[10px] font-medium text-base-content/60">
                        Duration (seconds)
                    </span>
                    <input
                        type="number"
                        value={durationSeconds}
                        onChange={event => setDurationSeconds(event.target.value)}
                        min="0"
                        max={maximumDurationMs / 1000}
                        step="0.1"
                        placeholder="Point marker"
                        className="input input-bordered input-xs h-8 w-full"
                        aria-label="Marker duration in seconds"
                        aria-invalid={isDurationInvalid}
                        aria-describedby={isDurationInvalid ? "marker-duration-error" : undefined}
                    />
                </label>
            </div>

            {isDurationInvalid && (
                <p id="marker-duration-error" className="mt-1 text-[10px] text-error" role="alert">
                    Duration must fit between the marker and project end.
                </p>
            )}

            <div className="mt-2.5 flex items-center gap-1.5 border-t border-base-content/10 pt-2">
                <button
                    type="button"
                    onClick={() => onDelete(bookmark.id)}
                    className="btn btn-ghost btn-xs mr-auto gap-1 text-error"
                >
                    <TrashIcon className="size-3" />
                    Delete
                </button>
                <button type="button" onClick={onClose} className="btn btn-ghost btn-xs">
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isDurationInvalid}
                    className="btn btn-primary btn-xs"
                >
                    Save
                </button>
            </div>
        </form>
    )
}

BookmarkEditor.propTypes = {
    bookmark: TimelineMarker.propTypes.bookmark,
    projectDuration: PropTypes.number.isRequired,
    left: PropTypes.number.isRequired,
    onSave: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
}
