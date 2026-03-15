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
} from "../../../../src/helpers"
import {
    selectOpenSection,
    selectSelectedIds,
    setIsMaskingModeEnabled,
    setOpenSection,
    setSelectedIds
} from "../../../../src/redux/timelineSlice"

export default function Card({ icon, title, children, showClose }) {

    const selectedIds = useSelector(selectSelectedIds)
    const openSection = useSelector(selectOpenSection)

    const dispatch = useDispatch()

    const close = () => {
        dispatch(setSelectedIds([]))
        dispatch(setIsMaskingModeEnabled(false))
        dispatch(setOpenSection(SCREEN_RECORDING))
    }

    const badgeColor = () => {
        switch (openSection) {
            case CLIPS: return "badge-primary"
            case CLICKS: return "badge-accent"
            case ZOOMS: return "badge-secondary"
            case SUBTITLES: return "bg-tertiary text-tertiary-content border-tertiary"
            case MASKS: return "badge-neutral"
            case AUDIO_TRACKS: return "badge-secondary"
            case OVERLAY_TRACKS: return "badge-accent"
            default: return ""
        }
    }

    return (
        <div className="card card-sm bg-base-100 rounded-lg h-full">
            <div className="card-body overflow-auto p-0!">
                <span className="card-title px-4 pt-4">
                    {icon}
                    <span className="flex-1">{title}</span>
                    {showClose && <div className="join">
                        <div className={`join-item badge shadow-lg ${badgeColor()}`}>
                            {selectedIds.length} selected
                        </div>
                        <button className={`join-item cursor-pointer badge shadow-lg ${badgeColor()}`} onClick={close}>
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>}
                </span>
                <div className="flex-1 px-4 pb-4 overflow-auto">
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