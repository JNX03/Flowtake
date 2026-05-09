import {
    CommandLineIcon,
    CursorArrowRaysIcon,
    PuzzlePieceIcon,
    RectangleGroupIcon,
} from "@heroicons/react/24/outline"
import { FolderOpenIcon } from "@heroicons/react/20/solid"
import PropTypes from "prop-types"
import { useEffect } from "react"
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
import Toggle from "../properties/Toggle"

const BUILT_IN_PLUGINS = [
    {
        id: FEATURE_IDS.APP_RECORDING,
        icon: RectangleGroupIcon,
        name: "Individual App Recording",
        short: "Record multiple apps at once",
        description:
            "Capture each selected app to its own video layer in parallel. After recording, choose which layers to show in the editor before exporting. Useful for picture-in-picture demos and side-by-side comparisons.",
    },
    {
        id: FEATURE_IDS.MOUSE_STYLE,
        icon: CursorArrowRaysIcon,
        name: "Mouse Coloring & Name Tag",
        short: "Recolor cursor and pin a label",
        description:
            "Tints the rendered cursor in any color and pins a floating label next to it during recording and playback. Great for AI-agent-style demos where the cursor represents an automated user.",
    },
    {
        id: FEATURE_IDS.KEYBOARD_OVERLAY,
        icon: CommandLineIcon,
        name: "Keyboard Typing Layout",
        short: "Show keys being pressed",
        description:
            "Captures every keystroke during recording and overlays it in your video. Two modes: full typing shows every key, or keybinds-only shows just modifier combos and special keys (F-keys, Backspace, Delete, arrows…).",
    },
]

export default function Plugins({ isOpen }) {
    const dispatch = useDispatch()
    const enabled = useSelector(selectAllEnabled)
    const detected = useSelector(selectDetectedPlugins)
    const pluginsDir = useSelector(selectPluginsDir)

    // Refresh the detected plugin list once when the panel becomes visible.
    useEffect(() => {
        if (!isOpen) return
        let cancelled = false
        ;(async () => {
            try {
                const path = await window.electron.ipcRenderer.invoke("ensure-plugins-dir")
                if (!cancelled) dispatch(setPluginsDir(path))
                const list = await window.electron.ipcRenderer.invoke("list-plugins")
                if (!cancelled) dispatch(setDetectedPlugins(list || []))
            } catch {
                // ignore
            }
        })()
        return () => { cancelled = true }
    }, [isOpen, dispatch])

    if (!isOpen) return null

    const setEnabled = (id, val) => dispatch(setFeatureEnabled({ id, enabled: val }))

    return (
        <div className="h-full flex flex-col gap-4 overflow-y-auto">
            <header className="flex items-center gap-2">
                <PuzzlePieceIcon className="size-5 text-primary" />
                <h2 className="font-brand font-semibold text-base">Plugins & Extensions</h2>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider">
                    Research Preview
                </span>
            </header>

            <p className="text-xs text-base-content/55 leading-relaxed -mt-2">
                Plugins extend Flowtake with new capabilities. The features below are built-in and can be toggled
                on or off. Third-party plugin files dropped into the folder below are detected but not executed in
                this preview build.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            />
        </div>
    )
}

Plugins.propTypes = {
    isOpen: PropTypes.bool.isRequired,
}

function PluginCard({ plugin, enabled, onToggle }) {
    const Icon = plugin.icon
    return (
        <article className={`rounded-xl border bg-base-100/60 p-3.5 transition-colors
            ${enabled ? "border-primary/40 bg-primary/[0.03]" : "border-base-content/10"}`}>
            <header className="flex items-start gap-3 mb-2">
                <div className={`size-9 flex items-center justify-center rounded-lg flex-shrink-0
                    ${enabled ? "bg-primary/15 text-primary" : "bg-base-content/5 text-base-content/40"}`}>
                    <Icon className="size-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-semibold truncate">{plugin.name}</h3>
                        <span className="px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[8px] font-bold uppercase tracking-wider flex-shrink-0">
                            Built-in
                        </span>
                    </div>
                    <p className="text-[11px] text-base-content/50">{plugin.short}</p>
                </div>
                <Toggle value={enabled} onChange={(e) => onToggle(e.target.checked)} />
            </header>
            <p className="text-xs text-base-content/65 leading-relaxed">
                {plugin.description}
            </p>
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

function DetectedPluginsCard({ pluginsDir, detected }) {
    return (
        <article className="rounded-xl border border-base-content/10 bg-base-100/60 p-3.5">
            <header className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold">Drop-in plugins</h3>
                    <p className="text-[11px] text-base-content/50 font-mono truncate">
                        {pluginsDir || "Loading folder…"}
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn-xs btn-outline gap-1"
                    onClick={() => window.electron.ipcRenderer.invoke("open-plugins-folder")}>
                    <FolderOpenIcon className="size-3.5" />
                    Open folder
                </button>
            </header>

            {detected.length === 0 ? (
                <p className="text-xs text-base-content/40 px-1 py-2">
                    No plugins detected. Drop files into the folder above and reopen this view.
                </p>
            ) : (
                <ul className="divide-y divide-base-content/5 rounded-md border border-base-content/10 overflow-hidden">
                    {detected.map((p) => (
                        <li key={p.name} className="flex items-center gap-3 px-3 py-1.5">
                            <span className="size-6 flex items-center justify-center rounded bg-base-content/5 text-[9px] font-mono text-base-content/50">
                                {p.is_dir ? "DIR" : (p.kind || "?").toUpperCase().slice(0, 4)}
                            </span>
                            <span className="text-xs flex-1 truncate">{p.name}</span>
                            <span className="px-1.5 py-0.5 rounded bg-base-content/5 text-[9px] font-bold uppercase tracking-wider text-base-content/45">
                                Detected
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <p className="text-[10px] text-base-content/35 mt-2 leading-snug">
                Detection only — third-party plugin code is not executed in this preview. A sandbox + manifest
                schema is part of the next milestone.
            </p>
        </article>
    )
}

DetectedPluginsCard.propTypes = {
    pluginsDir: PropTypes.string,
    detected: PropTypes.array.isRequired,
}
