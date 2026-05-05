import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [
    editorSource,
    previewSource,
    aspectRatioSource,
    titleBarSource,
    cssSource
] = await Promise.all([
    readFile(new URL("../app/windows/main/components/Editor.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/Preview.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/AspectRatioDropdown.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/TitleBar.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/shared/assets/index.css", import.meta.url), "utf8"),
])

test("editor opts into the clean studio shell", () => {
    assert.match(editorSource, /data-theme="flowtake-studio"/)
    assert.match(editorSource, /className="flowtake-editor h-full text-base-content"/)
    assert.match(editorSource, /variant="studio"/)
    assert.match(editorSource, /flowtake-editor__workspace/)
    assert.match(editorSource, /flowtake-editor__main/)
})

test("primary editor workflow follows properties, preview, assets order", () => {
    const propertiesIndex = editorSource.indexOf("<Properties")
    const previewIndex = editorSource.indexOf("<Preview")
    const assetsIndex = editorSource.indexOf("<AssetPanel")

    assert.ok(propertiesIndex > -1, "properties panel is present")
    assert.ok(previewIndex > -1, "preview is present")
    assert.ok(assetsIndex > -1, "asset shelf is present")
    assert.ok(propertiesIndex < previewIndex, "properties panel stays left of preview")
    assert.ok(previewIndex < assetsIndex, "asset shelf stays to the right of preview")
    assert.match(editorSource, /useState\(false\)/, "asset shelf starts compact")
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

test("studio title bar keeps mac-style controls wired to window actions", () => {
    assert.match(titleBarSource, /variant === "traffic"/)
    assert.match(titleBarSource, /aria-label="Close window"/)
    assert.match(titleBarSource, /aria-label="Minimize window"/)
    assert.match(titleBarSource, /aria-label="Maximize window"/)
    assert.match(titleBarSource, /getCurrentWindow\(\)\.close\(\)/)
    assert.match(titleBarSource, /getCurrentWindow\(\)\.minimize\(\)/)
    assert.match(titleBarSource, /getCurrentWindow\(\)\.toggleMaximize\(\)/)
})

test("studio theme defines clean, bounded editor surfaces", () => {
    assert.match(cssSource, /name:\s*"flowtake-studio"/)
    assert.match(cssSource, /\.flowtake-panel,\n\s+\.flowtake-icon-rail,\n\s+\.flowtake-asset-rail,\n\s+\.flowtake-properties-card,\n\s+\.flowtake-timeline-surface/)
    assert.match(cssSource, /\.flowtake-preview__stage/)
    assert.match(cssSource, /\.flowtake-preview__canvas/)
    assert.match(cssSource, /\.flowtake-timeline-scroll/)
    assert.doesNotMatch(cssSource, /letter-spacing:\s*-[0-9.]/)
})
