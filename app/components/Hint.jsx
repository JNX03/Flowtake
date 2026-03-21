import {
    InformationCircleIcon,
    XMarkIcon
} from "@heroicons/react/16/solid"
import PropTypes from "prop-types"

export default function Hint({ children, type, dismiss }) {
    return (
        <div className={`alert ${type || ""}`}>
            <span className="h-full">
                <InformationCircleIcon className={`size-4 ${type ? "" : "text-info"}`} />
            </span>
            <span className="text-xs">{children}</span>
            {dismiss && <div className="flex items-center">
                <button className="btn btn-sm btn-ghost ml-1" onClick={dismiss}><XMarkIcon className="size-4" /></button>
            </div>}
        </div>
    )
}

Hint.propTypes = {
    children: PropTypes.node.isRequired,
    type: PropTypes.string,
    dismiss: PropTypes.func
}