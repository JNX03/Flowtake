import {
    CommandLineIcon,
    CursorArrowRaysIcon,
    PuzzlePieceIcon,
    RectangleGroupIcon,
} from "@heroicons/react/24/outline"
import { ArrowPathIcon, ChevronDownIcon, FolderOpenIcon } from "@heroicons/react/20/solid"
import PropTypes from "prop-types"
import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
    FEATURE_IDS,
    selectAllEnabled,
    selectDetectedPlugins,
    selectPluginsDir,
    setDetectedPlugins,
    setFeatureEnabled,
    setPluginsDir,
} from "@shared/redux/pluginSlice"
import AppRecordingFeature from "../settings/plugin/features/AppRecordingFeature"
import KeyboardOverlayFeature from "../settings/plugin/features/KeyboardOverlayFeature"
import MouseStyleFeature from "../settings/plugin/features/MouseStyleFeature"

const CONFIG_COMPONENTS = {
    [FEATURE_IDS.APP_RECORDING]: AppRecordingFeature,
    [FEATURE_IDS.MOUSE_STYLE]: MouseStyleFeature,
    [FEATURE_IDS.KEYBOARD_OVERLAY]: KeyboardOverlayFeature,
}

const BUILT_IN_PLUGINS = [
    {
        id: FEATURE_IDS.APP_RECORDING,
        icon: RectangleGroupIcon,
        name: "Individual App Recording",
        short: "Record multiple apps at once",
        description:
            "Capture each selected app to its own video layer in parallel. Choose which layers to show in the editor before export.",
    },
    {
        id: FEATURE_IDS.MOUSE_STYLE,
        icon: CursorArrowRaysIcon,
        name: "Mouse Coloring & Name Tag",
        short: "Recolor cursor and pin a label",
        description:
            "Tints the rendered cursor and pins a floating label next to it during recording and playback. Great for AI-agent demos.",
    },
    {
        id: FEATURE_IDS.KEYBOARD_OVERLAY,
        icon: CommandLineIcon,
        name: "Keyboard Typing Layout",
        short: "Show keys being pressed",
        description:
            "Captures keystrokes during recording and overlays them. Two modes: full typing or keybinds-only (Ctrl/Alt/Fn/F1–F12, Backspace, Delete, arrows…).",
    },
]

export default function Plugins({ isOpen }) {
    const dispatch = useDispatch()
    const enabled = useSelector(selectAllEnabled)
    const detected = useSelector(selectDetectedPlugins)
    const pluginsDir = useSelector(selectPluginsDir)
    const [refreshing, setRefreshing] = useState(false)

    const refresh = async () => {
        setRefreshing(true)
        try {
            const path = await window.electron.ipcRenderer.invoke("ensure-plugins-dir")
            dispatch(setPluginsDir(path))
            const list = await window.electron.ipcRenderer.invoke("list-plugins")
            dispatch(setDetectedPlugins(list || []))
        } catch {
            /* swallow */
        } finally {
            setRefreshing(false)
        }
    }

    useEffect(() => {
        if (!isOpen) return
        refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    if (!isOpen) return null

    const setEnabled = (id, val) => dispatch(setFeatureEnabled({ id, enabled: val }))

    return (
        <div className="h-full flex flex-col min-h-0">
            {/* Header — fixed */}
            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                <PuzzlePieceIcon className="size-5 text-primary flex-shrink-0" />
                <h2 className="font-brand font-semibold text-sm">Plugins & Extensions</h2>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider">
                    Research Preview
                </span>
            </div>
            <p className="text-xs text-base-content/55 leading-relaxed mb-4 flex-shrink-0">
                Built-in extensions can be toggled on or off. Third-party plugin files dropped into the folder
                below are detected but not executed in this preview build.
            </p>

            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
                    {BUILT_IN_PLUGINS.map((p) => (
                        <PluginCard
                            key={p.id}
                            plugin={p}
                            enabled={!!enabled[p.id]}
                            onToggle={(v) => setEnabled(p.id, v)}
                        />
                    ))}
                </div>

                <DetectedPluginsCard
                    pluginsDir={pluginsDir}
                    detected={detected}
                    refreshing={refreshing}
                    onRefresh={refresh}
                />
            </div>
        </div>
    )
}

Plugins.propTypes = {
    isOpen: PropTypes.bool.isRequired,
}

function PluginCard({ plugin, enabled, onToggle }) {
    const Icon = plugin.icon
    const ConfigComponent = CONFIG_COMPONENTS[plugin.id]
    const [isOpen, setIsOpen] = useState(false)

    return (
        <article className={`rounded-xl border bg-base-100/60 transition-colors flex flex-col min-w-0
            ${enabled ? "border-primary/40 bg-primary/[0.03]" : "border-base-content/10"}`}>
            <div className="p-3">
                <header className="flex items-start gap-2.5 mb-2 min-w-0">
                    <div className={`size-8 flex items-center justify-center rounded-lg flex-shrink-0
                        ${enabled ? "bg-primary/15 text-primary" : "bg-base-content/5 text-base-content/40"}`}>
                        <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-[13px] font-semibold leading-tight truncate">{plugin.name}</h3>
                        <p className="text-[11px] text-base-content/50 truncate">{plugin.short}</p>
                    </div>
                    <input
                        type="checkbox"
                        className="toggle toggle-sm toggle-primary flex-shrink-0 mt-0.5"
                        checked={enabled}
                        onChange={(e) => onToggle(e.target.checked)}
                        aria-label={`Enable ${plugin.name}`}
                    />
                </header>
                <p className="text-[11px] text-base-content/65 leading-relaxed">
                    {plugin.description}
                </p>
                <div className="mt-2 pt-2 border-t border-base-content/5 flex items-center gap-1.5">
                    <span className="px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[8px] font-bold uppercase tracking-wider">
                        Built-in
                    </span>
                    <span className="text-[10px] text-base-content/40">
                        {enabled ? "Active" : "Disabled"}
                    </span>
                    {ConfigComponent && (
                        <button
                            type="button"
                            onClick={() => setIsOpen(o => !o)}
                            className="ml-auto inline-flex items-center gap-1 text-[10px] text-base-content/50 hover:text-base-content/80 px-1.5 py-0.5 rounded hover:bg-base-content/5 transition-colors"
                            aria-label={isOpen ? "Hide settings" : "Show settings"}>
                            {isOpen ? "Hide settings" : "Settings"}
                            <ChevronDownIcon className={`size-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                    )}
                </div>
            </div>
            {isOpen && ConfigComponent && (
                <div className={`px-3 pb-3 pt-1 border-t border-base-content/5
                    ${enabled ? "" : "opacity-40 pointer-events-none"}`}>
                    <ConfigComponent />
                </div>
            )}
        </article>
    )
}

PluginCard.propTypes = {
    plugin: PropTypes.shape({
        id: PropTypes.string.isRequired,
        icon: PropTypes.elementType.isRequired,
        name: PropTypes.string.isRequired,
        short: PropTypes.string.isRequired,
        description: PropTypes.string.isRequired,
    }).isRequired,
    enabled: PropTypes.bool.isRequired,
    onToggle: PropTypes.func.isRequired,
}

function DetectedPluginsCard({ pluginsDir, detected, refreshing, onRefresh }) {
    return (
        <article className="rounded-xl border border-base-content/10 bg-base-100/60 p-3">
            <header className="flex items-center gap-2 mb-2">
                <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-semibold">Drop-in plugins folder</h3>
                    <p className="text-[10px] text-base-content/45 font-mono truncate" title={pluginsDir || ""}>
                        {pluginsDir || "Loading folder…"}
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn-xs btn-ghost btn-square"
                    onClick={onRefresh}
                    disabled={refreshing}
                    title="Refresh">
                    <ArrowPathIcon className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
                </button>
                <button
                    type="button"
                    className="btn btn-xs btn-outline gap-1"
                    onClick={() => window.electron.ipcRenderer.invoke("open-plugins-folder")}>
                    <FolderOpenIcon className="size-3.5" />
                    Open
                </button>
            </header>

            {detected.length === 0 ? (
                <div className="rounded-lg border border-dashed border-base-content/10 px-3 py-4 text-center">
                    <p className="text-xs text-base-content/40">
                        No plugins detected. Drop files into the folder and refresh.
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-base-content/5 rounded-lg border border-base-content/10 overflow-hidden">
                    {detected.map((p) => (
                        <li key={p.name} className="flex items-center gap-3 px-3 py-1.5 min-w-0">
                            <span className="size-6 flex items-center justify-center rounded bg-base-content/5 text-[9px] font-mono text-base-content/50 flex-shrink-0">
                                {p.is_dir ? "DIR" : (p.kind || "?").toUpperCase().slice(0, 4)}
                            </span>
                            <span className="text-xs flex-1 min-w-0 truncate">{p.name}</span>
                            <span className="px-1.5 py-0.5 rounded bg-base-content/5 text-[9px] font-bold uppercase tracking-wider text-base-content/45 flex-shrink-0">
                                Detected
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <p className="text-[10px] text-base-content/35 mt-2 leading-snug">
                Detection only — third-party plugin code is not executed in this preview build.
            </p>
        </article>
    )
}

DetectedPluginsCard.propTypes = {
    pluginsDir: PropTypes.string,
    detected: PropTypes.array.isRequired,
    refreshing: PropTypes.bool,
    onRefresh: PropTypes.func.isRequired,
}
