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
import { ActionCreators } from "redux-undo"
import TitleBar from "../../../components/TitleBar"
import {
    selectHasProject,
    setLoaderMessage
} from "@shared/redux/appSlice"
import { selectIsInitialized } from "@shared/redux/editorSlice"
import {
    selectName
} from "@shared/redux/projectSlice"
import AssetPanel from "./assets/AssetPanel"
import DragOverlay from "./DragOverlay"
import ExportButton from "./ExportButton"
import PresetsDropdown from "./presets/PresetsDropdown"
import Preview from "./Preview"
import Properties from "./properties/Properties"
import Timeline from "./timeline/Timeline"
import ActivateButton from "./titleBar/ActivateButton"
import CloseButton from "./titleBar/CloseButton"
import RedoButton from "./titleBar/RedoButton"
import RenameButton from "./titleBar/RenameButton"
import RequestFeatureButton from "./titleBar/RequestFeatureButton"
import SaveIndicator from "./titleBar/SaveIndicator"
import SettingsButton from "./titleBar/SettingsButton"
import UndoButton from "./titleBar/UndoButton"

export default function Editor() {

    const dispatch = useDispatch()
    const hasProject = useSelector(selectHasProject)
    const isInitialized = useSelector(selectIsInitialized)
    const name = useSelector(selectName)
    const [isAssetPanelOpen, setIsAssetPanelOpen] = useState(true)
    const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(false)
    const [isFileDragOver, setIsFileDragOver] = useState(false)
    const autoCollapseRef = useRef(false)

    // Auto-collapse/expand Properties panel based on window width
    useEffect(() => {
        const handleResize = () => {
            const w = window.innerWidth
            if (w < 1024 && !autoCollapseRef.current) {
                autoCollapseRef.current = true
                setIsPropertiesCollapsed(true)
            } else if (w >= 1280 && autoCollapseRef.current) {
                autoCollapseRef.current = false
                setIsPropertiesCollapsed(false)
            }
        }
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        if (hasProject) dispatch(ActionCreators.clearHistory())
    }, [hasProject, dispatch])

    useEffect(() => {
        dispatch(setLoaderMessage(isInitialized ? null : "Opening editor..."))
    }, [isInitialized, dispatch])

    const handleDragOver = useCallback(e => {
        if (e.dataTransfer?.types?.includes("Files")) {
            e.preventDefault()
            e.dataTransfer.dropEffect = "copy"
            setIsFileDragOver(true)
        }
    }, [])

    const handleDragLeave = useCallback(e => {
        if (e.currentTarget.contains(e.relatedTarget)) return
        setIsFileDragOver(false)
    }, [])

    const handleDrop = useCallback(e => {
        e.preventDefault()
        setIsFileDragOver(false)

        const files = Array.from(e.dataTransfer?.files || [])
        if (files.length === 0) return

        files.forEach(file => {
            const ext = file.name.split(".").pop()?.toLowerCase()
            const audioExts = ["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma"]
            const imageExts = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"]
            const videoExts = ["mp4", "webm", "mov", "avi", "mkv"]

            let type = "unknown"
            if (audioExts.includes(ext)) type = "audio"
            else if (imageExts.includes(ext)) type = "image"
            else if (videoExts.includes(ext)) type = "video"

            if (type !== "unknown") {
                // Dispatch custom drop event that Timeline already listens for
                window.dispatchEvent(new CustomEvent("flowtake-drop", {
                    detail: {
                        data: {
                            type,
                            name: file.name,
                            src: URL.createObjectURL(file),
                            category: type,
                        },
                        target: { zone: "timeline" }
                    }
                }))
            }
        })
    }, [])

    return (<>
        <TitleBar overlayButtons={3} subtitle={name} >
            <SaveIndicator />
            <UndoButton />
            <RedoButton />
            <RenameButton />
            <CloseButton />
            <ActivateButton />
            <span data-tutorial="export-button"><ExportButton /></span>
            <PresetsDropdown />
            <RequestFeatureButton />
            <SettingsButton />
        </TitleBar>
        <div className="bg-base-300 flex flex-col h-full relative overflow-hidden"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}>
            {/* Top section: Assets | Preview | Properties */}
            <div className="pt-1 px-1.5 flex gap-1.5 flex-1 overflow-hidden min-h-0">
                <AssetPanel
                    isOpen={isAssetPanelOpen}
                    onToggle={() => setIsAssetPanelOpen(!isAssetPanelOpen)}
                />
                <Preview />
                <Properties
                    isCollapsed={isPropertiesCollapsed}
                    onToggle={() => { autoCollapseRef.current = false; setIsPropertiesCollapsed(!isPropertiesCollapsed) }}
                />
            </div>
            {/* Bottom section: Timeline */}
            <div data-tutorial="timeline">
                <Timeline />
            </div>
            <DragOverlay />

            {/* File drag-and-drop overlay */}
            {isFileDragOver && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-base-300/80 backdrop-blur-sm pointer-events-none">
                    <div className="border-2 border-dashed border-primary/60 rounded-2xl p-12 bg-primary/5">
                        <p className="text-lg font-semibold text-primary">Drop media files here</p>
                        <p className="text-sm opacity-50 mt-1">Audio, images, and video files supported</p>
                    </div>
                </div>
            )}
        </div>
    </>)
}
