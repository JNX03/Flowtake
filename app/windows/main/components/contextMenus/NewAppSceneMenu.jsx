import { PlusIcon } from "@heroicons/react/16/solid"
import { useCallback, useMemo } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
    selectIsNewAppSceneMenuOpen,
    selectTime,
    setIsNewAppSceneMenuOpen
} from "@shared/redux/contextMenuSlice"
import { selectDuration } from "@shared/redux/editorSlice"
import { addAppScene } from "@shared/redux/appSceneAnimSlice"
import { selectExtraTracks } from "@shared/redux/projectSlice"
import Item from "./Item"
import Menu from "./Menu"

const DEFAULT_DURATION_MS = 4000

export default function NewAppSceneMenu() {
    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsNewAppSceneMenuOpen)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)
    const tracks = useSelector(selectExtraTracks)

    const isEnabled = useMemo(
        () => isOpen && duration && time !== null && time >= 0 && time <= duration
            && Array.isArray(tracks) && tracks.length > 0,
        [isOpen, duration, time, tracks]
    )

    const onNew = useCallback(() => {
        dispatch(setIsNewAppSceneMenuOpen(false))
        const start = Math.max(0, time)
        const end = Math.min(duration, start + DEFAULT_DURATION_MS)
        // Default: first captured app is main, others sit in top-right corner.
        const main = tracks?.[0]?.id || null
        const slots = {}
        for (let i = 1; i < (tracks?.length || 0); i++) {
            slots[tracks[i].id] = "tr"
        }
        dispatch(addAppScene({
            id: `scn-${crypto.randomUUID()}`,
            start, end,
            layout: "pip",
            mainTrackId: main,
            slots,
        }))
    }, [dispatch, time, duration, tracks])

    const close = useCallback(() => dispatch(setIsNewAppSceneMenuOpen(false)), [dispatch])

    return (
        <Menu isOpen={isOpen} close={close}>
            <Item text="New Scene block" icon={PlusIcon} isEnabled={isEnabled} onClick={onNew} />
        </Menu>
    )
}
