export const EDITOR_SHORTCUTS_VERSION = 1
export const EDITOR_SHORTCUTS_STORAGE_KEY = "flowtake:editor-shortcuts"

export const EDITOR_SHORTCUT_IDS = Object.freeze({
    PLAY_PAUSE: "preview.play-pause",
    SEEK_BACK_ONE_SECOND: "preview.seek-back-one-second",
    SEEK_FORWARD_ONE_SECOND: "preview.seek-forward-one-second",
    PREVIOUS_FRAME: "preview.previous-frame",
    NEXT_FRAME: "preview.next-frame",
    SEEK_BACK_FIVE_SECONDS: "preview.seek-back-five-seconds",
    SEEK_FORWARD_FIVE_SECONDS: "preview.seek-forward-five-seconds",
    JUMP_TO_START: "preview.jump-to-start",
    JUMP_TO_END: "preview.jump-to-end",
    SPLIT: "timeline.split",
    TRIM_START: "timeline.trim-start",
    TRIM_END: "timeline.trim-end",
    COPY: "timeline.copy",
    PASTE: "timeline.paste",
    DUPLICATE: "timeline.duplicate",
    DELETE: "timeline.delete",
})

export const EDITOR_SHORTCUT_REGISTRY = Object.freeze([
    { id: EDITOR_SHORTCUT_IDS.PLAY_PAUSE, label: "Play / pause", category: "Playback", defaultBindings: ["space"] },
    { id: EDITOR_SHORTCUT_IDS.SEEK_BACK_ONE_SECOND, label: "Back one second", category: "Playback", defaultBindings: ["j"] },
    { id: EDITOR_SHORTCUT_IDS.SEEK_FORWARD_ONE_SECOND, label: "Forward one second", category: "Playback", defaultBindings: ["l"] },
    { id: EDITOR_SHORTCUT_IDS.PREVIOUS_FRAME, label: "Previous frame", category: "Playback", defaultBindings: ["left"] },
    { id: EDITOR_SHORTCUT_IDS.NEXT_FRAME, label: "Next frame", category: "Playback", defaultBindings: ["right"] },
    { id: EDITOR_SHORTCUT_IDS.SEEK_BACK_FIVE_SECONDS, label: "Back five seconds", category: "Playback", defaultBindings: ["shift+left"] },
    { id: EDITOR_SHORTCUT_IDS.SEEK_FORWARD_FIVE_SECONDS, label: "Forward five seconds", category: "Playback", defaultBindings: ["shift+right"] },
    { id: EDITOR_SHORTCUT_IDS.JUMP_TO_START, label: "Jump to start", category: "Playback", defaultBindings: ["home"] },
    { id: EDITOR_SHORTCUT_IDS.JUMP_TO_END, label: "Jump to end", category: "Playback", defaultBindings: ["end"] },
    { id: EDITOR_SHORTCUT_IDS.SPLIT, label: "Split selected element", category: "Timeline", defaultBindings: ["s"] },
    { id: EDITOR_SHORTCUT_IDS.TRIM_START, label: "Trim start to playhead", category: "Timeline", defaultBindings: ["q"] },
    { id: EDITOR_SHORTCUT_IDS.TRIM_END, label: "Trim end to playhead", category: "Timeline", defaultBindings: ["w"] },
    { id: EDITOR_SHORTCUT_IDS.COPY, label: "Copy selected elements", category: "Timeline", defaultBindings: ["mod+c"] },
    { id: EDITOR_SHORTCUT_IDS.PASTE, label: "Paste at playhead", category: "Timeline", defaultBindings: ["mod+v"] },
    { id: EDITOR_SHORTCUT_IDS.DUPLICATE, label: "Duplicate selected elements", category: "Timeline", defaultBindings: ["mod+d"] },
    { id: EDITOR_SHORTCUT_IDS.DELETE, label: "Delete selected elements", category: "Timeline", defaultBindings: ["delete", "backspace"] },
].map(action => Object.freeze({
    ...action,
    defaultBindings: Object.freeze([...action.defaultBindings]),
})))

const REGISTRY_BY_ID = new Map(EDITOR_SHORTCUT_REGISTRY.map(action => [action.id, action]))
const MODIFIER_ORDER = ["mod", "ctrl", "meta", "alt", "shift"]
const MODIFIERS = new Set(MODIFIER_ORDER)
const KEY_ALIASES = Object.freeze({
    " ": "space",
    "+": "plus",
    ",": "comma",
    spacebar: "space",
    esc: "escape",
    del: "delete",
    arrowleft: "left",
    arrowright: "right",
    arrowup: "up",
    arrowdown: "down",
    control: "ctrl",
    command: "meta",
    cmd: "meta",
    option: "alt",
})

const copyBindings = bindings => Object.fromEntries(
    Object.entries(bindings).map(([id, values]) => [id, [...values]])
)

export function isMacPlatform(platform = globalThis.navigator?.platform) {
    return /Mac|iPhone|iPad|iPod/i.test(platform || "")
}

export function normalizeShortcutKey(value) {
    if (typeof value !== "string") return null
    const trimmed = value === " " ? " " : value.trim().toLowerCase()
    if (!trimmed) return null
    return KEY_ALIASES[trimmed] || trimmed
}

export function normalizeShortcut(value, { mac = isMacPlatform() } = {}) {
    if (typeof value !== "string") return null
    const rawParts = value.split("+").map(normalizeShortcutKey).filter(Boolean)
    if (rawParts.length === 0) return null

    const modifiers = new Set()
    let key = null
    for (const part of rawParts) {
        let normalizedPart = part
        if (part === "meta" && mac) normalizedPart = "mod"
        if (part === "ctrl" && !mac) normalizedPart = "mod"
        if (MODIFIERS.has(normalizedPart)) {
            modifiers.add(normalizedPart)
            continue
        }
        if (key !== null) return null
        key = normalizedPart
    }
    if (!key || key.length > 32 || /[\s,]/.test(key)) return null
    return [...MODIFIER_ORDER.filter(modifier => modifiers.has(modifier)), key].join("+")
}

export function shortcutFromKeyboardEvent(event, { mac = isMacPlatform() } = {}) {
    const rawKey = normalizeShortcutKey(event?.key)
    if (!rawKey || MODIFIERS.has(rawKey)) return null

    const modifiers = []
    if (mac ? event.metaKey : event.ctrlKey) modifiers.push("mod")
    if (mac ? event.ctrlKey : event.metaKey) modifiers.push(mac ? "ctrl" : "meta")
    if (event.altKey) modifiers.push("alt")
    if (event.shiftKey) modifiers.push("shift")
    return normalizeShortcut([...modifiers, rawKey].join("+"), { mac })
}

export function getDefaultEditorShortcuts() {
    return Object.fromEntries(EDITOR_SHORTCUT_REGISTRY.map(action => [
        action.id,
        [...action.defaultBindings],
    ]))
}

function normalizeBindings(value, options) {
    if (typeof value === "string") value = [value]
    if (!Array.isArray(value)) return null
    const bindings = []
    for (const candidate of value) {
        const binding = normalizeShortcut(candidate, options)
        if (!binding) return null
        if (!bindings.includes(binding)) bindings.push(binding)
    }
    return bindings
}

export function findShortcutConflict(bindings, shortcut, excludeActionId = null) {
    const normalized = normalizeShortcut(shortcut)
    if (!normalized) return null
    for (const action of EDITOR_SHORTCUT_REGISTRY) {
        if (action.id === excludeActionId) continue
        if (bindings[action.id]?.includes(normalized)) return action
    }
    return null
}

export function sanitizeEditorShortcutBindings(value, options) {
    const defaults = getDefaultEditorShortcuts()
    const source = value?.bindings && typeof value.bindings === "object"
        ? value.bindings
        : (value && typeof value === "object" ? value : {})
    const result = copyBindings(defaults)

    for (const action of EDITOR_SHORTCUT_REGISTRY) {
        if (!Object.prototype.hasOwnProperty.call(source, action.id)) continue
        const normalized = normalizeBindings(source[action.id], options)
        if (normalized !== null) result[action.id] = normalized
    }

    const claimed = new Set()
    for (const action of EDITOR_SHORTCUT_REGISTRY) {
        for (const binding of result[action.id]) {
            if (claimed.has(binding)) return defaults
            claimed.add(binding)
        }
    }
    return result
}

export function parseEditorShortcutPreferences(raw, options) {
    if (!raw) return getDefaultEditorShortcuts()
    try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
        if (!parsed || typeof parsed !== "object") return getDefaultEditorShortcuts()
        if (parsed.version != null && parsed.version > EDITOR_SHORTCUTS_VERSION) {
            return getDefaultEditorShortcuts()
        }
        return sanitizeEditorShortcutBindings(parsed, options)
    } catch {
        return getDefaultEditorShortcuts()
    }
}

export function serializeEditorShortcutPreferences(bindings) {
    return JSON.stringify({
        version: EDITOR_SHORTCUTS_VERSION,
        bindings: sanitizeEditorShortcutBindings({ bindings }),
    })
}

export function getShortcutAction(actionId) {
    return REGISTRY_BY_ID.get(actionId) || null
}

export function formatShortcut(binding, { mac = isMacPlatform() } = {}) {
    if (!binding) return "Unassigned"
    const labels = {
        mod: mac ? "Command" : "Ctrl",
        ctrl: "Ctrl",
        meta: mac ? "Command" : "Meta",
        alt: mac ? "Option" : "Alt",
        shift: "Shift",
        space: "Space",
        left: "Left",
        right: "Right",
        up: "Up",
        down: "Down",
        delete: "Delete",
        backspace: "Backspace",
        escape: "Escape",
        home: "Home",
        end: "End",
        plus: "Plus",
        comma: "Comma",
    }
    return binding.split("+").map(part => labels[part] || part.toUpperCase()).join(" + ")
}
