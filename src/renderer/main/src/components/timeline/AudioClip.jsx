import {
    MusicalNoteIcon,
    SpeakerWaveIcon
} from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import { useCallback } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { AUDIO_TRACKS, formatPercent } from "../../../../src/helpers"
import {
    selectAudioClipById,
    selectAllAudioClips,
    updateAudioClip
} from "../../../../src/redux/audioTrackSlice"
import {
    selectSelectedRow,
    setOpenSection,
    setSelectedRow
} from "../../../../src/redux/timelineSlice"
import FlexibleAction from "./FlexibleAction"
import Label from "./Label"

export default function AudioClip({ id }) {

    const dispatch = useDispatch()

    const anim = useSelector(state => selectAudioClipById(state, id))
    const anims = useSelector(selectAllAudioClips)
    const selectedRow = useSelector(selectSelectedRow)

    const trackAnims = anims.filter(a => a.trackIndex === anim?.trackIndex)

    const onChange = useCallback(
        (start, end) => dispatch(updateAudioClip({ id, changes: { start, end } })),
        [dispatch, id]
    )

    const onTrackChange = useCallback(
        (start, end, newTrackId) => dispatch(updateAudioClip({ id, changes: { start, end, trackIndex: newTrackId } })),
        [dispatch, id]
    )

    const getTrackAnims = useCallback(
        (trackId) => anims.filter(a => a.trackIndex === trackId),
        [anims]
    )

    const onSelect = useCallback(() => {
        dispatch(setSelectedRow(AUDIO_TRACKS))
        dispatch(setOpenSection(AUDIO_TRACKS))
    }, [dispatch])

    if (!anim) return null

    return (
        <FlexibleAction anim={anim} anims={trackAnims} isRowSelected={selectedRow === AUDIO_TRACKS}
            onChange={onChange} onSelect={onSelect} color="secondary"
            crossTrackEnabled currentTrackId={anim.trackIndex}
            trackDropZone="audio-track" getTrackAnims={getTrackAnims}
            onTrackChange={onTrackChange}>
            <Label
                line1={<><MusicalNoteIcon className="size-4 shrink-0 mr-1" />{anim.name || "Audio"}</>}
                line2={<>
                    <span className="flex items-center gap-1">
                        <SpeakerWaveIcon className="size-3 shrink-0" />
                        {formatPercent(anim.volume ?? 1)}
                    </span>
                </>}
            />
        </FlexibleAction>
    )
}

AudioClip.propTypes = {
    id: PropTypes.string.isRequired
}
