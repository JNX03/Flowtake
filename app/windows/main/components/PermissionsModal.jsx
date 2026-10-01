import { useEffect, useState } from "react"
import useRecorderReadiness from "@shared/hooks/useRecorderReadiness"
import Modal from "./Modal"
import PermissionsStep from "./setup/PermissionsStep"

export default function PermissionsModal() {
    const [isOpen, setIsOpen] = useState(true)
    const [isManuallyOpen, setIsManuallyOpen] = useState(false)
    const { permissions } = useRecorderReadiness()
    const hasPermissionIssues = permissions?.some(permission => permission.permission === "screenCapture" && !permission.hasPermission)

    useEffect(() => {
        const openReadiness = () => setIsManuallyOpen(true)
        window.addEventListener("flowtake-check-readiness", openReadiness)
        return () => window.removeEventListener("flowtake-check-readiness", openReadiness)
    }, [])

    const showModal = Boolean(isManuallyOpen || (isOpen && hasPermissionIssues))
    const onClose = () => {
        setIsOpen(false)
        setIsManuallyOpen(false)
    }

    return (
        <Modal title="Check recorder" isOpen={showModal} close={onClose}>
            {showModal && <div className="overflow-y-auto pr-1"><PermissionsStep /></div>}
        </Modal>
    )
}
