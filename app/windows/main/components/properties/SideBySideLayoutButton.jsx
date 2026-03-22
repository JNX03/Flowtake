import {
    ComputerDesktopIcon,
    UserIcon
} from "@heroicons/react/24/outline"
import PropTypes from "prop-types"
import { useSelector } from "react-redux"
import { selectAspectRatio } from "@shared/redux/projectSlice"

export default function SideBySideLayoutButton({ onClick, isActive, cameraPosition, disabled = false }) {

    const aspectRatio = useSelector(selectAspectRatio)

    const activeClasses = (alwaysDrawBg = false) => isActive
        ? "bg-info border-info-content"
        : `${alwaysDrawBg ? "bg-base-200" : ""}${disabled ? " border-base-content/20" : ""}`

    const positionClasses = () => {
        if (cameraPosition === "left") return "flex"
        else if (cameraPosition === "right") return "flex flex-row-reverse"
        else if (cameraPosition === "top") return "flex flex-col"
        else if (cameraPosition === "bottom") return "flex flex-col-reverse"
        return "flex"
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
        <div className={`w-full relative p-2 ${positionClasses()} ${aspectRatioClasses()} gap-1`}>
            <div className={`flex-1 rounded-xs border-2 flex items-center justify-center transition-all ${activeClasses()}`} >
                <UserIcon className="h-6 w-6" />
            </div>
            <div className={`flex-2 rounded-xs border-2 flex items-center justify-center transition-all ${activeClasses()}`} >
                <ComputerDesktopIcon className="h-6 w-6" />
            </div>
        </div>
    </button>)
}

SideBySideLayoutButton.propTypes = {
    onClick: PropTypes.func.isRequired,
    isActive: PropTypes.bool.isRequired,
    cameraPosition: PropTypes.oneOf(['left', 'right', 'top', 'bottom']).isRequired,
    disabled: PropTypes.bool
}