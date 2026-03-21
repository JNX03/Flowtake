import { PlusIcon } from "@heroicons/react/16/solid"
import {
    useCallback,
    useMemo
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { createSubtitle } from "@shared/helpers"
import {
    selectIsNewSubtitleMenuOpen,
    selectTime,
    setIsNewSubtitleMenuOpen
} from "@shared/redux/contextMenuSlice"
import { selectDuration } from "@shared/redux/editorSlice"
import { selectAllSubtitles } from "@shared/redux/subtitleSlice"
import Item from "./Item"
import Menu from "./Menu"

export default function NewSubtitleMenu() {

    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsNewSubtitleMenuOpen)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)
    const subtitles = useSelector(selectAllSubtitles)

    const isEnabled = useMemo(
        () => isOpen && duration && time !== null && time >= 0 && time <= duration,
        [isOpen, duration, time]
    )

    const onNew = useCallback(() => {
        dispatch(setIsNewSubtitleMenuOpen(false))
        dispatch(createSubtitle(time, subtitles, duration))
    }, [dispatch, time, subtitles, duration])
    
    const close = useCallback(() => {
        dispatch(setIsNewSubtitleMenuOpen(false))
    }, [dispatch])

    return (
        <Menu isOpen={isOpen} close={close}>
            <Item text="New Subtitle Element" icon={PlusIcon} isEnabled={isEnabled} onClick={onNew} />
        </Menu>
    )
}