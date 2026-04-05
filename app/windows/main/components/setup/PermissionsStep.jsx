import {
    CheckCircleIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    ArrowTopRightOnSquareIcon
} from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"

export default function PermissionsStep() {
    const { data: permissions, isPending: permPending, refetch: refetchPerms } = useQuery({
        queryKey: ['setup-permissions'],
        queryFn: () => window.electron.ipcRenderer.invoke("check-permissions"),
        staleTime: 0
    })

    const { data: depsData, isPending: depsPending, refetch: refetchDeps } = useQuery({
        queryKey: ['setup-dependencies'],
        queryFn: () => window.electron.ipcRenderer.invoke("check-dependencies"),
        staleTime: 0
    })

    const dependencies = depsData?.dependencies ?? depsData
    const isLoading = permPending || depsPending
    const allPermsOk = permissions?.every(p => p.hasPermission)
    const allDepsOk = Array.isArray(dependencies) ? dependencies.every(d => d.installed || !d.required) : depsData?.allInstalled

    const refresh = () => {
        refetchPerms()
        refetchDeps()
    }

    const openSystemSettings = () => {
        window.electron.ipcRenderer.invoke(
            "open-url-in-browser",
            "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
        )
    }

    return (
        <div className="flex flex-col gap-5 max-w-lg mx-auto">
            <div>
                <h3 className="text-lg font-semibold">Permissions & Dependencies</h3>
                <p className="text-sm text-base-content/60 mt-1">
                    Flowtake needs certain permissions and tools to record your screen.
                </p>
            </div>

            {/* Permissions */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium text-base-content/70 uppercase tracking-wider">Permissions</h4>
                {isLoading ? (
                    <div className="flex items-center gap-2 py-4">
                        <span className="loading loading-spinner loading-sm" />
                        <span className="text-sm text-base-content/60">Checking permissions...</span>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {permissions?.map((perm, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-base-200/50">
                                {perm.hasPermission ? (
                                    <CheckCircleIcon className="w-5 h-5 text-success flex-none" />
                                ) : (
                                    <ExclamationTriangleIcon className="w-5 h-5 text-warning flex-none" />
                                )}
                                <span className="text-sm flex-1">{perm.label}</span>
                                <span className={`badge badge-sm ${perm.hasPermission ? "badge-success" : "badge-warning"}`}>
                                    {perm.hasPermission ? "Granted" : "Missing"}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Dependencies */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium text-base-content/70 uppercase tracking-wider">Dependencies</h4>
                {isLoading ? (
                    <div className="flex items-center gap-2 py-4">
                        <span className="loading loading-spinner loading-sm" />
                        <span className="text-sm text-base-content/60">Checking dependencies...</span>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {dependencies?.map((dep, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-base-200/50">
                                {dep.installed ? (
                                    <CheckCircleIcon className="w-5 h-5 text-success flex-none" />
                                ) : (
                                    <ExclamationTriangleIcon className={`w-5 h-5 flex-none ${dep.required ? "text-error" : "text-warning"}`} />
                                )}
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium">{dep.name}</span>
                                    <p className="text-xs text-base-content/50">{dep.description}</p>
                                </div>
                                <span className={`badge badge-sm ${dep.installed ? "badge-success" : dep.required ? "badge-error" : "badge-warning"}`}>
                                    {dep.installed ? "Found" : dep.required ? "Required" : "Optional"}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
                <button className="btn btn-ghost btn-sm gap-1" onClick={refresh} disabled={isLoading}>
                    <ArrowPathIcon className="w-4 h-4" />
                    Refresh
                </button>
                {!allPermsOk && navigator.platform?.includes("Mac") && (
                    <button className="btn btn-ghost btn-sm gap-1" onClick={openSystemSettings}>
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        Open System Settings
                    </button>
                )}
            </div>

            {allPermsOk && allDepsOk && (
                <div className="text-sm text-success font-medium">
                    Everything looks good! Click Next to continue.
                </div>
            )}
        </div>
    )
}
