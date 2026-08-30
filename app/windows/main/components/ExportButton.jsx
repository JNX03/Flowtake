import {
    ArrowUpTrayIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    QueueListIcon
} from "@heroicons/react/16/solid"
import {
    useCallback,
    useEffect,
    useRef,
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
    TOAST_EXPORT_COMPLETED
} from "@shared/helpers"
import { createRenderableProjectState } from "@shared/renderState"
import {
    dismissToastsByType,
    selectHasExports,
    selectHasProject,
    selectRenderQueueProgress,
    setHasExports,
    setRenderQueueProgress
} from "@shared/redux/appSlice"
import { selectAreHotkeysEnabled } from "@shared/redux/editorSlice"
import {
    formatShortcut,
    isMacPlatform
} from "@shared/editor/shortcutRegistry"

export default function ExportButton() {

    const dispatch = useDispatch()

    const store = useStore()

    const hasProject = useSelector(selectHasProject)
    const areHotkeysEnabled = useSelector(selectAreHotkeysEnabled)
    const renderQueueProgress = useSelector(selectRenderQueueProgress)
    const hasExports = useSelector(selectHasExports)

    const [isClicked, setIsClicked] = useState(false)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [openError, setOpenError] = useState(null)
    const menuRef = useRef(null)
    const triggerRef = useRef(null)

    const shortcutLabel = formatShortcut("mod+e")
    const shortcutBinding = isMacPlatform() ? "meta+e" : "ctrl+e"

    const openExportWindow = useCallback(async section => {
        dispatch(dismissToastsByType(TOAST_EXPORT_COMPLETED))
        setOpenError(null)
        // Get state snapshot at the time of the function call (button click)
        const currentState = store.getState()
        try {
            await window.electron.ipcRenderer.invoke(
                "open-export-window",
                hasProject ? createRenderableProjectState(currentState) : null,
                section
            )
            setIsMenuOpen(false)
            return true
        } catch (e) {
            console.error("Failed to open export window:", e)
            setOpenError("Export settings could not be opened. Please try again.")
            setIsMenuOpen(true)
            return false
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

    useHotkeys(shortcutBinding, () => { if (hasProject) onNew(); else if (hasExports) onShowQueue() },
        { enabled: areHotkeysEnabled && !isClicked },
        [hasProject, hasExports, areHotkeysEnabled, isClicked])

    useEffect(() => {
        const ipcRenderer = window.electron.ipcRenderer
        const handleRenderQueueProgress = (_event, progress) => dispatch(setRenderQueueProgress(progress))
        const handleHasExports = (_event, value) => dispatch(setHasExports(value))

        ipcRenderer.on("render-queue-progress", handleRenderQueueProgress)
        ipcRenderer.on("has-exports", handleHasExports)

        return () => {
            ipcRenderer.removeListener("render-queue-progress", handleRenderQueueProgress)
            ipcRenderer.removeListener("has-exports", handleHasExports)
        }
    }, [dispatch])

    useEffect(() => {
        if (!isMenuOpen) return undefined

        const closeOnOutsidePointer = event => {
            if (!menuRef.current?.contains(event.target)) setIsMenuOpen(false)
        }
        const closeOnEscape = event => {
            if (event.key !== "Escape") return
            setIsMenuOpen(false)
            triggerRef.current?.focus()
        }

        document.addEventListener("pointerdown", closeOnOutsidePointer)
        document.addEventListener("keydown", closeOnEscape)

        return () => {
            document.removeEventListener("pointerdown", closeOnOutsidePointer)
            document.removeEventListener("keydown", closeOnEscape)
        }
    }, [isMenuOpen])

    useEffect(() => {
        if (!isMenuOpen) return undefined
        const focusFrame = requestAnimationFrame(() => {
            menuRef.current?.querySelector("[data-export-primary]")?.focus()
        })
        return () => cancelAnimationFrame(focusFrame)
    }, [isMenuOpen])

    if (!hasProject && !hasExports) return null

    const queuePercent = renderQueueProgress === -1
        ? null
        : Math.round(Math.min(1, Math.max(0, renderQueueProgress)) * 100)

    return (
        <div ref={menuRef} className="relative">
            <Button
                ref={triggerRef}
                className="btn-primary"
                icon={QueueListIcon}
                size="xs"
                onClick={() => setIsMenuOpen(value => !value)}
                disabled={isClicked}
                isLoading={isClicked}
                aria-haspopup="dialog"
                aria-expanded={isMenuOpen}
                aria-controls="editor-export-menu"
                aria-label="Export project"
                aria-busy={isClicked}
            >
                <span className="hidden md:inline">Export</span>
                <ChevronDownIcon className="size-3.5" aria-hidden="true" />
            </Button>

            {isMenuOpen && (
                <div
                    id="editor-export-menu"
                    role="dialog"
                    aria-labelledby="editor-export-menu-title"
                    className="absolute right-0 top-full z-[80] mt-2 w-80 overflow-hidden rounded-lg border border-base-content/12 bg-base-100 text-base-content shadow-2xl"
                >
                    <div className="flex h-11 items-center gap-2 border-b border-base-content/10 px-3">
                        <p id="editor-export-menu-title" className="min-w-0 flex-1 text-sm font-medium">
                            Export project
                        </p>
                        {hasExports && (
                            <button
                                type="button"
                                onClick={onShowQueue}
                                disabled={isClicked}
                                className="btn btn-ghost btn-xs h-7 min-h-7 gap-1 px-2"
                                aria-label="Open render queue"
                            >
                                <QueueListIcon className="size-3.5" />
                                Queue
                            </button>
                        )}
                    </div>

                    {openError && (
                        <div className="border-b border-error/20 bg-error/10 px-3 py-2 text-[11px] text-error" role="alert">
                            {openError}
                        </div>
                    )}

                    {queuePercent === null ? (
                        <div className="p-2">
                            <div className="overflow-hidden rounded-md border border-base-content/10">
                            {[
                                ["Format", "MP4 / WebM"],
                                ["Quality", "Up to 4K"],
                                ["Audio", "Include or mute"],
                            ].map(([label, value]) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={onNew}
                                    disabled={!hasProject || isClicked}
                                    className="flex h-11 w-full items-center gap-3 border-b border-base-content/10 px-3 text-left transition last:border-b-0 hover:bg-base-content/5 disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label={`${label}: ${value}. Open export settings`}
                                >
                                    <span className="flex-1 text-xs font-medium">{label}</span>
                                    <span className="text-[10px] text-base-content/50">{value}</span>
                                    <ChevronRightIcon className="size-3.5 text-base-content/35" aria-hidden="true" />
                                </button>
                            ))}
                            </div>

                            <button
                                data-export-primary
                                type="button"
                                onClick={onNew}
                                disabled={!hasProject || isClicked}
                                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-content transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <ArrowUpTrayIcon className="size-4" aria-hidden="true" />
                                Export
                                <kbd className="ml-auto rounded bg-black/15 px-1.5 py-0.5 text-[9px] font-medium">
                                {shortcutLabel}
                                </kbd>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3 p-3" aria-live="polite">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-medium">Exporting</span>
                                <span className="font-mono text-primary">{queuePercent}%</span>
                            </div>
                            <progress
                                className="progress progress-primary block h-1.5 w-full"
                                value={queuePercent}
                                max="100"
                                aria-label={`Render queue ${queuePercent}% complete`}
                            />
                            <button
                                data-export-primary
                                type="button"
                                onClick={onShowQueue}
                                disabled={isClicked}
                                className="btn btn-outline btn-sm w-full gap-2"
                            >
                                <QueueListIcon className="size-4" aria-hidden="true" />
                                View render queue
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
