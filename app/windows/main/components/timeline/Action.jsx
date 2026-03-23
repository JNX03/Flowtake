import PropTypes from "prop-types"
import {
    useCallback,
    useMemo,
    useRef
} from "react"
import { isHotkeyPressed } from "react-hotkeys-hook"
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

    const getAnimsInRange = useCallback((anim1, anim2) =>
        anims.filter(({ start }) => start >= anim2.start && start <= anim1.start).map(({ id }) => id),
        [anims]
    )

    const click = useCallback(() => {
        if (isClickEnabled && !isMinimized) {
            let ids = selectedIds.length === 1 && selectedIds[0] === anim.id ? [] : [anim.id]
            dispatch(setSelectedIds(ids))

            let animIds
            if (isHotkeyPressed("ctrl") && isRowSelected) {
                if (selectedIds.some(id => id === anim.id))
                    animIds = selectedIds.filter(id => id !== anim.id)
                else
                    animIds = [...selectedIds, anim.id]

                dispatch(setLastSelectedAnim(animIds.length > 0 ? anim : null))
            } else if (isHotkeyPressed("shift") && isRowSelected && lastSelectedAnim) {
                if (anim.start > lastSelectedAnim.start)
                    animIds = getAnimsInRange(anim, lastSelectedAnim)
                else
                    animIds = getAnimsInRange(lastSelectedAnim, anim)
            } else {
                animIds = selectedIds.length === 1 && selectedIds[0] === anim.id ? [] : [anim.id]
                dispatch(setLastSelectedAnim(animIds.length > 0 ? anim : null))
            }
            dispatch(setSelectedIds(animIds))
            if (animIds.length > 0) onSelect?.()
        }
    }, [isClickEnabled, isMinimized, selectedIds, anim, dispatch, isRowSelected, lastSelectedAnim, getAnimsInRange, onSelect])

    const contextMenu = useCallback(e => {
        if (onContextMenu && !isPlaying && !isMinimized) {
            if (!selectedIds.some(id => id === anim.id)) dispatch(setSelectedIds([anim.id]))
            dispatch(setPosition({ x: e.clientX, y: e.clientY }))
            onContextMenu()
        }
    }, [onContextMenu, isPlaying, isMinimized, selectedIds, anim.id, dispatch])

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
        return isSelected
            ? "ring-2 ring-base-content hover:ring-offset-2"
            : `ring-0 ${isMinimized ? "" : "hover:ring-2"} ring-base-content/60`
    }

    return (
        <div ref={setRef} onClick={click} onContextMenu={contextMenu}
            className={`${getColorClasses()} ${getRingClasses()} ${isSelected ? "shadow-xl z-20 brightness-110" : "hover:z-10 hover:brightness-105"} ` +
                `h-full absolute select-none flex ${isDragging ? "" : "transition-all duration-150 "}rounded-xl overflow-hidden ring-offset-base-100 ` +
                `${isMinimized ? "" : "cursor-pointer"} @container`}
            style={{ left: `${leftPosition}px`, width: `${width}px` }} >
            {children}
        </div>
    )
}

Action.propTypes = {
    anim: PropTypes.shape({
        id: PropTypes.string.isRequired,
        start: PropTypes.number.isRequired,
        end: PropTypes.number.isRequired
    }).isRequired,
    anims: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        start: PropTypes.number.isRequired,
        end: PropTypes.number,
        filter: PropTypes.func,
        reduce: PropTypes.func,
        map: PropTypes.func
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
    actionRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object])
}