import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [
    editorSource,
    previewSource,
    aspectRatioSource,
    titleBarSource,
    cssSource,
    assetPanelSource,
    timelineSource,
    timelineToolbarSource,
    storeSource,
    helpersSource,
] = await Promise.all([
    readFile(new URL("../app/windows/main/components/Editor.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/Preview.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/AspectRatioDropdown.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/TitleBar.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/shared/assets/index.css", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/assets/AssetPanel.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/Timeline.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/TimelineToolbar.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/shared/redux/store.js", import.meta.url), "utf8"),
    readFile(new URL("../app/shared/helpers.js", import.meta.url), "utf8"),
])

test("editor opts into the clean studio shell", () => {
    // Editor must NOT pin a data-theme — it inherits the user's appearance theme.
    assert.doesNotMatch(editorSource, /data-theme="flowtake-studio"/)
    assert.match(editorSource, /className="flowtake-editor h-full text-base-content"/)
    assert.match(editorSource, /variant="studio"/)
    assert.match(editorSource, /flowtake-editor__workspace/)
    assert.match(editorSource, /flowtake-editor__main/)
})

test("primary editor workflow follows media, preview, inspector order", () => {
    const propertiesIndex = editorSource.indexOf("<Properties")
    const previewIndex = editorSource.indexOf("<Preview")
    const assetsIndex = editorSource.indexOf("<AssetPanel")

    assert.ok(propertiesIndex > -1, "properties panel is present")
    assert.ok(previewIndex > -1, "preview is present")
    assert.ok(assetsIndex > -1, "asset shelf is present")
    assert.ok(assetsIndex < previewIndex, "media panel stays left of preview")
    assert.ok(previewIndex < propertiesIndex, "inspector stays right of preview")
    assert.match(editorSource, /initialWidth >= 1180/, "side panels open by default only when there is room")
    assert.match(editorSource, /role="separator"/)
    assert.match(editorSource, /flowtake-editor-timeline-height/)
})

test("preview controls stay outside the render stage", () => {
    const toolbarIndex = previewSource.indexOf("flowtake-preview__chrome")
    const stageIndex = previewSource.indexOf("flowtake-preview__stage")
    const controlsIndex = previewSource.indexOf("flowtake-preview__controls")
    const videoIndex = previewSource.indexOf("<VideoWrapper")

    assert.ok(toolbarIndex > -1, "preview toolbar is present")
    assert.ok(stageIndex > -1, "preview stage is present")
    assert.ok(controlsIndex > -1, "preview controls are present")
    assert.ok(toolbarIndex < stageIndex, "aspect ratio control stays above the canvas")
    assert.ok(stageIndex < controlsIndex, "playback controls stay below the canvas")
    assert.ok(controlsIndex < videoIndex, "video elements remain hidden after visible controls")
})

test("aspect ratio menu opens above the preview stage", () => {
    assert.match(aspectRatioSource, /dropdown-bottom/)
    assert.match(aspectRatioSource, /type="button"/)
    assert.match(aspectRatioSource, /z-50/)
    assert.match(aspectRatioSource, /border-base-content\/10/)
})

test("studio title bar uses platform-appropriate controls wired to window actions", () => {
    assert.match(titleBarSource, /isMacPlatform/)
    assert.match(titleBarSource, /variant="standard"/)
    assert.match(titleBarSource, /variant="traffic"/)
    assert.match(titleBarSource, /aria-label="Close window"/)
    assert.match(titleBarSource, /aria-label="Minimize window"/)
    assert.match(titleBarSource, /aria-label="Maximize window"/)
    assert.match(titleBarSource, /getCurrentWindow\(\)\[method\]\(\)/)
    assert.match(titleBarSource, /getCurrentWindow\(\)\.close\(\)/)
    assert.match(titleBarSource, /getCurrentWindow\(\)\.minimize\(\)/)
    assert.match(titleBarSource, /getCurrentWindow\(\)\.toggleMaximize\(\)/)
    assert.match(titleBarSource, /callWindow\('close'\)/)
    assert.match(titleBarSource, /callWindow\('minimize'\)/)
    assert.match(titleBarSource, /callWindow\('toggleMaximize'\)/)
})

test("preview resizing avoids repeated GPU buffer allocation while panels move", () => {
    assert.match(previewSource, /rendererDimsRef/)
    assert.match(previewSource, /setTimeout\(commitResize, 120\)/)
    assert.match(previewSource, /clearTimeout\(resizeTimer\)/)
    assert.match(previewSource, /min-w-0/)
})

test("native media drops and imported assets remain project-durable", () => {
    assert.match(editorSource, /onDragDropEvent/)
    assert.match(editorSource, /convertFileSrc\(path\)/)
    assert.match(editorSource, /flowtake-import-paths/)
    assert.match(editorSource, /payload\.type === "leave"/)
    assert.doesNotMatch(editorSource, /payload\.type === "cancel"/)
    assert.match(assetPanelSource, /flowtake-import-paths/)
    assert.match(storeSource, /assetSlice\.actions/)
    assert.match(storeSource, /assets:\s*\{/)
    assert.match(helpersSource, /setAssets\(json\.assets\.entities\)/)
})

test("asset persistence cannot leave the editor stuck saving during close", () => {
    assert.match(storeSource, /const filterSaveableSlices = action =>/)
    assert.match(storeSource, /addAsset\.match\(action\)/)
    assert.match(storeSource, /removeAsset\.match\(action\)/)
    assert.match(storeSource, /updateAsset\.match\(action\)/)
    assert.match(storeSource, /if \(!state\.undoableState\.present\.project\.id \|\| state\.app\.isProjectClosing\) return/)
    assert.match(storeSource, /finally \{\s*if \(getState\(\)\.editor\.isSaving\) dispatch\(setIsSaving\(false\)\)/)
})

test("timeline editing stays responsive and controls expose accessible names", () => {
    assert.match(timelineSource, /const entitySnapLines = useMemo/)
    assert.match(timelineSource, /function TimelineClockSnapBridge/)
    assert.match(timelineSource, /selectTime\(currentState\)/)
    assert.match(timelineSource, /setTimeout\(\(\) => \{/)
    assert.match(editorSource, /<Timeline onRequestOpenInspector=\{openInspector\}/)
    assert.match(timelineSource, /onRequestOpenInspector=\{onRequestOpenInspector\}/)
    assert.match(timelineToolbarSource, /onRequestOpenInspector\?\.\(\)/)
    assert.match(timelineToolbarSource, /newEnd > duration/)
    assert.match(timelineToolbarSource, /selectedRow === AUDIO_TRACKS \|\| selectedRow === OVERLAY_TRACKS/)
    assert.match(timelineToolbarSource, /e\.trackIndex === entity\.trackIndex/)
    assert.match(timelineToolbarSource, /aria-label="Split selection"/)
    assert.match(timelineToolbarSource, /aria-label="Timeline zoom"/)
    assert.match(timelineToolbarSource, /isSnappingEnabled \? <LinkIcon/)
})

test("studio theme defines clean, bounded editor surfaces", () => {
    const studioCss = cssSource.slice(
        cssSource.indexOf(".flowtake-editor {"),
        cssSource.indexOf("/* ===== Editorial design system")
    )

    assert.match(cssSource, /name:\s*"flowtake-studio"/)
    assert.match(cssSource, /\.flowtake-panel,\r?\n\s+\.flowtake-icon-rail,\r?\n\s+\.flowtake-asset-rail,\r?\n\s+\.flowtake-properties-card,\r?\n\s+\.flowtake-timeline-surface/)
    assert.match(cssSource, /\.flowtake-preview__stage/)
    assert.match(cssSource, /\.flowtake-preview__canvas/)
    assert.match(cssSource, /\.flowtake-timeline-scroll/)
    assert.doesNotMatch(studioCss, /letter-spacing:\s*-[0-9.]/)
})
