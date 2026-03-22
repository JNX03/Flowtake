import { UserIcon } from "@heroicons/react/20/solid"
import { ComputerDesktopIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import {
    shallowEqual,
    useSelector
} from "react-redux"
import {
    POS_BOTTOM_LEFT,
    POS_BOTTOM_RIGHT,
    POS_TOP_LEFT,
    POS_TOP_RIGHT
} from "@shared/constants"
import { selectAspectRatio } from "@shared/redux/projectSlice"

export default function CameraOverlayLayoutButton({ onClick, isActive, cameraPosition, disabled = false }) {

    const aspectRatio = useSelector(selectAspectRatio)

    const activeClasses = (alwaysDrawBg = false) => isActive
        ? "bg-info border-info-content"
        : `${alwaysDrawBg ? "bg-base-200" : ""}${disabled ? " border-base-content/20" : ""}`

    const positionClasses = () => {
        if (shallowEqual(cameraPosition, POS_TOP_LEFT)) return "left-1 top-1"
        else if (shallowEqual(cameraPosition, POS_TOP_RIGHT)) return "right-1 top-1"
        else if (shallowEqual(cameraPosition, POS_BOTTOM_LEFT)) return "left-1 bottom-1"
        else if (shallowEqual(cameraPosition, POS_BOTTOM_RIGHT)) return "right-1 bottom-1"
        return "right-1 bottom-1"
    }

    const aspectRatioClasses = () => {
        switch (aspectRatio) {
            case "16x9": return "aspect-video"
            case "9x16": return "aspect-9/16"
            case "1x1": return "aspect-square"
            default: return "aspect-video"
        }
    }

    const paddingClasses = () => {
        switch (aspectRatio) {
            case "16x9": return "p-1"
            case "9x16": return "py-1 px-8"
            case "1x1": return "py-1 px-5"
            default: return "p-1"
        }
    }

    return (<button className={`btn ${isActive ? "btn-info" : ""} h-auto ${paddingClasses()}`}
        onClick={onClick} disabled={disabled}>
        <div className={`w-full ${aspectRatioClasses()} relative p-2`}>
            <div className={`w-full h-full rounded-xs border-2 flex items-center justify-center transition-all ${activeClasses()}`} >
                <ComputerDesktopIcon className="h-6 w-6" />
            </div>
            <div className={`absolute ${positionClasses()} w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${activeClasses(true)}`} >
                <UserIcon className="h-5 w-5" />
            </div>
        </div>
    </button>)
}

CameraOverlayLayoutButton.propTypes = {
    onClick: PropTypes.func.isRequired,
    isActive: PropTypes.bool.isRequired,
    cameraPosition: PropTypes.shape({
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired
    }).isRequired,
    disabled: PropTypes.bool
}