import { XMarkIcon } from "@heroicons/react/20/solid"
import PropTypes from "prop-types"

export default function PickerWrapper({ children, onCancel, instruction }) {
    return (<div className="h-full w-full relative overflow-hidden">
        <div className="absolute z-20 w-full top-0 flex justify-center pt-3 px-3 pointer-events-none">
            <div className="flex items-center gap-3 px-3 py-2 bg-base-300/95 backdrop-blur rounded-xl shadow-lg pointer-events-auto border border-base-content/10">
                {instruction && <p className="text-sm font-medium text-base-content/80">{instruction}</p>}
                <button type="button" className="btn btn-sm btn-ghost text-error" onClick={onCancel}>
                    <XMarkIcon className="h-5 w-5" />Cancel
                </button>
            </div>
        </div>
        {children}
    </div >)
}

PickerWrapper.propTypes = {
    children: PropTypes.node.isRequired,
    onCancel: PropTypes.func.isRequired,
    instruction: PropTypes.string,
}
