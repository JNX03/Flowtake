import { MusicalNoteIcon } from "@heroicons/react/24/outline"
import {
    PlusIcon,
    SpeakerWaveIcon,
    TrashIcon
} from "@heroicons/react/16/solid"
import {
    useCallback,
    useMemo
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { formatPercent } from "../../../../src/helpers"
import {
    addTrack,
    removeAudioClip,
    selectAllAudioClips,
    selectAudioClipById,
    selectAudioTracks,
    toggleTrackLock,
    toggleTrackMute,
    updateAudioClip,
    updateTrack
} from "../../../../src/redux/audioTrackSlice"
import {
    selectSelectedIds,
    setSelectedIds
} from "../../../../src/redux/timelineSlice"
import Card from "./Card"
import Fieldset from "./Fieldset"
import Slider from "./Slider"

export default function AudioTrackSection() {

    const dispatch = useDispatch()

    const selectedIds = useSelector(selectSelectedIds)
    const allClips = useSelector(selectAllAudioClips)
    const tracks = useSelector(selectAudioTracks)

    const selectedClips = useMemo(
        () => selectedIds.map(id => allClips.find(c => c.id === id)).filter(Boolean),
        [selectedIds, allClips]
    )

    const volume = useMemo(() => {
        if (selectedClips.length === 0) return 1
        return selectedClips[0]?.volume ?? 1
    }, [selectedClips])

    const onVolumeChange = useCallback(value => {
        selectedIds.forEach(id => {
            dispatch(updateAudioClip({ id, changes: { volume: value } }))
        })
    }, [dispatch, selectedIds])

    const onDelete = useCallback(() => {
        selectedIds.forEach(id => dispatch(removeAudioClip(id)))
        dispatch(setSelectedIds([]))
    }, [dispatch, selectedIds])

    const onAddTrack = useCallback(() => {
        dispatch(addTrack())
    }, [dispatch])

    const onRenameTrack = useCallback((id, name) => {
        dispatch(updateTrack({ id, changes: { name } }))
    }, [dispatch])

    return (
        <Card icon={<MusicalNoteIcon className="w-6 h-6" />} title="Audio Tracks"
            showClose={selectedClips.length > 0}>
            <div className="flex flex-col gap-4">
                {/* Track Management */}
                <Fieldset legend="Tracks">
                    <div className="flex flex-col gap-2">
                        {tracks.map(track => (
                            <div key={track.id} className="flex items-center gap-2 px-2 py-1 bg-base-300 rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-secondary shrink-0" />
                                <input
                                    type="text"
                                    value={track.name}
                                    onChange={e => onRenameTrack(track.id, e.target.value)}
                                    className="input input-xs input-ghost flex-1 min-w-0 bg-transparent"
                                />
                                <button
                                    className={`btn btn-ghost btn-xs ${track.muted ? "text-warning" : "opacity-50"}`}
                                    onClick={() => dispatch(toggleTrackMute(track.id))}
                                    title={track.muted ? "Unmute" : "Mute"}
                                >
                                    <SpeakerWaveIcon className="size-3" />
                                </button>
                            </div>
                        ))}
                        <button className="btn btn-xs btn-ghost gap-1" onClick={onAddTrack}>
                            <PlusIcon className="size-3" />
                            Add Audio Track
                        </button>
                    </div>
                </Fieldset>

                {/* Selected Clip Properties */}
                {selectedClips.length > 0 && (
                    <Fieldset legend="Selected Audio">
                        <div className="flex flex-col gap-3">
                            <Slider
                                label="Volume"
                                min={0}
                                max={2}
                                step={0.05}
                                value={volume}
                                onChange={onVolumeChange}
                                format={formatPercent}
                            />
                            <div className="flex justify-end">
                                <button className="btn btn-xs btn-error btn-outline gap-1" onClick={onDelete}>
                                    <TrashIcon className="size-3" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    </Fieldset>
                )}

                {/* Instructions */}
                {selectedClips.length === 0 && (
                    <div className="text-xs opacity-40 text-center py-4">
                        Double-click on an audio track to add a clip,<br />
                        or drag audio from the Assets panel.
                    </div>
                )}
            </div>
        </Card>
    )
}
