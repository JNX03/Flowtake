import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import test from "node:test"

const readRepoFile = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const repoFile = path => new URL(`../${path}`, import.meta.url)

const [tauriConfig, macConfig, notices, readme, websiteNotices, appSource, commandSource, setupSource] = await Promise.all([
    readRepoFile("src-tauri/tauri.conf.json").then(JSON.parse),
    readRepoFile("src-tauri/tauri.macos.conf.json").then(JSON.parse),
    readRepoFile("src-tauri/resources/THIRD_PARTY_NOTICES.txt"),
    readRepoFile("README.md"),
    readRepoFile("website/THIRD_PARTY_NOTICES.md"),
    readRepoFile("src-tauri/src/commands/app.rs"),
    readRepoFile("src-tauri/src/commands/mod.rs"),
    readRepoFile("app/windows/main/components/setup/PermissionsStep.jsx"),
])

test("desktop packages only the system-dependency notice and no FFmpeg sidecar", async () => {
    assert.deepEqual(tauriConfig.bundle.resources, ["resources/THIRD_PARTY_NOTICES.txt"])
    assert.equal(tauriConfig.bundle.externalBin, undefined)
    assert.deepEqual(macConfig.bundle.resources, [
        "resources/THIRD_PARTY_NOTICES.txt",
        "binaries/flowtake-macos-capture-*",
    ])
    assert.equal(macConfig.bundle.resources.some(resource => /ffmpeg/i.test(resource)), false)

    for (const path of [
        "resources/ffmpeg.exe",
        "src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe",
        "src-tauri/binaries/ffmpeg-aarch64-apple-darwin",
        "src-tauri/binaries/ffmpeg-x86_64-apple-darwin",
        "src-tauri/binaries/ffmpeg-universal-apple-darwin",
    ]) {
        await assert.rejects(access(repoFile(path)), undefined, `${path} must not be distributed`)
    }
})

test("notices distinguish MIT app code from separately installed FFmpeg", () => {
    assert.match(notices, /Flowtake application code is licensed under the MIT License/)
    assert.match(notices, /do not contain or redistribute an FFmpeg executable/)
    assert.match(notices, /installed separately/)
    assert.match(notices, /https:\/\/ffmpeg\.org\/legal\.html/)

    for (const copy of [readme, websiteNotices]) {
        assert.match(copy, /application\s+code/i)
        assert.match(copy, /FFmpeg/i)
        assert.match(copy, /separately\s+installed|installed\s+separately/i)
    }
})

test("dependency checks execute-probe FFmpeg and offer fixed package-manager commands", () => {
    assert.match(appSource, /recording::find_ffmpeg_path\(\)\.is_some\(\)/)
    assert.doesNotMatch(appSource, /sidecar\("ffmpeg"\)\.is_ok\(\)/)
    assert.match(appSource, /winget install --id Gyan\.FFmpeg --exact --source winget/)
    assert.match(appSource, /choco install ffmpeg --yes/)
    assert.match(appSource, /scoop install ffmpeg/)
    assert.match(appSource, /powershell\.exe/)
    assert.doesNotMatch(appSource, /All dependencies are bundled on Windows/)
    assert.match(setupSource, /invoke\("install-dependencies"\)/)
    assert.match(setupSource, /Install required tools/)
    assert.match(setupSource, /Manual FFmpeg setup/)
    assert.match(setupSource, /https:\/\/ffmpeg\.org\/download\.html/)
})

test("FFmpeg commands resolve the probed system path instead of a packaged sidecar", () => {
    assert.match(commandSource, /recording::find_ffmpeg_path\(\)/)
    assert.match(commandSource, /shell\(\)\.command\(path\.to_string_lossy\(\)\.into_owned\(\)\)/)
    assert.doesNotMatch(commandSource, /\.sidecar\("ffmpeg"\)/)
    assert.doesNotMatch(commandSource, /ffmpeg-system/)
})
