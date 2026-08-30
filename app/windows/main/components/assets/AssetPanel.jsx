import {
    ArrowDownTrayIcon,
    Bars3Icon,
    ChevronLeftIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon,
    FilmIcon,
    MagnifyingGlassIcon,
    MusicalNoteIcon,
    PhotoIcon,
    PlusIcon,
    Square2StackIcon,
    Squares2X2Icon,
    TrashIcon,
    XMarkIcon
} from "@heroicons/react/16/solid"
import { open as openDialog } from "@tauri-apps/plugin-dialog"
import PropTypes from "prop-types"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    addAsset,
    makeSelectLibraryAssets,
    removeAsset,
    removeAssets,
    selectAssetIds,
    selectBuiltInAssets,
    selectIsImporting,
    setIsImporting,
    updateAsset,
} from "@shared/redux/assetSlice"
import {
    getReferencedTimelineMediaIds,
    importProjectMedia,
} from "@shared/editor/projectMedia"
import { selectAllAudioClips } from "@shared/redux/audioTrackSlice"
import { selectAllOverlays } from "@shared/redux/overlaySlice"
import { removeMedia, upsertMedia } from "@shared/redux/sceneSlice"
import { isTauri } from "@shared/tauriBridge"
import { startDrag } from "../../dragState"

const ASSET_VIEW_MODE_STORAGE_KEY = "flowtake:asset-library-view:v1"
const MEDIA_DIALOG_FILTERS = [{
    name: "Video and image files",
    extensions: [
        "mp4", "mov", "mkv", "webm", "m4v", "avi",
        "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg",
    ],
}]
const AUDIO_DIALOG_FILTERS = [{
    name: "Audio files",
    extensions: ["mp3", "wav", "m4a", "aac", "ogg", "flac", "opus", "webm"],
}]

const TABS = [
    { id: "import", label: "Media", icon: FilmIcon },
    { id: "audio", label: "Sounds", icon: MusicalNoteIcon },
    { id: "text", label: "Text", icon: DocumentTextIcon },
    { id: "shapes", label: "Stickers", icon: Square2StackIcon },
]

function readStoredViewMode() {
    try {
        const storedMode = window.localStorage.getItem(ASSET_VIEW_MODE_STORAGE_KEY)
        return storedMode === "list" ? "list" : "grid"
    } catch {
        return "grid"
    }
}

function storeViewMode(viewMode) {
    try {
        window.localStorage.setItem(ASSET_VIEW_MODE_STORAGE_KEY, viewMode)
    } catch {
        // Storage may be unavailable in a privacy-restricted webview.
    }
}

function importFileAsAsset(dispatch, file) {
    const reader = new FileReader()
    reader.onload = () => {
        if (file.type.startsWith("audio/")) {
            const audio = new Audio(reader.result)
            audio.addEventListener("loadedmetadata", () => {
                dispatch(addAsset({
                    id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    name: file.name,
                    type: "audio",
                    category: "audio",
                    src: reader.result,
                    size: file.size,
                    mimeType: file.type,
                    duration: Math.round(audio.duration * 1000),
                    modifiedAt: file.lastModified,
                    persistence: "session",
                    sessionOnly: true,
                    availability: "ready",
                }))
            }, { once: true })
            audio.addEventListener("error", () => {
                dispatch(addAsset({
                    id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    name: file.name,
                    type: "audio",
                    category: "audio",
                    src: reader.result,
                    size: file.size,
                    mimeType: file.type,
                    duration: 5000,
                    modifiedAt: file.lastModified,
                    persistence: "session",
                    sessionOnly: true,
                    availability: "ready",
                }))
            }, { once: true })
        } else {
            dispatch(addAsset({
                id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: file.name,
                type: file.type.startsWith("video/") ? "video" : "image",
                category: "media",
                src: reader.result,
                size: file.size,
                mimeType: file.type,
                modifiedAt: file.lastModified,
                persistence: "session",
                sessionOnly: true,
                availability: "ready",
            }))
        }
    }
    reader.readAsDataURL(file)
}

function openBrowserFilePicker(dispatch, accept, onSelected) {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = accept
    input.multiple = true
    input.onchange = event => {
        const files = Array.from(event.target.files)
        files.forEach(file => importFileAsAsset(dispatch, file))
        onSelected(files)
    }
    input.click()
}

function probeMediaDuration(src, type) {
    if (!src || (type !== "audio" && type !== "video")) {
        return Promise.resolve(null)
    }

    return new Promise(resolve => {
        const media = document.createElement(type)
        let isSettled = false
        const finish = value => {
            if (isSettled) return
            isSettled = true
            clearTimeout(timeout)
            media.onloadedmetadata = null
            media.onerror = null
            resolve(value)
        }
        const timeout = setTimeout(() => finish(null), 4000)
        media.preload = "metadata"
        media.onloadedmetadata = () => {
            const duration = Number.isFinite(media.duration)
                ? Math.round(media.duration * 1000)
                : null
            finish(duration)
        }
        media.onerror = () => finish(null)
        media.src = src
    })
}

const getPathFileName = path =>
    path.replaceAll(String.fromCharCode(92), "/").split("/").pop()

export default function AssetPanel({
    isOpen,
    onToggle,
    mode = "docked",
    panelWidth = 248
}) {

    const dispatch = useDispatch()
    const librarySelector = useMemo(() => makeSelectLibraryAssets(), [])
    const importedAssetIds = useSelector(selectAssetIds)
    const isImporting = useSelector(selectIsImporting)
    const builtInAssets = useSelector(selectBuiltInAssets)
    const timelineAudioClips = useSelector(selectAllAudioClips)
    const timelineOverlays = useSelector(selectAllOverlays)
    const referencedAssetIds = useMemo(
        () => getReferencedTimelineMediaIds(timelineAudioClips, timelineOverlays),
        [timelineAudioClips, timelineOverlays]
    )
    const textAssets = useMemo(
        () => builtInAssets.filter(asset => asset.category === "text"),
        [builtInAssets]
    )
    const shapeAssets = useMemo(
        () => builtInAssets.filter(asset => asset.category === "shapes"),
        [builtInAssets]
    )

    const [activeTab, setActiveTab] = useState("import")
    const [isDraggingOver, setIsDraggingOver] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [sortBy, setSortBy] = useState("newest")
    const [viewMode, setViewMode] = useState(readStoredViewMode)
    const [selectedAssetIds, setSelectedAssetIds] = useState(() => new Set())
    const [importNotice, setImportNotice] = useState(null)
    const dragCounter = useRef(0)
    const lastSelectedAssetId = useRef(null)
    const isMounted = useRef(true)

    const libraryCategory = activeTab === "audio" ? "audio" : "media"
    const libraryAssets = useSelector(state =>
        librarySelector(state, libraryCategory, searchQuery, sortBy)
    )
    const visibleAssetIds = useMemo(
        () => libraryAssets.map(asset => asset.id),
        [libraryAssets]
    )
    const mediaAssets = activeTab === "import" ? libraryAssets : []
    const audioAssets = activeTab === "audio" ? libraryAssets : []
    const activeTabConfig = TABS.find(tab => tab.id === activeTab) || TABS[0]
    const ActiveTabIcon = activeTabConfig.icon
    const isDrawer = mode === "drawer"
    const isLibraryTab = activeTab === "import" || activeTab === "audio"
    const selectedCount = selectedAssetIds.size
    const allVisibleSelected = visibleAssetIds.length > 0
        && visibleAssetIds.every(id => selectedAssetIds.has(id))

    useEffect(() => {
        const availableAssetIds = new Set(importedAssetIds)
        setSelectedAssetIds(currentSelection => {
            const nextSelection = new Set(
                [...currentSelection].filter(id => availableAssetIds.has(id))
            )
            return nextSelection.size === currentSelection.size
                ? currentSelection
                : nextSelection
        })
        if (lastSelectedAssetId.current
            && !availableAssetIds.has(lastSelectedAssetId.current)) {
            lastSelectedAssetId.current = null
        }
    }, [importedAssetIds])

    useEffect(() => () => {
        isMounted.current = false
    }, [])

    const importDurablePaths = useCallback(async (sourcePaths, tabId) => {
        if (sourcePaths.length === 0) return
        dispatch(setIsImporting(true))
        setImportNotice(null)
        const failedNames = []

        try {
            for (const sourcePath of sourcePaths) {
                try {
                    const { metadata, asset } = await importProjectMedia(sourcePath)
                    if (!isMounted.current) return
                    dispatch(upsertMedia(metadata))
                    dispatch(addAsset(asset))

                    const duration = await probeMediaDuration(asset.src, asset.type)
                    if (duration != null && isMounted.current) {
                        dispatch(upsertMedia({ id: metadata.id, duration }))
                        dispatch(updateAsset({
                            id: asset.id,
                            changes: { duration },
                        }))
                    }
                } catch (error) {
                    if (!isMounted.current) return
                    console.error("[AssetPanel] Project media import failed:", error)
                    failedNames.push(getPathFileName(sourcePath) || sourcePath)
                }
            }
            if (!isMounted.current) return
            setActiveTab(tabId)
            if (failedNames.length > 0) {
                setImportNotice({
                    type: "error",
                    text: `Couldn't import ${failedNames.length} ${failedNames.length === 1 ? "file" : "files"}.`,
                })
            }
        } finally {
            if (isMounted.current) dispatch(setIsImporting(false))
        }
    }, [dispatch])

    const openProjectMediaPicker = useCallback(async (filters, tabId) => {
        try {
            const selection = await openDialog({
                directory: false,
                multiple: true,
                filters,
            })
            if (!selection) return
            const sourcePaths = Array.isArray(selection) ? selection : [selection]
            await importDurablePaths(sourcePaths, tabId)
        } catch (error) {
            if (!isMounted.current) return
            console.error("[AssetPanel] Media picker failed:", error)
            setImportNotice({
                type: "error",
                text: "Couldn't open or import the selected files.",
            })
        }
    }, [importDurablePaths])

    const openSessionOnlyPicker = useCallback((accept, tabId) => {
        openBrowserFilePicker(dispatch, accept, files => {
            if (files.length === 0) return
            setActiveTab(tabId)
            setImportNotice({
                type: "session",
                text: "Browser imports are available in this editing session only.",
            })
        })
    }, [dispatch])

    const handleImportMedia = useCallback(() => {
        if (isTauri) {
            openProjectMediaPicker(MEDIA_DIALOG_FILTERS, "import")
            return
        }
        openSessionOnlyPicker("video/*,image/*", "import")
    }, [openProjectMediaPicker, openSessionOnlyPicker])

    const handleImportAudio = useCallback(() => {
        if (isTauri) {
            openProjectMediaPicker(AUDIO_DIALOG_FILTERS, "audio")
            return
        }
        openSessionOnlyPicker("audio/*", "audio")
    }, [openProjectMediaPicker, openSessionOnlyPicker])

    // Pointer-event-based drag (HTML5 DnD is unreliable in Tauri WebView2)
    const handlePointerDrag = useCallback((e, asset) => {
        startDrag(asset.type || asset.category, asset, e)
    }, [])

    // OS file drop into panel
    const handlePanelDragOver = useCallback(e => {
        // Only accept OS file drops, not internal drags
        if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault()
            e.dataTransfer.dropEffect = "copy"
        }
    }, [])

    const handlePanelDragEnter = useCallback(e => {
        e.preventDefault()
        dragCounter.current++
        if (e.dataTransfer.types.includes("Files")) setIsDraggingOver(true)
    }, [])

    const handlePanelDragLeave = useCallback(e => {
        e.preventDefault()
        dragCounter.current--
        if (dragCounter.current <= 0) { setIsDraggingOver(false); dragCounter.current = 0 }
    }, [])

    const handlePanelDrop = useCallback(e => {
        e.preventDefault()
        setIsDraggingOver(false)
        dragCounter.current = 0
        const files = Array.from(e.dataTransfer.files)
        if (files.length === 0) return
        files.forEach(file => importFileAsAsset(dispatch, file))
        setImportNotice({
            type: "session",
            text: "Dropped files are available in this editing session only. Use Import to keep them with the project.",
        })
        const hasAudio = files.some(f => f.type.startsWith("audio/"))
        const hasMedia = files.some(f => f.type.startsWith("video/") || f.type.startsWith("image/"))
        if (hasAudio && !hasMedia) setActiveTab("audio")
        else if (hasMedia) setActiveTab("import")
    }, [dispatch])

    const handleAssetSelect = useCallback((assetId, event) => {
        if (event.button != null && event.button !== 0) return

        const isAdditive = event.ctrlKey || event.metaKey
        const anchorIndex = visibleAssetIds.indexOf(lastSelectedAssetId.current)
        const selectedIndex = visibleAssetIds.indexOf(assetId)

        if (event.shiftKey && anchorIndex >= 0 && selectedIndex >= 0) {
            const start = Math.min(anchorIndex, selectedIndex)
            const end = Math.max(anchorIndex, selectedIndex)
            const rangeIds = visibleAssetIds.slice(start, end + 1)
            setSelectedAssetIds(currentSelection => {
                const nextSelection = isAdditive
                    ? new Set(currentSelection)
                    : new Set()
                rangeIds.forEach(id => nextSelection.add(id))
                return nextSelection
            })
        } else if (isAdditive) {
            setSelectedAssetIds(currentSelection => {
                const nextSelection = new Set(currentSelection)
                if (nextSelection.has(assetId)) nextSelection.delete(assetId)
                else nextSelection.add(assetId)
                return nextSelection
            })
        } else {
            setSelectedAssetIds(new Set([assetId]))
        }

        lastSelectedAssetId.current = assetId
    }, [visibleAssetIds])

    const handleRemoveAsset = useCallback(assetId => {
        if (referencedAssetIds.has(assetId)) {
            setImportNotice({
                type: "error",
                text: "This asset is used on the timeline. Remove its timeline clips before deleting it.",
            })
            return
        }
        dispatch(removeAsset(assetId))
        dispatch(removeMedia(assetId))
        setSelectedAssetIds(currentSelection => {
            if (!currentSelection.has(assetId)) return currentSelection
            const nextSelection = new Set(currentSelection)
            nextSelection.delete(assetId)
            return nextSelection
        })
        if (lastSelectedAssetId.current === assetId) {
            lastSelectedAssetId.current = null
        }
    }, [dispatch, referencedAssetIds])

    const handleRemoveSelected = useCallback(() => {
        if (selectedAssetIds.size === 0) return
        const assetIds = [...selectedAssetIds]
        const referencedCount = assetIds
            .filter(assetId => referencedAssetIds.has(assetId))
            .length
        if (referencedCount > 0) {
            setImportNotice({
                type: "error",
                text: `${referencedCount} selected ${referencedCount === 1 ? "asset is" : "assets are"} used on the timeline. Remove those timeline clips before deleting.`,
            })
            return
        }
        dispatch(removeAssets(assetIds))
        dispatch(removeMedia(assetIds))
        setSelectedAssetIds(new Set())
        lastSelectedAssetId.current = null
    }, [dispatch, referencedAssetIds, selectedAssetIds])

    const handleSelectAll = useCallback(() => {
        setSelectedAssetIds(new Set(visibleAssetIds))
        lastSelectedAssetId.current = visibleAssetIds[visibleAssetIds.length - 1] || null
    }, [visibleAssetIds])

    const handleClearSelection = useCallback(() => {
        setSelectedAssetIds(new Set())
        lastSelectedAssetId.current = null
    }, [])

    const handleViewModeChange = useCallback(nextViewMode => {
        setViewMode(nextViewMode)
        storeViewMode(nextViewMode)
    }, [])

    const handleTabChange = tabId => {
        if (tabId !== activeTab) handleClearSelection()
        setActiveTab(tabId)
        if (!isOpen) onToggle()
    }

    const rail = (
        <nav className="flowtake-asset-rail h-full w-10 shrink-0 flex flex-col items-center gap-0.5 overflow-y-auto border-r border-base-content/10 bg-base-100 py-1 no-scrollbar"
            aria-label="Media tools">
            {TABS.map(tab => (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    aria-label={tab.label}
                    aria-pressed={activeTab === tab.id && isOpen}
                    title={tab.label}
                    className={[
                        "flowtake-sidebar-button relative !min-h-8 h-8 w-8 shrink-0 flex items-center justify-center rounded-md transition-colors",
                        activeTab === tab.id && isOpen
                            ? "bg-primary/15 text-primary ring-1 ring-primary/20"
                            : "text-base-content/55 hover:bg-base-content/5 hover:text-base-content"
                    ].join(" ")}
                >
                    {activeTab === tab.id && isOpen && (
                        <span className="absolute -left-2 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-r" />
                    )}
                    <tab.icon className="size-4" />
                </button>
            ))}
        </nav>
    )

    const content = (
        <div
            className="flowtake-asset-panel min-w-0 flex-1 bg-base-100 flex flex-col h-full overflow-hidden relative"
            onDragEnter={handlePanelDragEnter}
            onDragLeave={handlePanelDragLeave}
            onDragOver={handlePanelDragOver}
            onDrop={handlePanelDrop}
        >
            {isDraggingOver && (
                <div className="absolute inset-0 z-50 bg-info/10 border-2 border-dashed border-info flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <ArrowDownTrayIcon className="size-8 text-info animate-bounce" />
                    <span className="text-xs font-medium text-info">Drop files here</span>
                </div>
            )}

            <header className="flowtake-panel__header h-11 px-2.5 flex items-center justify-between border-b border-base-content/10 shrink-0">
                <div className="flex min-w-0 items-center gap-2">
                    <ActiveTabIcon className="size-3.5 shrink-0 text-primary/80" />
                    <h2 className="truncate text-sm font-medium">{activeTabConfig.label}</h2>
                </div>
                <button
                    type="button"
                    onClick={onToggle}
                    className="btn btn-ghost btn-xs h-7 min-h-7 w-7 p-0"
                    aria-label="Collapse media panel"
                    title="Collapse media panel"
                >
                    <ChevronLeftIcon className="size-3.5" />
                </button>
            </header>

            {isLibraryTab && (
                <LibraryControls
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    viewMode={viewMode}
                    onViewModeChange={handleViewModeChange}
                    resultCount={libraryAssets.length}
                    selectedCount={selectedCount}
                    allVisibleSelected={allVisibleSelected}
                    onSelectAll={handleSelectAll}
                    onClearSelection={handleClearSelection}
                    onRemoveSelected={handleRemoveSelected}
                    onImport={activeTab === "audio" ? handleImportAudio : handleImportMedia}
                    importLabel={activeTab === "audio" ? "Import audio" : "Import media"}
                    isImporting={isImporting}
                />
            )}

            {isLibraryTab && importNotice && (
                <div
                    className={[
                        "mx-2.5 mt-2 flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-[10px]",
                        importNotice.type === "error"
                            ? "border-error/30 bg-error/10 text-error"
                            : "border-warning/30 bg-warning/10 text-base-content/70",
                    ].join(" ")}
                    role={importNotice.type === "error" ? "alert" : "status"}
                >
                    <ExclamationTriangleIcon className="mt-0.5 size-3 shrink-0" />
                    <span className="min-w-0 flex-1">{importNotice.text}</span>
                    <button
                        type="button"
                        onClick={() => setImportNotice(null)}
                        className="btn btn-ghost btn-xs h-4 min-h-4 w-4 p-0"
                        aria-label="Dismiss import notice"
                    >
                        <XMarkIcon className="size-2.5" />
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar p-2">
                {activeTab === "import" && <ImportTab
                    mediaAssets={mediaAssets}
                    onRemove={handleRemoveAsset}
                    onPointerDrag={handlePointerDrag}
                    onSelect={handleAssetSelect}
                    selectedAssetIds={selectedAssetIds}
                    viewMode={viewMode}
                    searchQuery={searchQuery}
                />}
                {activeTab === "audio" && <AudioTab
                    audioAssets={audioAssets}
                    onRemove={handleRemoveAsset}
                    onPointerDrag={handlePointerDrag}
                    onSelect={handleAssetSelect}
                    selectedAssetIds={selectedAssetIds}
                    viewMode={viewMode}
                    searchQuery={searchQuery}
                />}
                {activeTab === "text" && <TextTab
                    assets={textAssets}
                    onPointerDrag={handlePointerDrag}
                />}
                {activeTab === "shapes" && <ShapesTab
                    assets={shapeAssets}
                    onPointerDrag={handlePointerDrag}
                />}
            </div>
        </div>
    )

    if (isDrawer) {
        return (
            <>
                <div className="flowtake-panel relative h-full shrink-0 z-30 overflow-hidden">
                    {rail}
                </div>
                {isOpen && (
                    <>
                        <button
                            type="button"
                            aria-label="Close media panel"
                            className="absolute inset-0 bg-base-content/20 backdrop-blur-[1px] z-20"
                            onClick={onToggle}
                        />
                        <div
                            className="flowtake-panel absolute left-12 top-0 bottom-0 z-30 flex overflow-hidden"
                            style={{ width: panelWidth, maxWidth: "calc(100vw - 7.5rem)" }}
                        >
                            {content}
                        </div>
                    </>
                )}
            </>
        )
    }

    return (
        <div
            className="flowtake-panel h-full min-w-0 shrink-0 flex overflow-hidden"
            style={{ width: isOpen ? panelWidth : 40 }}
        >
            {rail}
            {isOpen && content}
        </div>
    )
}

AssetPanel.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onToggle: PropTypes.func.isRequired,
    mode: PropTypes.oneOf(["docked", "drawer"]),
    panelWidth: PropTypes.number
}

function LibraryControls({
    searchQuery,
    onSearchChange,
    sortBy,
    onSortChange,
    viewMode,
    onViewModeChange,
    resultCount,
    selectedCount,
    allVisibleSelected,
    onSelectAll,
    onClearSelection,
    onRemoveSelected,
    onImport,
    importLabel,
    isImporting,
}) {
    return (
        <div className="shrink-0 flex flex-col gap-1.5 border-b border-base-content/10 p-2">
            <div className="flex min-w-0 items-center gap-1.5">
                <label className="relative block min-w-0 flex-1">
                    <span className="sr-only">Search library</span>
                    <MagnifyingGlassIcon
                        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-base-content/40"
                    />
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={event => onSearchChange(event.target.value)}
                        placeholder="Search"
                        className="input input-xs h-8 w-full min-w-0 pl-8"
                        aria-label="Search library"
                    />
                </label>
                <button
                    type="button"
                    onClick={onImport}
                    disabled={isImporting}
                    className="btn btn-primary btn-xs h-8 min-h-8 shrink-0 gap-1 px-2"
                    aria-label={importLabel}
                    title={importLabel}
                >
                    {isImporting
                        ? <span className="loading loading-spinner loading-xs" />
                        : <PlusIcon className="size-3.5" />}
                    <span>Import</span>
                </button>
            </div>

            <div className="flex min-w-0 items-center gap-1.5">
                <select
                    value={sortBy}
                    onChange={event => onSortChange(event.target.value)}
                    className="select select-xs h-8 min-h-8 min-w-0 flex-1"
                    aria-label="Sort library assets"
                >
                    <option value="newest">Newest</option>
                    <option value="name">Name</option>
                    <option value="type">Type</option>
                </select>
                <div
                    className="flex shrink-0 rounded-md border border-base-content/10 p-0.5"
                    role="group"
                    aria-label="Library view"
                >
                    <button
                        type="button"
                        onClick={() => onViewModeChange("grid")}
                        className={`btn btn-ghost btn-xs h-7 min-h-7 w-7 p-0 ${viewMode === "grid" ? "bg-base-content/10 text-primary" : ""}`}
                        aria-label="Grid view"
                        aria-pressed={viewMode === "grid"}
                        title="Grid view"
                    >
                        <Squares2X2Icon className="size-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewModeChange("list")}
                        className={`btn btn-ghost btn-xs h-7 min-h-7 w-7 p-0 ${viewMode === "list" ? "bg-base-content/10 text-primary" : ""}`}
                        aria-label="List view"
                        aria-pressed={viewMode === "list"}
                        title="List view"
                    >
                        <Bars3Icon className="size-3.5" />
                    </button>
                </div>
            </div>

            {(resultCount > 0 || selectedCount > 0) && <div className="flex min-w-0 items-center gap-1">
                <span
                    className="mr-auto truncate text-[10px] text-base-content/50"
                    aria-live="polite"
                >
                    {selectedCount > 0
                        ? `${selectedCount} selected`
                        : `${resultCount} ${resultCount === 1 ? "item" : "items"}`}
                </span>
                <button
                    type="button"
                    onClick={onSelectAll}
                    disabled={resultCount === 0 || allVisibleSelected}
                    className="btn btn-ghost btn-xs h-7 min-h-7 px-1.5 text-[10px]"
                >
                    Select all
                </button>
                <button
                    type="button"
                    onClick={onClearSelection}
                    disabled={selectedCount === 0}
                    className="btn btn-ghost btn-xs h-7 min-h-7 px-1.5 text-[10px]"
                >
                    Clear
                </button>
                <button
                    type="button"
                    onClick={onRemoveSelected}
                    disabled={selectedCount === 0}
                    className="btn btn-ghost btn-xs h-7 min-h-7 w-7 p-0 text-error"
                    aria-label={selectedCount > 0
                        ? `Remove ${selectedCount} selected assets`
                        : "Remove selected assets"}
                    title="Remove selected assets"
                >
                    <TrashIcon className="size-3.5" />
                </button>
            </div>}
        </div>
    )
}

function ImportTab({
    mediaAssets,
    onRemove,
    onPointerDrag,
    onSelect,
    selectedAssetIds,
    viewMode,
    searchQuery,
}) {
    return (<>
        {mediaAssets.length === 0 ? (
            <EmptyState icon={<FilmIcon className="size-8 opacity-20" />}
                text={searchQuery
                    ? "No media matches your search"
                    : "Drop video or image files here, or use Import above"} />
        ) : (
            <div
                className={viewMode === "grid"
                    ? "grid grid-cols-[repeat(auto-fill,7rem)] content-start justify-start gap-2"
                    : "flex flex-col gap-1"}
                role="listbox"
                aria-label="Imported media"
                aria-multiselectable="true"
            >
                {mediaAssets.map(asset => (
                    <MediaCard key={asset.id} asset={asset}
                        onRemove={() => onRemove(asset.id)}
                        onPointerDrag={event => onPointerDrag(event, asset)}
                        onSelect={event => onSelect(asset.id, event)}
                        isSelected={selectedAssetIds.has(asset.id)}
                        viewMode={viewMode} />
                ))}
            </div>
        )}
    </>)
}

function AudioTab({
    audioAssets,
    onRemove,
    onPointerDrag,
    onSelect,
    selectedAssetIds,
    viewMode,
    searchQuery,
}) {
    return (<>
        {audioAssets.length === 0 ? (
            <EmptyState icon={<MusicalNoteIcon className="size-8 opacity-20" />}
                text={searchQuery
                    ? "No audio matches your search"
                    : "Drop audio files here, or use Import above"} />
        ) : (
            <div
                className={viewMode === "grid"
                    ? "grid grid-cols-[repeat(auto-fill,7rem)] content-start justify-start gap-2"
                    : "flex flex-col gap-1"}
                role="listbox"
                aria-label="Imported audio"
                aria-multiselectable="true"
            >
                {audioAssets.map(asset => (
                    <AudioCard key={asset.id} asset={asset}
                        onRemove={() => onRemove(asset.id)}
                        onPointerDrag={event => onPointerDrag(event, asset)}
                        onSelect={event => onSelect(asset.id, event)}
                        isSelected={selectedAssetIds.has(asset.id)}
                        viewMode={viewMode} />
                ))}
            </div>
        )}
    </>)
}

function TextTab({ assets, onPointerDrag }) {
    return (
        <div className="flex flex-col gap-1.5">
            <p className="text-[10px] opacity-40 mb-1">Drag to the preview or timeline</p>
            {assets.map(asset => (
                <div key={asset.id}
                    onPointerDown={e => onPointerDrag(e, asset)}
                    className="px-3 py-2.5 bg-base-200 rounded-lg cursor-grab active:cursor-grabbing
                        hover:bg-base-content/10 transition-colors select-none"
                >
                    <span style={{
                        fontSize: Math.min(asset.config?.fontSize || 32, 20),
                        fontWeight: asset.config?.fontWeight || 400,
                        color: asset.config?.color || "#fff"
                    }}>
                        {asset.name}
                    </span>
                </div>
            ))}
        </div>
    )
}

function ShapesTab({ assets, onPointerDrag }) {
    return (
        <div className="grid grid-cols-2 gap-1.5">
            <p className="text-[10px] opacity-40 col-span-2 mb-1">Drag to the preview or timeline</p>
            {assets.map(asset => (
                <div key={asset.id}
                    onPointerDown={e => onPointerDrag(e, asset)}
                    className="flex flex-col items-center gap-1 p-3 bg-base-200 rounded-lg cursor-grab
                        active:cursor-grabbing hover:bg-base-content/10 transition-colors select-none"
                >
                    <ShapePreview config={asset.config} />
                    <span className="text-[10px] opacity-60">{asset.name}</span>
                </div>
            ))}
        </div>
    )
}

function ShapePreview({ config }) {
    if (!config) return null
    const { shapeType, fill, stroke, strokeWidth = 0 } = config
    const style = {
        backgroundColor: fill !== "none" ? fill : "transparent",
        border: stroke !== "none" ? `${strokeWidth || 2}px solid ${stroke}` : "none",
    }
    if (shapeType === "circle") return <div className="w-10 h-10 rounded-full" style={style} />
    if (shapeType === "arrow") return <div className="w-12 h-4 rounded" style={{ ...style, clipPath: "polygon(0 30%, 70% 30%, 70% 0, 100% 50%, 70% 100%, 70% 70%, 0 70%)" }} />
    return <div className="w-12 h-8" style={{ ...style, borderRadius: config.borderRadius || 0 }} />
}

function MediaCard({
    asset,
    onRemove,
    onPointerDrag,
    onSelect,
    isSelected,
    viewMode,
}) {
    const isUnavailable = asset.availability === "missing" || asset.isMissing
    const handlePointerDown = event => {
        onSelect(event)
        if (event.button === 0 && !isUnavailable) onPointerDrag(event)
    }
    const handleKeyDown = event => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        onSelect(event)
    }

    if (viewMode === "list") {
        return (
            <div
                className={[
                    "group/asset relative flex h-8 min-w-0 cursor-grab items-center gap-1.5 overflow-hidden rounded-md border px-1.5",
                    "select-none transition-colors active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isSelected
                        ? "border-primary/60 bg-primary/10 ring-1 ring-primary/50"
                        : "border-transparent bg-base-200 hover:bg-base-content/10",
                    isUnavailable ? "cursor-not-allowed opacity-70" : ""
                ].join(" ")}
                onPointerDown={handlePointerDown}
                onKeyDown={handleKeyDown}
                onDragStart={event => event.preventDefault()}
                role="option"
                aria-selected={isSelected}
                aria-disabled={isUnavailable}
                tabIndex={0}
                title={isUnavailable ? `${asset.name} - file unavailable` : asset.name}
            >
                <div className="h-6 w-8 shrink-0 overflow-hidden rounded-sm bg-base-300">
                    <MediaThumbnail asset={asset} iconClassName="size-4" />
                </div>
                <span className="block min-w-0 max-w-full flex-1 truncate text-[11px] pointer-events-none">
                    {asset.name}
                </span>
                <AssetStatus asset={asset} compact />
                <AssetRemoveButton
                    assetName={asset.name}
                    isSelected={isSelected}
                    onRemove={onRemove}
                />
            </div>
        )
    }

    return (
        <div
            className={[
                "relative group/asset flex w-28 min-w-0 flex-col gap-1 overflow-hidden rounded-md border bg-base-200 p-1 cursor-grab active:cursor-grabbing",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isSelected
                    ? "border-primary ring-2 ring-primary ring-inset"
                    : "border-transparent",
                isUnavailable ? "cursor-not-allowed opacity-70" : ""
            ].join(" ")}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            onDragStart={event => event.preventDefault()}
            role="option"
            aria-selected={isSelected}
            aria-disabled={isUnavailable}
            tabIndex={0}
            title={isUnavailable ? `${asset.name} - file unavailable` : asset.name}
        >
            <div className="relative aspect-video w-full min-w-0 overflow-hidden rounded-sm bg-base-300">
                <MediaThumbnail asset={asset} />
                <AssetStatus asset={asset} overlay compact />
                <AssetRemoveButton
                    assetName={asset.name}
                    isSelected={isSelected}
                    onRemove={onRemove}
                    overlay
                />
            </div>
            <span className="pointer-events-none block min-w-0 max-w-full truncate px-0.5 text-[10px] text-base-content/75">
                {asset.name}
            </span>
        </div>
    )
}

function MediaThumbnail({ asset, iconClassName = "size-6" }) {
    const [hasPreviewError, setHasPreviewError] = useState(false)
    const isImage = asset.type === "image"
    const hasImagePreview = isImage && asset.src && !hasPreviewError

    useEffect(() => {
        setHasPreviewError(false)
    }, [asset.src])

    if (hasImagePreview) {
        return (
            <img
                src={asset.src}
                alt=""
                loading="lazy"
                onError={() => setHasPreviewError(true)}
                className="h-full w-full select-none object-cover pointer-events-none"
                draggable={false}
                style={{ WebkitUserDrag: "none" }}
            />
        )
    }

    const PreviewIcon = isImage ? PhotoIcon : FilmIcon
    return (
        <div
            className="flex h-full w-full items-center justify-center overflow-hidden pointer-events-none"
            aria-hidden="true"
        >
            <PreviewIcon className={`${iconClassName} shrink-0 opacity-25`} />
        </div>
    )
}

function AudioCard({
    asset,
    onRemove,
    onPointerDrag,
    onSelect,
    isSelected,
    viewMode,
}) {
    const isUnavailable = asset.availability === "missing" || asset.isMissing
    const handlePointerDown = event => {
        onSelect(event)
        if (event.button === 0 && !isUnavailable) onPointerDrag(event)
    }
    const handleKeyDown = event => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        onSelect(event)
    }

    return (
        <div
            className={[
                "group/asset relative min-w-0 cursor-grab rounded-lg border bg-base-200 select-none transition-colors",
                "active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                viewMode === "grid"
                    ? "flex min-h-24 flex-col items-center justify-center gap-1.5 p-2 text-center"
                    : "flex h-8 items-center gap-1.5 overflow-hidden px-1.5",
                isSelected
                    ? "border-primary/60 bg-primary/10 ring-1 ring-primary/50"
                    : "border-transparent hover:bg-base-content/10",
                isUnavailable ? "cursor-not-allowed opacity-70" : ""
            ].join(" ")}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            onDragStart={event => event.preventDefault()}
            role="option"
            aria-selected={isSelected}
            aria-disabled={isUnavailable}
            tabIndex={0}
            title={isUnavailable ? `${asset.name} - file unavailable` : asset.name}
        >
            <div className={`${viewMode === "grid" ? "h-8 w-8" : "h-6 w-6"} rounded bg-secondary/20 flex items-center justify-center shrink-0 pointer-events-none`}>
                <MusicalNoteIcon className={`${viewMode === "grid" ? "size-4" : "size-3.5"} text-secondary`} />
            </div>
            <div className={`flex min-w-0 flex-col pointer-events-none ${viewMode === "grid" ? "w-full" : "flex-1"}`}>
                <span className="text-xs truncate">{asset.name}</span>
                {viewMode === "grid" && asset.duration && (
                    <span className="text-[10px] opacity-40">{formatDuration(asset.duration)}</span>
                )}
                {viewMode === "grid" && <AssetStatus asset={asset} />}
            </div>
            {viewMode === "list" && <AssetStatus asset={asset} compact />}
            <AssetRemoveButton
                assetName={asset.name}
                isSelected={isSelected}
                onRemove={onRemove}
                overlay={viewMode === "grid"}
            />
        </div>
    )
}

function AssetStatus({ asset, overlay = false, compact = false }) {
    const isMissing = asset.availability === "missing" || asset.isMissing
    if (!isMissing && !asset.sessionOnly) return null
    const label = isMissing ? "Missing file" : "Session only"
    const title = isMissing
        ? asset.missingReason || "File unavailable"
        : "Available for this editing session only"

    return (
        <span
            className={[
                "inline-flex w-fit items-center gap-1 rounded px-1 py-0.5 text-[9px] font-medium",
                isMissing
                    ? "bg-error/15 text-error"
                    : "bg-warning/15 text-base-content/60",
                overlay ? "absolute left-1 top-1 z-10 bg-black/65 text-white" : "mt-0.5",
                compact ? "m-0 h-4 w-4 shrink-0 justify-center p-0" : "",
            ].join(" ")}
            title={title}
        >
            <ExclamationTriangleIcon className="size-2.5" />
            {compact ? <span className="sr-only">{label}</span> : label}
        </span>
    )
}

function AssetRemoveButton({ assetName, isSelected, onRemove, overlay = false }) {
    const stopAndRemove = event => {
        event.stopPropagation()
        onRemove()
    }

    return (
        <button
            type="button"
            onClick={stopAndRemove}
            onPointerDown={event => event.stopPropagation()}
            onKeyDown={event => event.stopPropagation()}
            className={[
                "btn btn-ghost btn-xs h-6 min-h-6 w-6 shrink-0 p-0",
                "opacity-0 group-hover/asset:opacity-80 group-focus-within/asset:opacity-80 hover:!opacity-100",
                isSelected ? "opacity-80" : "",
                overlay ? "absolute right-1 top-1 rounded bg-black/50 text-white" : ""
            ].join(" ")}
            aria-label={`Remove ${assetName}`}
            title={`Remove ${assetName}`}
        >
            <XMarkIcon className="size-3" />
        </button>
    )
}

function EmptyState({ icon, text }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md bg-base-200/55 px-4 py-8">
            {icon}
            <span className="max-w-40 text-center text-xs leading-relaxed text-base-content/40">{text}</span>
        </div>
    )
}

function formatDuration(ms) {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
}
