import {
    EyeIcon,
    EyeSlashIcon,
    LockClosedIcon,
    LockOpenIcon,
    SpeakerWaveIcon,
    SpeakerXMarkIcon,
    XMarkIcon
} from "@heroicons/react/16/solid"
import PropTypes from "prop-types"

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
    isMinimized = false
}) {

    if (isMinimized) {
        return <div className="h-2 flex items-center px-2">
            <span className="text-[7px] opacity-20 truncate">{name}</span>
        </div>
    }

    return (
        <div className="h-12 flex items-center px-2 gap-1 group/hdr hover:bg-base-content/5 transition-colors">
            <div className={`w-1 h-6 rounded-full shrink-0 bg-${color}`} />
            <div className="flex flex-col flex-1 min-w-0 pl-1">
                <span className="text-[10px] font-medium truncate leading-tight">{name}</span>
                <div className="flex items-center gap-px opacity-0 group-hover/hdr:opacity-100 transition-opacity">
                    {onToggleMute && (
                        <button onClick={e => { e.stopPropagation(); onToggleMute() }}
                            className={`p-0.5 rounded hover:bg-base-content/10 ${isMuted ? "text-warning opacity-100!" : "opacity-50"}`}
                            title={isMuted ? "Unmute" : "Mute"}>
                            {isMuted ? <SpeakerXMarkIcon className="size-3" /> : <SpeakerWaveIcon className="size-3" />}
                        </button>
                    )}
                    {onToggleLock && (
                        <button onClick={e => { e.stopPropagation(); onToggleLock() }}
                            className={`p-0.5 rounded hover:bg-base-content/10 ${isLocked ? "text-error opacity-100!" : "opacity-50"}`}
                            title={isLocked ? "Unlock" : "Lock"}>
                            {isLocked ? <LockClosedIcon className="size-3" /> : <LockOpenIcon className="size-3" />}
                        </button>
                    )}
                    {onToggleVisible && (
                        <button onClick={e => { e.stopPropagation(); onToggleVisible() }}
                            className={`p-0.5 rounded hover:bg-base-content/10 ${!isVisible ? "text-warning opacity-100!" : "opacity-50"}`}
                            title={isVisible ? "Hide" : "Show"}>
                            {isVisible ? <EyeIcon className="size-3" /> : <EyeSlashIcon className="size-3" />}
                        </button>
                    )}
                    {isRemovable && onRemove && (
                        <button onClick={e => { e.stopPropagation(); onRemove() }}
                            className="p-0.5 rounded hover:bg-base-content/10 opacity-50 hover:text-error"
                            title="Remove">
                            <XMarkIcon className="size-3" />
                        </button>
                    )}
                </div>
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
}
