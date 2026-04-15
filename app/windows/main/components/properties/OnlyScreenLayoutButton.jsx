import { ComputerDesktopIcon } from "@heroicons/react/24/outline"
import PropTypes from 'prop-types'
import { useSelector } from "react-redux"
import { selectAspectRatio } from "@shared/redux/projectSlice"

export default function OnlyScreenLayoutButton({ onClick, isActive, disabled = false }) {

    const aspectRatio = useSelector(selectAspectRatio)

    const activeClasses = (alwaysDrawBg = false) => isActive
        ? "bg-info border-info-content"
        : `${alwaysDrawBg ? "bg-base-200" : ""}${disabled ? " border-base-content/20" : ""}`

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
            case "9x16": return "py-1 px-4"
            case "1x1": return "py-1 px-2"
            default: return "p-1"
        }
    }

    return (<button className={`btn btn-sm ${isActive ? "btn-info" : ""} h-auto ${paddingClasses()}`}
        onClick={onClick} disabled={disabled}>
        <div className={`w-full ${aspectRatioClasses()} relative p-1`}>
            <div className={`w-full h-full rounded-xs border-2 flex items-center justify-center transition-all ${activeClasses()}`} >
                <ComputerDesktopIcon className="h-4 w-4" />
            </div>
        </div>
    </button>)
}

OnlyScreenLayoutButton.propTypes = {
    onClick: PropTypes.func.isRequired,
    isActive: PropTypes.bool.isRequired,
    disabled: PropTypes.bool
}