import { CommandLineIcon } from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import { useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import { KEYBOARD_LAYOUTS } from "@shared/helpers"
import {
    setIsKeyboardLayoutMenuOpen,
    setKeyboardLayoutId
} from "@shared/redux/contextMenuSlice"
import {
    selectAllKeyboardLayouts,
    selectKeyboardLayoutById,
    selectKeyboardLayoutDefaults,
    updateKeyboardLayout
} from "@shared/redux/keyboardLayoutSlice"
import {
    selectIsMaskingModeEnabled,
    selectSelectedRow,
    setOpenSection,
    setSelectedRow
} from "@shared/redux/timelineSlice"
import FlexibleAction from "./FlexibleAction"
import Label from "./Label"

const POSITION_LABELS = {
    "top-left": "TL",
    "top-center": "TC",
    "top-right": "TR",
    "bottom-left": "BL",
    "bottom-center": "BC",
    "bottom-right": "BR",
}

export default function KeyboardLayout({ id }) {
    const dispatch = useDispatch()

    const anim = useSelector(state => selectKeyboardLayoutById(state, id))
    const anims = useSelector(selectAllKeyboardLayouts)
    const defaults = useSelector(selectKeyboardLayoutDefaults)
    const selectedRow = useSelector(selectSelectedRow)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)

    const onChange = useCallback(
        (start, end) => dispatch(updateKeyboardLayout({ id, changes: { start, end } })),
        [dispatch, id]
    )

    const onSelect = useCallback(() => {
        dispatch(setSelectedRow(KEYBOARD_LAYOUTS))
        dispatch(setOpenSection(KEYBOARD_LAYOUTS))
    }, [dispatch])

    const onContextMenu = useCallback(() => {
        dispatch(setSelectedRow(KEYBOARD_LAYOUTS))
        dispatch(setOpenSection(KEYBOARD_LAYOUTS))
        dispatch(setKeyboardLayoutId(id))
        dispatch(setIsKeyboardLayoutMenuOpen(true))
    }, [dispatch, id])

    if (!anim) return null

    const mode = anim.mode ?? defaults.mode
    const position = anim.position ?? defaults.position

    return (
        <FlexibleAction anim={anim} anims={anims} isRowSelected={selectedRow === KEYBOARD_LAYOUTS}
            onChange={onChange} onSelect={onSelect} onContextMenu={onContextMenu}
            color="primary" isMinimized={isMinimized}>
            <Label
                isMinimized={isMinimized}
                line1={<><CommandLineIcon className="size-4 shrink-0 mr-1" />Keyboard</>}
                line2={<>
                    <span>{mode === "full" ? "Full typing" : "Keybinds only"}</span>
                    <span className="opacity-60">{POSITION_LABELS[position] || position}</span>
                </>}
            />
        </FlexibleAction>
    )
}

KeyboardLayout.propTypes = {
    id: PropTypes.string.isRequired,
}
