import { FolderIcon } from "@heroicons/react/24/outline"
import {
    useMutation,
    useQuery,
    useQueryClient
} from "@tanstack/react-query"
import { useState } from "react"
import Button from "../../../../components/Button"

export default function ExportPathStep() {
    const queryClient = useQueryClient()
    const [error, setError] = useState(null)

    const { data: exportDirectory, isPending } = useQuery({
        queryKey: ['exportDirectory'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "exportDirectory"),
        staleTime: Infinity
    })

    const { mutate, isPending: isMutatePending } = useMutation({
        mutationFn: () => window.electron.ipcRenderer.invoke("choose-export-directory"),
        onSuccess: (result) => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ['exportDirectory'] })
            } else if (result.message) {
                setError(result.message)
            }
        },
        onMutate: () => setError(null)
    })

    return (
        <div className="flex flex-col gap-5 max-w-lg mx-auto">
            <div>
                <h3 className="text-lg font-semibold">Export Directory</h3>
                <p className="text-sm text-base-content/60 mt-1">
                    Choose where your exported videos will be saved.
                </p>
            </div>

            <div className="space-y-3">
                <div className="p-4 rounded-xl bg-base-200/50 border border-base-content/5">
                    <p className="text-xs font-medium text-base-content/50 uppercase tracking-wider mb-2">Current path</p>
                    <p className="text-sm font-mono break-all">
                        {isPending ? (
                            <span className="loading loading-dots loading-xs" />
                        ) : (
                            exportDirectory || "~/Videos/Flowtake (default)"
                        )}
                    </p>
                </div>

                <Button
                    onClick={mutate}
                    className="btn-primary"
                    disabled={isPending || isMutatePending}
                    isLoading={isMutatePending}
                    icon={FolderIcon}
                >
                    Choose folder
                </Button>

                {error && <p className="text-sm text-error">{error}</p>}
            </div>

            <p className="text-xs text-base-content/40">
                You can always change this later in Settings.
            </p>
        </div>
    )
}
