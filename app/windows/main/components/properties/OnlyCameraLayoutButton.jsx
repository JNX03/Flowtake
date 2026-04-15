import { UserIcon } from "@heroicons/react/24/outline"
import PropTypes from 'prop-types'
import { useSelector } from "react-redux"
import { selectAspectRatio } from "@shared/redux/projectSlice"

export default function OnlyCameraLayoutButton({ onClick, isActive, disabled = false }) {

    const aspectRatio = useSelector(selectAspectRatio)

    const innerAspect = () => {
        switch (aspectRatio) {
            case "16x9": return "aspect-video"
            case "9x16": return "aspect-9/16"
            case "1x1": return "aspect-square"
            default: return "aspect-video"
        }
    }

    const frameClasses = isActive
        ? "bg-info/30 border-info"
        : `bg-base-300/40 border-base-content/20 ${disabled ? "opacity-40" : ""}`

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
                    <UserIcon className="h-4 w-4" />
                </div>
            </div>
        </button>
    )
}

OnlyCameraLayoutButton.propTypes = {
    onClick: PropTypes.func.isRequired,
    isActive: PropTypes.bool.isRequired,
    disabled: PropTypes.bool
}
