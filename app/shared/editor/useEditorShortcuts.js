import { useSyncExternalStore } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
    EDITOR_SHORTCUTS_STORAGE_KEY,
    findShortcutConflict,
    getDefaultEditorShortcuts,
    getShortcutAction,
    normalizeShortcut,
    parseEditorShortcutPreferences,
    sanitizeEditorShortcutBindings,
    serializeEditorShortcutPreferences,
} from "./shortcutRegistry"

let shortcutSnapshot = null
let isStorageListenerAttached = false
const listeners = new Set()
const serverSnapshot = getDefaultEditorShortcuts()

function notifyListeners() {
    listeners.forEach(listener => listener())
}

function readStoredBindings() {
    if (typeof window === "undefined") return getDefaultEditorShortcuts()
    try {
        return parseEditorShortcutPreferences(
            window.localStorage.getItem(EDITOR_SHORTCUTS_STORAGE_KEY)
        )
    } catch {
        return getDefaultEditorShortcuts()
    }
}

function attachStorageListener() {
    if (isStorageListenerAttached || typeof window === "undefined") return
    isStorageListenerAttached = true
    window.addEventListener("storage", event => {
        if (event.key !== EDITOR_SHORTCUTS_STORAGE_KEY) return
        shortcutSnapshot = parseEditorShortcutPreferences(event.newValue)
        notifyListeners()
    })
}

export function getEditorShortcutSnapshot() {
    if (!shortcutSnapshot) shortcutSnapshot = readStoredBindings()
    attachStorageListener()
    return shortcutSnapshot
}

function persistBindings(bindings) {
    shortcutSnapshot = sanitizeEditorShortcutBindings({ bindings })
    if (typeof window !== "undefined") {
        try {
            window.localStorage.setItem(
                EDITOR_SHORTCUTS_STORAGE_KEY,
                serializeEditorShortcutPreferences(shortcutSnapshot)
            )
        } catch {
            // Keep the in-memory preference when local storage is unavailable.
        }
    }
    notifyListeners()
    return shortcutSnapshot
}

export function subscribeToEditorShortcuts(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function setEditorShortcut(actionId, shortcut) {
    const action = getShortcutAction(actionId)
    const normalized = normalizeShortcut(shortcut)
    if (!action || !normalized) {
        return { ok: false, reason: "invalid" }
    }

    const current = getEditorShortcutSnapshot()
    const conflict = findShortcutConflict(current, normalized, actionId)
    if (conflict) {
        return { ok: false, reason: "conflict", conflict }
    }
    persistBindings({ ...current, [actionId]: [normalized] })
    return { ok: true, shortcut: normalized }
}

export function removeEditorShortcut(actionId) {
    if (!getShortcutAction(actionId)) return false
    const current = getEditorShortcutSnapshot()
    persistBindings({ ...current, [actionId]: [] })
    return true
}

export function restoreEditorShortcut(actionId) {
    const action = getShortcutAction(actionId)
    if (!action) return { ok: false, reason: "invalid" }
    const current = getEditorShortcutSnapshot()
    for (const shortcut of action.defaultBindings) {
        const conflict = findShortcutConflict(current, shortcut, actionId)
        if (conflict) {
            return {
                ok: false,
                reason: "conflict",
                conflict,
            }
        }
    }
    persistBindings({
        ...current,
        [actionId]: [...action.defaultBindings],
    })
    return { ok: true }
}

export function resetEditorShortcuts() {
    persistBindings(getDefaultEditorShortcuts())
}

export function useEditorShortcutBindings() {
    return useSyncExternalStore(
        subscribeToEditorShortcuts,
        getEditorShortcutSnapshot,
        () => serverSnapshot
    )
}

export function useEditorHotkey(actionId, callback, options = {}, dependencies = []) {
    const bindings = useEditorShortcutBindings()
    const activeBindings = bindings[actionId] || []
    const isEnabled = options.enabled !== false && activeBindings.length > 0
    const keys = activeBindings.length > 0
        ? activeBindings.join(",")
        : "unidentified"

    useHotkeys(keys, callback, {
        ...options,
        enabled: isEnabled,
        enableOnFormTags: false,
        enableOnContentEditable: false,
    }, dependencies)
}
