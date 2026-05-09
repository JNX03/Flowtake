import {
    ArrowsPointingOutIcon,
    ChevronUpDownIcon,
    CommandLineIcon,
    MapPinIcon,
    ScissorsIcon
} from "@heroicons/react/16/solid"
import { useCallback, useMemo } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { useDispatch, useSelector } from "react-redux"
import {
    selectIsKeyboardLayoutMenuOpen,
    selectKeyboardLayoutId,
    selectTime,
    setIsKeyboardLayoutMenuOpen
} from "@shared/redux/contextMenuSlice"
import {
    selectAreHotkeysEnabled,
    selectDuration,
    selectIsPlaying
} from "@shared/redux/editorSlice"
import {
    addKeyboardLayout,
    removeKeyboardLayout,
    selectKeyboardLayoutById,
    updateKeyboardLayout
} from "@shared/redux/keyboardLayoutSlice"
import DeleteButton from "./DeleteButton"
import Divider from "./Divider"
import Item from "./Item"
import Menu from "./Menu"

const MODES = ["full", "keybinds"]
const POSITIONS = [
    "top-left", "top-center", "top-right",
    "bottom-left", "bottom-center", "bottom-right",
]
const SIZES = ["sm", "md", "lg"]

const MODE_LABELS = { full: "Full typing", keybinds: "Keybinds only" }
const SIZE_LABELS = { sm: "Small", md: "Medium", lg: "Large" }
const POSITION_LABELS = {
    "top-left": "Top left", "top-center": "Top center", "top-right": "Top right",
    "bottom-left": "Bottom left", "bottom-center": "Bottom center", "bottom-right": "Bottom right",
}

const cycle = (arr, current) => arr[(arr.indexOf(current) + 1) % arr.length]

export default function KeyboardLayoutMenu() {
    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsKeyboardLayoutMenuOpen)
    const id = useSelector(selectKeyboardLayoutId)
    const entity = useSelector(state => id ? selectKeyboardLayoutById(state, id) : null)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)

    const close = useCallback(() => dispatch(setIsKeyboardLayoutMenuOpen(false)), [dispatch])

    const isSplittingEnabled = useMemo(
        () => entity && time > entity.start && time < entity.end,
        [entity, time]
    )

    const onSplit = useCallback(() => {
        if (!entity || !isSplittingEnabled) return
        const splitTime = time
        dispatch(updateKeyboardLayout({ id: entity.id, changes: { end: splitTime } }))
        dispatch(addKeyboardLayout({
            id: `kb-${crypto.randomUUID()}`,
            start: splitTime,
            end: entity.end,
            mode: entity.mode,
            position: entity.position,
            size: entity.size,
        }))
        close()
    }, [dispatch, entity, isSplittingEnabled, time, close])

    const onCycleMode = useCallback(() => {
        if (!entity) return
        const next = cycle(MODES, entity.mode || "keybinds")
        dispatch(updateKeyboardLayout({ id: entity.id, changes: { mode: next } }))
    }, [dispatch, entity])

    const onCyclePosition = useCallback(() => {
        if (!entity) return
        const next = cycle(POSITIONS, entity.position || "bottom-center")
        dispatch(updateKeyboardLayout({ id: entity.id, changes: { position: next } }))
    }, [dispatch, entity])

    const onCycleSize = useCallback(() => {
        if (!entity) return
        const next = cycle(SIZES, entity.size || "md")
        dispatch(updateKeyboardLayout({ id: entity.id, changes: { size: next } }))
    }, [dispatch, entity])

    const onDelete = useCallback(() => {
        if (!entity) return
        dispatch(removeKeyboardLayout(entity.id))
        close()
    }, [dispatch, entity, close])

    useHotkeys('s', () => onSplit(),
        { enabled: areHotkeysEnabled && !!isSplittingEnabled && !isPlaying },
        [areHotkeysEnabled, isSplittingEnabled, isPlaying, onSplit])

    useHotkeys('delete', () => onDelete(),
        { enabled: areHotkeysEnabled && isOpen && !isPlaying },
        [areHotkeysEnabled, isOpen, isPlaying, onDelete])

    if (!entity) return null

    const mode = entity.mode || "keybinds"
    const position = entity.position || "bottom-center"
    const size = entity.size || "md"

    // Use no-op duration for non-splittable cases so duration is never null.
    const _ = duration

    return (
        <Menu isOpen={isOpen} close={close}>
            <Item text="Split at time cursor" icon={ScissorsIcon} isEnabled={!!isSplittingEnabled}
                onClick={onSplit} kbd={<kbd className="kbd kbd-sm">s</kbd>} />
            <Divider />
            <Item text={`Mode: ${MODE_LABELS[mode]}`} icon={CommandLineIcon}
                isEnabled={true} onClick={onCycleMode} />
            <Item text={`Position: ${POSITION_LABELS[position]}`} icon={MapPinIcon}
                isEnabled={true} onClick={onCyclePosition} />
            <Item text={`Size: ${SIZE_LABELS[size]}`} icon={ArrowsPointingOutIcon}
                isEnabled={true} onClick={onCycleSize} />
            <Item text="Customize…" icon={ChevronUpDownIcon} isEnabled={false} onClick={close} />
            <Divider />
            <DeleteButton onDelete={onDelete} />
        </Menu>
    )
}
