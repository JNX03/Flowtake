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
import {
    addKeyboardLayout,
    selectKeyboardLayoutDefaults,
    selectKeyboardLayoutIds,
    setMode as setKbMode,
    setPosition as setKbPosition,
    setSize as setKbSize,
} from "@shared/redux/keyboardLayoutSlice"
import {
    addMouseStyle,
    removeMouseStyle,
    selectAllMouseStyles,
    selectMouseStyleById,
    selectMouseStyleDefaults,
    selectMouseStyleIds,
    setColor as setMsColor,
    setLabel as setMsLabel,
    setPreset as setMsPreset,
    setShowLabel as setMsShowLabel,
    updateMouseStyle,
} from "@shared/redux/mouseStyleAnimSlice"
import {
    addAppScene,
    selectAllAppScenes,
    selectAppSceneById,
    selectAppSceneIds,
    updateAppScene,
} from "@shared/redux/appSceneAnimSlice"
import { selectExtraTracks } from "@shared/redux/projectSlice"
import {
    selectDuration,
    selectIsPlaying,
} from "@shared/redux/editorSlice"
import {
    selectSelectedIds,
    selectSelectedRow,
    selectTime,
    setOpenSection,
    setSelectedIds,
    setSelectedRow,
} from "@shared/redux/timelineSlice"
import Fieldset from "./Fieldset"

const NEW_BLOCK_DURATION_MS = 4000

const CURSOR_PRESETS = [
    { value: "default", label: "Default (system)" },
    { value: "arrow", label: "Arrow" },
    { value: "pointer", label: "Pointer" },
    { value: "dot", label: "Dot" },
    { value: "ring", label: "Ring" },
    { value: "target", label: "Target" },
    { value: "agent", label: "AI Agent" },
]

const KEYBOARD_MODES = [
    { value: "full", label: "Everything typed" },
    { value: "keybinds", label: "Keybinds only" },
]
const KEYBOARD_POSITIONS = [
    { value: "top-left", label: "Top left" },
    { value: "top-center", label: "Top center" },
    { value: "top-right", label: "Top right" },
    { value: "bottom-left", label: "Bottom left" },
    { value: "bottom-center", label: "Bottom center" },
    { value: "bottom-right", label: "Bottom right" },
]
const KEYBOARD_SIZES = [
    { value: "sm", label: "Small" },
    { value: "md", label: "Medium" },
    { value: "lg", label: "Large" },
]

const SCENE_SLOTS = [
    { value: "tl", label: "Top-left" },
    { value: "tr", label: "Top-right" },
    { value: "bl", label: "Bottom-left" },
    { value: "br", label: "Bottom-right" },
    { value: "hidden", label: "Hidden" },
]

const SCENE_LAYOUTS = [
    { value: "pip", label: "Picture-in-picture", help: "Main fills the canvas; secondaries float in corners." },
    { value: "sidebyside", label: "Side-by-side", help: "Main on the left, first visible secondary on the right." },
    { value: "grid", label: "Grid", help: "Auto-tile every visible source into an N×M grid." },
]

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

    const selectedRow = useSelector(selectSelectedRow)
    const selectedIds = useSelector(selectSelectedIds)
    const selectedId = selectedIds?.[0] || null

    const setEnabled = (id, val) => dispatch(setFeatureEnabled({ id, enabled: val }))

    const addBlock = (kind) => {
        if (!duration || isPlaying) return
        const start = Math.max(0, Math.min(time, duration - 100))
        const end = Math.min(duration, start + NEW_BLOCK_DURATION_MS)
        if (kind === "mouse") {
            const id = `ms-${crypto.randomUUID()}`
            dispatch(addMouseStyle({ id, start, end }))
            dispatch(setSelectedRow(MOUSE_STYLES))
            dispatch(setOpenSection(MOUSE_STYLES))
            dispatch(setSelectedIds([id]))
        } else if (kind === "keyboard") {
            const id = `kb-${crypto.randomUUID()}`
            dispatch(addKeyboardLayout({ id, start, end }))
            dispatch(setSelectedRow(KEYBOARD_LAYOUTS))
            dispatch(setOpenSection(KEYBOARD_LAYOUTS))
            dispatch(setSelectedIds([id]))
        } else if (kind === "scene") {
            const id = `scn-${crypto.randomUUID()}`
            const main = extraTracks?.[0]?.id || null
            const slots = {}
            for (let i = 1; i < (extraTracks?.length || 0); i++) {
                slots[extraTracks[i].id] = "hidden"  // focus mode default: only main is shown
            }
            dispatch(addAppScene({ id, start, end, layout: "pip", mainTrackId: main, slots }))
            dispatch(setSelectedRow(APP_SCENES))
            dispatch(setOpenSection(APP_SCENES))
            dispatch(setSelectedIds([id]))
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
                Toggle plugins, set their default style, and add timeline blocks to override the default for
                a span. Click a block in the timeline to edit it here.
            </p>

            <PluginPanel
                icon={CursorArrowRaysIcon}
                title="Mouse Coloring & Tag"
                enabled={!!enabled[FEATURE_IDS.MOUSE_STYLE]}
                onToggle={(v) => setEnabled(FEATURE_IDS.MOUSE_STYLE, v)}
                blockCount={mouseIds.length}
                onAddBlock={() => addBlock("mouse")}>
                <MouseStyleControls
                    selectedId={selectedRow === MOUSE_STYLES ? selectedId : null}
                />
            </PluginPanel>

            <PluginPanel
                icon={CommandLineIcon}
                title="Keyboard Typing Overlay"
                enabled={!!enabled[FEATURE_IDS.KEYBOARD_OVERLAY]}
                onToggle={(v) => setEnabled(FEATURE_IDS.KEYBOARD_OVERLAY, v)}
                blockCount={keyboardIds.length}
                onAddBlock={() => addBlock("keyboard")}>
                <KeyboardControls />
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
                <AppRecordingControls
                    selectedId={selectedRow === APP_SCENES ? selectedId : null}
                />
            </PluginPanel>
        </div>
    )
}

// ── Mouse Style controls ──────────────────────────────────────────────────

function MouseStyleControls({ selectedId }) {
    const dispatch = useDispatch()
    const defaults = useSelector(selectMouseStyleDefaults)
    const allEntities = useSelector(selectAllMouseStyles)
    const selectedEntity = useSelector(state => selectedId ? selectMouseStyleById(state, selectedId) : null)

    const updateEntity = (changes) => {
        if (!selectedEntity) return
        dispatch(updateMouseStyle({ id: selectedEntity.id, changes }))
    }

    const onDelete = () => {
        if (!selectedEntity) return
        dispatch(removeMouseStyle(selectedEntity.id))
    }

    return (
        <div className="flex flex-col gap-3 mt-2">
            <SectionHead text={selectedEntity ? "Editing block" : "Default style"} />
            <Row label="Color">
                <input
                    type="color"
                    value={selectedEntity?.color ?? defaults.color}
                    onChange={(e) => selectedEntity
                        ? updateEntity({ color: e.target.value })
                        : dispatch(setMsColor(e.target.value))}
                    className="h-7 w-14 rounded border border-base-content/10 bg-transparent cursor-pointer"
                />
                <span className="text-[10px] font-mono text-base-content/40">
                    {(selectedEntity?.color ?? defaults.color)}
                </span>
            </Row>
            <Row label="Cursor preset">
                <select
                    className="select select-sm flex-1"
                    value={selectedEntity?.preset ?? defaults.preset}
                    onChange={(e) => selectedEntity
                        ? updateEntity({ preset: e.target.value })
                        : dispatch(setMsPreset(e.target.value))}>
                    {CURSOR_PRESETS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                </select>
            </Row>
            <Row label="Show tag">
                <input
                    type="checkbox"
                    className="toggle toggle-sm"
                    checked={selectedEntity?.showLabel ?? defaults.showLabel}
                    onChange={(e) => selectedEntity
                        ? updateEntity({ showLabel: e.target.checked })
                        : dispatch(setMsShowLabel(e.target.checked))}
                />
            </Row>
            <Row label="Tag text">
                <input
                    type="text"
                    placeholder="FlowTake Agent"
                    maxLength={40}
                    value={selectedEntity?.label ?? defaults.label}
                    onChange={(e) => selectedEntity
                        ? updateEntity({ label: e.target.value })
                        : dispatch(setMsLabel(e.target.value))}
                    className="input input-sm flex-1"
                />
            </Row>
            <CursorPreview
                color={selectedEntity?.color ?? defaults.color}
                preset={selectedEntity?.preset ?? defaults.preset}
                label={(selectedEntity?.showLabel ?? defaults.showLabel)
                    ? (selectedEntity?.label ?? defaults.label)
                    : null}
            />
            {selectedEntity && (
                <button type="button" className="btn btn-xs btn-outline btn-error self-start"
                    onClick={onDelete}>Delete this block</button>
            )}
            {!selectedEntity && allEntities.length > 0 && (
                <p className="text-[10px] text-base-content/40">
                    Click a Mouse block in the timeline to edit just that span.
                </p>
            )}
        </div>
    )
}

// ── Keyboard controls (slice-level only for now) ──────────────────────────

function KeyboardControls() {
    const dispatch = useDispatch()
    const d = useSelector(selectKeyboardLayoutDefaults)
    return (
        <div className="flex flex-col gap-3 mt-2">
            <SectionHead text="Default style" />
            <Row label="Mode">
                <select className="select select-sm flex-1" value={d.mode}
                    onChange={(e) => dispatch(setKbMode(e.target.value))}>
                    {KEYBOARD_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
            </Row>
            <Row label="Position">
                <select className="select select-sm flex-1" value={d.position}
                    onChange={(e) => dispatch(setKbPosition(e.target.value))}>
                    {KEYBOARD_POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
            </Row>
            <Row label="Size">
                <select className="select select-sm flex-1" value={d.size}
                    onChange={(e) => dispatch(setKbSize(e.target.value))}>
                    {KEYBOARD_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </Row>
        </div>
    )
}

// ── App Scene controls ────────────────────────────────────────────────────

function AppRecordingControls({ selectedId }) {
    const dispatch = useDispatch()
    const tracks = useSelector(selectExtraTracks)
    const allScenes = useSelector(selectAllAppScenes)
    const selectedScene = useSelector(state => selectedId ? selectAppSceneById(state, selectedId) : null)

    const update = (changes) => {
        if (!selectedScene) return
        dispatch(updateAppScene({ id: selectedScene.id, changes }))
    }

    const setMain = (trackId) => {
        if (!selectedScene) return
        const slots = { ...(selectedScene.slots || {}) }
        if (selectedScene.mainTrackId && selectedScene.mainTrackId !== trackId) {
            slots[selectedScene.mainTrackId] = slots[selectedScene.mainTrackId] || "hidden"
        }
        delete slots[trackId]
        update({ mainTrackId: trackId, slots })
    }

    const setSlot = (trackId, slot) => {
        if (!selectedScene) return
        update({ slots: { ...(selectedScene.slots || {}), [trackId]: slot } })
    }

    if (!Array.isArray(tracks) || tracks.length === 0) {
        return (
            <p className="text-[11px] text-base-content/40 mt-2">
                No extra apps captured for this project. Enable in launcher Plugins → pick apps before recording.
            </p>
        )
    }

    return (
        <div className="flex flex-col gap-3 mt-2">
            <p className="text-[11px] text-base-content/55">
                {tracks.length} captured app{tracks.length === 1 ? "" : "s"}.
                {!selectedScene && " Add a Scene block to focus on one app at a time."}
            </p>

            <ul className="rounded-md border border-base-content/10 divide-y divide-base-content/5">
                {tracks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 px-2 py-1.5">
                        <span className="size-5 rounded bg-base-content/10 text-[8px] font-mono flex items-center justify-center text-base-content/60">
                            {t.width}×{t.height}
                        </span>
                        <span className="text-xs flex-1 truncate">{t.name}</span>
                        {selectedScene && (
                            selectedScene.mainTrackId === t.id ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold uppercase tracking-wider">
                                    Main
                                </span>
                            ) : (
                                <button type="button" className="btn btn-xs btn-ghost"
                                    onClick={() => setMain(t.id)}>Set main</button>
                            )
                        )}
                    </li>
                ))}
            </ul>

            {selectedScene && (
                <div className="rounded-md border border-base-content/10 px-2 py-2 flex flex-col gap-2">
                    <SectionHead text="Layout" />
                    <div className="grid grid-cols-3 gap-1.5">
                        {SCENE_LAYOUTS.map(l => {
                            const active = (selectedScene.layout || "pip") === l.value
                            return (
                                <button
                                    key={l.value}
                                    type="button"
                                    title={l.help}
                                    onClick={() => update({ layout: l.value })}
                                    className={`btn btn-xs ${active ? "btn-primary" : "btn-outline"}`}>
                                    {l.label}
                                </button>
                            )
                        })}
                    </div>
                    <p className="text-[10px] text-base-content/40 -mt-1">
                        {SCENE_LAYOUTS.find(l => l.value === (selectedScene.layout || "pip"))?.help}
                    </p>
                </div>
            )}

            {selectedScene && (
                <div className="rounded-md border border-base-content/10 px-2 py-2 flex flex-col gap-2">
                    <SectionHead text={(selectedScene.layout || "pip") === "pip" ? "Secondary placements" : "Secondary visibility"} />
                    {tracks.filter(t => t.id !== selectedScene.mainTrackId).map((t) => {
                        const cur = selectedScene.slots?.[t.id] || "hidden"
                        const isPip = (selectedScene.layout || "pip") === "pip"
                        if (isPip) {
                            return (
                                <Row key={t.id} label={t.name}>
                                    <select
                                        className="select select-xs flex-1"
                                        value={cur}
                                        onChange={(e) => setSlot(t.id, e.target.value)}>
                                        {SCENE_SLOTS.map(s => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </Row>
                            )
                        }
                        const isVisible = cur && cur !== "hidden"
                        return (
                            <Row key={t.id} label={t.name}>
                                <button
                                    type="button"
                                    onClick={() => setSlot(t.id, isVisible ? "hidden" : "tr")}
                                    className={`btn btn-xs flex-1 ${isVisible ? "btn-primary" : "btn-outline"}`}>
                                    {isVisible ? "Visible" : "Hidden"}
                                </button>
                            </Row>
                        )
                    })}
                </div>
            )}

            {!selectedScene && allScenes.length > 0 && (
                <p className="text-[10px] text-base-content/40">
                    Click a Scene block in the timeline to edit it here.
                </p>
            )}
        </div>
    )
}

// ── Reusable bits ─────────────────────────────────────────────────────────

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

function Row({ label, children }) {
    return (
        <div className="flex items-center gap-3">
            <label className="text-xs text-base-content/70 w-28 flex-shrink-0 truncate">{label}</label>
            {children}
        </div>
    )
}

function SectionHead({ text }) {
    return (
        <h4 className="text-[10px] uppercase tracking-wider text-base-content/45 font-semibold">{text}</h4>
    )
}

function CursorPreview({ color, preset, label }) {
    return (
        <div className="rounded-md border border-base-content/10 bg-base-content/[0.02] p-4 flex items-center justify-center min-h-24">
            <div className="relative">
                <PresetIcon preset={preset} color={color} />
                {label && (
                    <span className="absolute left-7 top-7 px-2 py-0.5 rounded-full text-[10px] font-medium text-white whitespace-nowrap shadow"
                        style={{ background: color }}>
                        {label}
                    </span>
                )}
            </div>
        </div>
    )
}

function PresetIcon({ preset, color }) {
    const stroke = "white"
    switch (preset) {
        case "arrow":
            return (
                <svg width="32" height="32" viewBox="0 0 32 32">
                    <polygon points="0,0 0,28 8,22 13,32 17,30 12,21 20,21" fill={color} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
            )
        case "pointer":
            return (
                <svg width="32" height="32" viewBox="0 0 32 32">
                    <polygon points="4,0 4,22 8,19 12,28 16,26 12,18 18,18" fill={color} stroke={stroke} strokeWidth="1.2" />
                </svg>
            )
        case "dot":
            return <svg width="32" height="32" viewBox="-16 -16 32 32"><circle r="8" fill={color} stroke={stroke} strokeWidth="1.5" /></svg>
        case "ring":
            return <svg width="32" height="32" viewBox="-16 -16 32 32"><circle r="11" fill="none" stroke={color} strokeWidth="3" /><circle r="3.5" fill={color} /></svg>
        case "target":
            return (
                <svg width="40" height="40" viewBox="-20 -20 40 40">
                    <circle r="14" fill="none" stroke={color} strokeWidth="2" />
                    <line x1="-18" x2="-6" stroke={color} strokeWidth="2" />
                    <line x1="6" x2="18" stroke={color} strokeWidth="2" />
                    <line y1="-18" y2="-6" stroke={color} strokeWidth="2" />
                    <line y1="6" y2="18" stroke={color} strokeWidth="2" />
                    <circle r="2" fill={color} />
                </svg>
            )
        case "agent":
            return (
                <svg width="40" height="40" viewBox="-20 -20 40 40">
                    <circle r="18" fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="2" />
                    <circle r="12" fill="none" stroke={color} strokeOpacity="0.85" strokeWidth="2.5" />
                    <circle r="4" fill={color} />
                </svg>
            )
        default:
            return (
                <svg viewBox="0 0 24 24" width="32" height="32" style={{ color }}>
                    <path d="M3 2 L3 19 L8 14 L11.5 21 L14 20 L10.5 13 L17 13 Z"
                        fill="currentColor" stroke="white" strokeWidth="1" strokeLinejoin="round" />
                </svg>
            )
    }
}
