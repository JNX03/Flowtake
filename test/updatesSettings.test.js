import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [
    settingsSource,
    bridgeSource,
    updaterSource,
    tauriLibSource,
    appSource,
    toastsSource,
    helpersSource,
    tutorialSource,
    capabilitySource,
] = await Promise.all([
    readFile(
        new URL("../app/windows/main/components/settings/UpdatesSettings.jsx", import.meta.url),
        "utf8"
    ),
    readFile(new URL("../app/shared/tauriBridge.js", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/src/commands/app.rs", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/toasts/Toasts.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/shared/helpers.js", import.meta.url), "utf8"),
    readFile(
        new URL("../app/windows/main/components/tutorial/TutorialProvider.jsx", import.meta.url),
        "utf8"
    ),
    readFile(new URL("../src-tauri/capabilities/default.json", import.meta.url), "utf8"),
])

test("updates settings is metadata-only and opens the official release action", () => {
    assert.match(settingsSource, /invoke\("check-for-updates"\)/)
    assert.match(settingsSource, /invoke\("install-update"\)/)
    assert.match(settingsSource, /Open Official GitHub Release/)
    assert.match(settingsSource, /will not download or launch installers/)

    for (const forbidden of [
        "download-update",
        "launch-installer",
        "get-pending-installer",
        "update-download-progress",
        "@tauri-apps/plugin-process",
        "exit(0)",
    ]) {
        assert.ok(!settingsSource.includes(forbidden), `${forbidden} must stay out of update settings`)
    }
})

test("only no-argument manual update commands cross the renderer bridge", () => {
    assert.match(bridgeSource, /'check-for-updates': 'check_for_updates'/)
    assert.match(bridgeSource, /'install-update': 'install_update'/)
    assert.match(bridgeSource, /'install_update': \(\) => \(\{\}\)/)

    for (const forbidden of [
        "download_update",
        "launch_installer",
        "pending_installer_path",
        "download-update",
        "launch-installer",
        "get-pending-installer",
    ]) {
        assert.ok(!bridgeSource.includes(forbidden), `${forbidden} must not be bridged`)
        assert.ok(!tauriLibSource.includes(`commands::app::${forbidden}`), `${forbidden} must not be registered`)
    }
})

test("backend manual updater owns the exact official HTTPS destination", () => {
    assert.match(
        updaterSource,
        /const GITHUB_RELEASES_URL: &str = "https:\/\/github\.com\/JNX03\/Flowtake\/releases\/latest"/
    )
    assert.match(updaterSource, /pub async fn check_for_updates\(app: AppHandle\)/)
    assert.match(updaterSource, /pub async fn install_update\(\) -> AppResult<\(\)>/)
    assert.match(updaterSource, /open::that\(GITHUB_RELEASES_URL\)/)
    assert.doesNotMatch(updaterSource, /download_url/)
    assert.doesNotMatch(updaterSource, /pub async fn download_update/)
    assert.doesNotMatch(updaterSource, /pub async fn pending_installer_path/)
    assert.doesNotMatch(updaterSource, /pub async fn launch_installer/)
})

test("pending-installer and automatic-exit state wiring is removed", () => {
    for (const source of [appSource, toastsSource, helpersSource, tutorialSource]) {
        assert.doesNotMatch(source, /TOAST_UPDATE_READY/)
        assert.doesNotMatch(source, /lastInstallerLaunchedAt/)
        assert.doesNotMatch(source, /get-pending-installer/)
        assert.doesNotMatch(source, /launch-installer/)
    }

    const capabilities = JSON.parse(capabilitySource).permissions
    assert.ok(!capabilities.includes("process:allow-exit"))
})
