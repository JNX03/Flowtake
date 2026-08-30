import {
    useCallback,
    useEffect
} from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    CLIPS,
    createClip
} from "@shared/helpers"
import {
    selectAllClips,
    selectClipIds,
    selectLayout,
    selectMicrophoneAudioVolume,
    selectPlaybackRate,
    selectSystemAudioVolume,
    selectTotalClips
} from "@shared/redux/clipSlice"
import { setIsNewClipMenuOpen } from "@shared/redux/contextMenuSlice"
import {
    selectAreHotkeysEnabled,
    selectDuration,
    selectIsPlaying,
    selectSourceDuration
} from "@shared/redux/editorSlice"
import { setVideoDetails } from "@shared/redux/projectSlice"
import {
    selectIsMaskingModeEnabled,
    selectSelectedRow,
    setOpenSection,
    setSelectedIds
} from "@shared/redux/timelineSlice"
import Clip from "./Clip"
import Row from "./Row"

export default function Clips() {

    const dispatch = useDispatch()

    const clipIds = useSelector(selectClipIds)
    const totalClips = useSelector(selectTotalClips)
    const clips = useSelector(selectAllClips)
    const selectedRow = useSelector(selectSelectedRow)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const isPlaying = useSelector(selectIsPlaying)
    const duration = useSelector(selectDuration)
    const sourceDuration = useSelector(selectSourceDuration)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)
    const playbackRate = useSelector(selectPlaybackRate)
    const layout = useSelector(selectLayout)
    const microphoneAudioVolume = useSelector(selectMicrophoneAudioVolume)
    const systemAudioVolume = useSelector(selectSystemAudioVolume)

    useHotkeys(
        'ctrl+a',
        e => {
            e.preventDefault()
            dispatch(setSelectedIds(clipIds))
            dispatch(setOpenSection(CLIPS))
        },
        { enabled: areHotkeysEnabled && selectedRow === CLIPS && !isPlaying && !isMinimized },
        [selectedRow, areHotkeysEnabled, isPlaying, isMinimized])

    useEffect(() => {
        if (totalClips > 0 && sourceDuration && duration) {
            dispatch(setVideoDetails({
                duration: sourceDuration,
                start: 0,
                end: duration,
            }))
        }
    }, [clips, dispatch, totalClips, duration, sourceDuration])

    const onDoubleClick = useCallback(
        time => dispatch(createClip(time, clips, playbackRate, layout, microphoneAudioVolume, systemAudioVolume,
            duration)),
        [dispatch, clips, playbackRate, layout, microphoneAudioVolume, systemAudioVolume, duration]
    )

    const onContextMenu = useCallback(
        () => dispatch(setIsNewClipMenuOpen(true)),
        [dispatch]
    )

    return (<Row name={CLIPS} className="h-16" animIds={clipIds} action={Clip} onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu} isMinimized={isMinimized} />)
}
