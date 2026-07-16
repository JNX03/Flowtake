import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [defaultCapability, liveOverlayCapability, windowsSource, overlaySource] = await Promise.all([
    readFile(new URL("../src-tauri/capabilities/default.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../src-tauri/capabilities/live-overlay.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../src-tauri/src/commands/windows.rs", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/liveOverlay/App.jsx", import.meta.url), "utf8"),
])

test("live overlay receives only the event capabilities its renderer uses", () => {
    assert.deepEqual(liveOverlayCapability.windows, ["liveOverlay"])
    assert.equal(defaultCapability.windows.includes("liveOverlay"), false)
    assert.deepEqual(
        [...liveOverlayCapability.permissions].sort(),
        [
            "core:event:allow-emit",
            "core:event:allow-listen",
            "core:event:allow-unlisten",
        ].sort(),
    )
})

test("live overlay destruction is bound to the invoking webview", () => {
    const destroyStart = windowsSource.indexOf("pub async fn destroy_window")
    const nextCommand = windowsSource.indexOf("pub async fn open_window_picker", destroyStart)
    const destroyCommand = windowsSource.slice(destroyStart, nextCommand)

    assert.ok(destroyStart >= 0 && nextCommand > destroyStart)
    assert.match(destroyCommand, /destroy_window\(window: WebviewWindow\)/)
    assert.match(destroyCommand, /window\.destroy\(\)\.map_err\(AppError::Tauri\)\?/)
    assert.doesNotMatch(destroyCommand, /get_webview_window\("main"\)/)

    const overlayDestroyCalls = overlaySource.match(/invoke\("destroy_window"\)/g) || []
    assert.equal(overlayDestroyCalls.length, 2)
})
