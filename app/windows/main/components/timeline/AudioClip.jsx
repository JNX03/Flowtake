import {
    MusicalNoteIcon,
    SpeakerWaveIcon
} from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import {
    useCallback,
    useMemo
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { AUDIO_TRACKS, formatPercent, msToPx } from "@shared/helpers"
import {
    selectAudioClipById,
    selectAllAudioClips,
    updateAudioClip
} from "@shared/redux/audioTrackSlice"
import {
    selectPxPerMs,
    selectSelectedRow,
    setOpenSection,
    setSelectedRow
} from "@shared/redux/timelineSlice"
import AudioWaveform from "./AudioWaveform"
import FlexibleAction from "./FlexibleAction"
import Label from "./Label"

export default function AudioClip({ id }) {

    const dispatch = useDispatch()

    const anim = useSelector(state => selectAudioClipById(state, id))
    const anims = useSelector(selectAllAudioClips)
    const selectedRow = useSelector(selectSelectedRow)
    const pxPerMs = useSelector(selectPxPerMs)

    const trackAnims = anims.filter(a => a.trackIndex === anim?.trackIndex)

    const clipWidthPx = useMemo(
        () => anim ? msToPx(anim.end - anim.start, pxPerMs) : 0,
        [anim, pxPerMs]
    )

    // Waveform should only paint inside the move column, not under the two 24px resize handles
    const waveformWidth = Math.max(clipWidthPx - 48, 0)

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
            <div className="relative flex-1 min-w-0 h-full overflow-hidden flex flex-col justify-center">
                <AudioWaveform waveformData={anim.waveformData} width={waveformWidth} />
                <Label
                    line1={<><MusicalNoteIcon className="size-4 shrink-0 mr-1 inline-block align-text-bottom" />{anim.name || "Audio"}</>}
                    line2={<>
                        <SpeakerWaveIcon className="size-3 shrink-0 inline-block align-text-bottom mr-1" />
                        {formatPercent(anim.volume ?? 1)}
                    </>}
                />
            </div>
        </FlexibleAction>
    )
}

AudioClip.propTypes = {
    id: PropTypes.string.isRequired
}
