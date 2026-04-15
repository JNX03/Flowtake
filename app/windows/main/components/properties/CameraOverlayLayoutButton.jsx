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

    const innerAspect = () => {
        switch (aspectRatio) {
            case "16x9": return "aspect-video"
            case "9x16": return "aspect-9/16"
            case "1x1": return "aspect-square"
            default: return "aspect-video"
        }
    }

    const positionClasses = () => {
        if (shallowEqual(cameraPosition, POS_TOP_LEFT)) return "left-1 top-1"
        else if (shallowEqual(cameraPosition, POS_TOP_RIGHT)) return "right-1 top-1"
        else if (shallowEqual(cameraPosition, POS_BOTTOM_LEFT)) return "left-1 bottom-1"
        else if (shallowEqual(cameraPosition, POS_BOTTOM_RIGHT)) return "right-1 bottom-1"
        return "right-1 bottom-1"
    }

    const frameClasses = isActive
        ? "bg-info/20 border-info"
        : `bg-base-300/40 border-base-content/20 ${disabled ? "opacity-40" : ""}`

    const chipClasses = isActive
        ? "bg-info border-info-content"
        : "bg-base-200 border-base-content/30"

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`group relative h-20 w-full rounded-lg border transition-all flex items-center justify-center p-2
                ${isActive
                    ? "border-info ring-2 ring-info/30 bg-info/10"
                    : "border-base-content/10 hover:border-base-content/30 hover:bg-base-200/60"}
                ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
        >
            <div className={`relative ${innerAspect()} max-w-[88%] max-h-full h-full`}>
                <div className={`w-full h-full rounded-sm border flex items-center justify-center transition-all ${frameClasses}`}>
                    <ComputerDesktopIcon className="h-4 w-4" />
                </div>
                <div className={`absolute ${positionClasses()} w-5 h-5 rounded-full border flex items-center justify-center transition-all ${chipClasses}`}>
                    <UserIcon className="h-3 w-3" />
                </div>
            </div>
        </button>
    )
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
