import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import shallowEqual from "../app/shared/shallowEqual.js"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const readRepoFile = file => readFile(path.join(repoRoot, file), "utf8")

async function collectJsFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    const files = await Promise.all(entries.map(entry => {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) return collectJsFiles(fullPath)
        return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : []
    }))
    return files.flat()
}

test("worker-imported scene modules do not import react-redux", async () => {
    const sceneDir = path.join(repoRoot, "app/shared/scene")
    const sceneFiles = await collectJsFiles(sceneDir)

    for (const file of sceneFiles) {
        const source = await readFile(file, "utf8")
        assert.doesNotMatch(
            source,
            /from\s+["']react-redux["']/,
            `${path.relative(repoRoot, file)} should stay safe for preview workers`
        )
    }
})

test("worker-safe shallowEqual keeps react-redux comparison semantics", () => {
    assert.equal(shallowEqual({ a: 1 }, { a: 1 }), true)
    assert.equal(shallowEqual({ a: 1 }, { a: 2 }), false)
    assert.equal(shallowEqual({ a: Number.NaN }, { a: Number.NaN }), true)
    assert.equal(shallowEqual({ a: 0 }, { a: -0 }), false)
})

test("preview worker loads webworker adapter before scene modules", async () => {
    const source = await readRepoFile("app/shared/workers/previewWorker.js")

    assert.doesNotMatch(source, /import\s+["']pixi\.js\//)
    assert.doesNotMatch(source, /import\s+PreviewScene/)
    assert.match(source, /await import\(["']pixi\.js\/webworker["']\)/)
    assert.match(source, /await import\(["']\.\.\/scene\/PreviewScene["']\)/)
})

test("macOS recording restores cursor visibility without hiding it", async () => {
    const mouseTracker = await readRepoFile("src-tauri/src/mouse_tracker.rs")
    const recording = await readRepoFile("src-tauri/src/commands/recording.rs")

    assert.doesNotMatch(mouseTracker, /fn\s+CGDisplayHideCursor/)
    assert.match(mouseTracker, /CGDisplayShowCursor/)
    assert.match(mouseTracker, /pub fn restore_macos_cursor/)
    assert.match(recording, /restore_macos_cursor\(\)/)
})

test("macOS recording errors only report permission denial after probing TCC", async () => {
    const appCommands = await readRepoFile("src-tauri/src/commands/app.rs")
    const recording = await readRepoFile("src-tauri/src/commands/recording.rs")

    assert.match(appCommands, /pub fn macos_has_screen_recording_permission/)
    assert.match(recording, /macos_ffmpeg_stderr_is_permission_error/)
    assert.match(recording, /macos_recording_error_code_for_empty_output/)
    assert.match(recording, /macos_has_screen_recording_permission\(\)/)
    assert.match(recording, /app\.emit\("recording-error", error_code\)/)
    assert.doesNotMatch(
        recording,
        /No frames captured[\s\S]{0,500}app\.emit\("recording-error", "ScreenPermissionDenied"\)/
    )
})

test("new recording preview retries after transient permission failures", async () => {
    const source = await readRepoFile("app/windows/main/components/newRecording/NewRecording.jsx")

    assert.doesNotMatch(source, /enabled:\s*isOpen && !!previewSource && !screenPermissionDenied/)
    assert.match(source, /refetch:\s*refetchCaptureSourcePreview/)
    assert.match(source, /refetchInterval:\s*screenPermissionDenied \|\| previewUnavailable \? 5000 : 2000/)
    assert.match(source, /Enable this exact Flowtake app/)
    assert.doesNotMatch(source, /enable this app, then restart/)
})

test("recording skips bundled ffmpeg binaries that fail to launch", async () => {
    const recording = await readRepoFile("src-tauri/src/commands/recording.rs")
    const downloadScript = await readRepoFile("scripts/download-ffmpeg.sh")

    assert.match(recording, /static FFMPEG_PATH_CACHE/)
    assert.match(recording, /fn ffmpeg_binary_is_usable/)
    assert.match(recording, /-version/)
    assert.match(recording, /Skipping unusable candidate/)
    assert.doesNotMatch(
        recording,
        /if sidecar\.exists\(\) \{\s*return Some\(sidecar\);/
    )
    assert.match(downloadScript, /ffmpeg_is_usable\(\)/)
    assert.match(downloadScript, /Existing FFmpeg is unusable/)
    assert.match(downloadScript, /ffmpeg-static\/releases\/download\/b6\.0/)
    assert.doesNotMatch(downloadScript, /FFmpeg already exists at \$DEST/)
})

test("capture error toast is not GPU-specific", async () => {
    const toast = await readRepoFile("app/windows/main/components/toasts/CaptureErrorToast.jsx")
    const settings = await readRepoFile("app/windows/main/components/settings/RecorderSettings.jsx")

    assert.doesNotMatch(toast, /GPU drivers/i)
    assert.doesNotMatch(toast, /encoder issue/i)
    assert.match(toast, /problem starting screen recording/i)
    assert.doesNotMatch(settings, /GPU drivers/i)
})

test("recording output is frame-rate clamped and validated before opening editor", async () => {
    const recording = await readRepoFile("src-tauri/src/commands/recording.rs")

    assert.match(recording, /"-r"\.to_string\(\)/)
    assert.match(recording, /"30"\.to_string\(\)/)
    assert.match(recording, /fn recording_video_is_readable/)
    assert.match(recording, /get_video_duration_ms\(app, video_path\)/)
    assert.match(recording, /get_video_dimensions\(video_path\)/)
    assert.match(recording, /Recording video exists but is not readable/)
    assert.match(recording, /Frames were captured, but FFmpeg did not produce a readable MP4/)
})

test("preview scene falls back when worker font asset loading fails", async () => {
    const source = await readRepoFile("app/shared/scene/Scene.js")

    assert.match(source, /const SUBTITLE_FONT_FALLBACK = "Arial, Helvetica, sans-serif"/)
    assert.match(source, /async loadSubtitleFontFamily\(\)/)
    assert.match(source, /await Assets\.load\("roboto"\)/)
    assert.match(source, /catch \(e\)/)
    assert.match(source, /return SUBTITLE_FONT_FALLBACK/)
    assert.match(source, /new SubtitleAnimator\(this\.subtitleContainer, await this\.loadSubtitleFontFamily\(\)\)/)
})
