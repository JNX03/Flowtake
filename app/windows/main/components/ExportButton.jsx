import {
    PlusIcon,
    QueueListIcon
} from "@heroicons/react/16/solid"
import {
    useCallback,
    useEffect,
    useState
} from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
    useDispatch,
    useSelector,
    useStore
} from "react-redux"
import Button from "../../../components/Button"
import {
    EXPORTER_SECTION_NEW_RENDER,
    EXPORTER_SECTION_QUEUE,
    getProjectState,
    TOAST_EXPORT_COMPLETED
} from "@shared/helpers"
import {
    dismissToastsByType,
    selectHasExports,
    selectHasProject,
    selectRenderQueueProgress,
    setHasExports,
    setRenderQueueProgress
} from "@shared/redux/appSlice"
import { selectAreHotkeysEnabled } from "@shared/redux/editorSlice"
import { selectHasLicense } from "@shared/redux/licenseSlice"

export default function ExportButton() {

    const dispatch = useDispatch()

    const store = useStore()

    const hasLicense = useSelector(selectHasLicense)
    const hasProject = useSelector(selectHasProject)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const renderQueueProgress = useSelector(selectRenderQueueProgress)
    const hasExports = useSelector(selectHasExports)

    const [isClicked, setIsClicked] = useState(false)

    const openExportWindow = useCallback(async section => {
        dispatch(dismissToastsByType(TOAST_EXPORT_COMPLETED))
        // Get state snapshot at the time of the function call (button click)
        const currentState = store.getState()
        try {
            await window.electron.ipcRenderer.invoke(
                "open-export-window",
                hasProject ? getProjectState(currentState) : null,
                section
            )
        } catch (e) {
            console.error("Failed to open export window:", e)
        } finally {
            setIsClicked(false)
        }
    }, [dispatch, hasProject, store])

    const onNew = useCallback(() => {
        setIsClicked(true)
        openExportWindow(EXPORTER_SECTION_NEW_RENDER)
    }, [openExportWindow])

    const onShowQueue = useCallback(() => {
        setIsClicked(true)
        openExportWindow(EXPORTER_SECTION_QUEUE)
    }, [openExportWindow])

    useHotkeys('ctrl+e', () => { if (hasProject) onNew(); else onShowQueue() },
        { enabled: hasLicense && areHotkeysEnabled && !isClicked },
        [hasLicense, hasProject, areHotkeysEnabled, isClicked])

    useEffect(() => {
        window.electron.ipcRenderer.on('render-queue-progress', (_e, progress) => dispatch(setRenderQueueProgress(progress)))
    }, [dispatch])

    useEffect(() => {
        window.electron.ipcRenderer.on('has-exports', (_e, hasExports) => dispatch(setHasExports(hasExports)))
    }, [dispatch])

    return (<>
        {hasLicense && <>
            {hasExports && <div className="dropdown">
                <Button
                    className="mt-1 btn-xs btn-primary"
                    icon={QueueListIcon}
                    size="xs"
                    onClick={() => { }}
                >
                    Exports
                </Button>
                <ul className="dropdown-content menu menu-sm border-base-300/10 border-2 bg-base-300/70 text-base-content backdrop-blur-md rounded-lg shadow-lg w-72 mt-2">
                    {hasProject && (
                        <li>
                            <button onClick={onNew} disabled={isClicked}><PlusIcon className="size-5" />New</button>
                        </li>
                    )}
                    <li>
                        <button onClick={onShowQueue} disabled={isClicked}>
                            <QueueListIcon className="size-5" />
                            <span>Render queue</span>
                            {renderQueueProgress !== -1 && <progress className="progress w-20" value={renderQueueProgress * 100} max="100" />}
                        </button>
                    </li>
                </ul>
            </div>}
            {!hasExports && hasProject && (
                <Button
                    onClick={onNew}
                    className="mt-1 btn-xs btn-primary"
                    disabled={isClicked}
                    isLoading={isClicked}
                    icon={QueueListIcon}
                    size="xs"
                >
                    Exports
                </Button>
            )}
        </>}
    </>)
}