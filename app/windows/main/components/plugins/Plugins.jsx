import {
    CommandLineIcon,
    CursorArrowRaysIcon,
    PuzzlePieceIcon,
    RectangleGroupIcon,
} from "@heroicons/react/24/outline"
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import PropTypes from "prop-types"
import { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
    FEATURE_IDS,
    selectAllEnabled,
    setFeatureEnabled,
} from "@shared/redux/pluginSlice"
import AppRecordingFeature from "../settings/plugin/features/AppRecordingFeature"

const CONFIG_COMPONENTS = {
    [FEATURE_IDS.APP_RECORDING]: AppRecordingFeature,
}

const BUILT_IN_PLUGINS = [
    {
        id: FEATURE_IDS.APP_RECORDING,
        icon: RectangleGroupIcon,
        name: "App layers",
        short: "Record up to two extra app regions",
        description: "Creates separate video layers from the selected app regions. Keep those windows open, visible, and in place while recording.",
        overhead: "Higher overhead",
    },
    {
        id: FEATURE_IDS.MOUSE_STYLE,
        icon: CursorArrowRaysIcon,
        name: "Enhanced Cursor",
        short: "Render the configured cursor style",
        description: "Applies Flowtake's cursor styling during preview and final rendering.",
        overhead: "Low overhead",
    },
    {
        id: FEATURE_IDS.KEYBOARD_OVERLAY,
        icon: CommandLineIcon,
        name: "Keyboard Overlay",
        short: "Show captured shortcuts and typing",
        description: "On Windows, captures keyboard events during recording and renders the configured overlay in the finished video.",
        overhead: "Low overhead",
        windowsOnly: true,
    },
]

export default function Plugins({ isOpen }) {
    const dispatch = useDispatch()
    const enabled = useSelector(selectAllEnabled)
    const platform = window.electron?.process?.platform || (navigator.platform?.includes("Win") ? "win32" : "other")
    const availablePlugins = BUILT_IN_PLUGINS.filter(plugin => !plugin.windowsOnly || platform === "win32")

    if (!isOpen) return null

    const setEnabled = (id, value) => dispatch(setFeatureEnabled({ id, enabled: value }))

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                <PuzzlePieceIcon className="size-5 text-primary flex-shrink-0" />
                <h2 className="font-brand font-semibold text-sm">Experimental features</h2>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold uppercase tracking-wider">
                    Built-in
                </span>
            </div>
            <p className="text-xs text-base-content/55 leading-relaxed mb-4 flex-shrink-0 max-w-2xl">
                These local features have real recording or rendering integrations, but may add resource use. Keep only the tools you need enabled.
            </p>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {availablePlugins.map(plugin => (
                        <PluginCard
                            key={plugin.id}
                            plugin={plugin}
                            enabled={!!enabled[plugin.id]}
                            onToggle={value => setEnabled(plugin.id, value)}
                        />
                    ))}
                </div>
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
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

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
                        onChange={event => onToggle(event.target.checked)}
                        aria-label={`Enable ${plugin.name}`}
                    />
                </header>
                <p className="text-[11px] text-base-content/65 leading-relaxed">{plugin.description}</p>
                <div className="mt-2 pt-2 border-t border-base-content/5 flex items-center gap-1.5">
                    <span className={`px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider
                        ${plugin.overhead === "Low overhead"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-amber-500/15 text-amber-400"}`}>
                        {plugin.overhead}
                    </span>
                    <span className="text-[10px] text-base-content/40">{enabled ? "Active" : "Disabled"}</span>
                    {ConfigComponent && (
                        <button
                            type="button"
                            onClick={() => setIsSettingsOpen(open => !open)}
                            className="ml-auto inline-flex items-center gap-1 text-[10px] text-base-content/50 hover:text-base-content/80 px-1.5 py-0.5 rounded hover:bg-base-content/5 transition-colors"
                            aria-label={isSettingsOpen ? `Hide ${plugin.name} settings` : `Show ${plugin.name} settings`}
                            aria-expanded={isSettingsOpen}
                        >
                            {isSettingsOpen ? "Hide settings" : "Settings"}
                            <ChevronDownIcon className={`size-3 transition-transform ${isSettingsOpen ? "rotate-180" : ""}`} />
                        </button>
                    )}
                </div>
            </div>
            {isSettingsOpen && ConfigComponent && (
                <div className={`px-3 pb-3 pt-1 border-t border-base-content/5 ${enabled ? "" : "opacity-40 pointer-events-none"}`}>
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
        overhead: PropTypes.string.isRequired,
        windowsOnly: PropTypes.bool,
    }).isRequired,
    enabled: PropTypes.bool.isRequired,
    onToggle: PropTypes.func.isRequired,
}
