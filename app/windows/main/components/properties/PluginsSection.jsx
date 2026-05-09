import {
    CommandLineIcon,
    CursorArrowRaysIcon,
    PlusIcon,
    PuzzlePieceIcon,
    RectangleGroupIcon,
} from "@heroicons/react/20/solid"
import { useDispatch, useSelector } from "react-redux"
import {
    KEYBOARD_LAYOUTS,
    MOUSE_STYLES,
    APP_SCENES,
} from "@shared/helpers"
import {
    FEATURE_IDS,
    selectAllEnabled,
    setFeatureEnabled,
} from "@shared/redux/pluginSlice"
import { addKeyboardLayout, selectKeyboardLayoutIds } from "@shared/redux/keyboardLayoutSlice"
import { addMouseStyle, selectMouseStyleIds } from "@shared/redux/mouseStyleAnimSlice"
import { addAppScene, selectAppSceneIds } from "@shared/redux/appSceneAnimSlice"
import { selectExtraTracks } from "@shared/redux/projectSlice"
import {
    selectDuration,
    selectIsPlaying,
} from "@shared/redux/editorSlice"
import { selectTime, setOpenSection, setSelectedRow } from "@shared/redux/timelineSlice"
import MouseStyleFeature from "../settings/plugin/features/MouseStyleFeature"
import KeyboardOverlayFeature from "../settings/plugin/features/KeyboardOverlayFeature"
import Fieldset from "./Fieldset"

const NEW_BLOCK_DURATION_MS = 4000

export default function PluginsSection() {
    const dispatch = useDispatch()
    const enabled = useSelector(selectAllEnabled)
    const time = useSelector(selectTime)
    const duration = useSelector(selectDuration)
    const isPlaying = useSelector(selectIsPlaying)
    const extraTracks = useSelector(selectExtraTracks)
    const mouseIds = useSelector(selectMouseStyleIds)
    const keyboardIds = useSelector(selectKeyboardLayoutIds)
    const sceneIds = useSelector(selectAppSceneIds)

    const setEnabled = (id, val) => dispatch(setFeatureEnabled({ id, enabled: val }))

    const addBlock = (kind) => {
        if (!duration || isPlaying) return
        const start = Math.max(0, Math.min(time, duration - 100))
        const end = Math.min(duration, start + NEW_BLOCK_DURATION_MS)
        if (kind === "mouse") {
            dispatch(addMouseStyle({ id: `ms-${crypto.randomUUID()}`, start, end }))
            dispatch(setSelectedRow(MOUSE_STYLES))
            dispatch(setOpenSection(MOUSE_STYLES))
        } else if (kind === "keyboard") {
            dispatch(addKeyboardLayout({ id: `kb-${crypto.randomUUID()}`, start, end }))
            dispatch(setSelectedRow(KEYBOARD_LAYOUTS))
            dispatch(setOpenSection(KEYBOARD_LAYOUTS))
        } else if (kind === "scene") {
            const main = extraTracks?.[0]?.id || null
            const slots = {}
            for (let i = 1; i < (extraTracks?.length || 0); i++) {
                slots[extraTracks[i].id] = "tr"
            }
            dispatch(addAppScene({
                id: `scn-${crypto.randomUUID()}`, start, end,
                mainTrackId: main, slots,
            }))
            dispatch(setSelectedRow(APP_SCENES))
            dispatch(setOpenSection(APP_SCENES))
        }
    }

    return (
        <div className="h-full overflow-y-auto px-4 py-4 flex flex-col gap-4">
            <header className="flex items-center gap-2">
                <PuzzlePieceIcon className="size-5 text-primary" />
                <h2 className="font-brand font-semibold text-sm">Plugins</h2>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider">
                    Research Preview
                </span>
            </header>
            <p className="text-xs text-base-content/55 leading-relaxed -mt-2">
                Toggle plugins for this project, set their default style, and add timeline blocks
                to override the default for specific time spans.
            </p>

            <PluginPanel
                icon={CursorArrowRaysIcon}
                title="Mouse Coloring & Tag"
                enabled={!!enabled[FEATURE_IDS.MOUSE_STYLE]}
                onToggle={(v) => setEnabled(FEATURE_IDS.MOUSE_STYLE, v)}
                blockCount={mouseIds.length}
                onAddBlock={() => addBlock("mouse")}>
                <MouseStyleFeature />
            </PluginPanel>

            <PluginPanel
                icon={CommandLineIcon}
                title="Keyboard Typing Overlay"
                enabled={!!enabled[FEATURE_IDS.KEYBOARD_OVERLAY]}
                onToggle={(v) => setEnabled(FEATURE_IDS.KEYBOARD_OVERLAY, v)}
                blockCount={keyboardIds.length}
                onAddBlock={() => addBlock("keyboard")}>
                <KeyboardOverlayFeature />
            </PluginPanel>

            <PluginPanel
                icon={RectangleGroupIcon}
                title="Individual App Recording"
                enabled={!!enabled[FEATURE_IDS.APP_RECORDING]}
                onToggle={(v) => setEnabled(FEATURE_IDS.APP_RECORDING, v)}
                blockCount={sceneIds.length}
                onAddBlock={Array.isArray(extraTracks) && extraTracks.length > 0
                    ? () => addBlock("scene")
                    : null}>
                {Array.isArray(extraTracks) && extraTracks.length > 0 ? (
                    <div className="flex flex-col gap-1">
                        <p className="text-[11px] text-base-content/55">
                            {extraTracks.length} captured app{extraTracks.length === 1 ? "" : "s"}. Add a Scene
                            block to set which is the main view + where the others appear (corner PiPs or hidden).
                        </p>
                        <ul className="rounded-md border border-base-content/10 divide-y divide-base-content/5">
                            {extraTracks.map((t) => (
                                <li key={t.id} className="flex items-center gap-2 px-2 py-1">
                                    <span className="size-5 rounded bg-base-content/10 text-[8px] font-mono flex items-center justify-center text-base-content/60">
                                        {t.width}×{t.height}
                                    </span>
                                    <span className="text-xs flex-1 truncate">{t.name}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p className="text-[11px] text-base-content/40">
                        No extra apps captured for this project. Enable in launcher Plugins → pick apps before recording.
                    </p>
                )}
            </PluginPanel>
        </div>
    )
}

function PluginPanel({ icon: Icon, title, enabled, onToggle, blockCount, onAddBlock, children }) {
    return (
        <Fieldset>
            <div className={`rounded-lg border bg-base-100/40 p-3 transition-colors
                ${enabled ? "border-primary/30 bg-primary/[0.02]" : "border-base-content/10"}`}>
                <header className="flex items-center gap-2 mb-2">
                    <div className={`size-7 flex items-center justify-center rounded-md flex-shrink-0
                        ${enabled ? "bg-primary/15 text-primary" : "bg-base-content/5 text-base-content/40"}`}>
                        <Icon className="size-4" />
                    </div>
                    <h3 className="text-[13px] font-semibold flex-1 truncate">{title}</h3>
                    {typeof blockCount === "number" && blockCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-base-content/5 text-base-content/60 font-medium">
                            {blockCount} block{blockCount === 1 ? "" : "s"}
                        </span>
                    )}
                    <input
                        type="checkbox"
                        className="toggle toggle-sm toggle-primary flex-shrink-0"
                        checked={enabled}
                        onChange={(e) => onToggle(e.target.checked)}
                        aria-label={`Enable ${title}`}
                    />
                </header>
                <div className={enabled ? "" : "opacity-40 pointer-events-none"}>
                    {children}
                    {onAddBlock && (
                        <button
                            type="button"
                            onClick={onAddBlock}
                            className="mt-3 btn btn-xs btn-outline gap-1"
                            disabled={!enabled}>
                            <PlusIcon className="size-3.5" />
                            Add block at playhead
                        </button>
                    )}
                </div>
            </div>
        </Fieldset>
    )
}
