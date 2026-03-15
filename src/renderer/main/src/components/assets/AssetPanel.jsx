import {
    ArrowDownTrayIcon,
    DocumentTextIcon,
    FilmIcon,
    MusicalNoteIcon,
    PlusIcon,
    Square2StackIcon,
    XMarkIcon
} from "@heroicons/react/16/solid"
import { useCallback, useRef, useState } from "react"
import {
    useDispatch,
    useSelector
} from "react-redux"
import {
    addAsset,
    removeAsset,
    selectAllAssets,
    selectBuiltInAssetsByCategory
} from "../../../../src/redux/assetSlice"

const TABS = [
    { id: "import", label: "Import", icon: ArrowDownTrayIcon },
    { id: "audio", label: "Audio", icon: MusicalNoteIcon },
    { id: "text", label: "Text", icon: DocumentTextIcon },
    { id: "shapes", label: "Shapes", icon: Square2StackIcon },
]

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
            }))
        }
    }
    reader.readAsDataURL(file)
}

export default function AssetPanel({ isOpen, onToggle }) {

    const dispatch = useDispatch()
    const importedAssets = useSelector(selectAllAssets)
    const textAssets = useSelector(state => selectBuiltInAssetsByCategory(state, "text"))
    const shapeAssets = useSelector(state => selectBuiltInAssetsByCategory(state, "shapes"))

    const [activeTab, setActiveTab] = useState("import")
    const [isDraggingOver, setIsDraggingOver] = useState(false)
    const dragCounter = useRef(0)

    const mediaAssets = importedAssets.filter(a => a.category === "media")
    const audioAssets = importedAssets.filter(a => a.category === "audio")

    const handleImportMedia = useCallback(() => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = "video/*,image/*"
        input.multiple = true
        input.onchange = e => {
            Array.from(e.target.files).forEach(file => importFileAsAsset(dispatch, file))
        }
        input.click()
    }, [dispatch])

    const handleImportAudio = useCallback(() => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = "audio/*"
        input.multiple = true
        input.onchange = e => {
            Array.from(e.target.files).forEach(file => importFileAsAsset(dispatch, file))
        }
        input.click()
    }, [dispatch])

    const handleDragStart = useCallback((e, asset) => {
        e.dataTransfer.setData("application/json", JSON.stringify(asset))
        e.dataTransfer.effectAllowed = "copy"
    }, [])

    // OS file drop into panel
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

    const handlePanelDragOver = useCallback(e => {
        e.preventDefault()
        if (e.dataTransfer.types.includes("Files")) e.dataTransfer.dropEffect = "copy"
    }, [])

    const handlePanelDrop = useCallback(e => {
        e.preventDefault()
        setIsDraggingOver(false)
        dragCounter.current = 0
        const files = Array.from(e.dataTransfer.files)
        if (files.length === 0) return
        files.forEach(file => importFileAsAsset(dispatch, file))
        // Auto-switch tab based on what was dropped
        const hasAudio = files.some(f => f.type.startsWith("audio/"))
        const hasMedia = files.some(f => f.type.startsWith("video/") || f.type.startsWith("image/"))
        if (hasAudio && !hasMedia) setActiveTab("audio")
        else if (hasMedia) setActiveTab("import")
    }, [dispatch])

    if (!isOpen) {
        return (
            <div className="flex flex-col items-center gap-1 py-2 bg-base-100 rounded-lg shrink-0">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { onToggle(); setActiveTab(tab.id) }}
                        className="btn btn-ghost btn-xs btn-square tooltip tooltip-right"
                        data-tip={tab.label}
                    >
                        <tab.icon className="size-4" />
                    </button>
                ))}
            </div>
        )
    }

    return (
        <div className="w-56 bg-base-100 rounded-lg flex flex-col h-full shrink-0 overflow-hidden relative"
            onDragEnter={handlePanelDragEnter}
            onDragLeave={handlePanelDragLeave}
            onDragOver={handlePanelDragOver}
            onDrop={handlePanelDrop}
        >
            {/* File drop overlay */}
            {isDraggingOver && (
                <div className="absolute inset-0 z-50 bg-info/10 border-2 border-dashed border-info rounded-lg flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <ArrowDownTrayIcon className="size-8 text-info animate-bounce" />
                    <span className="text-xs font-medium text-info">Drop files here</span>
                </div>
            )}

            {/* Tab bar */}
            <div className="flex items-center border-b border-base-content/10 shrink-0">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 px-1 text-[10px] font-medium transition-colors
                            ${activeTab === tab.id
                                ? "text-info border-b-2 border-info"
                                : "opacity-50 hover:opacity-80"}`}
                    >
                        <tab.icon className="size-3.5" />
                        {tab.label}
                    </button>
                ))}
                <button onClick={onToggle} className="btn btn-ghost btn-xs px-1 opacity-40 hover:opacity-100">
                    <XMarkIcon className="size-3" />
                </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar p-2">
                {activeTab === "import" && <ImportTab
                    mediaAssets={mediaAssets}
                    onImport={handleImportMedia}
                    onRemove={id => dispatch(removeAsset(id))}
                    onDragStart={handleDragStart}
                />}
                {activeTab === "audio" && <AudioTab
                    audioAssets={audioAssets}
                    onImport={handleImportAudio}
                    onRemove={id => dispatch(removeAsset(id))}
                    onDragStart={handleDragStart}
                />}
                {activeTab === "text" && <TextTab
                    assets={textAssets}
                    onDragStart={handleDragStart}
                />}
                {activeTab === "shapes" && <ShapesTab
                    assets={shapeAssets}
                    onDragStart={handleDragStart}
                />}
            </div>
        </div>
    )
}

function ImportTab({ mediaAssets, onImport, onRemove, onDragStart }) {
    return (<>
        <button onClick={onImport}
            className="btn btn-sm btn-outline btn-info w-full gap-2 mb-2">
            <PlusIcon className="size-4" />
            Import Media
        </button>
        {mediaAssets.length === 0 ? (
            <EmptyState icon={<FilmIcon className="size-8 opacity-20" />}
                text="Drop video/image files here or click Import" />
        ) : (
            <div className="grid grid-cols-2 gap-1.5">
                {mediaAssets.map(asset => (
                    <MediaCard key={asset.id} asset={asset}
                        onRemove={() => onRemove(asset.id)}
                        onDragStart={e => onDragStart(e, asset)} />
                ))}
            </div>
        )}
    </>)
}

function AudioTab({ audioAssets, onImport, onRemove, onDragStart }) {
    return (<>
        <button onClick={onImport}
            className="btn btn-sm btn-outline btn-secondary w-full gap-2 mb-2">
            <PlusIcon className="size-4" />
            Import Audio
        </button>
        {audioAssets.length === 0 ? (
            <EmptyState icon={<MusicalNoteIcon className="size-8 opacity-20" />}
                text="Drop audio files here or click Import" />
        ) : (
            <div className="flex flex-col gap-1">
                {audioAssets.map(asset => (
                    <AudioCard key={asset.id} asset={asset}
                        onRemove={() => onRemove(asset.id)}
                        onDragStart={e => onDragStart(e, asset)} />
                ))}
            </div>
        )}
    </>)
}

function TextTab({ assets, onDragStart }) {
    return (
        <div className="flex flex-col gap-1.5">
            <p className="text-[10px] opacity-40 mb-1">Drag onto an overlay track</p>
            {assets.map(asset => (
                <div key={asset.id}
                    draggable
                    onDragStart={e => onDragStart(e, asset)}
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

function ShapesTab({ assets, onDragStart }) {
    return (
        <div className="grid grid-cols-2 gap-1.5">
            <p className="text-[10px] opacity-40 col-span-2 mb-1">Drag onto an overlay track</p>
            {assets.map(asset => (
                <div key={asset.id}
                    draggable
                    onDragStart={e => onDragStart(e, asset)}
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
    if (shapeType === "circle") {
        return <div className="w-10 h-10 rounded-full" style={style} />
    }
    if (shapeType === "arrow") {
        return <div className="w-12 h-4 rounded" style={{ ...style, clipPath: "polygon(0 30%, 70% 30%, 70% 0, 100% 50%, 70% 100%, 70% 70%, 0 70%)" }} />
    }
    return <div className="w-12 h-8" style={{ ...style, borderRadius: config.borderRadius || 0 }} />
}

function MediaCard({ asset, onRemove, onDragStart }) {
    const isImage = asset.type === "image"
    return (
        <div className="relative group/card rounded-lg overflow-hidden bg-base-200 aspect-video cursor-grab active:cursor-grabbing"
            draggable onDragStart={onDragStart}>
            {isImage && asset.src ? (
                <img src={asset.src} alt={asset.name} className="w-full h-full object-cover" draggable={false} />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <FilmIcon className="size-6 opacity-20" />
                </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-4">
                <span className="text-[9px] text-white truncate block">{asset.name}</span>
            </div>
            <button onClick={e => { e.stopPropagation(); onRemove() }}
                className="absolute top-1 right-1 btn btn-ghost btn-xs p-0 min-h-0 h-5 w-5
                    opacity-0 group-hover/card:opacity-80 hover:!opacity-100 bg-black/50 rounded">
                <XMarkIcon className="size-3 text-white" />
            </button>
        </div>
    )
}

function AudioCard({ asset, onRemove, onDragStart }) {
    return (
        <div className="flex items-center gap-2 px-2 py-2 bg-base-200 rounded-lg cursor-grab active:cursor-grabbing
            hover:bg-base-content/10 transition-colors group/audio select-none"
            draggable onDragStart={onDragStart}>
            <div className="w-8 h-8 rounded bg-secondary/20 flex items-center justify-center shrink-0">
                <MusicalNoteIcon className="size-4 text-secondary" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs truncate">{asset.name}</span>
                {asset.duration && (
                    <span className="text-[10px] opacity-40">{formatDuration(asset.duration)}</span>
                )}
            </div>
            <button onClick={e => { e.stopPropagation(); onRemove() }}
                className="btn btn-ghost btn-xs p-0 min-h-0 h-5 w-5 opacity-0 group-hover/audio:opacity-50 hover:!opacity-100">
                <XMarkIcon className="size-3" />
            </button>
        </div>
    )
}

function EmptyState({ icon, text }) {
    return (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
            {icon}
            <span className="text-[11px] opacity-30 text-center max-w-32">{text}</span>
        </div>
    )
}

function formatDuration(ms) {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
}
