import { PlusIcon } from "@heroicons/react/16/solid"
import {
    useCallback,
    useMemo
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { createClip } from "../../../../src/helpers"
import {
    selectAllClips,
    selectLayout,
    selectMicrophoneAudioVolume,
    selectPlaybackRate,
    selectSystemAudioVolume
} from "../../../../src/redux/clipSlice"
import {
    selectIsNewClipMenuOpen,
    selectTime,
    setIsNewClipMenuOpen
} from "../../../../src/redux/contextMenuSlice"
import { selectDuration } from "../../../../src/redux/editorSlice"
import Item from "./Item"
import Menu from "./Menu"

export default function NewClipMenu() {

    const dispatch = useDispatch()

    const isOpen = useSelector(selectIsNewClipMenuOpen)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)
    const clips = useSelector(selectAllClips)
    const playbackRate = useSelector(selectPlaybackRate)
    const layout = useSelector(selectLayout)
    const microphoneAudioVolume = useSelector(selectMicrophoneAudioVolume)
    const systemAudioVolume = useSelector(selectSystemAudioVolume)

    const isEnabled = useMemo(
        () => isOpen && duration && time !== null && time >= 0 && time <= duration,
        [isOpen, duration, time]
    )

    const onNew = useCallback(() => {
        dispatch(setIsNewClipMenuOpen(false))
        dispatch(createClip(time, clips, playbackRate, layout, microphoneAudioVolume, systemAudioVolume,
            duration))
    }, [dispatch, time, clips, playbackRate, layout, microphoneAudioVolume, systemAudioVolume, duration])

    const close = useCallback(() => {
        dispatch(setIsNewClipMenuOpen(false))
    }, [dispatch])

    return (
        <Menu isOpen={isOpen} close={close}>
            <Item text="New Clip" icon={PlusIcon} isEnabled={isEnabled} onClick={onNew} />
        </Menu>
    )
}