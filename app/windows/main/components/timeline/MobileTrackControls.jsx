import {
    Bars3Icon,
    EyeIcon,
    EyeSlashIcon,
    LockClosedIcon,
    LockOpenIcon,
    MusicalNoteIcon,
    PlusIcon,
    SpeakerWaveIcon,
    SpeakerXMarkIcon,
    Square2StackIcon,
    TrashIcon,
} from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import {
    useDispatch,
    useSelector,
} from "react-redux"
import {
    addTrack as addAudioTrack,
    removeTrack as removeAudioTrack,
    selectAudioTracks,
    toggleTrackLock,
    toggleTrackMute,
} from "@shared/redux/audioTrackSlice"
import {
    addOverlayTrack,
    removeOverlayTrack,
    selectOverlayTracks,
    toggleOverlayTrackLock,
    toggleOverlayTrackVisibility,
} from "@shared/redux/overlaySlice"

export default function MobileTrackControls() {
    const dispatch = useDispatch()
    const audioTracks = useSelector(selectAudioTracks)
    const overlayTracks = useSelector(selectOverlayTracks)
    const totalTracks = audioTracks.length + overlayTracks.length

    return (
        <details className="border-b border-base-content/10 bg-base-100 md:hidden">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
                <Bars3Icon className="size-4 text-base-content/60" />
                <span>Track controls</span>
                <span className="badge badge-ghost badge-sm ml-auto">{totalTracks}</span>
            </summary>
            <div className="max-h-44 space-y-1 overflow-y-auto border-t border-base-content/8 p-2">
                {totalTracks === 0 && (
                    <p className="px-1 py-2 text-[11px] text-base-content/45">
                        Add an audio or visual track to start layering media.
                    </p>
                )}
                {audioTracks.map(track => (
                    <TrackControlRow
                        key={`mobile-audio-${track.id}`}
                        icon={MusicalNoteIcon}
                        name={track.name}
                        colorClass="text-secondary"
                        isMuted={Boolean(track.muted)}
                        isLocked={Boolean(track.locked)}
                        onToggleMute={() => dispatch(toggleTrackMute(track.id))}
                        onToggleLock={() => dispatch(toggleTrackLock(track.id))}
                        onRemove={() => dispatch(removeAudioTrack(track.id))}
                    />
                ))}
                {overlayTracks.map(track => (
                    <TrackControlRow
                        key={`mobile-overlay-${track.id}`}
                        icon={Square2StackIcon}
                        name={track.name}
                        colorClass="text-accent"
                        isLocked={Boolean(track.locked)}
                        isVisible={track.visible !== false}
                        onToggleLock={() => dispatch(toggleOverlayTrackLock(track.id))}
                        onToggleVisibility={() => dispatch(toggleOverlayTrackVisibility(track.id))}
                        onRemove={() => dispatch(removeOverlayTrack(track.id))}
                    />
                ))}
                <div className="grid grid-cols-2 gap-2 border-t border-base-content/8 pt-2">
                    <button
                        type="button"
                        onClick={() => dispatch(addAudioTrack())}
                        className="btn btn-ghost btn-sm justify-start gap-1.5"
                    >
                        <PlusIcon className="size-3.5" />
                        Audio track
                    </button>
                    <button
                        type="button"
                        onClick={() => dispatch(addOverlayTrack())}
                        className="btn btn-ghost btn-sm justify-start gap-1.5"
                    >
                        <PlusIcon className="size-3.5" />
                        Visual track
                    </button>
                </div>
            </div>
        </details>
    )
}

function TrackControlRow({
    icon: Icon,
    name,
    colorClass,
    isMuted,
    isLocked,
    isVisible,
    onToggleMute,
    onToggleLock,
    onToggleVisibility,
    onRemove,
}) {
    return (
        <div className="flex min-h-9 items-center gap-1 rounded-lg bg-base-200/45 px-1.5">
            <Icon className={`size-3.5 shrink-0 ${colorClass}`} />
            <span className="min-w-0 flex-1 truncate px-1 text-[11px] font-medium">{name}</span>
            {onToggleMute && (
                <button
                    type="button"
                    onClick={onToggleMute}
                    className="btn btn-ghost btn-xs h-8 min-h-8 w-8 p-0"
                    aria-label={isMuted ? `Unmute ${name}` : `Mute ${name}`}
                    aria-pressed={Boolean(isMuted)}
                    title={isMuted ? "Unmute" : "Mute"}
                >
                    {isMuted
                        ? <SpeakerXMarkIcon className="size-3.5" />
                        : <SpeakerWaveIcon className="size-3.5" />}
                </button>
            )}
            {onToggleVisibility && (
                <button
                    type="button"
                    onClick={onToggleVisibility}
                    className="btn btn-ghost btn-xs h-8 min-h-8 w-8 p-0"
                    aria-label={isVisible ? `Hide ${name}` : `Show ${name}`}
                    aria-pressed={!isVisible}
                    title={isVisible ? "Hide" : "Show"}
                >
                    {isVisible
                        ? <EyeIcon className="size-3.5" />
                        : <EyeSlashIcon className="size-3.5" />}
                </button>
            )}
            <button
                type="button"
                onClick={onToggleLock}
                className="btn btn-ghost btn-xs h-8 min-h-8 w-8 p-0"
                aria-label={isLocked ? `Unlock ${name}` : `Lock ${name}`}
                aria-pressed={Boolean(isLocked)}
                title={isLocked ? "Unlock" : "Lock"}
            >
                {isLocked
                    ? <LockClosedIcon className="size-3.5" />
                    : <LockOpenIcon className="size-3.5" />}
            </button>
            <button
                type="button"
                onClick={onRemove}
                className="btn btn-ghost btn-xs h-8 min-h-8 w-8 p-0 text-error"
                aria-label={`Remove ${name}`}
                title="Remove track"
            >
                <TrashIcon className="size-3.5" />
            </button>
        </div>
    )
}

TrackControlRow.propTypes = {
    icon: PropTypes.elementType.isRequired,
    name: PropTypes.string.isRequired,
    colorClass: PropTypes.string.isRequired,
    isMuted: PropTypes.bool,
    isLocked: PropTypes.bool.isRequired,
    isVisible: PropTypes.bool,
    onToggleMute: PropTypes.func,
    onToggleLock: PropTypes.func.isRequired,
    onToggleVisibility: PropTypes.func,
    onRemove: PropTypes.func.isRequired,
}
