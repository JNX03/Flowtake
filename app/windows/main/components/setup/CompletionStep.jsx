import { CheckCircleIcon, RocketLaunchIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import PropTypes from "prop-types"

export default function CompletionStep({ onComplete }) {
    const { data: launchCount } = useQuery({
        queryKey: ['launchCount'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "launchCount"),
        staleTime: Infinity
    })

    const { data: exportDir } = useQuery({
        queryKey: ['exportDirectory'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "exportDirectory"),
        staleTime: Infinity
    })

    const { data: themeName } = useQuery({
        queryKey: ['setup-theme-name'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "appearance-theme"),
        staleTime: Infinity
    })

    return (
        <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <CheckCircleIcon className="w-16 h-16 text-success" />

            <div>
                <h2 className="text-2xl font-bold">You're all set!</h2>
                <p className="text-base-content/60 mt-1">
                    Flowtake is ready to go.
                </p>
            </div>

            {/* Summary */}
            <div className="bg-base-200/50 rounded-xl p-4 text-left w-full max-w-sm space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-base-content/60">Theme</span>
                    <span className="font-medium">{themeName || "Flowtake Dark"}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-base-content/60">Export path</span>
                    <span className="font-medium truncate ml-4 max-w-[200px]">{exportDir || "Default"}</span>
                </div>
                {typeof launchCount === 'number' && (
                    <div className="flex justify-between text-sm">
                        <span className="text-base-content/60">Launch</span>
                        <span className="font-medium">#{launchCount}</span>
                    </div>
                )}
            </div>

            <button className="btn btn-primary gap-2" onClick={onComplete}>
                <RocketLaunchIcon className="w-5 h-5" />
                Get Started
            </button>
        </div>
    )
}

CompletionStep.propTypes = {
    onComplete: PropTypes.func.isRequired
}
