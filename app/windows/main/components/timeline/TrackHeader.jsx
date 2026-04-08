import {
    ChatBubbleLeftIcon,
    EyeIcon,
    EyeSlashIcon,
    FilmIcon,
    LockClosedIcon,
    LockOpenIcon,
    MagnifyingGlassIcon,
    MusicalNoteIcon,
    SpeakerWaveIcon,
    SpeakerXMarkIcon,
    Squares2X2Icon,
    XMarkIcon
} from "@heroicons/react/16/solid"
import PropTypes from "prop-types"

const TRACK_ICONS = {
    Clips: FilmIcon,
    Zooms: MagnifyingGlassIcon,
    Subtitles: ChatBubbleLeftIcon,
    Masks: Squares2X2Icon,
}

function getTrackIcon(name) {
    if (TRACK_ICONS[name]) return TRACK_ICONS[name]
    if (name?.toLowerCase().includes("audio")) return MusicalNoteIcon
    return Squares2X2Icon
}

export default function TrackHeader({
    name,
    color = "base-content",
    isMuted = false,
    isLocked = false,
    isVisible = true,
    onToggleMute,
    onToggleLock,
    onToggleVisible,
    onRemove,
    isRemovable = false,
    isMinimized = false,
    height = "h-12"
}) {

    if (isMinimized) {
        return <div className="h-2 flex items-center px-2">
            <span className="text-[8px] opacity-30 truncate">{name}</span>
        </div>
    }

    const Icon = getTrackIcon(name)

    return (
        <div className={`${height} flex items-center px-2 gap-1.5 border-l-2 border-${color} transition-colors`}>
            <Icon className="size-3.5 shrink-0 opacity-50" />
            <span className="text-[11px] font-medium truncate leading-tight opacity-80 flex-1 min-w-0">{name}</span>
            <div className="flex items-center gap-px shrink-0">
                {onToggleMute && (
                    <button onClick={e => { e.stopPropagation(); onToggleMute() }}
                        className={`p-0.5 rounded hover:bg-base-content/10 transition-opacity ${isMuted ? "text-warning opacity-100" : "opacity-40 hover:opacity-80"}`}
                        title={isMuted ? "Unmute" : "Mute"}>
                        {isMuted ? <SpeakerXMarkIcon className="size-3" /> : <SpeakerWaveIcon className="size-3" />}
                    </button>
                )}
                {onToggleLock && (
                    <button onClick={e => { e.stopPropagation(); onToggleLock() }}
                        className={`p-0.5 rounded hover:bg-base-content/10 transition-opacity ${isLocked ? "text-error opacity-100" : "opacity-40 hover:opacity-80"}`}
                        title={isLocked ? "Unlock" : "Lock"}>
                        {isLocked ? <LockClosedIcon className="size-3" /> : <LockOpenIcon className="size-3" />}
                    </button>
                )}
                {onToggleVisible && (
                    <button onClick={e => { e.stopPropagation(); onToggleVisible() }}
                        className={`p-0.5 rounded hover:bg-base-content/10 transition-opacity ${!isVisible ? "text-warning opacity-100" : "opacity-40 hover:opacity-80"}`}
                        title={isVisible ? "Hide" : "Show"}>
                        {isVisible ? <EyeIcon className="size-3" /> : <EyeSlashIcon className="size-3" />}
                    </button>
                )}
                {isRemovable && onRemove && (
                    <button onClick={e => { e.stopPropagation(); onRemove() }}
                        className="p-0.5 rounded hover:bg-base-content/10 opacity-40 hover:text-error hover:opacity-80 transition-opacity"
                        title="Remove">
                        <XMarkIcon className="size-3" />
                    </button>
                )}
            </div>
        </div>
    )
}

TrackHeader.propTypes = {
    name: PropTypes.string.isRequired,
    color: PropTypes.string,
    isMuted: PropTypes.bool,
    isLocked: PropTypes.bool,
    isVisible: PropTypes.bool,
    onToggleMute: PropTypes.func,
    onToggleLock: PropTypes.func,
    onToggleVisible: PropTypes.func,
    onRemove: PropTypes.func,
    isRemovable: PropTypes.bool,
    isMinimized: PropTypes.bool,
    height: PropTypes.string,
}
