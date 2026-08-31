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

const TRACK_COLOR_CLASSES = {
    primary: "border-primary",
    secondary: "border-secondary",
    tertiary: "border-tertiary",
    accent: "border-accent",
    neutral: "border-neutral",
    "base-content": "border-base-content/30",
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
    isActive = false,
    height = "h-12"
}) {

    if (isMinimized) {
        return <div className={`flex h-2 shrink-0 items-center px-2 ${isActive ? "bg-primary/10" : ""}`}>
            <span className="text-[8px] opacity-30 truncate">{name}</span>
        </div>
    }

    const Icon = getTrackIcon(name)
    const hasVisibleState = isMuted || isLocked || !isVisible

    return (
        <div
            data-active={isActive || undefined}
            className={[
                "group/track relative flex shrink-0 items-center gap-1.5 border-l-2 px-2 transition-colors",
                height,
                TRACK_COLOR_CLASSES[color] || TRACK_COLOR_CLASSES["base-content"],
                isActive
                    ? "bg-primary/10 text-base-content"
                    : "hover:bg-base-content/[0.035]",
            ].join(" ")}
        >
            <Icon className={`size-3.5 shrink-0 ${isActive ? "opacity-90" : "opacity-45"}`} />
            <span className={`min-w-0 flex-1 truncate text-[11px] leading-tight ${isActive ? "font-semibold" : "font-medium opacity-75"}`}>
                {name}
            </span>
            <div className={[
                "absolute right-1 flex items-center rounded-md bg-base-100/95 shadow-sm transition-opacity",
                isActive || hasVisibleState
                    ? "opacity-100"
                    : "opacity-0 group-hover/track:opacity-100 group-focus-within/track:opacity-100",
            ].join(" ")}>
                {onToggleMute && (
                    <button type="button" onClick={e => { e.stopPropagation(); onToggleMute() }}
                        className={`btn btn-ghost btn-xs h-7 min-h-7 w-7 p-0 ${isMuted ? "text-warning opacity-100" : "opacity-50 hover:opacity-90"}`}
                        aria-label={isMuted ? `Unmute ${name}` : `Mute ${name}`}
                        aria-pressed={isMuted}
                        title={isMuted ? "Unmute" : "Mute"}>
                        {isMuted ? <SpeakerXMarkIcon className="size-3.5" /> : <SpeakerWaveIcon className="size-3.5" />}
                    </button>
                )}
                {onToggleVisible && (
                    <button type="button" onClick={e => { e.stopPropagation(); onToggleVisible() }}
                        className={`btn btn-ghost btn-xs h-7 min-h-7 w-7 p-0 ${!isVisible ? "text-warning opacity-100" : "opacity-50 hover:opacity-90"}`}
                        aria-label={isVisible ? `Hide ${name}` : `Show ${name}`}
                        aria-pressed={!isVisible}
                        title={isVisible ? "Hide" : "Show"}>
                        {isVisible ? <EyeIcon className="size-3.5" /> : <EyeSlashIcon className="size-3.5" />}
                    </button>
                )}
                {onToggleLock && (
                    <button type="button" onClick={e => { e.stopPropagation(); onToggleLock() }}
                        className={`btn btn-ghost btn-xs h-7 min-h-7 w-7 p-0 ${isLocked ? "text-error opacity-100" : "opacity-50 hover:opacity-90"}`}
                        aria-label={isLocked ? `Unlock ${name}` : `Lock ${name}`}
                        aria-pressed={isLocked}
                        title={isLocked ? "Unlock" : "Lock"}>
                        {isLocked ? <LockClosedIcon className="size-3.5" /> : <LockOpenIcon className="size-3.5" />}
                    </button>
                )}
                {isRemovable && onRemove && (
                    <button type="button" onClick={e => { e.stopPropagation(); onRemove() }}
                        className="btn btn-ghost btn-xs h-7 min-h-7 w-7 p-0 opacity-45 hover:text-error hover:opacity-90"
                        aria-label={`Remove ${name}`}
                        title="Remove">
                        <XMarkIcon className="size-3.5" />
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
    isActive: PropTypes.bool,
    height: PropTypes.string,
}
