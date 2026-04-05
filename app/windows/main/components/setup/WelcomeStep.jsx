import { useQuery } from "@tanstack/react-query"
import logo from "../../../../shared/assets/logo.svg"

export default function WelcomeStep() {
    const { data: version } = useQuery({
        queryKey: ['version'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-version"),
        staleTime: Infinity
    })

    return (
        <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <div className="w-20 h-20">
                <img src={logo} alt="Flowtake" className="w-full h-full" />
            </div>

            <div>
                <h2 className="text-2xl font-bold">Welcome to Flowtake</h2>
                {version && (
                    <p className="text-sm text-base-content/50 mt-1">v{version}</p>
                )}
            </div>

            <p className="text-base-content/70 max-w-md">
                Professional screen recording with automatic zoom animations.
                Let's get you set up in a few quick steps.
            </p>
        </div>
    )
}
