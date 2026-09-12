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

test("capture writer and encoder share a bounded 30-second finalization budget", async () => {
    const source = await readFile(path.join(rootDir, "src-tauri/src/commands/recording.rs"), "utf8")
    const stop = source.slice(source.indexOf("fn kill_ffmpeg("), source.indexOf("/// Force kill FFmpeg"))

    assert.match(source, /const RECORDING_FINALIZATION_TIMEOUT: std::time::Duration = std::time::Duration::from_secs\(30\);/)
    assert.match(stop, /let deadline = std::time::Instant::now\(\) \+ RECORDING_FINALIZATION_TIMEOUT;/)
    assert.match(stop, /wait_for_capture_thread\([\s\S]*deadline\.saturating_duration_since\(std::time::Instant::now\(\)\)/)
    assert.match(stop, /if std::time::Instant::now\(\) >= deadline/)
    assert.doesNotMatch(stop, /from_secs\(8\)/)
})

test("screen MP4 commits periodic fragments even before the next keyframe", async () => {
    const source = await readFile(path.join(rootDir, "src-tauri/src/commands/recording.rs"), "utf8")
    const output = source.slice(source.indexOf("fn append_recording_output_args("), source.indexOf("fn ddagrab_transfer_filter("))

    assert.match(output, /"-movflags"\.to_string\(\),\s*"\+frag_keyframe\+empty_moov"\.to_string\(\)/)
    assert.match(output, /"-frag_duration"\.to_string\(\),\s*"1000000"\.to_string\(\)/)
})

test("incomplete finalization is surfaced after cleanup and before project packaging", async () => {
    const source = await readFile(path.join(rootDir, "src-tauri/src/commands/recording.rs"), "utf8")
    const stop = source.slice(source.indexOf("async fn stop_recording_impl("), source.indexOf("pub async fn reset_recording("))
    const failure = stop.indexOf("if let Some(error) = primary_finalize_failure.or(app_layer_finalize_failure)")

    assert.match(stop, /let primary_finalize_failure = tokio::task::spawn_blocking\([\s\S]*move \|\| kill_ffmpeg\(&app\)/)
    assert.ok(failure > stop.indexOf("state.mouse_tracker.stop()"))
    assert.ok(failure > stop.indexOf("unmute_all_sessions(&app)"))
    assert.ok(failure < stop.indexOf('"Creating project..."'))
    assert.match(stop.slice(failure, stop.indexOf('"Creating project..."')), /emit_to\("main", "recording-error"[\s\S]*return Err\(error\)/)
    assert.match(source, /ending may be incomplete\. Retry Save can recover the playable portion/)
})

test("explicit recovery repairs a copy and preserves the original until validation succeeds", async () => {
    const source = await readFile(path.join(rootDir, "src-tauri/src/commands/recording.rs"), "utf8")
    const recovery = source.slice(source.indexOf("async fn recover_recording_video("), source.indexOf("fn kill_ffmpeg("))
    const stop = source.slice(source.indexOf("async fn stop_recording_impl("), source.indexOf("pub async fn reset_recording("))

    assert.match(source, /if primary_finalize_failure\.is_some\(\) \{\s*state\.lock\(\)\.unwrap\(\)\.recording_needs_recovery = true;/)
    assert.ok(stop.indexOf("primary_finalize_failure.or(app_layer_finalize_failure)") < stop.indexOf("if needs_recovery"))
    assert.match(stop, /recover_recording_video\(path, requires_system_audio\)\.await/)
    assert.ok(recovery.indexOf("probe_video_metadata(&recovered") < recovery.indexOf("commit_recovered_recording(source"))
    assert.match(source, /"\+discardcorrupt"\.to_string\(\)/)
    assert.match(source, /std::fs::rename\(source, backup\)/)
    assert.match(source, /std::fs::rename\(backup, source\)/)
    assert.doesNotMatch(recovery, /remove_file\(&?source\)/)
})
