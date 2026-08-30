import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..")

test("macOS window capture uses FFmpeg's graceful shutdown path", async () => {
    const source = await readFile(path.join(rootDir, "src-tauri/src/commands/recording.rs"), "utf8")

    assert.match(
        source,
        /let uses_stdin_pipe = is_window_capture && cfg!\(target_os = "windows"\);/,
        "only the Windows PrintWindow pipe should use the stdin-pipe shutdown branch"
    )
    assert.match(
        source,
        /if !uses_stdin_pipe \{[\s\S]*stdin\.write_all\(b"q\\n"\)/,
        "macOS window capture should still send q to FFmpeg so MP4 files finalize"
    )
})

test("slow Windows window capture keeps wall-clock timestamps", async () => {
    const source = await readFile(path.join(rootDir, "src-tauri/src/commands/recording.rs"), "utf8")

    assert.match(
        source,
        /fn window_capture_input_args[\s\S]*"-use_wallclock_as_timestamps"[\s\S]*"1"[\s\S]*"-i"/,
        "PrintWindow frames must use arrival timestamps before the rawvideo input is opened"
    )
    assert.match(
        source,
        /ffmpeg_args = window_capture_input_args\(w, h, fps\);/,
        "Windows window capture must use the duration-safe input arguments"
    )
})
