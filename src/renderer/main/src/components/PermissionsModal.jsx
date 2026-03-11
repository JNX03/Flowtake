import { useQuery } from "@tanstack/react-query"
import {
    useMemo,
    useState
} from "react"
import Modal from "./Modal"

export default function PermissionsModal() {
    const [isOpen, setIsOpen] = useState(true)

    const { data: permissions, isPending, isError } = useQuery({
        queryKey: ['permissions'],
        queryFn: async () => window.electron.ipcRenderer.invoke("check-permissions"),
        staleTime: Infinity
    })

    const hasPermissionIssues = useMemo(() => {
        return !isPending && !isError && permissions?.filter(({ hasPermission }) => !hasPermission).length > 0
    }, [isPending, isError, permissions])

    const showModal = hasPermissionIssues && isOpen

    const onClose = () => setIsOpen(false)

    return (
        <Modal title="Missing Permissions" isOpen={showModal} close={onClose}>
            <p className="text-sm">
                Flowtake requires various file system permissions to work properly.
            </p>
            <p className="text-sm">
                The following permissions are currently missing:
            </p>
            <div className="overflow-x-auto">
                <table className="table table-sm table-zebra w-full my-5">
                    <thead>
                        <tr>
                            <th>Label</th>
                            <th>Permission</th>
                            <th>Path</th>
                        </tr>

                    </thead>
                    <tbody>
                        {permissions?.filter(({ hasPermission }) => !hasPermission).map(({ path, permission, label }, i) => (
                            <tr key={i}>
                                <td>{label}</td>
                                <td>{permission}</td>
                                <td>{path}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="text-sm">
                Here are some steps you can take to resolve these issues:
            </p>
            <ul className="list-disc list-inside text-sm my-1">
                <li>Run Flowtake as an administrator.</li>
                <li>Adjust the permissions for these paths or talk to your IT department.</li>
                <li>White-list these paths in your antivirus software.</li>
                <li>Change the export directory in the settings.</li>
            </ul>

            <p className="mt-2 text-sm font-semibold">
                Make sure to restart Flowtake after making changes.
            </p>
        </Modal>
    )
}