import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
    EDITOR_SHORTCUT_IDS,
    EDITOR_SHORTCUT_REGISTRY,
    EDITOR_SHORTCUTS_VERSION,
    findShortcutConflict,
    getDefaultEditorShortcuts,
    normalizeShortcut,
    parseEditorShortcutPreferences,
    serializeEditorShortcutPreferences,
    shortcutFromKeyboardEvent,
} from "../app/shared/editor/shortcutRegistry.js"

test("registered editor actions have unique IDs and conflict-free defaults", () => {
    const ids = EDITOR_SHORTCUT_REGISTRY.map(action => action.id)
    const defaults = getDefaultEditorShortcuts()

    assert.equal(new Set(ids).size, ids.length)
    for (const action of EDITOR_SHORTCUT_REGISTRY) {
        for (const binding of defaults[action.id]) {
            assert.equal(findShortcutConflict(defaults, binding, action.id), null)
        }
    }
})

test("shortcut normalization stores the platform command key as Mod", () => {
    assert.equal(normalizeShortcut("Ctrl+C", { mac: false }), "mod+c")
    assert.equal(normalizeShortcut("Meta+C", { mac: true }), "mod+c")
    assert.equal(normalizeShortcut("Shift+ArrowLeft", { mac: false }), "shift+left")
    assert.equal(normalizeShortcut("ctrl+c+v", { mac: false }), null)
})

test("keyboard events are captured without accepting modifier-only presses", () => {
    assert.equal(shortcutFromKeyboardEvent({
        key: "d",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true,
    }, { mac: false }), "mod+shift+d")
    assert.equal(shortcutFromKeyboardEvent({
        key: "Meta",
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
    }, { mac: true }), null)
})

test("preferences migrate legacy data, preserve removals, and fail future data closed", () => {
    const legacy = parseEditorShortcutPreferences({
        [EDITOR_SHORTCUT_IDS.SPLIT]: ["x"],
        [EDITOR_SHORTCUT_IDS.DELETE]: [],
    }, { mac: false })
    assert.deepEqual(legacy[EDITOR_SHORTCUT_IDS.SPLIT], ["x"])
    assert.deepEqual(legacy[EDITOR_SHORTCUT_IDS.DELETE], [])

    const defaults = getDefaultEditorShortcuts()
    assert.deepEqual(parseEditorShortcutPreferences("{broken"), defaults)
    assert.deepEqual(parseEditorShortcutPreferences({
        version: EDITOR_SHORTCUTS_VERSION + 1,
        bindings: {
            [EDITOR_SHORTCUT_IDS.SPLIT]: ["x"],
        },
    }), defaults)
})

test("shortcut serialization is versioned and keeps explicit unassigned actions", () => {
    const defaults = getDefaultEditorShortcuts()
    defaults[EDITOR_SHORTCUT_IDS.COPY] = []
    const serialized = JSON.parse(serializeEditorShortcutPreferences(defaults))

    assert.equal(serialized.version, EDITOR_SHORTCUTS_VERSION)
    assert.deepEqual(serialized.bindings[EDITOR_SHORTCUT_IDS.COPY], [])
})

test("Preview, timeline, and settings consume the same reactive registry", async () => {
    const [preview, toolbar, settings, store] = await Promise.all([
        readFile(new URL("../app/windows/main/components/Preview.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/windows/main/components/timeline/TimelineToolbar.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/windows/main/components/settings/HotkeysSettings.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/editor/useEditorShortcuts.js", import.meta.url), "utf8"),
    ])

    assert.doesNotMatch(preview, /useHotkeys\("space"/)
    assert.match(preview, /useEditorHotkey\(EDITOR_SHORTCUT_IDS\.PLAY_PAUSE/)
    assert.match(preview, /window\.localStorage\.getItem[\s\S]*catch/)
    assert.match(toolbar, /useEditorHotkey\(EDITOR_SHORTCUT_IDS\.SPLIT/)
    assert.match(toolbar, /shortcutLabel\(EDITOR_SHORTCUT_IDS\.DUPLICATE\)/)
    assert.match(settings, /EDITOR_SHORTCUT_REGISTRY/)
    assert.match(settings, /Press shortcut/)
    assert.match(settings, /Confirm reset/)
    assert.match(store, /findShortcutConflict/)
    assert.match(store, /enableOnFormTags: false/)
    assert.match(store, /enableOnContentEditable: false/)
})
