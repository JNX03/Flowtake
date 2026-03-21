import {
    QueueListIcon,
    XMarkIcon
} from "@heroicons/react/24/outline"
import {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import Button from "../../../components/Button"
import {
    EXPORTER_SECTION_QUEUE,
    TOAST_EXPORT_COMPLETED
} from "@shared/helpers"
import {
    dismissToastsByType,
    selectHasExports,
    selectHasProject,
    selectIsCloseRequested,
    selectIsProjectClosing,
    setIsCloseRequested,
    setIsProjectClosing,
    setLoaderMessage
} from "@shared/redux/appSlice"
import Modal from "./Modal"

export default function CloseModal() {

    const dispatch = useDispatch()

    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
    const hasExports = useSelector(selectHasExports)
    const hasExportsRef = useRef(hasExports)
    const isProjectClosing = useSelector(selectIsProjectClosing)
    const hasProject = useSelector(selectHasProject)
    const isCloseRequested = useSelector(selectIsCloseRequested)

    useEffect(() => {
        hasExportsRef.current = hasExports
    }, [hasExports])

    useEffect(() => {
        const onBeforeUnload = e => {
            if (!isCloseModalOpen && !isCloseRequested) {
                if (hasExportsRef.current) setIsCloseModalOpen(true)
                else dispatch(setIsCloseRequested(true))
            }
            e.returnValue = false
            return false
        }

        window.addEventListener('beforeunload', onBeforeUnload)

        return () => { window.removeEventListener('beforeunload', onBeforeUnload) }
    }, [isCloseModalOpen, isCloseRequested, dispatch])

    useEffect(() => {
        if (isCloseRequested && !isProjectClosing) {
            if (hasProject) dispatch(setIsProjectClosing(true))
            else window.electron.ipcRenderer.invoke("destroy")
        }
    }, [isCloseRequested, isProjectClosing, hasProject, dispatch])

    const closeAnyway = useCallback(async () => {
        setIsCloseModalOpen(false)
        dispatch(setLoaderMessage("Canceling renders..."))

        window.electron.ipcRenderer.on('exporter-window-ready-to-close', async () => {
            await window.electron.ipcRenderer.invoke("close-export-window")
            await window.electron.ipcRenderer.invoke("close-window")
            dispatch(setIsCloseRequested(true))
        })
        await window.electron.ipcRenderer.invoke("clear-pending-renders")
        await window.electron.ipcRenderer.invoke("cancel-running-render")
    }, [dispatch])

    const showRenderQueue = useCallback(async () => {
        dispatch(dismissToastsByType(TOAST_EXPORT_COMPLETED))
        await window.electron.ipcRenderer.invoke("open-export-window", null, EXPORTER_SECTION_QUEUE)
        setIsCloseModalOpen(false)
    }, [dispatch])

    const onClose = useCallback(() => {
        setIsCloseModalOpen(false)
    }, [])

    return (
        <Modal title="Exports still running" isOpen={isCloseModalOpen} close={onClose}>
            There are exports currently running. Closing the application will cancel all pending exports.

            <div className="modal-action">
                <Button onClick={closeAnyway} icon={XMarkIcon}>
                    Close anyway
                </Button>
                <Button className="btn-primary" onClick={showRenderQueue} icon={QueueListIcon}>
                    Render queue
                </Button>
            </div>
        </Modal>
    )
}

