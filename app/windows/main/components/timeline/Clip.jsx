import {
    ClockIcon,
    FilmIcon,
    MicrophoneIcon,
    SpeakerWaveIcon,
    Square2StackIcon
} from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    MODE_CAMERA_FULLSCREEN,
    MODE_CAMERA_OVERLAY,
    MODE_SCREEN_FULLSCREEN,
    MODE_SIDE_BY_SIDE
} from "@shared/constants"
import {
    CLIPS,
    formatMs,
    formatPercent,
    formatX
} from "@shared/helpers"
import {
    selectAllClips,
    selectClipById,
    updateClip
} from "@shared/redux/clipSlice"
import {
    setIsClipMenuOpen
} from "@shared/redux/contextMenuSlice"
import {
    selectHasCameraVideo,
    selectHasMicrophoneAudio,
    selectHasSystemAudio
} from "@shared/redux/projectSlice"
import {
    selectIsMaskingModeEnabled,
    selectSelectedRow,
    setOpenSection,
    setSelectedRow
} from "@shared/redux/timelineSlice"
import FlexibleAction from "./FlexibleAction"
import Label from "./Label"

export default function Clip({ id }) {

    const dispatch = useDispatch()

    const anim = useSelector(state => selectClipById(state, id))
    const anims = useSelector(state => selectAllClips(state, id))
    const hasCameraVideo = useSelector(selectHasCameraVideo)
    const hasMicrophoneAudio = useSelector(selectHasMicrophoneAudio)
    const hasSystemAudio = useSelector(selectHasSystemAudio)
    const selectedRow = useSelector(selectSelectedRow)
    const isMinimized = useSelector(selectIsMaskingModeEnabled)

    const onChange = useCallback(
        (start, end) => dispatch(updateClip({ id, changes: { start, end } })),
        [dispatch, id]
    )

    const onSelect = useCallback(() => {
        dispatch(setSelectedRow(CLIPS))
        dispatch(setOpenSection(CLIPS))
    }, [dispatch])

    const onContextMenu = useCallback(() => {
        dispatch(setSelectedRow(CLIPS))
        dispatch(setOpenSection(CLIPS))
        dispatch(setIsClipMenuOpen(true))
    }, [dispatch])

    const layoutMode = () => {
        switch (anim.layout.mode) {
            case MODE_CAMERA_OVERLAY: return "Camera overlay"
            case MODE_CAMERA_FULLSCREEN: return "Only camera"
            case MODE_SCREEN_FULLSCREEN: return "Only screen"
            case MODE_SIDE_BY_SIDE: return "Side-by-side"
            default: return ""
        }
    }

    return (<FlexibleAction anim={anim} anims={anims} isRowSelected={selectedRow === CLIPS} onChange={onChange}
        onSelect={onSelect} onContextMenu={onContextMenu} color="primary" isMinimized={isMinimized}>

        <Label
            isMinimized={isMinimized}
            badge={formatMs(anim.end - anim.start)}
            line1={<><FilmIcon className="size-4 shrink-0 mr-1" />Clip</>}
            line2={<>
                {hasCameraVideo && <span className="flex items-center gap-1">
                    <Square2StackIcon className="size-3 shrink-0" />
                    {layoutMode()}
                </span>}
                {hasMicrophoneAudio && <span className="flex items-center gap-1">
                    <MicrophoneIcon className="size-3 shrink-0" />
                    {formatPercent(anim.microphoneAudioVolume)}
                </span>}
                {hasSystemAudio && <span className="flex items-center gap-1">
                    <SpeakerWaveIcon className="size-3 shrink-0" />
                    {formatPercent(anim.systemAudioVolume)}
                </span>}
                <span className="flex items-center gap-1">
                    <ClockIcon className="size-3 shrink-0" />
                    {formatX(anim.playbackRate)}
                </span>
            </>}
        />

    </FlexibleAction>)
}

Clip.propTypes = {
    id: PropTypes.string.isRequired
}