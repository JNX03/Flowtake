import { ChevronUpDownIcon, MapPinIcon, ScissorsIcon } from "@heroicons/react/16/solid"
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

const MODES = [
    { value: "full", label: "Full typing" },
    { value: "keybinds", label: "Keybinds only" },
]

const POSITIONS = [
    { value: "top-left", label: "Top left" },
    { value: "top-center", label: "Top center" },
    { value: "top-right", label: "Top right" },
    { value: "bottom-left", label: "Bottom left" },
    { value: "bottom-center", label: "Bottom center" },
    { value: "bottom-right", label: "Bottom right" },
]

const SIZES = [
    { value: "sm", label: "Small" },
    { value: "md", label: "Medium" },
    { value: "lg", label: "Large" },
]

export default function KeyboardLayoutMenu() {
    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsKeyboardLayoutMenuOpen)
    const id = useSelector(selectKeyboardLayoutId)
    const entity = useSelector(state => id ? selectKeyboardLayoutById(state, id) : null)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)

    const isSplittingEnabled = useMemo(
        () => entity && time > entity.start && time < entity.end,
        [entity, time]
    )

    const close = useCallback(() => dispatch(setIsKeyboardLayoutMenuOpen(false)), [dispatch])

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
        const cur = entity.mode || "keybinds"
        const next = cur === "full" ? "keybinds" : "full"
        dispatch(updateKeyboardLayout({ id: entity.id, changes: { mode: next } }))
    }, [dispatch, entity])

    const setMode = useCallback((mode) => {
        if (!entity) return
        dispatch(updateKeyboardLayout({ id: entity.id, changes: { mode } }))
        close()
    }, [dispatch, entity, close])

    const setPosition = useCallback((position) => {
        if (!entity) return
        dispatch(updateKeyboardLayout({ id: entity.id, changes: { position } }))
        close()
    }, [dispatch, entity, close])

    const setSize = useCallback((size) => {
        if (!entity) return
        dispatch(updateKeyboardLayout({ id: entity.id, changes: { size } }))
        close()
    }, [dispatch, entity, close])

    const onDelete = useCallback(() => {
        if (!entity) return
        dispatch(removeKeyboardLayout(entity.id))
        close()
    }, [dispatch, entity, close])

    useHotkeys('s', () => onSplit(),
        { enabled: areHotkeysEnabled && isSplittingEnabled && !isPlaying },
        [areHotkeysEnabled, isSplittingEnabled, isPlaying, onSplit])

    useHotkeys('delete', () => onDelete(),
        { enabled: areHotkeysEnabled && isOpen && !isPlaying },
        [areHotkeysEnabled, isOpen, isPlaying, onDelete])

    if (!entity) return null

    const currentMode = entity.mode || "keybinds"
    const currentPosition = entity.position || "bottom-center"
    const currentSize = entity.size || "md"

    return (
        <Menu isOpen={isOpen} close={close}>
            <Item text="Split at time cursor" icon={ScissorsIcon} isEnabled={!!isSplittingEnabled}
                onClick={onSplit} kbd={<kbd className="kbd kbd-sm">s</kbd>} />
            <Divider />
            <Item text={`Mode: ${MODES.find(m => m.value === currentMode)?.label}`}
                icon={ChevronUpDownIcon} isEnabled={true} onClick={onCycleMode} />
            {MODES.map(m => (
                <Item key={m.value} text={`  ${m.label}${m.value === currentMode ? "  ✓" : ""}`}
                    isEnabled={true} onClick={() => setMode(m.value)} />
            ))}
            <Divider />
            <Item text={`Position: ${POSITIONS.find(p => p.value === currentPosition)?.label}`}
                icon={MapPinIcon} isEnabled={true} onClick={close} />
            {POSITIONS.map(p => (
                <Item key={p.value} text={`  ${p.label}${p.value === currentPosition ? "  ✓" : ""}`}
                    isEnabled={true} onClick={() => setPosition(p.value)} />
            ))}
            <Divider />
            <Item text={`Size: ${SIZES.find(s => s.value === currentSize)?.label}`}
                isEnabled={true} onClick={close} />
            {SIZES.map(s => (
                <Item key={s.value} text={`  ${s.label}${s.value === currentSize ? "  ✓" : ""}`}
                    isEnabled={true} onClick={() => setSize(s.value)} />
            ))}
            <Divider />
            <DeleteButton onDelete={onDelete} />
        </Menu>
    )
}
