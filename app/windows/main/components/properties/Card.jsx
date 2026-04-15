import { XMarkIcon } from "@heroicons/react/16/solid"
import PropTypes from "prop-types"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    AUDIO_TRACKS,
    CLICKS,
    CLIPS,
    MASKS,
    OVERLAY_TRACKS,
    SCREEN_RECORDING,
    SUBTITLES,
    ZOOMS
} from "@shared/helpers"
import {
    selectOpenSection,
    selectSelectedIds,
    setIsMaskingModeEnabled,
    setOpenSection,
    setSelectedIds
} from "@shared/redux/timelineSlice"

export default function Card({ icon, title, children, showClose }) {

    const selectedIds = useSelector(selectSelectedIds)
    const openSection = useSelector(selectOpenSection)

    const dispatch = useDispatch()

    const close = () => {
        dispatch(setSelectedIds([]))
        dispatch(setIsMaskingModeEnabled(false))
        dispatch(setOpenSection(SCREEN_RECORDING))
    }

    const accentColor = () => {
        switch (openSection) {
            case CLIPS: return "text-primary"
            case CLICKS: return "text-accent"
            case ZOOMS: return "text-secondary"
            case SUBTITLES: return "text-tertiary"
            case MASKS: return "text-base-content"
            case AUDIO_TRACKS: return "text-secondary"
            case OVERLAY_TRACKS: return "text-accent"
            default: return "text-base-content"
        }
    }

    return (
        <div className="card card-sm bg-base-100 rounded-lg h-full overflow-hidden">
            <div className="flex flex-col h-full min-h-0">
                <div className="flex items-center gap-2 px-4 pt-4 pb-2 shrink-0">
                    {icon && <span className={`shrink-0 ${accentColor()}`}>{icon}</span>}
                    <h2 className="flex-1 min-w-0 font-semibold text-base truncate">{title}</h2>
                    {showClose && (
                        <div className="flex items-center gap-1 shrink-0">
                            <span className={`badge badge-sm badge-ghost ${accentColor()} font-medium`}>
                                {selectedIds.length} selected
                            </span>
                            <button
                                className="btn btn-ghost btn-xs btn-square"
                                onClick={close}
                                aria-label="Close section"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex-1 min-h-0 overflow-auto px-4 pb-4 flex flex-col gap-4">
                    {children}
                </div>
            </div>
        </div>
    )
}

Card.propTypes = {
    icon: PropTypes.element,
    title: PropTypes.string.isRequired,
    children: PropTypes.node,
    showClose: PropTypes.bool
}
