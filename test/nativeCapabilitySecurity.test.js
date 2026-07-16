import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const capability = JSON.parse(await readFile(
    new URL("../src-tauri/capabilities/default.json", import.meta.url),
    "utf8"
))
const pickerImage = await readFile(
    new URL("../app/windows/pickerImage.js", import.meta.url),
    "utf8"
)
const updaterSource = await readFile(
    new URL("../src-tauri/src/commands/app.rs", import.meta.url),
    "utf8"
)
const tauriConfig = JSON.parse(await readFile(
    new URL("../src-tauri/tauri.conf.json", import.meta.url),
    "utf8"
))

test("renderer capabilities do not expose native store, filesystem, or shell plugins", () => {
    const permissionIds = capability.permissions.map(permission =>
        typeof permission === "string" ? permission : permission.identifier
    )

    assert.equal(permissionIds.some(id => id.startsWith("store:")), false)
    assert.equal(permissionIds.some(id => id.startsWith("fs:")), false)
    assert.equal(permissionIds.some(id => id.startsWith("shell:")), false)
    assert.equal(permissionIds.includes("core:default"), false)
    assert.equal(permissionIds.some(id => id.startsWith("core:image:")), false)
    assert.equal(permissionIds.includes("core:webview:default"), false)
    assert.equal(permissionIds.includes("fs:scope"), false)
    assert.equal(permissionIds.includes("core:window:allow-create"), false)
    assert.equal(permissionIds.includes("core:webview:allow-create-webview-window"), false)
    assert.equal(permissionIds.includes("process:allow-exit"), false)
})

test("picker screenshots accept only backend-supplied image data URLs", () => {
    assert.doesNotMatch(pickerImage, /@tauri-apps\/plugin-(?:fs|store)/)
    assert.doesNotMatch(pickerImage, /convertFileSrc|readFile/)
    assert.match(pickerImage, /startsWith\("data:image\/"\)/)
    assert.match(pickerImage, /trusted backend/)
})

test("the application omits unused privileged renderer plugins", async () => {
    const [packageJson, cargoToml, rustEntry] = await Promise.all([
        readFile(new URL("../package.json", import.meta.url), "utf8"),
        readFile(new URL("../src-tauri/Cargo.toml", import.meta.url), "utf8"),
        readFile(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8"),
    ])

    assert.doesNotMatch(packageJson, /@tauri-apps\/plugin-(?:fs|shell|store|updater|process)/)
    assert.doesNotMatch(cargoToml, /^tauri-plugin-fs\s*=/m)
    assert.doesNotMatch(cargoToml, /^tauri-plugin-process\s*=/m)
    assert.doesNotMatch(rustEntry, /tauri_plugin_fs::init/)
    assert.doesNotMatch(rustEntry, /tauri_plugin_process::init/)
})

test("native updater filesystem and execution code is absent", () => {
    assert.match(
        updaterSource,
        /https:\/\/github\.com\/JNX03\/Flowtake\/releases\/latest/
    )
    assert.match(updaterSource, /open::that\(GITHUB_RELEASES_URL\)/)
    assert.doesNotMatch(updaterSource, /fn updater_directory/)
    assert.doesNotMatch(updaterSource, /PendingUpdate/)
    assert.doesNotMatch(updaterSource, /download_update/)
    assert.doesNotMatch(updaterSource, /pending_installer_path/)
    assert.doesNotMatch(updaterSource, /launch_installer/)
})

test("production webviews cannot enable DevTools or read arbitrary asset paths", async () => {
    const cargoToml = await readFile(new URL("../src-tauri/Cargo.toml", import.meta.url), "utf8")
    const assetScope = tauriConfig.app.security.assetProtocol.scope

    assert.equal(tauriConfig.app.windows.some(window => window.devtools !== false), false)
    assert.doesNotMatch(cargoToml, /features\s*=\s*\[[^\]]*"devtools"/)
    assert.deepEqual(assetScope, [
        "$APPDATA/temp/**",
        "$VIDEO/Flowtake/**",
        "$HOME/Flowtake/**",
    ])
    assert.equal(assetScope.includes("**"), false)
})
