import {
    ArrowDownTrayIcon,
    ArrowRightIcon,
    DocumentTextIcon,
    MagnifyingGlassIcon,
    MusicalNoteIcon,
    PhotoIcon,
    PlusIcon,
    Square2StackIcon,
    XMarkIcon
} from "@heroicons/react/16/solid"
import { convertFileSrc } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
import PropTypes from "prop-types"
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import { addErrorToast } from "@shared/errorToastHelper"
import { readAudioDurationMs } from "@shared/mediaMetadata"
import {
    addAsset,
    removeAsset,
    selectAllAssets,
    selectBuiltInAssets,
    updateAsset
} from "@shared/redux/assetSlice"
import { isTauri } from "@shared/tauriBridge"
import { consumeSuppressedAssetClick, startDrag } from "../../dragState"

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]
const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma"]

const TABS = [
    { id: "images", label: "Images", icon: PhotoIcon },
    { id: "audio", label: "Audio", icon: MusicalNoteIcon },
    { id: "text", label: "Text", icon: DocumentTextIcon },
    { id: "shapes", label: "Shapes", icon: Square2StackIcon },
]

function uniqueId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function fileNameFromPath(path) {
    return path.split(/[\\/]/).pop() || "Imported file"
}

async function probeAudioDuration(dispatch, asset) {
    const duration = await readAudioDurationMs(asset.src)
    if (duration) dispatch(updateAsset({ id: asset.id, changes: { duration } }))
}

function addPathAsset(dispatch, path, type) {
    const asset = {
        id: uniqueId(type),
        name: fileNameFromPath(path),
        type,
        category: type === "audio" ? "audio" : "media",
        src: convertFileSrc(path),
        path,
        duration: undefined,
    }
    dispatch(addAsset(asset))
    if (type === "audio") probeAudioDuration(dispatch, asset)
}

function addBrowserFile(dispatch, file, type) {
    const src = URL.createObjectURL(file)
    window.dispatchEvent(new CustomEvent("flowtake-object-url-created", { detail: { url: src } }))
    const asset = {
        id: uniqueId(type),
        name: file.name,
        type,
        category: type === "audio" ? "audio" : "media",
        src,
        size: file.size,
        mimeType: file.type,
        duration: undefined,
        objectUrl: true,
    }
    dispatch(addAsset(asset))
    if (type === "audio") probeAudioDuration(dispatch, asset)
}

async function insertAsset(asset) {
    let data = asset
    if ((asset.type === "audio" || asset.category === "audio") && !asset.duration) {
        const duration = await readAudioDurationMs(asset.src)
        if (duration) data = { ...asset, duration }
    }
    window.dispatchEvent(new CustomEvent("flowtake-drop", {
        detail: {
            data,
            target: { zone: "timeline" },
        }
    }))
}

export default function AssetPanel({ isOpen, onToggle, mode = "docked" }) {

    const dispatch = useDispatch()
    const importedAssets = useSelector(selectAllAssets)
    const builtInAssets = useSelector(selectBuiltInAssets)

    const [activeTab, setActiveTab] = useState("images")
    const [query, setQuery] = useState("")
    const [isDraggingOver, setIsDraggingOver] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const dragCounter = useRef(0)

    useEffect(() => {
        const importPaths = event => {
            const paths = Array.isArray(event.detail?.paths) ? event.detail.paths : []
            let importedAudio = false
            let importedImage = false
            paths.forEach(path => {
                const extension = path.split(".").pop()?.toLowerCase()
                if (AUDIO_EXTENSIONS.includes(extension)) {
                    addPathAsset(dispatch, path, "audio")
                    importedAudio = true
                } else if (IMAGE_EXTENSIONS.includes(extension)) {
                    addPathAsset(dispatch, path, "image")
                    importedImage = true
                }
            })
            if (importedAudio && !importedImage) setActiveTab("audio")
            else if (importedImage) setActiveTab("images")
        }
        window.addEventListener("flowtake-import-paths", importPaths)
        return () => window.removeEventListener("flowtake-import-paths", importPaths)
    }, [dispatch])

    const imageAssets = useMemo(
        () => importedAssets.filter(asset => asset.category === "media" && asset.type === "image"),
        [importedAssets]
    )
    const audioAssets = useMemo(
        () => importedAssets.filter(asset => asset.category === "audio"),
        [importedAssets]
    )
    const textAssets = useMemo(
        () => builtInAssets.filter(asset => asset.category === "text"),
        [builtInAssets]
    )
    const shapeAssets = useMemo(
        () => builtInAssets.filter(asset => asset.category === "shapes"),
        [builtInAssets]
    )

    const filterAssets = useCallback(assets => {
        const normalized = query.trim().toLowerCase()
        if (!normalized) return assets
        return assets.filter(asset => asset.name?.toLowerCase().includes(normalized))
    }, [query])

    const filteredImages = useMemo(() => filterAssets(imageAssets), [filterAssets, imageAssets])
    const filteredAudio = useMemo(() => filterAssets(audioAssets), [filterAssets, audioAssets])
    const filteredText = useMemo(() => filterAssets(textAssets), [filterAssets, textAssets])
    const filteredShapes = useMemo(() => filterAssets(shapeAssets), [filterAssets, shapeAssets])

    const importWithBrowserPicker = useCallback((type) => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = type === "audio" ? "audio/*" : "image/*"
        input.multiple = true
        input.onchange = event => {
            Array.from(event.target.files || []).forEach(file => {
                addBrowserFile(dispatch, file, type)
            })
        }
        input.click()
    }, [dispatch])

    const handleImport = useCallback(async type => {
        if (isImporting) return
        setIsImporting(true)
        try {
            if (!isTauri) {
                importWithBrowserPicker(type)
                return
            }
            const selected = await open({
                multiple: true,
                directory: false,
                filters: [{
                    name: type === "audio" ? "Audio" : "Images",
                    extensions: type === "audio" ? AUDIO_EXTENSIONS : IMAGE_EXTENSIONS,
                }],
            })
            const paths = selected == null ? [] : Array.isArray(selected) ? selected : [selected]
            paths.forEach(path => addPathAsset(dispatch, path, type))
        } catch (error) {
            console.error("[Flowtake] Media import failed", error)
            dispatch(addErrorToast("Couldn't import that file. Check the format and try again."))
        } finally {
            setIsImporting(false)
        }
    }, [dispatch, importWithBrowserPicker, isImporting])

    const handlePointerDrag = useCallback((event, asset) => {
        startDrag(asset.type || asset.category, asset, event)
    }, [])

    const handlePanelDragOver = useCallback(event => {
        event.stopPropagation()
        if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault()
            event.dataTransfer.dropEffect = "copy"
        }
    }, [])

    const handlePanelDragEnter = useCallback(event => {
        event.preventDefault()
        event.stopPropagation()
        dragCounter.current += 1
        if (event.dataTransfer.types.includes("Files")) setIsDraggingOver(true)
    }, [])

    const handlePanelDragLeave = useCallback(event => {
        event.preventDefault()
        event.stopPropagation()
        dragCounter.current -= 1
        if (dragCounter.current <= 0) {
            setIsDraggingOver(false)
            dragCounter.current = 0
        }
    }, [])

    const handlePanelDrop = useCallback(event => {
        event.preventDefault()
        event.stopPropagation()
        setIsDraggingOver(false)
        dragCounter.current = 0
        const files = Array.from(event.dataTransfer.files || [])
        const getDroppedType = file => {
            const extension = file.name.split(".").pop()?.toLowerCase()
            if (file.type.startsWith("audio/") || AUDIO_EXTENSIONS.includes(extension)) return "audio"
            if (file.type.startsWith("image/") || IMAGE_EXTENSIONS.includes(extension)) return "image"
            return null
        }
        files.forEach(file => {
            const type = getDroppedType(file)
            if (type) addBrowserFile(dispatch, file, type)
        })
        if (files.some(file => getDroppedType(file) === "audio")) setActiveTab("audio")
        else if (files.some(file => getDroppedType(file) === "image")) setActiveTab("images")
    }, [dispatch])

    const handleRemove = useCallback(asset => {
        // Timeline entities may still reference this URL after it is removed
        // from the library. Editor owns and revokes it when the project closes.
        dispatch(removeAsset(asset.id))
    }, [dispatch])

    if (!isOpen && mode === "drawer") return null

    if (!isOpen) {
        return (
            <aside className="flowtake-asset-rail w-12 flex flex-col items-center gap-1 py-2 bg-base-100 rounded-xl shrink-0" aria-label="Media tools">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => { onToggle(); setActiveTab(tab.id) }}
                        className="flowtake-sidebar-button btn btn-ghost btn-xs btn-square tooltip tooltip-right"
                        data-tip={tab.label}
                        aria-label={`Open ${tab.label}`}
                    >
                        <tab.icon className="size-4" />
                    </button>
                ))}
            </aside>
        )
    }

    const visibleCount = activeTab === "images" ? imageAssets.length
        : activeTab === "audio" ? audioAssets.length
            : activeTab === "text" ? textAssets.length
                : shapeAssets.length

    return (
        <aside
            className={`flowtake-panel flowtake-media-panel ${mode === "drawer" ? "w-[min(19rem,calc(100vw-1rem))]" : "w-68"} bg-base-100 rounded-xl flex flex-col h-full shrink-0 overflow-hidden relative`}
            onDragEnter={handlePanelDragEnter}
            onDragLeave={handlePanelDragLeave}
            onDragOver={handlePanelDragOver}
            onDrop={handlePanelDrop}
            aria-label="Media and elements"
        >
            {isDraggingOver && (
                <div className="absolute inset-0 z-50 bg-base-100/95 border border-dashed border-primary rounded-xl flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <ArrowDownTrayIcon className="size-7 text-primary" />
                    <span className="text-xs font-medium text-primary">Drop images or audio</span>
                </div>
            )}

            <header className="h-11 px-3 flex items-center gap-2 border-b border-base-content/8 shrink-0">
                <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold leading-none">Media</h2>
                    <p className="text-[10px] text-base-content/40 mt-1">{visibleCount} in this section</p>
                </div>
                <button type="button" onClick={onToggle} className="btn btn-ghost btn-xs btn-square" aria-label="Close media panel">
                    <XMarkIcon className="size-3.5" />
                </button>
            </header>

            <div className="grid grid-cols-4 border-b border-base-content/8 shrink-0" role="tablist" aria-label="Media types">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flowtake-media-tab ${activeTab === tab.id ? "is-active" : ""}`}
                    >
                        <tab.icon className="size-3.5" />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="p-2 border-b border-base-content/8 shrink-0">
                <label className="flowtake-search-field flex items-center gap-2 px-2.5 h-8 rounded-lg bg-base-200/70">
                    <MagnifyingGlassIcon className="size-3.5 text-base-content/35 shrink-0" />
                    <span className="sr-only">Search assets</span>
                    <input
                        type="search"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder={`Search ${TABS.find(tab => tab.id === activeTab)?.label.toLowerCase()}`}
                        className="w-full min-w-0 bg-transparent border-0 outline-none text-xs placeholder:text-base-content/30"
                    />
                </label>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar p-2.5">
                {activeTab === "images" && <ImageTab
                    assets={filteredImages}
                    onImport={() => handleImport("image")}
                    onRemove={handleRemove}
                    onPointerDrag={handlePointerDrag}
                    onInsert={insertAsset}
                    isImporting={isImporting}
                    hasQuery={Boolean(query.trim())}
                />}
                {activeTab === "audio" && <AudioTab
                    assets={filteredAudio}
                    onImport={() => handleImport("audio")}
                    onRemove={handleRemove}
                    onPointerDrag={handlePointerDrag}
                    onInsert={insertAsset}
                    isImporting={isImporting}
                    hasQuery={Boolean(query.trim())}
                />}
                {activeTab === "text" && <TextTab
                    assets={filteredText}
                    onPointerDrag={handlePointerDrag}
                    onInsert={insertAsset}
                    hasQuery={Boolean(query.trim())}
                />}
                {activeTab === "shapes" && <ShapesTab
                    assets={filteredShapes}
                    onPointerDrag={handlePointerDrag}
                    onInsert={insertAsset}
                    hasQuery={Boolean(query.trim())}
                />}
            </div>
        </aside>
    )
}

function ImportButton({ children, onClick, isLoading }) {
    return (
        <button type="button" onClick={onClick} disabled={isLoading} className="btn btn-sm btn-primary w-full gap-2 mb-3">
            <PlusIcon className="size-4" />
            {isLoading ? "Opening..." : children}
        </button>
    )
}

function ImageTab({ assets, onImport, onRemove, onPointerDrag, onInsert, isImporting, hasQuery }) {
    return (
        <>
            <ImportButton onClick={onImport} isLoading={isImporting}>Import images</ImportButton>
            {assets.length === 0 ? (
                <EmptyState icon={PhotoIcon} text={hasQuery ? "No images match your search" : "Import an image, then drag it or add it at the playhead"} />
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    {assets.map(asset => (
                        <MediaCard key={asset.id} asset={asset} onRemove={() => onRemove(asset)}
                            onPointerDrag={event => onPointerDrag(event, asset)} onInsert={() => onInsert(asset)} />
                    ))}
                </div>
            )}
        </>
    )
}

function AudioTab({ assets, onImport, onRemove, onPointerDrag, onInsert, isImporting, hasQuery }) {
    return (
        <>
            <ImportButton onClick={onImport} isLoading={isImporting}>Import audio</ImportButton>
            {assets.length === 0 ? (
                <EmptyState icon={MusicalNoteIcon} text={hasQuery ? "No audio matches your search" : "Import music or narration, then add it at the playhead"} />
            ) : (
                <div className="flex flex-col gap-1.5">
                    {assets.map(asset => (
                        <AudioCard key={asset.id} asset={asset} onRemove={() => onRemove(asset)}
                            onPointerDrag={event => onPointerDrag(event, asset)} onInsert={() => onInsert(asset)} />
                    ))}
                </div>
            )}
        </>
    )
}

function TextTab({ assets, onPointerDrag, onInsert, hasQuery }) {
    if (assets.length === 0) return <EmptyState icon={DocumentTextIcon} text={hasQuery ? "No text styles match your search" : "No text styles available"} />
    return (
        <div className="flex flex-col gap-2">
            <p className="text-[10px] text-base-content/40">Drag a style, or double-click to add it at the playhead.</p>
            {assets.map(asset => (
                <button
                    key={asset.id}
                    type="button"
                    onPointerDown={event => onPointerDrag(event, asset)}
                    onClick={() => { if (!consumeSuppressedAssetClick()) onInsert(asset) }}
                    className="flowtake-element-card group text-left px-3 py-2.5 bg-base-200/70 rounded-lg cursor-grab active:cursor-grabbing select-none"
                >
                    <span className="block truncate" style={{
                        fontSize: Math.min(asset.config?.fontSize || 32, 18),
                        fontWeight: asset.config?.fontWeight || 400,
                    }}>
                        {asset.name}
                    </span>
                    <span className="text-[9px] text-base-content/35">Click to add</span>
                </button>
            ))}
        </div>
    )
}

function ShapesTab({ assets, onPointerDrag, onInsert, hasQuery }) {
    if (assets.length === 0) return <EmptyState icon={Square2StackIcon} text={hasQuery ? "No shapes match your search" : "No shapes available"} />
    return (
        <div className="grid grid-cols-2 gap-2">
            {assets.map(asset => (
                <button
                    key={asset.id}
                    type="button"
                    onPointerDown={event => onPointerDrag(event, asset)}
                    onClick={() => { if (!consumeSuppressedAssetClick()) onInsert(asset) }}
                    className="flowtake-element-card flex flex-col items-center gap-2 p-3 bg-base-200/70 rounded-lg cursor-grab active:cursor-grabbing select-none"
                >
                    <ShapePreview config={asset.config} />
                    <span className="text-[10px] text-base-content/60">{asset.name}</span>
                </button>
            ))}
        </div>
    )
}

function ShapePreview({ config }) {
    if (!config) return null
    if (config.shapeType === "arrow") return <ArrowRightIcon className="w-12 h-7" style={{ color: config.fill }} />
    const style = {
        backgroundColor: config.fill !== "none" ? config.fill : "transparent",
        border: config.stroke !== "none" ? `${config.strokeWidth || 2}px solid ${config.stroke}` : "none",
    }
    if (config.shapeType === "circle") return <span className="block w-9 h-9 rounded-full" style={style} />
    return <span className="block w-12 h-8" style={{ ...style, borderRadius: config.borderRadius || 0 }} />
}

function MediaCard({ asset, onRemove, onPointerDrag, onInsert }) {
    return (
        <div
            className="flowtake-media-card relative group rounded-lg overflow-hidden bg-base-200 aspect-video cursor-grab active:cursor-grabbing focus-within:ring-1 focus-within:ring-primary"
            onPointerDown={onPointerDrag}
            onDoubleClick={() => { if (!consumeSuppressedAssetClick()) onInsert() }}
            onDragStart={event => event.preventDefault()}
            title="Double-click to add at the playhead"
        >
            <img src={asset.src} alt={asset.name} className="w-full h-full object-cover pointer-events-none select-none" draggable={false} />
            <div className="absolute inset-x-0 bottom-0 bg-black/75 p-1.5 pt-4 pointer-events-none">
                <span className="text-[9px] text-white truncate block">{asset.name}</span>
            </div>
            <button type="button" onClick={event => { event.stopPropagation(); onInsert() }} onPointerDown={event => event.stopPropagation()}
                className="absolute top-1 left-1 btn btn-primary btn-xs min-h-0 h-6 px-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                <PlusIcon className="size-3" />
                <span className="sr-only">Add {asset.name}</span>
            </button>
            <button type="button" onClick={event => { event.stopPropagation(); onRemove() }} onPointerDown={event => event.stopPropagation()}
                className="absolute top-1 right-1 btn btn-ghost btn-xs min-h-0 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 bg-black/60 text-white">
                <XMarkIcon className="size-3" />
                <span className="sr-only">Remove {asset.name}</span>
            </button>
        </div>
    )
}

function AudioCard({ asset, onRemove, onPointerDrag, onInsert }) {
    return (
        <div
            className="flowtake-element-card flex items-center gap-2 px-2 py-2 bg-base-200/70 rounded-lg cursor-grab active:cursor-grabbing group select-none"
            onPointerDown={onPointerDrag}
            onDoubleClick={() => { if (!consumeSuppressedAssetClick()) onInsert() }}
            title="Double-click to add at the playhead"
        >
            <div className="w-8 h-8 rounded-md bg-secondary/15 flex items-center justify-center shrink-0 pointer-events-none">
                <MusicalNoteIcon className="size-4 text-secondary" />
            </div>
            <div className="flex flex-col min-w-0 flex-1 pointer-events-none">
                <span className="text-xs truncate">{asset.name}</span>
                <span className="text-[10px] text-base-content/40">
                    {asset.duration ? formatDuration(asset.duration) : "Reading length..."}
                </span>
            </div>
            <button type="button" onClick={event => { event.stopPropagation(); onInsert() }} onPointerDown={event => event.stopPropagation()}
                className="btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Add ${asset.name}`}>
                <PlusIcon className="size-3" />
            </button>
            <button type="button" onClick={event => { event.stopPropagation(); onRemove() }} onPointerDown={event => event.stopPropagation()}
                className="btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Remove ${asset.name}`}>
                <XMarkIcon className="size-3" />
            </button>
        </div>
    )
}

function EmptyState({ icon: Icon, text }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 px-3 gap-2 text-center">
            <Icon className="size-7 text-base-content/20" />
            <span className="text-[11px] leading-relaxed text-base-content/40 max-w-44">{text}</span>
        </div>
    )
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`
}

AssetPanel.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onToggle: PropTypes.func.isRequired,
    mode: PropTypes.oneOf(["docked", "drawer"]),
}

ImportButton.propTypes = {
    children: PropTypes.node.isRequired,
    onClick: PropTypes.func.isRequired,
    isLoading: PropTypes.bool,
}

ImageTab.propTypes = AudioTab.propTypes = {
    assets: PropTypes.array.isRequired,
    onImport: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
    onPointerDrag: PropTypes.func.isRequired,
    onInsert: PropTypes.func.isRequired,
    isImporting: PropTypes.bool,
    hasQuery: PropTypes.bool,
}

TextTab.propTypes = ShapesTab.propTypes = {
    assets: PropTypes.array.isRequired,
    onPointerDrag: PropTypes.func.isRequired,
    onInsert: PropTypes.func.isRequired,
    hasQuery: PropTypes.bool,
}

ShapePreview.propTypes = { config: PropTypes.object }
MediaCard.propTypes = AudioCard.propTypes = {
    asset: PropTypes.object.isRequired,
    onRemove: PropTypes.func.isRequired,
    onPointerDrag: PropTypes.func.isRequired,
    onInsert: PropTypes.func.isRequired,
}
EmptyState.propTypes = { icon: PropTypes.elementType.isRequired, text: PropTypes.string.isRequired }
