import { CheckCircleIcon, RocketLaunchIcon } from "@heroicons/react/24/outline"
import PropTypes from "prop-types"

export default function CompletionStep({ onComplete }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <CheckCircleIcon className="w-16 h-16 text-success" />

            <div>
                <h2 className="text-2xl font-bold">Ready for your first take</h2>
                <p className="text-base-content/60 mt-1">
                    Your recording controls stay close, and everything is saved locally.
                </p>
            </div>

            <div className="bg-base-200/50 rounded-xl p-4 text-left w-full max-w-sm space-y-2">
                <div className="flex items-center gap-2 text-sm">
                    <CheckCircleIcon className="size-4 text-success flex-none" />
                    <span>Pick a screen, window, or area</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <CheckCircleIcon className="size-4 text-success flex-none" />
                    <span>Add camera or microphone only when needed</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <CheckCircleIcon className="size-4 text-success flex-none" />
                    <span>Press Record, then stop from the floating controls</span>
                </div>
            </div>

            <button type="button" className="btn btn-primary gap-2" onClick={onComplete}>
                <RocketLaunchIcon className="w-5 h-5" />
                Open recorder
            </button>
        </div>
    )
}

CompletionStep.propTypes = {
    onComplete: PropTypes.func.isRequired
}
