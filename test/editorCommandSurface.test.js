import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [
    toolbarSource,
    sliderSource,
    clipSectionSource,
    hotkeysSource,
    shortcutRegistrySource,
] = await Promise.all([
    readFile(new URL("../app/windows/main/components/timeline/TimelineToolbar.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/properties/Slider.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/properties/ClipSection.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/settings/HotkeysSettings.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/shared/editor/shortcutRegistry.js", import.meta.url), "utf8"),
])

test("timeline toolbar routes core edits through the command facade", () => {
    assert.match(toolbarSource, /splitEditorSelection/)
    assert.match(toolbarSource, /retainRightEditorSelection/)
    assert.match(toolbarSource, /retainLeftEditorSelection/)
    assert.match(toolbarSource, /deleteEditorSelection/)
    assert.match(toolbarSource, /duplicateEditorSelection/)
    assert.match(toolbarSource, /copyEditorSelection/)
    assert.match(toolbarSource, /pasteEditorClipboard/)
    assert.match(toolbarSource, /useEditorHotkey\(EDITOR_SHORTCUT_IDS\.TRIM_START/)
    assert.match(toolbarSource, /useEditorHotkey\(EDITOR_SHORTCUT_IDS\.TRIM_END/)
    assert.match(toolbarSource, /useEditorHotkey\(EDITOR_SHORTCUT_IDS\.COPY/)
    assert.match(toolbarSource, /useEditorHotkey\(EDITOR_SHORTCUT_IDS\.PASTE/)
    assert.match(toolbarSource, /aria-label="Trim selection start to playhead"/)
    assert.match(toolbarSource, /aria-label="Trim selection end to playhead"/)
    assert.match(toolbarSource, /aria-label="Paste at playhead"/)
    assert.match(toolbarSource, /canEditSelection = hasSelection && isEditorCommandRow\(selectedRow\)/)
    assert.match(toolbarSource, /enabled: areHotkeysEnabled && canEditSelection/)
    assert.match(toolbarSource, /disabled=\{!canEditSelection \|\| isPlaying\}/)
    assert.match(toolbarSource, /aria-label="More timeline actions"/)
    assert.match(toolbarSource, /<span className="flex-1">Copy<\/span>/)
    assert.match(toolbarSource, /<span className="flex-1">Paste at playhead<\/span>/)
    assert.doesNotMatch(toolbarSource, /Â·/)
})

test("speed shortcut opens and reveals the selected clip control", () => {
    assert.match(toolbarSource, /dispatch\(setOpenSection\(CLIPS\)\)/)
    assert.match(toolbarSource, /getElementById\("clip-speed-control"\)/)
    assert.match(clipSectionSource, /id="clip-speed-control"/)
    assert.doesNotMatch(toolbarSource, /just a visual shortcut hint/)
})

test("continuous inspector slider changes share one undo group", () => {
    assert.match(sliderSource, /groupRef = useRef\(null\)/)
    assert.match(sliderSource, /onPointerDown=\{startGroup\}/)
    assert.match(sliderSource, /onPointerUp=\{endGroup\}/)
    assert.match(sliderSource, /onKeyDown=\{startGroup\}/)
    assert.match(sliderSource, /onKeyUp=\{endGroup\}/)
    assert.match(sliderSource, /onChange\(Number\(target\.value\), groupRef\.current/)
    assert.match(clipSectionSource, /withGroup\(action, group\)/)
})

test("shortcut settings are generated from the active transport and edit registry", () => {
    assert.match(hotkeysSource, /EDITOR_SHORTCUT_REGISTRY/)
    assert.match(hotkeysSource, /setEditorShortcut/)
    assert.match(hotkeysSource, /Confirm reset/)
    for (const label of [
        "Previous frame",
        "Next frame",
        "Trim start to playhead",
        "Trim end to playhead",
        "Copy selected elements",
        "Paste at playhead",
        "Duplicate selected elements",
    ]) {
        assert.match(shortcutRegistrySource, new RegExp(label))
    }
    assert.doesNotMatch(shortcutRegistrySource, /Merge selected element/)
    assert.doesNotMatch(shortcutRegistrySource, /Maximize selected element/)
})
