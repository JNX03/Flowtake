import {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react"
import {
    AdjustmentsHorizontalIcon,
    FolderOpenIcon
} from "@heroicons/react/20/solid"
import { convertFileSrc } from "@tauri-apps/api/core"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { ActionCreators } from "redux-undo"
import TitleBar from "../../../components/TitleBar"
import { addErrorToast } from "@shared/errorToastHelper"
import { readAudioDurationMs } from "@shared/mediaMetadata"
import { isTauri } from "@shared/tauriBridge"
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
import ExportButton from "./ExportButton"
import PresetsDropdown from "./presets/PresetsDropdown"
import Preview from "./Preview"
import Properties from "./properties/Properties"
import Timeline from "./timeline/Timeline"
import ActivateButton from "./titleBar/ActivateButton"
import CloseButton from "./titleBar/CloseButton"
import RedoButton from "./titleBar/RedoButton"
import RenameButton from "./titleBar/RenameButton"
import SaveIndicator from "./titleBar/SaveIndicator"
import SettingsButton from "./titleBar/SettingsButton"
import UndoButton from "./titleBar/UndoButton"

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma"])
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"])

function getMediaType(name) {
    const extension = name.split(".").pop()?.toLowerCase()
    if (AUDIO_EXTENSIONS.has(extension)) return "audio"
    if (IMAGE_EXTENSIONS.has(extension)) return "image"
    return null
}

function nameFromPath(path) {
    return path.split(/[\\/]/).pop() || "Imported media"
}

function getViewport(width) {
    if (width >= 1440) return {
        key: "wide",
        propertiesMode: "docked",
        propertiesWidth: 336,
        assetMode: "docked",
        showInspectorRail: true,
    }
    if (width >= 1180) return {
        key: "studio",
        propertiesMode: "docked",
        propertiesWidth: 304,
        assetMode: "docked",
        showInspectorRail: true,
    }
    if (width >= 760) return {
        key: "compact",
        propertiesMode: "drawer",
        propertiesWidth: 320,
        assetMode: "drawer",
        showInspectorRail: true,
    }
    return {
        key: "mobile",
        propertiesMode: "drawer",
        propertiesWidth: 320,
        assetMode: "drawer",
        showInspectorRail: false,
    }
}

const TIMELINE_MIN_HEIGHT = 184

function getTimelineMaxHeight() {
    if (typeof window === "undefined") return 360
    return Math.max(TIMELINE_MIN_HEIGHT, Math.min(460, Math.floor(window.innerHeight * 0.58)))
}

function clampTimelineHeight(value) {
    return Math.max(TIMELINE_MIN_HEIGHT, Math.min(getTimelineMaxHeight(), value))
}

function getInitialTimelineHeight() {
    if (typeof window === "undefined") return 248
    let stored = Number.NaN
    try {
        stored = Number(window.localStorage?.getItem("flowtake-editor-timeline-height"))
    } catch {
        // Storage access can be disabled; use the viewport-derived default.
    }
    return clampTimelineHeight(Number.isFinite(stored) && stored > 0
        ? stored
        : Math.floor(window.innerHeight * 0.31))
}

export default function Editor() {

    const dispatch = useDispatch()
    const hasProject = useSelector(selectHasProject)
    const isInitialized = useSelector(selectIsInitialized)
    const areVideosReady = useSelector(selectAreVideosReady)
    const duration = useSelector(selectDuration)
    const mouseEvents = useSelector(selectMouseEvents)
    const name = useSelector(selectName)

    const initialWidth = typeof window !== "undefined" ? window.innerWidth : 1280
    const [viewport, setViewport] = useState(() => getViewport(initialWidth))
    const [isAssetPanelOpen, setIsAssetPanelOpen] = useState(() => initialWidth >= 1180)
    const [isInspectorVisible, setIsInspectorVisible] = useState(() => initialWidth >= 1180)
    const [isPropertiesDrawerOpen, setIsPropertiesDrawerOpen] = useState(false)
    const [isFileDragOver, setIsFileDragOver] = useState(false)
    const [timelineHeight, setTimelineHeight] = useState(getInitialTimelineHeight)

    const timelineDragRef = useRef(null)
    const timelineRafRef = useRef(null)
    const objectUrlsRef = useRef(new Set())
    const isMountedRef = useRef(true)

    useEffect(() => {
        const onResize = () => {
            const next = getViewport(window.innerWidth)
            setViewport(current => current.key === next.key ? current : next)
            setTimelineHeight(current => clampTimelineHeight(current))
        }
        window.addEventListener("resize", onResize)
        return () => window.removeEventListener("resize", onResize)
    }, [])

    useEffect(() => {
        if (viewport.propertiesMode !== "drawer") setIsPropertiesDrawerOpen(false)
    }, [viewport.propertiesMode])

    useEffect(() => {
        const objectUrls = objectUrlsRef.current
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
            if (timelineRafRef.current) cancelAnimationFrame(timelineRafRef.current)
            objectUrls.forEach(url => URL.revokeObjectURL(url))
            objectUrls.clear()
        }
    }, [])

    useEffect(() => {
        const registerObjectUrl = event => {
            if (event.detail?.url) objectUrlsRef.current.add(event.detail.url)
        }
        const unregisterObjectUrl = event => {
            if (event.detail?.url) objectUrlsRef.current.delete(event.detail.url)
        }
        window.addEventListener("flowtake-object-url-created", registerObjectUrl)
        window.addEventListener("flowtake-object-url-revoked", unregisterObjectUrl)
        return () => {
            window.removeEventListener("flowtake-object-url-created", registerObjectUrl)
            window.removeEventListener("flowtake-object-url-revoked", unregisterObjectUrl)
        }
    }, [])

    useEffect(() => {
        if (!isTauri) return

        let unlisten = null
        let cancelled = false

        const routeNativeDrop = async payload => {
            if (payload.type === "enter" || payload.type === "over") {
                setIsFileDragOver(true)
                return
            }
            if (payload.type === "leave") {
                setIsFileDragOver(false)
                return
            }
            if (payload.type !== "drop") return

            setIsFileDragOver(false)
            const paths = Array.isArray(payload.paths) ? payload.paths : []
            if (paths.length === 0) return

            const scale = window.devicePixelRatio || 1
            const point = payload.position
                ? { x: payload.position.x / scale, y: payload.position.y / scale }
                : null
            const elementAtDrop = point ? document.elementFromPoint(point.x, point.y) : null
            if (elementAtDrop?.closest(".flowtake-media-panel")) {
                window.dispatchEvent(new CustomEvent("flowtake-import-paths", { detail: { paths } }))
                return
            }

            let unsupportedCount = 0
            await Promise.all(paths.map(async path => {
                const type = getMediaType(path)
                if (!type) {
                    unsupportedCount += 1
                    return
                }
                const src = convertFileSrc(path)
                const mediaDuration = type === "audio" ? await readAudioDurationMs(src) : undefined
                if (!isMountedRef.current) return
                window.dispatchEvent(new CustomEvent("flowtake-drop", {
                    detail: {
                        data: {
                            type,
                            name: nameFromPath(path),
                            path,
                            src,
                            category: type,
                            duration: mediaDuration,
                        },
                        target: { zone: "timeline" },
                    }
                }))
            }))

            if (unsupportedCount > 0 && isMountedRef.current) {
                dispatch(addErrorToast("Some files were skipped. The editor currently accepts images and audio."))
            }
        }

        const listen = async () => {
            const { getCurrentWebview } = await import("@tauri-apps/api/webview")
            const stopListening = await getCurrentWebview().onDragDropEvent(event => {
                routeNativeDrop(event.payload).catch(error => {
                    console.error("[Flowtake] Native media drop failed", error)
                    if (isMountedRef.current) dispatch(addErrorToast("Couldn't add the dropped media."))
                })
            })
            if (cancelled) stopListening()
            else unlisten = stopListening
        }

        listen().catch(error => {
            console.error("[Flowtake] Native drop listener failed", error)
        })

        return () => {
            cancelled = true
            unlisten?.()
        }
    }, [dispatch])

    useEffect(() => {
        if (hasProject) dispatch(ActionCreators.clearHistory())
    }, [hasProject, dispatch])

    useEffect(() => {
        dispatch(setLoaderMessage(isInitialized ? null : "Opening editor..."))
    }, [isInitialized, dispatch])

    useEffect(() => {
        if (isInitialized) return
        const timeout = setTimeout(() => {
            console.warn("[Flowtake] Editor init stalled 15s", {
                areVideosReady,
                duration,
                hasMouseEvents: Array.isArray(mouseEvents) && mouseEvents.length > 0,
            })
            dispatch(addErrorToast(
                "Editor didn't finish initializing. Try reopening the project from the launcher."
            ))
        }, 15000)
        return () => clearTimeout(timeout)
    }, [isInitialized, dispatch, areVideosReady, duration, mouseEvents])

    const handleDragOver = useCallback(event => {
        if (event.dataTransfer?.types?.includes("Files")) {
            event.preventDefault()
            event.dataTransfer.dropEffect = "copy"
            setIsFileDragOver(true)
        }
    }, [])

    const handleDragLeave = useCallback(event => {
        if (event.currentTarget.contains(event.relatedTarget)) return
        setIsFileDragOver(false)
    }, [])

    const handleDrop = useCallback(async event => {
        event.preventDefault()
        setIsFileDragOver(false)

        const files = Array.from(event.dataTransfer?.files || [])
        let unsupportedCount = 0
        await Promise.all(files.map(async file => {
            const type = getMediaType(file.name)
            if (!type) {
                unsupportedCount += 1
                return
            }

            const src = URL.createObjectURL(file)
            objectUrlsRef.current.add(src)
            const mediaDuration = type === "audio" ? await readAudioDurationMs(src) : undefined
            if (!isMountedRef.current) return
            window.dispatchEvent(new CustomEvent("flowtake-drop", {
                detail: {
                    data: { type, name: file.name, src, category: type, duration: mediaDuration },
                    target: { zone: "timeline" },
                }
            }))
        }))
        if (unsupportedCount > 0 && isMountedRef.current) {
            dispatch(addErrorToast("Some files were skipped. The editor currently accepts images and audio."))
        }
    }, [dispatch])

    const toggleInspector = useCallback(() => {
        if (viewport.propertiesMode === "drawer") {
            setIsPropertiesDrawerOpen(open => !open)
        } else {
            setIsInspectorVisible(open => !open)
        }
    }, [viewport.propertiesMode])

    const openInspector = useCallback(() => {
        if (viewport.propertiesMode === "drawer") {
            setIsPropertiesDrawerOpen(true)
        } else {
            setIsInspectorVisible(true)
        }
    }, [viewport.propertiesMode])

    const inspectorOpen = viewport.propertiesMode === "drawer"
        ? isPropertiesDrawerOpen
        : isInspectorVisible

    const commitTimelineHeight = useCallback(value => {
        const next = clampTimelineHeight(value)
        setTimelineHeight(next)
        try {
            window.localStorage?.setItem("flowtake-editor-timeline-height", String(next))
        } catch {
            // localStorage can be disabled; resizing still works for the session.
        }
    }, [])

    const handleTimelineResizeStart = useCallback(event => {
        if (event.button !== 0) return
        timelineDragRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startHeight: timelineHeight,
            currentHeight: timelineHeight,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        event.preventDefault()
    }, [timelineHeight])

    const handleTimelineResizeMove = useCallback(event => {
        const drag = timelineDragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const next = clampTimelineHeight(drag.startHeight + drag.startY - event.clientY)
        drag.currentHeight = next
        if (timelineRafRef.current) cancelAnimationFrame(timelineRafRef.current)
        timelineRafRef.current = requestAnimationFrame(() => {
            setTimelineHeight(next)
            timelineRafRef.current = null
        })
    }, [])

    const handleTimelineResizeEnd = useCallback(event => {
        const drag = timelineDragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        timelineDragRef.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
        }
        commitTimelineHeight(drag.currentHeight)
    }, [commitTimelineHeight])

    const handleTimelineResizeKeyDown = useCallback(event => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
        event.preventDefault()
        commitTimelineHeight(timelineHeight + (event.key === "ArrowUp" ? 16 : -16))
    }, [commitTimelineHeight, timelineHeight])

    return (
        <div className="flowtake-editor h-full text-base-content" data-layout={viewport.key}>
            <TitleBar overlayButtons={3} subtitle={name} variant="studio">
                <div className="flowtake-titlebar__history flex items-center gap-0.5">
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
                    <SettingsButton />
                </div>
                <div className="sm:hidden flex items-center pl-2 ml-1 border-l border-base-content/10">
                    <SettingsButton />
                </div>
            </TitleBar>

            <div
                className="flowtake-editor__workspace bg-base-300 flex flex-col h-full relative overflow-hidden"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="flowtake-editor__commandbar h-11 px-2 shrink-0 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1" role="group" aria-label="Workspace panels">
                        <button
                            type="button"
                            onClick={() => setIsAssetPanelOpen(open => !open)}
                            aria-pressed={isAssetPanelOpen}
                            className={`flowtake-workspace-toggle ${isAssetPanelOpen ? "is-active" : ""}`}
                        >
                            <FolderOpenIcon className="size-4" />
                            <span>Media</span>
                        </button>
                        <button
                            type="button"
                            onClick={toggleInspector}
                            aria-pressed={inspectorOpen}
                            className={`flowtake-workspace-toggle ${inspectorOpen ? "is-active" : ""}`}
                        >
                            <AdjustmentsHorizontalIcon className="size-4" />
                            <span>Inspector</span>
                        </button>
                    </div>
                    <div className="hidden sm:flex min-w-0 items-center gap-2 text-[11px] text-base-content/50">
                        <span className="size-1.5 rounded-full bg-success shrink-0" />
                        <span className="truncate">Edit workspace</span>
                    </div>
                    <span className="hidden lg:block text-[10px] text-base-content/35">
                        Drag the divider to resize the timeline
                    </span>
                </div>

                <div className="flowtake-editor__main px-2 pb-1 flex gap-2 flex-1 overflow-hidden min-h-0 relative">
                    {viewport.assetMode === "docked" && (
                        <AssetPanel
                            isOpen={isAssetPanelOpen}
                            onToggle={() => setIsAssetPanelOpen(open => !open)}
                            mode="docked"
                        />
                    )}
                    {viewport.assetMode === "drawer" && isAssetPanelOpen && (
                        <>
                            <button
                                type="button"
                                aria-label="Close media panel"
                                className="flowtake-panel-backdrop absolute inset-0 z-30"
                                onClick={() => setIsAssetPanelOpen(false)}
                            />
                            <div className="flowtake-editor__asset-drawer absolute left-2 top-0 bottom-0 z-40">
                                <AssetPanel
                                    isOpen
                                    onToggle={() => setIsAssetPanelOpen(false)}
                                    mode="drawer"
                                />
                            </div>
                        </>
                    )}

                    <Preview />

                    {(viewport.propertiesMode === "drawer" || isInspectorVisible) && (
                        <Properties
                            mode={viewport.propertiesMode}
                            panelWidth={viewport.propertiesWidth}
                            isDrawerOpen={isPropertiesDrawerOpen}
                            onDrawerChange={setIsPropertiesDrawerOpen}
                            side="right"
                            showRail={viewport.showInspectorRail}
                        />
                    )}
                </div>

                <div
                    className="flowtake-timeline-resizer"
                    role="separator"
                    aria-label="Resize timeline"
                    aria-orientation="horizontal"
                    aria-valuemin={TIMELINE_MIN_HEIGHT}
                    aria-valuemax={getTimelineMaxHeight()}
                    aria-valuenow={Math.round(timelineHeight)}
                    tabIndex={0}
                    onPointerDown={handleTimelineResizeStart}
                    onPointerMove={handleTimelineResizeMove}
                    onPointerUp={handleTimelineResizeEnd}
                    onPointerCancel={handleTimelineResizeEnd}
                    onKeyDown={handleTimelineResizeKeyDown}
                >
                    <span />
                </div>
                <div
                    className="flowtake-editor__timeline shrink-0"
                    style={{ height: `${timelineHeight}px` }}
                    data-tutorial="timeline"
                >
                    <Timeline onRequestOpenInspector={openInspector} />
                </div>

                <DragOverlay />

                {isFileDragOver && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-base-300/90 pointer-events-none">
                        <div className="border border-dashed border-primary/60 rounded-xl p-10 bg-base-100 shadow-xl">
                            <p className="text-base font-semibold text-primary">Drop images or audio</p>
                            <p className="text-sm opacity-50 mt-1">Drop over Media to import, or elsewhere to add at the playhead</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
