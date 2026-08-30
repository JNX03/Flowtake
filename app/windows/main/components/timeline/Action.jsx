import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
    useMemo,
    useRef
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { msToPx } from "@shared/helpers"
import { setPosition } from "@shared/redux/contextMenuSlice"
import { selectIsPlaying } from "@shared/redux/editorSlice"
import {
    selectlastSelectedAnim,
    selectPxPerMs,
    selectSelectedIds,
    setLastSelectedAnim,
    setSelectedIds
} from "@shared/redux/timelineSlice"
import { createTimelineAutoScrollController } from "@shared/editor/timelineAutoScroll"

export default function Action({
    anim,
    anims,
    start,
    duration,
    onSelect,
    onContextMenu,
    isRowSelected,
    isClickEnabled = true,
    isActive = true,
    color,
    children,
    isMinimized = false,
    isDragging = false,
    isDragEnabled = true,
    actionRef
}) {

    const dispatch = useDispatch()

    const selectedIds = useSelector(selectSelectedIds)
    const lastSelectedAnim = useSelector(selectlastSelectedAnim)
    const isPlaying = useSelector(selectIsPlaying)
    const pxPerMs = useSelector(selectPxPerMs)

    const isSelected = useMemo(
        () => selectedIds.some(selectedId => selectedId === anim.id),
        [anim.id, selectedIds])

    const leftPosition = useMemo(() => msToPx(start, pxPerMs), [start, pxPerMs])
    const width = useMemo(() => msToPx(duration, pxPerMs), [duration, pxPerMs])

    const action = useRef(null)
    const setRef = useCallback(el => {
        action.current = el
        if (typeof actionRef === "function") actionRef(el)
        else if (actionRef) actionRef.current = el
    }, [actionRef])

    useEffect(() => {
        const element = action.current
        if (!element) return

        let gestureActive = false
        let gestureOriginX = 0
        const controller = createTimelineAutoScrollController({
            getContainer: () => action.current?.closest(".flowtake-timeline-scroll"),
            onScrollFrame: ({ pointer, container }) => {
                // Keep the existing move/trim handler authoritative. The synthetic
                // move only asks it to re-evaluate against the newly scrolled viewport.
                container.dispatchEvent(new Event("scroll"))
                window.dispatchEvent(new MouseEvent("mousemove", {
                    clientX: pointer.clientX,
                    clientY: pointer.clientY,
                    button: 0,
                    buttons: 1
                }))
            }
        })

        const removeWindowListeners = () => {
            window.removeEventListener("mousemove", handleMouseMove)
            window.removeEventListener("mouseup", finishGesture)
            window.removeEventListener("blur", cancelGesture)
            window.removeEventListener("contextmenu", cancelGesture)
            window.removeEventListener("keydown", handleKeyDown)
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }

        const stopGesture = () => {
            if (!gestureActive) return
            gestureActive = false
            controller.stop()
            removeWindowListeners()
        }

        const handleMouseMove = event => {
            if (!controller.isActive()) {
                if (Math.abs(event.clientX - gestureOriginX) < 3) return
                controller.start(event)
                return
            }
            controller.update(event)
        }
        const finishGesture = () => stopGesture()
        const cancelGesture = () => stopGesture()
        const handleKeyDown = event => {
            if (event.key === "Escape") cancelGesture()
        }
        const handleVisibilityChange = () => {
            if (document.hidden) cancelGesture()
        }

        const handleMouseDown = event => {
            if (!isDragEnabled
                || event.button !== 0
                || event.target.closest("button, input, textarea, select, a, [contenteditable='true']")) {
                return
            }

            stopGesture()
            gestureActive = true
            gestureOriginX = event.clientX
            window.addEventListener("mousemove", handleMouseMove, { passive: true })
            window.addEventListener("mouseup", finishGesture)
            window.addEventListener("blur", cancelGesture)
            window.addEventListener("contextmenu", cancelGesture)
            window.addEventListener("keydown", handleKeyDown)
            document.addEventListener("visibilitychange", handleVisibilityChange)
        }

        element.addEventListener("mousedown", handleMouseDown)
        return () => {
            element.removeEventListener("mousedown", handleMouseDown)
            controller.stop()
            removeWindowListeners()
        }
    }, [isDragEnabled])

    const getAnimsInRange = useCallback((anim1, anim2) =>
        anims.filter(({ start }) => start >= anim2.start && start <= anim1.start).map(({ id }) => id),
        [anims]
    )

    const click = useCallback(event => {
        if (!isClickEnabled || isMinimized) return

        let animIds
        const isAdditive = event.ctrlKey || event.metaKey
        const hasRangeAnchor = Boolean(
            lastSelectedAnim
            && anims.some(item => item.id === lastSelectedAnim.id)
        )
        if (isAdditive && isRowSelected) {
            // Ctrl/Cmd-click: toggle this item in the selection.
            animIds = selectedIds.includes(anim.id)
                ? selectedIds.filter(id => id !== anim.id)
                : [...selectedIds, anim.id]
            const nextAnchor = animIds.includes(anim.id)
                ? anim
                : anims.find(item => item.id === animIds.at(-1)) || null
            dispatch(setLastSelectedAnim(nextAnchor))
        } else if (event.shiftKey && isRowSelected && hasRangeAnchor) {
            // Range selection never crosses between audio or visual lanes.
            animIds = anim.start > lastSelectedAnim.start
                ? getAnimsInRange(anim, lastSelectedAnim)
                : getAnimsInRange(lastSelectedAnim, anim)
        } else {
            // Plain click keeps the item selected. Ctrl/Cmd-click is the
            // explicit way to toggle items out of a selection.
            animIds = [anim.id]
            dispatch(setLastSelectedAnim(anim))
        }
        dispatch(setSelectedIds(animIds))
        if (animIds.length > 0) onSelect?.()
    }, [isClickEnabled, isMinimized, selectedIds, anim, anims, dispatch, isRowSelected, lastSelectedAnim, getAnimsInRange, onSelect])

    const selectBeforeDrag = useCallback(event => {
        if (!isClickEnabled
            || isMinimized
            || event.button !== 0
            || event.ctrlKey
            || event.metaKey
            || event.shiftKey
            || selectedIds.includes(anim.id)) {
            return
        }

        dispatch(setSelectedIds([anim.id]))
        dispatch(setLastSelectedAnim(anim))
        onSelect?.()
    }, [anim, dispatch, isClickEnabled, isMinimized, onSelect, selectedIds])

    const contextMenu = useCallback(e => {
        if (onContextMenu && !isPlaying && !isMinimized) {
            e.preventDefault()
            if (!selectedIds.some(id => id === anim.id)) dispatch(setSelectedIds([anim.id]))
            const rect = action.current?.getBoundingClientRect()
            const hasPointerPosition = Number.isFinite(e.clientX)
                && Number.isFinite(e.clientY)
                && (e.clientX !== 0 || e.clientY !== 0)
            dispatch(setPosition({
                x: hasPointerPosition ? e.clientX : (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
                y: hasPointerPosition ? e.clientY : (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
            }))
            onContextMenu()
        }
    }, [onContextMenu, isPlaying, isMinimized, selectedIds, anim.id, dispatch])

    const handleActionKeyDown = useCallback(event => {
        if (event.target !== event.currentTarget) return
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            click(event)
        } else if (event.key === "ContextMenu"
            || (event.shiftKey && event.key === "F10")) {
            contextMenu(event)
        }
    }, [click, contextMenu])

    const getColorClasses = () => {
        switch (color) {
            case "primary": return `${isActive ? "bg-primary" : "bg-primary/50"} text-primary-content`
            case "secondary": return `${isActive ? "bg-secondary" : "bg-secondary/50"} text-secondary-content`
            case "tertiary": return `${isActive ? "bg-tertiary" : "bg-tertiary/50"} text-tertiary-content`
            case "accent": return `${isActive ? "bg-accent" : "bg-accent/50"} text-accent-content`
            case "neutral": return `${isActive ? "bg-neutral" : "bg-neutral/50"} text-neutral-content`
            default: return ""
        }
    }

    const getRingClasses = () => {
        if (isSelected) {
            switch (color) {
                case "primary": return "ring-1 ring-primary/90"
                case "secondary": return "ring-1 ring-secondary/90"
                case "tertiary": return "ring-1 ring-tertiary/90"
                case "accent": return "ring-1 ring-accent/90"
                case "neutral": return "ring-1 ring-neutral/90"
                default: return "ring-1 ring-base-content"
            }
        }
        return `ring-0 ${isMinimized ? "" : "hover:ring-1"} ring-base-content/60`
    }

    return (
        <div
            ref={setRef}
            role="button"
            tabIndex={!isMinimized && isClickEnabled ? 0 : -1}
            aria-label={anim.name || anim.text || "Timeline item"}
            aria-pressed={isSelected}
            onMouseDownCapture={selectBeforeDrag}
            onClick={click}
            onContextMenu={contextMenu}
            onKeyDown={handleActionKeyDown}
            className={`${getColorClasses()} ${getRingClasses()} ${isSelected ? "shadow-lg z-20 brightness-110" : "hover:z-10 hover:brightness-105"} ` +
                `group/timeline-item h-full absolute select-none flex ${isDragging ? "opacity-80 " : "transition-[box-shadow,filter,ring,ring-offset,opacity] duration-150 "}rounded-md overflow-hidden ring-offset-base-100 ` +
                `${isMinimized ? "" : "cursor-pointer"} outline-none focus-visible:ring-2 focus-visible:ring-offset-2 @container`}
            style={{ left: `${leftPosition}px`, width: `${width}px` }} >
            {children}
        </div>
    )
}

Action.propTypes = {
    anim: PropTypes.shape({
        id: PropTypes.string.isRequired,
        start: PropTypes.number.isRequired,
        end: PropTypes.number.isRequired,
        name: PropTypes.string,
        text: PropTypes.string,
    }).isRequired,
    anims: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        start: PropTypes.number.isRequired,
        end: PropTypes.number
    })).isRequired,
    start: PropTypes.number.isRequired,
    duration: PropTypes.number.isRequired,
    onSelect: PropTypes.func,
    onContextMenu: PropTypes.func,
    isRowSelected: PropTypes.bool.isRequired,
    isClickEnabled: PropTypes.bool,
    isActive: PropTypes.bool,
    color: PropTypes.oneOf(["primary", "secondary", "tertiary", "accent", "neutral"]),
    children: PropTypes.node,
    isMinimized: PropTypes.bool,
    isDragging: PropTypes.bool,
    isDragEnabled: PropTypes.bool,
    actionRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object])
}
