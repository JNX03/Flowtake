import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [helpersSource, managerSource, workerSource, previewSource] = await Promise.all([
    readFile(new URL("../app/shared/workers/helpers.js", import.meta.url), "utf8"),
    readFile(new URL("../app/shared/workers/PreviewWorkerManager.js", import.meta.url), "utf8"),
    readFile(new URL("../app/shared/workers/previewWorker.js", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/Preview.jsx", import.meta.url), "utf8"),
])

test("preview snapshots are extracted from the offscreen renderer", () => {
    assert.match(helpersSource, /export const SNAPSHOT = "SNAPSHOT"/)
    assert.match(managerSource, /captureSnapshot\(\) \{\s*return this\.postAsync\(SNAPSHOT\)/)
    assert.match(workerSource, /async snapshot\(\)/)
    assert.match(workerSource, /renderer\.extract\.base64/)
    assert.match(workerSource, /target: this\.scene\.app\.stage/)
    assert.match(workerSource, /case SNAPSHOT/)
    assert.match(workerSource, /result = await renderer\?\.snapshot\(\)/)
    assert.match(previewSource, /<PreviewTransport manager=\{manager\} \/>/)
    assert.doesNotMatch(previewSource, /canvasRef\.current\.toBlob/)
})

test("snapshot controls support PNG download, clipboard, and visible failures", () => {
    assert.match(previewSource, /data:image\/png/)
    assert.match(previewSource, /navigator\.clipboard\.write/)
    assert.match(previewSource, /new window\.ClipboardItem/)
    assert.match(previewSource, /anchor\.download =/)
    assert.match(previewSource, /addErrorToast/)
    assert.match(previewSource, /aria-label="Save preview snapshot"/)
    assert.match(previewSource, /aria-label="Copy preview snapshot"/)
})

test("preview resizing stays responsive when the desktop window or panels change", () => {
    assert.match(previewSource, /useResizeDetector\(\{/)
    assert.match(previewSource, /refreshMode: "throttle"/)
    assert.match(previewSource, /refreshRate: 50/)
    assert.match(previewSource, /observerOptions: \{ box: "border-box" \}/)
})
