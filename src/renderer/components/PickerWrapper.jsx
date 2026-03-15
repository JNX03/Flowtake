import { XMarkIcon } from "@heroicons/react/20/solid"
import PropTypes from "prop-types"

export default function PickerWrapper({ children, onCancel }) {
    return (<div className="h-full w-full relative overflow-hidden">
        <div className="absolute z-10 w-full top-0 flex justify-center pt-1 pointer-events-none">
            <div className="flex items-center px-3 py-2 bg-base-300 rounded-xl shadow-lg pointer-events-auto">
                <button className="btn btn-sm btn-error" onClick={onCancel}>
                    <XMarkIcon className="h-5 w-5" />Cancel
                </button>
            </div>
        </div>
        {children}
    </div >)
}

PickerWrapper.propTypes = {
    children: PropTypes.node.isRequired,
    onCancel: PropTypes.func.isRequired
}