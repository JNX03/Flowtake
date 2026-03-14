import { FolderIcon } from "@heroicons/react/24/outline"
import {
    useMutation,
    useQuery,
    useQueryClient
} from "@tanstack/react-query"
import { useState } from "react"
import Button from "../../../../components/Button"
import Fieldset from "../properties/Fieldset"

export default function ExporterSettings() {
    const queryClient = useQueryClient()

    const [error, setError] = useState(null)

    const { data: exportDirectory, isPending: isGetPending, isError: isGetError } = useQuery({
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
        onMutate: () => { setError(null) }
    })

    return (<>
        <h4 className="font-semibold text-lg mb-4">Exporter</h4>

        <Fieldset legend="Export directory">
            <div className="label">Choose the folder for your exported videos</div>
            <div className="join">
                <Button
                    onClick={mutate}
                    className="btn-primary join-item"
                    disabled={isGetPending || isMutatePending}
                    isLoading={isGetPending || isMutatePending}
                    icon={FolderIcon}
                >
                    Select folder
                </Button>
                <input type="text" value={isGetPending || isGetError ? "" : (exportDirectory || "")}
                    placeholder="Export directory"
                    className="join-item input w-full"
                    readOnly
                />
            </div>
            {error && <p className="label text-error">{error}</p>}
        </Fieldset>
    </>)
}