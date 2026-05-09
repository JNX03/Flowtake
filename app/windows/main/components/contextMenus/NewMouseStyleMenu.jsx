import { PlusIcon } from "@heroicons/react/16/solid"
import { useCallback, useMemo } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
    selectIsNewMouseStyleMenuOpen,
    selectTime,
    setIsNewMouseStyleMenuOpen
} from "@shared/redux/contextMenuSlice"
import { selectDuration } from "@shared/redux/editorSlice"
import { addMouseStyle } from "@shared/redux/mouseStyleAnimSlice"
import Item from "./Item"
import Menu from "./Menu"

const DEFAULT_DURATION_MS = 4000

export default function NewMouseStyleMenu() {
    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsNewMouseStyleMenuOpen)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)

    const isEnabled = useMemo(
        () => isOpen && duration && time !== null && time >= 0 && time <= duration,
        [isOpen, duration, time]
    )

    const onNew = useCallback(() => {
        dispatch(setIsNewMouseStyleMenuOpen(false))
        const start = Math.max(0, time)
        const end = Math.min(duration, start + DEFAULT_DURATION_MS)
        dispatch(addMouseStyle({
            id: `ms-${crypto.randomUUID()}`,
            start,
            end,
        }))
    }, [dispatch, time, duration])

    const close = useCallback(() => {
        dispatch(setIsNewMouseStyleMenuOpen(false))
    }, [dispatch])

    return (
        <Menu isOpen={isOpen} close={close}>
            <Item text="New Mouse Style block" icon={PlusIcon} isEnabled={isEnabled} onClick={onNew} />
        </Menu>
    )
}
