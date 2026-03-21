import { UserIcon } from "@heroicons/react/24/outline"
import PropTypes from 'prop-types'
import { useSelector } from "react-redux"
import { selectAspectRatio } from "@shared/redux/projectSlice"

export default function OnlyCameraLayoutButton({ onClick, isActive, disabled = false }) {

    const aspectRatio = useSelector(selectAspectRatio)

    const activeClasses = (alwaysDrawBg = false) => isActive
        ? "bg-info border-info-content"
        : `${alwaysDrawBg ? "bg-base-200" : ""}${disabled ? " border-base-content/20" : ""}`

    const aspectRatioClasses = () => {
        switch (aspectRatio) {
            case "16x9": return "aspect-video"
            case "9x16": return "aspect-9/16"
            case "1x1": return "aspect-square"
        }
    }

    const paddingClasses = () => {
        switch (aspectRatio) {
            case "16x9": return "p-1"
            case "9x16": return "py-1 px-8"
            case "1x1": return "py-1 px-5"
        }
    }

    return (<button className={`btn ${isActive ? "btn-info" : ""} h-auto ${paddingClasses()}`}
        onClick={onClick} disabled={disabled}>
        <div className={`w-full ${aspectRatioClasses()} relative p-2`}>
            <div className={`w-full h-full rounded-xs border-2 flex items-center justify-center transition-all ${activeClasses()}`} >
                <UserIcon className="h-6 w-6" />
            </div>
        </div>
    </button>)
}

OnlyCameraLayoutButton.propTypes = {
    onClick: PropTypes.func.isRequired,
    isActive: PropTypes.bool.isRequired,
    disabled: PropTypes.bool
}