import {
    CursorArrowRaysIcon,
    EyeIcon,
    EyeSlashIcon,
    ScissorsIcon,
    SwatchIcon,
    TagIcon
} from "@heroicons/react/16/solid"
import { useCallback, useMemo } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { useDispatch, useSelector } from "react-redux"
import {
    selectDrawnMouseId,
    selectIsDrawnMouseMenuOpen,
    selectTime,
    setIsDrawnMouseMenuOpen
} from "@shared/redux/contextMenuSlice"
import {
    selectAreHotkeysEnabled,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import {
    addDrawnMouse,
    removeDrawnMouse,
    selectDrawnMouseById,
    updateDrawnMouse
} from "@shared/redux/drawnMouseAnimSlice"
import DeleteButton from "./DeleteButton"
import Divider from "./Divider"
import Item from "./Item"
import Menu from "./Menu"

const PRESET_COLORS = [
    { name: "Blue", value: "#3b82f6" },
    { name: "Red", value: "#ff3b30" },
    { name: "Green", value: "#22c55e" },
    { name: "Yellow", value: "#facc15" },
    { name: "Purple", value: "#a855f7" },
    { name: "White", value: "#ffffff" },
]

const PRESETS = [
    { name: "Pointer", value: "pointer" },
    { name: "Arrow", value: "arrow" },
    { name: "Dot", value: "dot" },
    { name: "Ring", value: "ring" },
    { name: "Target", value: "target" },
    { name: "Agent", value: "agent" },
]

export default function DrawnMouseMenu() {
    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsDrawnMouseMenuOpen)
    const id = useSelector(selectDrawnMouseId)
    const entity = useSelector(state => id ? selectDrawnMouseById(state, id) : null)
    const time = useSelector(selectTime)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)

    const close = useCallback(() => dispatch(setIsDrawnMouseMenuOpen(false)), [dispatch])

    const isSplittingEnabled = useMemo(
        () => entity && time > entity.start && time < entity.end,
        [entity, time]
    )

    const onSplit = useCallback(() => {
        if (!entity || !isSplittingEnabled) return
        const t = time
        // Partition captured points into the "before t" and "after t" halves so
        // each new segment carries only its slice of the path.
        const segDur = Math.max(entity.end - entity.start, 1)
        const segT = (t - entity.start) / segDur
        const points = Array.isArray(entity.points) ? entity.points : []
        if (points.length === 0) return
        const first = points[0]
        const last = points[points.length - 1]
        const pathT = first.t + segT * (last.t - first.t)

        const left = points.filter(p => p.t <= pathT).map(p => ({ ...p }))
        const right = points
            .filter(p => p.t >= pathT)
            .map(p => ({ ...p, t: p.t - pathT }))

        dispatch(updateDrawnMouse({ id: entity.id, changes: { end: t, points: left } }))
        dispatch(addDrawnMouse({
            id: `dm-${crypto.randomUUID()}`,
            start: t,
            end: entity.end,
            points: right,
            color: entity.color,
            label: entity.label,
            showLabel: entity.showLabel,
            preset: entity.preset,
            showTrail: entity.showTrail,
        }))
        close()
    }, [dispatch, entity, isSplittingEnabled, time, close])

    const cycleColor = useCallback(() => {
        if (!entity) return
        const cur = entity.color || PRESET_COLORS[0].value
        const idx = PRESET_COLORS.findIndex(c => c.value.toLowerCase() === cur.toLowerCase())
        const next = PRESET_COLORS[(idx + 1) % PRESET_COLORS.length]
        dispatch(updateDrawnMouse({ id: entity.id, changes: { color: next.value } }))
    }, [dispatch, entity])

    const cyclePreset = useCallback(() => {
        if (!entity) return
        const cur = entity.preset || PRESETS[0].value
        const idx = PRESETS.findIndex(p => p.value === cur)
        const next = PRESETS[(idx + 1) % PRESETS.length]
        dispatch(updateDrawnMouse({ id: entity.id, changes: { preset: next.value } }))
    }, [dispatch, entity])

    const toggleLabel = useCallback(() => {
        if (!entity) return
        const cur = entity.showLabel
        dispatch(updateDrawnMouse({ id: entity.id, changes: { showLabel: !cur } }))
    }, [dispatch, entity])

    const toggleTrail = useCallback(() => {
        if (!entity) return
        const cur = entity.showTrail !== false
        dispatch(updateDrawnMouse({ id: entity.id, changes: { showTrail: !cur } }))
    }, [dispatch, entity])

    const onDelete = useCallback(() => {
        if (!entity) return
        dispatch(removeDrawnMouse(entity.id))
        close()
    }, [dispatch, entity, close])

    useHotkeys('s', () => onSplit(),
        { enabled: areHotkeysEnabled && !!isSplittingEnabled && !isPlaying && isOpen },
        [areHotkeysEnabled, isSplittingEnabled, isPlaying, isOpen, onSplit])

    useHotkeys('delete', () => onDelete(),
        { enabled: areHotkeysEnabled && isOpen && !isPlaying },
        [areHotkeysEnabled, isOpen, isPlaying, onDelete])

    if (!entity) return null

    const currentColor = PRESET_COLORS.find(c =>
        (entity.color || "").toLowerCase() === c.value.toLowerCase()
    )
    const currentPreset = PRESETS.find(p => p.value === entity.preset) || PRESETS[0]
    const trailOn = entity.showTrail !== false

    return (
        <Menu isOpen={isOpen} close={close}>
            <Item text="Split at time cursor" icon={ScissorsIcon} isEnabled={!!isSplittingEnabled}
                onClick={onSplit} kbd={<kbd className="kbd kbd-sm">s</kbd>} />
            <Divider />
            <Item text={`Shape: ${currentPreset.name}`} icon={CursorArrowRaysIcon}
                isEnabled={true} onClick={cyclePreset} />
            <Item text={`Color: ${currentColor?.name || (entity.color || "Custom")}`}
                icon={SwatchIcon} isEnabled={true} onClick={cycleColor} />
            <Item text={entity.showLabel ? "Hide tag" : "Show tag"}
                icon={TagIcon}
                isEnabled={true} onClick={toggleLabel} />
            <Item text={trailOn ? "Hide trail" : "Show trail"}
                icon={trailOn ? EyeSlashIcon : EyeIcon}
                isEnabled={true} onClick={toggleTrail} />
            <Divider />
            <DeleteButton onDelete={onDelete} />
        </Menu>
    )
}
