import { useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import { KEYBOARD_LAYOUTS } from "@shared/helpers"
import { setIsNewKeyboardLayoutMenuOpen } from "@shared/redux/contextMenuSlice"
import { selectKeyboardLayoutIds } from "@shared/redux/keyboardLayoutSlice"
import { selectIsMaskingModeEnabled } from "@shared/redux/timelineSlice"
import KeyboardLayout from "./KeyboardLayout"
import Row from "./Row"

export default function KeyboardLayouts() {
    const dispatch = useDispatch()
    const ids = useSelector(selectKeyboardLayoutIds)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)

    const onContextMenu = useCallback(
        () => dispatch(setIsNewKeyboardLayoutMenuOpen(true)),
        [dispatch]
    )

    return (
        <Row name={KEYBOARD_LAYOUTS} className="h-12" animIds={ids} action={KeyboardLayout}
            onContextMenu={onContextMenu} isMinimized={isMinimized} />
    )
}
