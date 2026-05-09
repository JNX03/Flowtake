import { PlusIcon } from "@heroicons/react/16/solid"
import { useCallback, useMemo } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
    selectIsNewKeyboardLayoutMenuOpen,
    selectTime,
    setIsNewKeyboardLayoutMenuOpen
} from "@shared/redux/contextMenuSlice"
import { selectDuration } from "@shared/redux/editorSlice"
import { addKeyboardLayout } from "@shared/redux/keyboardLayoutSlice"
import Item from "./Item"
import Menu from "./Menu"

const DEFAULT_DURATION_MS = 4000

export default function NewKeyboardLayoutMenu() {
    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsNewKeyboardLayoutMenuOpen)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)

    const isEnabled = useMemo(
        () => isOpen && duration && time !== null && time >= 0 && time <= duration,
        [isOpen, duration, time]
    )

    const onNew = useCallback(() => {
        dispatch(setIsNewKeyboardLayoutMenuOpen(false))
        const start = Math.max(0, time)
        const end = Math.min(duration, start + DEFAULT_DURATION_MS)
        dispatch(addKeyboardLayout({
            id: `kb-${crypto.randomUUID()}`,
            start,
            end,
        }))
    }, [dispatch, time, duration])

    const close = useCallback(() => {
        dispatch(setIsNewKeyboardLayoutMenuOpen(false))
    }, [dispatch])

    return (
        <Menu isOpen={isOpen} close={close}>
            <Item text="New Keyboard Layout" icon={PlusIcon} isEnabled={isEnabled} onClick={onNew} />
        </Menu>
    )
}
