import {
    useCallback,
    useEffect,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { ActionCreators } from "redux-undo"
import TitleBar from "../../../components/TitleBar"
import { addErrorToast } from "@shared/errorToastHelper"
import {
    selectHasProject,
    setLoaderMessage
} from "@shared/redux/appSlice"
import {
    selectAreVideosReady,
    selectDuration,
    selectIsInitialized
} from "@shared/redux/editorSlice"
import {
    selectMouseEvents,
    selectName
} from "@shared/redux/projectSlice"
import AssetPanel from "./assets/AssetPanel"
import DragOverlay from "./DragOverlay"
import ResizeHandle from "./editor/ResizeHandle"
import useEditorLayout from "./editor/useEditorLayout"
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
    const areVideosReady = useSelector(selectAreVideosReady)
    const duration = useSelector(selectDuration)
    const mouseEvents = useSelector(selectMouseEvents)
    const name = useSelector(selectName)
    const {
        assetsMode,
        propertiesMode,
        sizes,
        timelineMax,
        isDockedAssetsOpen,
        setDockedAssetsOpen,
        startResize,
        nudgeSize,
        resetSize
    } = useEditorLayout()
    const [isAssetDrawerOpen, setIsAssetDrawerOpen] = useState(false)
    const [isFileDragOver, setIsFileDragOver] = useState(false)
    const [isPropertiesDrawerOpen, setIsPropertiesDrawerOpen] = useState(false)
    const isAssetPanelOpen = assetsMode === "docked"
        ? isDockedAssetsOpen
        : isAssetDrawerOpen

    useEffect(() => {
        if (propertiesMode !== "drawer") setIsPropertiesDrawerOpen(false)
    }, [propertiesMode])

    useEffect(() => {
        if (assetsMode !== "drawer") setIsAssetDrawerOpen(false)
    }, [assetsMode])

    useEffect(() => {
        if (hasProject) dispatch(ActionCreators.clearHistory())
    }, [hasProject, dispatch])

    useEffect(() => {
        dispatch(setLoaderMessage(isInitialized ? null : "Opening editor..."))
    }, [isInitialized, dispatch])

    // Safety net: if the editor is stuck on "Opening editor..." for more than
    // 15 s, the video element or the worker manager has silently stalled.
    // Log the slice state that createManager waits on, and surface a toast so
    // the user sees something actionable instead of an indefinite spinner.
    useEffect(() => {
        if (isInitialized) return
        const t = setTimeout(() => {
            console.warn("[Flowtake] Editor init stalled 15s", {
                areVideosReady,
                duration,
                hasMouseEvents: Array.isArray(mouseEvents) && mouseEvents.length > 0,
            })
            dispatch(addErrorToast(
                "Editor didn't finish initializing. Try reopening the project from the launcher."
            ))
        }, 15000)
        return () => clearTimeout(t)
    }, [isInitialized, dispatch, areVideosReady, duration, mouseEvents])

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

    const handleAssetPanelToggle = useCallback(() => {
        if (assetsMode === "drawer") {
            setIsAssetDrawerOpen(current => !current)
            setIsPropertiesDrawerOpen(false)
            return
        }
        setDockedAssetsOpen(current => !current)
    }, [assetsMode, setDockedAssetsOpen])

    const handlePropertiesDrawerChange = useCallback(open => {
        setIsPropertiesDrawerOpen(open)
        if (open && propertiesMode === "drawer") setIsAssetDrawerOpen(false)
    }, [propertiesMode])

    return (
        <div className="flowtake-editor h-full text-base-content">
        <TitleBar overlayButtons={3} subtitle={name} variant="studio" >
            <div className="flex items-center gap-0.5">
                <SaveIndicator />
                <UndoButton />
                <RedoButton />
                <RenameButton />
                <CloseButton />
                <ActivateButton />
            </div>
            <div className="flex items-center gap-0.5 pl-2 ml-1 border-l border-base-content/10">
                <span data-tutorial="export-button"><ExportButton /></span>
            </div>
            <div className="hidden sm:flex items-center gap-0.5 pl-2 ml-1 border-l border-base-content/10">
                <PresetsDropdown />
                <RequestFeatureButton />
                <SettingsButton />
            </div>
            <div className="sm:hidden flex items-center pl-2 ml-1 border-l border-base-content/10">
                <SettingsButton />
            </div>
        </TitleBar>
        <div className="flowtake-editor__workspace bg-base-300 flex flex-col h-full relative overflow-hidden"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}>
            {/* Primary workspace: media | preview | inspector */}
            <div className="flowtake-editor__main px-3 pt-3 flex flex-1 overflow-hidden min-h-0 relative">
                <AssetPanel
                    mode={assetsMode}
                    panelWidth={sizes.assets}
                    isOpen={isAssetPanelOpen}
                    onToggle={handleAssetPanelToggle}
                />
                <ResizeHandle
                    orientation="vertical"
                    label="Resize media panel"
                    value={sizes.assets}
                    min={200}
                    max={360}
                    hidden={assetsMode !== "docked" || !isAssetPanelOpen}
                    onResizeStart={event => startResize("assets", event)}
                    onNudge={delta => nudgeSize("assets", delta)}
                    onReset={() => resetSize("assets")}
                />
                <Preview />
                <ResizeHandle
                    orientation="vertical"
                    label="Resize inspector"
                    value={sizes.inspector}
                    min={260}
                    max={420}
                    hidden={propertiesMode !== "docked"}
                    onResizeStart={event => startResize("inspector", event)}
                    onNudge={delta => nudgeSize("inspector", -delta)}
                    onReset={() => resetSize("inspector")}
                />
                <Properties
                    mode={propertiesMode}
                    panelWidth={sizes.inspector}
                    isDrawerOpen={isPropertiesDrawerOpen}
                    onDrawerChange={handlePropertiesDrawerChange}
                />
            </div>
            <ResizeHandle
                orientation="horizontal"
                label="Resize timeline"
                value={sizes.timeline}
                min={190}
                max={timelineMax}
                onResizeStart={event => startResize("timeline", event)}
                onNudge={delta => nudgeSize("timeline", -delta)}
                onReset={() => resetSize("timeline")}
            />
            <div
                data-tutorial="timeline"
                className="flowtake-editor__timeline shrink-0 min-h-0"
                style={{ height: sizes.timeline }}
            >
                <Timeline />
            </div>
            <DragOverlay />

            {/* File drag-and-drop overlay */}
            {isFileDragOver && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-base-300/75 backdrop-blur-sm pointer-events-none">
                    <div className="border-2 border-dashed border-primary/50 rounded-xl p-12 bg-base-100/85 shadow-xl">
                        <p className="text-lg font-semibold text-primary">Drop media files here</p>
                        <p className="text-sm opacity-50 mt-1">Audio, images, and video files supported</p>
                    </div>
                </div>
            )}
        </div>
        </div>
    )
}
