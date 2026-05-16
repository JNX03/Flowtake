import {
    BoltIcon,
    EyeIcon,
    EyeSlashIcon,
    PencilSquareIcon,
    ScissorsIcon,
    SwatchIcon,
    TagIcon
} from "@heroicons/react/16/solid"
import { useCallback, useMemo } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { useDispatch, useSelector } from "react-redux"
import {
    selectIsMouseStyleMenuOpen,
    selectMouseStyleId,
    selectTime,
    setIsMouseStyleMenuOpen
} from "@shared/redux/contextMenuSlice"
import {
    selectAreHotkeysEnabled,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import {
    addMouseStyle,
    removeMouseStyle,
    selectMouseStyleById,
    updateMouseStyle
} from "@shared/redux/mouseStyleAnimSlice"
import DeleteButton from "./DeleteButton"
import Divider from "./Divider"
import Item from "./Item"
import Menu from "./Menu"

const PRESET_COLORS = [
    { name: "Red", value: "#ff3b30" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Green", value: "#22c55e" },
    { name: "Yellow", value: "#facc15" },
    { name: "Purple", value: "#a855f7" },
    { name: "White", value: "#ffffff" },
]

// `inherit` = null (use global cursorCoords.inertia)
const SMOOTHING_STEPS = [
    { name: "Inherit", value: null },
    { name: "Snappy", value: 200 },
    { name: "Smooth", value: 650 },
    { name: "Floaty", value: 1100 },
]

export default function MouseStyleMenu() {
    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsMouseStyleMenuOpen)
    const id = useSelector(selectMouseStyleId)
    const entity = useSelector(state => id ? selectMouseStyleById(state, id) : null)
    const time = useSelector(selectTime)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)

    const close = useCallback(() => dispatch(setIsMouseStyleMenuOpen(false)), [dispatch])

    const isSplittingEnabled = useMemo(
        () => entity && time > entity.start && time < entity.end,
        [entity, time]
    )

    const onSplit = useCallback(() => {
        if (!entity || !isSplittingEnabled) return
        const t = time
        dispatch(updateMouseStyle({ id: entity.id, changes: { end: t } }))
        dispatch(addMouseStyle({
            id: `ms-${crypto.randomUUID()}`,
            start: t,
            end: entity.end,
            color: entity.color,
            showLabel: entity.showLabel,
            label: entity.label,
        }))
        close()
    }, [dispatch, entity, isSplittingEnabled, time, close])

    const setColor = useCallback((color) => {
        if (!entity) return
        dispatch(updateMouseStyle({ id: entity.id, changes: { color } }))
    }, [dispatch, entity])

    const cyclePreset = useCallback(() => {
        if (!entity) return
        const cur = entity.color || "#ffffff"
        const idx = PRESET_COLORS.findIndex(c => c.value.toLowerCase() === cur.toLowerCase())
        const next = PRESET_COLORS[(idx + 1) % PRESET_COLORS.length]
        setColor(next.value)
    }, [entity, setColor])

    const toggleLabel = useCallback(() => {
        if (!entity) return
        const cur = entity.showLabel
        dispatch(updateMouseStyle({ id: entity.id, changes: { showLabel: !cur } }))
    }, [dispatch, entity])

    const toggleEnabled = useCallback(() => {
        if (!entity) return
        const isHidden = entity.enabled === false
        dispatch(updateMouseStyle({ id: entity.id, changes: { enabled: isHidden ? true : false } }))
    }, [dispatch, entity])

    const cycleSmoothing = useCallback(() => {
        if (!entity) return
        const cur = entity.inertia ?? null
        const idx = SMOOTHING_STEPS.findIndex(s => s.value === cur)
        const next = SMOOTHING_STEPS[(idx + 1) % SMOOTHING_STEPS.length]
        dispatch(updateMouseStyle({ id: entity.id, changes: { inertia: next.value } }))
    }, [dispatch, entity])

    const onDelete = useCallback(() => {
        if (!entity) return
        dispatch(removeMouseStyle(entity.id))
        close()
    }, [dispatch, entity, close])

    useHotkeys('s', () => onSplit(),
        { enabled: areHotkeysEnabled && !!isSplittingEnabled && !isPlaying },
        [areHotkeysEnabled, isSplittingEnabled, isPlaying, onSplit])

    useHotkeys('h', () => toggleEnabled(),
        { enabled: areHotkeysEnabled && isOpen && !isPlaying },
        [areHotkeysEnabled, isOpen, isPlaying, toggleEnabled])

    useHotkeys('delete', () => onDelete(),
        { enabled: areHotkeysEnabled && isOpen && !isPlaying },
        [areHotkeysEnabled, isOpen, isPlaying, onDelete])

    if (!entity) return null

    const currentPreset = PRESET_COLORS.find(c =>
        (entity.color || "").toLowerCase() === c.value.toLowerCase()
    )
    const isHidden = entity.enabled === false
    const currentSmoothing = SMOOTHING_STEPS.find(s => s.value === (entity.inertia ?? null)) || SMOOTHING_STEPS[0]

    return (
        <Menu isOpen={isOpen} close={close}>
            <Item text={isHidden ? "Show cursor in this segment" : "Hide cursor in this segment"}
                icon={isHidden ? EyeIcon : EyeSlashIcon}
                isEnabled={true} onClick={toggleEnabled}
                kbd={<kbd className="kbd kbd-sm">h</kbd>} />
            <Divider />
            <Item text="Split at time cursor" icon={ScissorsIcon} isEnabled={!!isSplittingEnabled}
                onClick={onSplit} kbd={<kbd className="kbd kbd-sm">s</kbd>} />
            <Divider />
            <Item text={`Color: ${currentPreset?.name || (entity.color || "Custom")}`}
                icon={SwatchIcon} isEnabled={!isHidden} onClick={cyclePreset} />
            <Item text={entity.showLabel ? "Hide tag" : "Show tag"}
                icon={entity.showLabel ? TagIcon : TagIcon}
                isEnabled={!isHidden} onClick={toggleLabel} />
            <Item text={`Smoothing: ${currentSmoothing.name}`}
                icon={BoltIcon} isEnabled={!isHidden} onClick={cycleSmoothing} />
            <Item text="Edit in sidebar" icon={PencilSquareIcon}
                isEnabled={false} onClick={close} />
            <Divider />
            <DeleteButton onDelete={onDelete} />
        </Menu>
    )
}
