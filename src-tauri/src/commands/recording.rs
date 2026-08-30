use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde_json::Value;
use std::sync::atomic::Ordering;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_store::StoreExt;

static FFMPEG_PATH_CACHE: OnceLock<Option<std::path::PathBuf>> = OnceLock::new();

#[tauri::command]
pub async fn get_camera_mic_config(app: AppHandle) -> AppResult<Value> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    // Return the config that was stored during init_recording
    Ok(state
        .camera_mic_config
        .clone()
        .unwrap_or(serde_json::json!({
            "cameraDeviceId": null,
            "microphoneDeviceId": null
        })))
}

/// Find the FFmpeg binary path (for std::process::Command usage)
pub fn find_ffmpeg_path() -> Option<std::path::PathBuf> {
    FFMPEG_PATH_CACHE.get_or_init(resolve_ffmpeg_path).clone()
}

fn resolve_ffmpeg_path() -> Option<std::path::PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;

    // Platform-specific sidecar names that Tauri generates
    let sidecar_names = platform_ffmpeg_sidecar_names();

    for name in &sidecar_names {
        let sidecar = dir.join(name);
        if ffmpeg_binary_is_usable(&sidecar) {
            return Some(sidecar);
        }
        // Try binaries subdirectory (dev mode)
        let binaries = dir.join("binaries").join(name);
        if ffmpeg_binary_is_usable(&binaries) {
            return Some(binaries);
        }
    }

    // Try plain name (with extension on Windows)
    let plain_name = if cfg!(target_os = "windows") {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    let plain = dir.join(plain_name);
    if ffmpeg_binary_is_usable(&plain) {
        return Some(plain);
    }

    // Fallback: check well-known install locations (needed for macOS .app bundles
    // where PATH doesn't include Homebrew paths)
    #[cfg(target_os = "macos")]
    {
        for path in [
            "/opt/homebrew/bin/ffmpeg", // Apple Silicon Homebrew
            "/usr/local/bin/ffmpeg",    // Intel Homebrew
        ] {
            let p = std::path::PathBuf::from(path);
            if ffmpeg_binary_is_usable(&p) {
                return Some(p);
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        for path in [
            "/usr/bin/ffmpeg",
            "/usr/local/bin/ffmpeg",
            "/snap/bin/ffmpeg",
        ] {
            let p = std::path::PathBuf::from(path);
            if ffmpeg_binary_is_usable(&p) {
                return Some(p);
            }
        }
    }

    // Fallback: check if ffmpeg is on PATH
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = std::process::Command::new("which").arg("ffmpeg").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    let p = std::path::PathBuf::from(path);
                    if ffmpeg_binary_is_usable(&p) {
                        return Some(p);
                    }
                }
            }
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = std::process::Command::new("where").arg("ffmpeg").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                // `where` may return multiple lines; take the first
                if let Some(first) = path.lines().next() {
                    if !first.is_empty() {
                        let p = std::path::PathBuf::from(first);
                        if ffmpeg_binary_is_usable(&p) {
                            return Some(p);
                        }
                    }
                }
            }
        }
    }

    None
}

fn ffmpeg_binary_is_usable(path: &std::path::Path) -> bool {
    if !path.exists() {
        return false;
    }

    let output = std::process::Command::new(path)
        .args(["-hide_banner", "-version"])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .output();

    match output {
        Ok(output) if output.status.success() => true,
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let reason = stderr.lines().next().unwrap_or("unknown error");
            log::warn!(
                "[ffmpeg] Skipping unusable candidate {:?}: {}",
                path,
                reason
            );
            false
        }
        Err(err) => {
            log::warn!("[ffmpeg] Skipping unusable candidate {:?}: {}", path, err);
            false
        }
    }
}

/// Get platform-specific FFmpeg sidecar binary names
fn platform_ffmpeg_sidecar_names() -> Vec<String> {
    let mut names = Vec::new();

    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        names.push("ffmpeg-x86_64-pc-windows-msvc.exe".to_string());
    }
    #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
    {
        names.push("ffmpeg-aarch64-pc-windows-msvc.exe".to_string());
    }

    // macOS universal binary (produced by CI via lipo) must be checked first
    #[cfg(target_os = "macos")]
    {
        names.push("ffmpeg-universal-apple-darwin".to_string());
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        names.push("ffmpeg-x86_64-apple-darwin".to_string());
    }
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        names.push("ffmpeg-aarch64-apple-darwin".to_string());
    }

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        names.push("ffmpeg-x86_64-unknown-linux-gnu".to_string());
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        names.push("ffmpeg-aarch64-unknown-linux-gnu".to_string());
    }

    // Universal fallback name
    if cfg!(target_os = "windows") {
        names.push("ffmpeg.exe".to_string());
    } else {
        names.push("ffmpeg".to_string());
    }

    names
}

#[cfg(target_os = "macos")]
fn macos_recording_error_code_for_empty_output() -> &'static str {
    if crate::commands::app::macos_has_screen_recording_permission() {
        "CaptureError"
    } else {
        "ScreenPermissionDenied"
    }
}

#[cfg(target_os = "macos")]
fn macos_ffmpeg_stderr_is_permission_error(msg: &str) -> bool {
    let lower = msg.to_ascii_lowercase();
    let looks_like_permission_error = lower.contains("permission denied")
        || lower.contains("not granted")
        || lower.contains("not authorized")
        || lower.contains("operation not permitted")
        || lower.contains("screen recording")
        || lower.contains("no screens found")
        || lower.contains("input/output error");

    looks_like_permission_error && !crate::commands::app::macos_has_screen_recording_permission()
}

fn ffmpeg_stderr_is_capture_error(msg: &str) -> bool {
    let lower = msg.to_ascii_lowercase();
    lower.contains("could not find video device")
        || lower.contains("unable to open device")
        || lower.contains("no screens found")
        || lower.contains("input/output error")
}

fn handle_ffmpeg_diagnostic(app: &AppHandle, message: &str) {
    let message = message.trim();
    if message.is_empty() {
        return;
    }

    log::debug!("[FFmpeg] {}", message);
    #[cfg(target_os = "macos")]
    let is_permission_error = macos_ffmpeg_stderr_is_permission_error(message);
    #[cfg(not(target_os = "macos"))]
    let is_permission_error = {
        let lower = message.to_ascii_lowercase();
        lower.contains("permission denied") || lower.contains("not granted")
    };

    if is_permission_error {
        app.emit("recording-error", "ScreenPermissionDenied").ok();
    } else if ffmpeg_stderr_is_capture_error(message) {
        app.emit("recording-error", "CaptureError").ok();
    }
}

/// Drain FFmpeg stderr for the lifetime of the process. FFmpeg progress uses
/// carriage returns instead of newlines, so `BufRead::lines` can retain a very
/// large buffer during long recordings and eventually block the child process.
fn spawn_ffmpeg_stderr_reader(stderr: std::process::ChildStderr, app: AppHandle) {
    std::thread::spawn(move || {
        use std::io::Read;

        let mut stderr = stderr;
        let mut chunk = [0_u8; 4096];
        let mut pending = Vec::with_capacity(4096);
        loop {
            let read = match stderr.read(&mut chunk) {
                Ok(0) => break,
                Ok(read) => read,
                Err(error) => {
                    log::debug!("[FFmpeg] stderr reader stopped: {}", error);
                    break;
                }
            };

            for byte in &chunk[..read] {
                if *byte == b'\n' || *byte == b'\r' {
                    if !pending.is_empty() {
                        handle_ffmpeg_diagnostic(&app, &String::from_utf8_lossy(&pending));
                        pending.clear();
                    }
                } else if pending.len() < 32 * 1024 {
                    pending.push(*byte);
                } else {
                    // A diagnostic line should never be this large. Flush the
                    // bounded prefix so malformed output cannot grow forever.
                    handle_ffmpeg_diagnostic(&app, &String::from_utf8_lossy(&pending));
                    pending.clear();
                }
            }
        }

        if !pending.is_empty() {
            handle_ffmpeg_diagnostic(&app, &String::from_utf8_lossy(&pending));
        }
    });
}

fn verify_capture_process_start(
    process: &mut std::process::Child,
    startup_window: std::time::Duration,
) -> AppResult<()> {
    let deadline = std::time::Instant::now() + startup_window;
    loop {
        match process.try_wait() {
            Ok(Some(status)) => {
                return Err(AppError::General(format!(
                    "FFmpeg exited during capture startup with {}",
                    status
                )))
            }
            Ok(None) if std::time::Instant::now() < deadline => {
                std::thread::sleep(std::time::Duration::from_millis(20));
            }
            Ok(None) => return Ok(()),
            Err(error) => {
                process.kill().ok();
                process.wait().ok();
                return Err(AppError::General(format!(
                    "Could not verify FFmpeg capture startup: {}",
                    error
                )))
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn spawn_macos_capture_stderr_reader(stderr: std::process::ChildStderr, app: AppHandle) {
    std::thread::spawn(move || {
        use std::io::BufRead;

        let reader = std::io::BufReader::new(stderr);
        for line in reader.lines() {
            match line {
                Ok(line) if !line.trim().is_empty() => {
                    log::warn!("[macos-capture] {}", line.trim());
                    if line.contains("Native recording failed") {
                        app.emit("recording-error", "CaptureError").ok();
                    }
                }
                Ok(_) => {}
                Err(error) => {
                    log::debug!("[macos-capture] stderr reader stopped: {}", error);
                    break;
                }
            }
        }
    });
}

#[cfg(target_os = "macos")]
fn spawn_macos_capture(
    app: &AppHandle,
    args: &[String],
    ready_file: &std::path::Path,
) -> AppResult<std::process::Child> {
    use std::process::{Command, Stdio};

    let helper = crate::macos_capture::find_helper(app).ok_or_else(|| {
        AppError::General("ScreenCaptureKit helper is not installed".to_string())
    })?;

    if ready_file.exists() {
        std::fs::remove_file(ready_file).map_err(|error| {
            AppError::General(format!(
                "Could not clear stale ScreenCaptureKit handshake: {}",
                error
            ))
        })?;
    }

    log::info!(
        "[macos-capture] Starting {:?} with native ScreenCaptureKit",
        helper
    );
    let mut process = Command::new(&helper)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            AppError::General(format!(
                "Could not start ScreenCaptureKit helper: {}",
                error
            ))
        })?;
    crate::process_containment::contain_owned_child(&process, "ScreenCaptureKit helper");

    if let Some(stderr) = process.stderr.take() {
        spawn_macos_capture_stderr_reader(stderr, app.clone());
    }

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(6);
    loop {
        if ready_file.is_file() {
            std::fs::remove_file(ready_file).ok();
            return Ok(process);
        }

        match process.try_wait() {
            Ok(Some(status)) => {
                return Err(AppError::General(format!(
                    "ScreenCaptureKit helper exited during startup with {}",
                    status
                )));
            }
            Ok(None) => {}
            Err(error) => {
                process.kill().ok();
                process.wait().ok();
                return Err(AppError::General(format!(
                    "Could not verify ScreenCaptureKit startup: {}",
                    error
                )));
            }
        }

        if std::time::Instant::now() >= deadline {
            process.kill().ok();
            process.wait().ok();
            return Err(AppError::General(
                "ScreenCaptureKit helper did not become ready within 6 seconds".to_string(),
            ));
        }
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct RecordingPreferences {
    fps: u32,
    encoder: String,
    capturer: String,
    quality: String,
}

fn normalize_recording_quality(quality: Option<&str>) -> &'static str {
    match quality.unwrap_or_default().to_ascii_lowercase().as_str() {
        "performance" => "performance",
        "quality" => "quality",
        _ => "balanced",
    }
}

async fn load_recording_preferences(
    app: &AppHandle,
    requires_system_audio: bool,
) -> AppResult<RecordingPreferences> {
    let ffmpeg = find_ffmpeg_path()
        .ok_or_else(|| AppError::General("FFmpeg binary not found".to_string()))?;
    let store = app
        .store("store.json")
        .map_err(|error| AppError::General(error.to_string()))?;

    let fps = match store.get("screenFps").and_then(|value| value.as_u64()) {
        Some(60) => 60,
        _ => 30,
    };
    let stored_quality = store
        .get("recordingQuality")
        .and_then(|value| value.as_str().map(str::to_owned));
    let quality = normalize_recording_quality(stored_quality.as_deref());
    let requested_encoder = store
        .get("encoder")
        .and_then(|value| value.as_str().map(str::to_owned));
    let automatic_encoder = store
        .get("encoderMode")
        .and_then(|value| value.as_str().map(|mode| mode != "manual"))
        .unwrap_or(true);
    let stored_capturer = store
        .get("capturer")
        .and_then(|value| value.as_str().map(str::to_owned));
    let automatic_capturer = store
        .get("capturerMode")
        .and_then(|value| value.as_str().map(|mode| mode != "manual"))
        .unwrap_or(true);
    let capturer = crate::commands::encoding::resolve_capturer(
        app,
        if automatic_capturer {
            None
        } else {
            stored_capturer.as_deref()
        },
        requires_system_audio,
    )
    .await;

    let ffmpeg_for_probe = ffmpeg.clone();
    let requested_for_probe = if automatic_encoder {
        None
    } else {
        requested_encoder.clone()
    };
    let encoder = tokio::task::spawn_blocking(move || {
        crate::commands::encoding::resolve_recording_encoder(
            &ffmpeg_for_probe,
            requested_for_probe.as_deref(),
            false,
        )
    })
    .await
    .map_err(|error| AppError::General(format!("Encoder probe failed: {}", error)))?
    .ok_or_else(|| AppError::General("No usable H.264 recording encoder was found".to_string()))?;

    let preferences = RecordingPreferences {
        fps,
        encoder,
        capturer: capturer.to_string(),
        quality: quality.to_string(),
    };

    let mut changed = false;
    if requested_encoder.as_deref() != Some(preferences.encoder.as_str()) {
        store.set("encoder", Value::String(preferences.encoder.clone()));
        changed = true;
    }
    if stored_capturer.as_deref() != Some(preferences.capturer.as_str()) {
        store.set("capturer", Value::String(preferences.capturer.clone()));
        changed = true;
    }
    if store.get("screenFps").and_then(|value| value.as_u64()) != Some(fps as u64) {
        store.set("screenFps", Value::from(fps));
        changed = true;
    }
    if stored_quality.as_deref() != Some(preferences.quality.as_str()) {
        store.set(
            "recordingQuality",
            Value::String(preferences.quality.clone()),
        );
        changed = true;
    }
    if changed {
        store
            .save()
            .map_err(|error| AppError::General(error.to_string()))?;
    }

    Ok(preferences)
}

fn target_video_bitrate_kbps(width: u32, height: u32, fps: u32, quality: &str) -> u32 {
    let pixels = (width.max(16) as f64) * (height.max(16) as f64);
    let resolution_scale = pixels / (1920.0 * 1080.0);
    let frame_rate_scale = if fps >= 60 { 1.5 } else { 1.0 };
    let quality_scale = match quality {
        "performance" => 0.7,
        "quality" => 1.45,
        _ => 1.0,
    };

    (9000.0 * resolution_scale * frame_rate_scale * quality_scale)
        .round()
        .clamp(3_000.0, 60_000.0) as u32
}

fn estimated_recording_dimensions(
    source: &Value,
    source_type: &str,
    fallback_width: u32,
    fallback_height: u32,
) -> (u32, u32) {
    let positive_u32 = |key: &str| {
        source
            .get(key)
            .and_then(|value| value.as_u64())
            .and_then(|value| u32::try_from(value).ok())
            .filter(|value| *value > 0)
    };

    let (width, height) = match source_type {
        "window" => (
            positive_u32("width").unwrap_or(fallback_width),
            positive_u32("height").unwrap_or(fallback_height),
        ),
        "area" => {
            let width_percent = source
                .get("width")
                .and_then(|value| value.as_f64())
                .unwrap_or(100.0)
                .clamp(1.0, 100.0);
            let height_percent = source
                .get("height")
                .and_then(|value| value.as_f64())
                .unwrap_or(100.0)
                .clamp(1.0, 100.0);
            (
                ((fallback_width as f64) * width_percent / 100.0).round() as u32,
                ((fallback_height as f64) * height_percent / 100.0).round() as u32,
            )
        }
        _ => (
            positive_u32("physicalWidth")
                .or_else(|| positive_u32("monitorWidth"))
                .unwrap_or(fallback_width),
            positive_u32("physicalHeight")
                .or_else(|| positive_u32("monitorHeight"))
                .unwrap_or(fallback_height),
        ),
    };

    // Every supported H.264 path requires even dimensions.
    ((width.max(16) & !1), (height.max(16) & !1))
}

#[cfg(target_os = "macos")]
struct MacCaptureArgumentConfig<'a> {
    source_type: &'a str,
    output_path: &'a str,
    ready_file_path: &'a str,
    fps: u32,
    width: u32,
    height: u32,
    quality: &'a str,
    captures_system_audio: bool,
    excluded_process_id: Option<u32>,
}

#[cfg(target_os = "macos")]
fn macos_native_capture_arguments(
    source: &Value,
    config: MacCaptureArgumentConfig<'_>,
) -> Vec<String> {
    let MacCaptureArgumentConfig {
        source_type,
        output_path,
        ready_file_path,
        fps,
        width,
        height,
        quality,
        captures_system_audio,
        excluded_process_id,
    } = config;
    let mut args = vec![
        "record".to_string(),
        "--output".to_string(),
        output_path.to_string(),
        "--ready-file".to_string(),
        ready_file_path.to_string(),
        "--source-type".to_string(),
        source_type.to_string(),
        "--display-index".to_string(),
        source
            .get("monitorIndex")
            .and_then(Value::as_i64)
            .unwrap_or(0)
            .max(0)
            .to_string(),
        "--width".to_string(),
        width.to_string(),
        "--height".to_string(),
        height.to_string(),
        "--fps".to_string(),
        fps.to_string(),
        "--bitrate".to_string(),
        target_video_bitrate_kbps(width, height, fps, quality)
            .saturating_mul(1_000)
            .to_string(),
    ];

    if let Some(process_id) = excluded_process_id {
        args.extend(["--exclude-process-id".to_string(), process_id.to_string()]);
    }

    if source_type == "window" {
        args.extend([
            "--window-id".to_string(),
            source
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or("0")
                .to_string(),
        ]);
    } else if source_type == "area" {
        for (option, key, default) in [
            ("--x-percent", "x", 0.0),
            ("--y-percent", "y", 0.0),
            ("--width-percent", "width", 100.0),
            ("--height-percent", "height", 100.0),
        ] {
            args.extend([
                option.to_string(),
                source
                    .get(key)
                    .and_then(Value::as_f64)
                    .unwrap_or(default)
                    .to_string(),
            ]);
        }
    }

    if captures_system_audio {
        args.push("--audio".to_string());
    }
    args
}

fn window_capture_input_args(width: i64, height: i64, fps: u32) -> Vec<String> {
    vec![
        "-y".to_string(),
        // PrintWindow can take longer than the requested frame interval,
        // especially for large or GPU-heavy windows. Rawvideo otherwise gives
        // every arriving frame a synthetic 1/fps timestamp, which compresses
        // the recording and drops the real-world tail in the editor. Preserve
        // arrival time so FFmpeg duplicates frames as needed for the CFR
        // output while keeping the complete wall-clock duration.
        "-use_wallclock_as_timestamps".to_string(),
        "1".to_string(),
        "-f".to_string(),
        "rawvideo".to_string(),
        "-pixel_format".to_string(),
        "bgra".to_string(),
        "-video_size".to_string(),
        format!("{}x{}", width, height),
        "-framerate".to_string(),
        fps.to_string(),
        "-i".to_string(),
        "pipe:0".to_string(),
    ]
}

fn recording_video_output_args(
    encoder: &str,
    fps: u32,
    width: u32,
    height: u32,
    quality: &str,
    qsv_zero_copy: bool,
) -> Vec<String> {
    let mut args = vec!["-c:v".to_string(), encoder.to_string()];
    let bitrate = target_video_bitrate_kbps(width, height, fps, quality);
    let max_rate = ((bitrate as f64) * 1.25).round() as u32;
    let buffer_size = bitrate.saturating_mul(2);

    match encoder {
        "libx264" => {
            let (crf, preset) = match quality {
                "performance" => ("28", "ultrafast"),
                "quality" => ("20", "veryfast"),
                _ => ("24", "superfast"),
            };
            args.extend([
                "-crf".to_string(),
                crf.to_string(),
                "-preset".to_string(),
                preset.to_string(),
            ]);
        }
        "h264_videotoolbox" => args.extend([
            "-b:v".to_string(),
            format!("{}k", bitrate),
            "-maxrate".to_string(),
            format!("{}k", max_rate),
            "-bufsize".to_string(),
            format!("{}k", buffer_size),
            "-allow_sw".to_string(),
            "1".to_string(),
            "-realtime".to_string(),
            "1".to_string(),
        ]),
        "h264_qsv" => {
            let (preset, async_depth) = match quality {
                "performance" => ("veryfast", "1"),
                "quality" => ("medium", "2"),
                _ => ("veryfast", "2"),
            };
            args.extend([
                "-b:v".to_string(),
                format!("{}k", bitrate),
                "-maxrate".to_string(),
                format!("{}k", max_rate),
                "-bufsize".to_string(),
                format!("{}k", buffer_size),
                "-preset".to_string(),
                preset.to_string(),
                "-async_depth".to_string(),
                async_depth.to_string(),
            ]);
            if quality == "performance" {
                args.extend(["-bf".to_string(), "0".to_string()]);
            }
        }
        _ => args.extend([
            "-b:v".to_string(),
            format!("{}k", bitrate),
            "-maxrate".to_string(),
            format!("{}k", max_rate),
            "-bufsize".to_string(),
            format!("{}k", buffer_size),
        ]),
    }

    if let Some(pixel_format) = recording_pixel_format(encoder, qsv_zero_copy) {
        args.extend(["-pix_fmt".to_string(), pixel_format.to_string()]);
    }
    args.extend(["-r".to_string(), fps.to_string()]);
    args
}

fn recording_pixel_format(encoder: &str, qsv_zero_copy: bool) -> Option<&'static str> {
    match encoder {
        "libx264" => Some("yuv420p"),
        "h264_videotoolbox" => Some("nv12"),
        // The mapped D3D11 path must remain a QSV hardware surface. GDI and
        // other system-memory inputs must keep negotiating NV12 themselves.
        "h264_qsv" if qsv_zero_copy => Some("qsv"),
        "h264_qsv" => None,
        // NVENC/AMF may receive D3D11 hardware frames directly. Forcing a
        // software pixel format there makes FFmpeg insert an invalid transfer.
        "h264_nvenc" | "h264_amf" => None,
        _ => Some("yuv420p"),
    }
}

/// Append output-only options after every input. FFmpeg applies options to the
/// next file, so placing filters before the optional audio input makes `-vf`
/// target that input and causes startup to fail.
struct RecordingOutputConfig<'a> {
    video_filters: &'a [String],
    encoder: &'a str,
    fps: u32,
    width: u32,
    height: u32,
    quality: &'a str,
    has_system_audio: bool,
    stop_on_video_eof: bool,
}

fn append_recording_output_args(
    args: &mut Vec<String>,
    config: RecordingOutputConfig<'_>,
) {
    let RecordingOutputConfig {
        video_filters,
        encoder,
        fps,
        width,
        height,
        quality,
        has_system_audio,
        stop_on_video_eof,
    } = config;

    let qsv_zero_copy = encoder == "h264_qsv"
        && video_filters
            .iter()
            .any(|filter| filter == "hwmap=derive_device=qsv:mode=read+write+direct");

    if !video_filters.is_empty() {
        args.extend(["-vf".to_string(), video_filters.join(",")]);
    }

    args.extend(["-map".to_string(), "0:v:0".to_string()]);
    if has_system_audio {
        args.extend([
            "-map".to_string(),
            "1:a:0".to_string(),
            "-af".to_string(),
            if stop_on_video_eof {
                "aresample=async=1000:first_pts=0,apad".to_string()
            } else {
                "aresample=async=1000:first_pts=0".to_string()
            },
        ]);
    }

    args.extend(recording_video_output_args(
        encoder,
        fps,
        width,
        height,
        quality,
        qsv_zero_copy,
    ));
    if has_system_audio {
        let audio_bitrate = match quality {
            "performance" => "128k",
            "quality" => "256k",
            _ => "192k",
        };
        args.extend([
            "-c:a".to_string(),
            "aac".to_string(),
            "-b:a".to_string(),
            audio_bitrate.to_string(),
            "-ar".to_string(),
            "48000".to_string(),
            "-ac".to_string(),
            "2".to_string(),
        ]);
        if stop_on_video_eof {
            args.push("-shortest".to_string());
        }
    } else {
        args.push("-an".to_string());
    }
}

#[cfg(target_os = "windows")]
fn ddagrab_transfer_filter(encoder: &str) -> Option<&'static str> {
    match encoder {
        "h264_nvenc" | "h264_amf" => None,
        // Keep DXGI frames in video memory. This avoids a full-resolution BGRA
        // download followed by another QSV upload for every frame.
        "h264_qsv" => Some("hwmap=derive_device=qsv:mode=read+write+direct"),
        _ => Some("hwdownload,format=bgra"),
    }
}

/// Detect the avfoundation device index for screen capture on macOS.
/// Camera devices come first (e.g. [0] FaceTime HD Camera), then screens (e.g. [1] Capture screen 0).
/// Returns the device index for the requested monitor, falling back to first screen device.
#[cfg(target_os = "macos")]
pub(crate) fn macos_screen_device_index(monitor_index: i64) -> i64 {
    if let Some(ffmpeg) = find_ffmpeg_path() {
        if let Ok(output) = std::process::Command::new(&ffmpeg)
            .args(["-f", "avfoundation", "-list_devices", "true", "-i", ""])
            .stderr(std::process::Stdio::piped())
            .stdout(std::process::Stdio::null())
            .output()
        {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Find "Capture screen" devices
            // Lines: [AVFoundation indev @ 0x...] [1] Capture screen 0
            let mut screen_devices: Vec<i64> = Vec::new();
            for line in stderr.lines() {
                if line.contains("Capture screen") {
                    // Extract device index: find "] [N] Capture" pattern
                    if let Some(cap_pos) = line.find("] Capture screen") {
                        // Look backwards for the opening bracket of the device index
                        let before = &line[..cap_pos];
                        if let Some(bracket_pos) = before.rfind('[') {
                            let idx_str = &before[bracket_pos + 1..];
                            if let Ok(idx) = idx_str.trim().parse::<i64>() {
                                screen_devices.push(idx);
                            }
                        }
                    }
                }
            }
            if !screen_devices.is_empty() {
                let idx = if (monitor_index as usize) < screen_devices.len() {
                    screen_devices[monitor_index as usize]
                } else {
                    screen_devices[0]
                };
                log::info!(
                    "[avfoundation] Screen device index {} for monitor {} (found {} screens)",
                    idx,
                    monitor_index,
                    screen_devices.len()
                );
                return idx;
            }
        }
    }
    log::warn!("[avfoundation] Could not detect screen device index, defaulting to 0");
    0
}

/// Capture a single window frame using PrintWindow API.
/// Writes raw BGRA pixel data into the provided buffer. Only the window's own content is captured,
/// excluding any overlapping windows (DWM composited).
/// Returns true on success, false on failure (buffer is zeroed on failure).
#[cfg(target_os = "windows")]
fn capture_window_frame(hwnd_raw: isize, width: i32, height: i32, buffer: &mut [u8]) -> bool {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::*;
    use windows::Win32::Storage::Xps::{PrintWindow, PRINT_WINDOW_FLAGS};

    unsafe {
        let hwnd = HWND(hwnd_raw as *mut _);
        let hdc_window = GetDC(Some(hwnd));
        if hdc_window.is_invalid() {
            buffer.fill(0);
            return false;
        }

        let hdc_mem = CreateCompatibleDC(Some(hdc_window));
        let hbmp = CreateCompatibleBitmap(hdc_window, width, height);
        let old_obj = SelectObject(hdc_mem, hbmp.into());

        // PW_RENDERFULLCONTENT = 2 - captures full content including DirectX/Aero effects
        let success = PrintWindow(hwnd, hdc_mem, PRINT_WINDOW_FLAGS(2));

        if !success.as_bool() {
            // Fallback to BitBlt from window DC (works for most GDI windows)
            let _ = BitBlt(
                hdc_mem,
                0,
                0,
                width,
                height,
                Some(hdc_window),
                0,
                0,
                SRCCOPY,
            );
        }

        // Extract bitmap data as BGRA (top-down)
        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height, // negative = top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default()],
        };

        GetDIBits(
            hdc_mem,
            hbmp,
            0,
            height as u32,
            Some(buffer.as_mut_ptr() as *mut _),
            &mut { bmi },
            DIB_RGB_COLORS,
        );

        // Cleanup
        SelectObject(hdc_mem, old_obj);
        let _ = DeleteObject(hbmp.into());
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(Some(hwnd), hdc_window);

        true
    }
}

/// Capture loop for window recording. Runs in a dedicated thread.
/// Captures frames using PrintWindow at the configured rate and writes raw BGRA to FFmpeg stdin.
#[cfg(target_os = "windows")]
fn window_capture_loop(
    hwnd: isize,
    width: i32,
    height: i32,
    fps: u32,
    mut stdin: std::process::ChildStdin,
    stop_flag: std::sync::Arc<std::sync::atomic::AtomicBool>,
) {
    use std::io::Write;

    let fps = fps.clamp(1, 120);
    let frame_duration = std::time::Duration::from_secs_f64(1.0 / fps as f64);
    let buf_size = (width * height * 4) as usize;
    let mut frame_buffer = vec![0u8; buf_size];

    log::info!(
        "[capture_loop] Starting window capture: hwnd={} {}x{} at {} fps",
        hwnd,
        width,
        height,
        fps
    );

    while !stop_flag.load(Ordering::Relaxed) {
        let start = std::time::Instant::now();

        capture_window_frame(hwnd, width, height, &mut frame_buffer);
        if stdin.write_all(&frame_buffer).is_err() {
            log::warn!("[capture_loop] FFmpeg stdin pipe broken, stopping");
            break;
        }

        let elapsed = start.elapsed();
        if elapsed < frame_duration {
            std::thread::sleep(frame_duration - elapsed);
        }
    }

    // stdin is dropped here, sending EOF to FFmpeg
    log::info!("[capture_loop] Window capture stopped");
}

/// Take a single screenshot of a window using PrintWindow API.
/// Returns PNG data as base64 data URL.
#[cfg(target_os = "windows")]
fn screenshot_window_printwindow(hwnd_raw: isize, width: i32, height: i32) -> Option<Vec<u8>> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::*;
    use windows::Win32::Storage::Xps::{PrintWindow, PRINT_WINDOW_FLAGS};

    unsafe {
        let hwnd = HWND(hwnd_raw as *mut _);
        let hdc_window = GetDC(Some(hwnd));
        if hdc_window.is_invalid() {
            return None;
        }

        let hdc_mem = CreateCompatibleDC(Some(hdc_window));
        let hbmp = CreateCompatibleBitmap(hdc_window, width, height);
        let old_obj = SelectObject(hdc_mem, hbmp.into());

        let success = PrintWindow(hwnd, hdc_mem, PRINT_WINDOW_FLAGS(2));
        if !success.as_bool() {
            let _ = BitBlt(
                hdc_mem,
                0,
                0,
                width,
                height,
                Some(hdc_window),
                0,
                0,
                SRCCOPY,
            );
        }

        // Extract as BMP-style BGRA data (top-down)
        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default()],
        };

        let buf_size = (width * height * 4) as usize;
        let mut buffer = vec![0u8; buf_size];
        GetDIBits(
            hdc_mem,
            hbmp,
            0,
            height as u32,
            Some(buffer.as_mut_ptr() as *mut _),
            &mut { bmi },
            DIB_RGB_COLORS,
        );

        SelectObject(hdc_mem, old_obj);
        let _ = DeleteObject(hbmp.into());
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(Some(hwnd), hdc_window);

        // Convert BGRA to BMP file format for encoding
        // Build a simple BMP file in memory
        let file_size = 54 + buf_size; // header + data
        let mut bmp = Vec::with_capacity(file_size);

        // BMP file header (14 bytes)
        bmp.extend_from_slice(b"BM");
        bmp.extend_from_slice(&(file_size as u32).to_le_bytes());
        bmp.extend_from_slice(&0u16.to_le_bytes()); // reserved
        bmp.extend_from_slice(&0u16.to_le_bytes()); // reserved
        bmp.extend_from_slice(&54u32.to_le_bytes()); // pixel data offset

        // DIB header (40 bytes)
        bmp.extend_from_slice(&40u32.to_le_bytes()); // header size
        bmp.extend_from_slice(&width.to_le_bytes());
        bmp.extend_from_slice(&(-height).to_le_bytes()); // top-down
        bmp.extend_from_slice(&1u16.to_le_bytes()); // planes
        bmp.extend_from_slice(&32u16.to_le_bytes()); // bits per pixel
        bmp.extend_from_slice(&0u32.to_le_bytes()); // compression (BI_RGB)
        bmp.extend_from_slice(&(buf_size as u32).to_le_bytes());
        bmp.extend_from_slice(&0i32.to_le_bytes()); // x pixels per meter
        bmp.extend_from_slice(&0i32.to_le_bytes()); // y pixels per meter
        bmp.extend_from_slice(&0u32.to_le_bytes()); // colors used
        bmp.extend_from_slice(&0u32.to_le_bytes()); // important colors

        // Pixel data
        bmp.extend_from_slice(&buffer);

        Some(bmp)
    }
}

fn close_camera_file_handle(state: &mut AppState) {
    if let Some(mut file) = state.camera_file_handle.take() {
        use std::io::Write;
        if let Err(error) = file.flush() {
            log::warn!("Failed to flush camera/microphone capture file: {}", error);
        }
    }
}

#[tauri::command]
pub async fn init_recording(
    app: AppHandle,
    source: Value,
    camera_mic_config: Value,
    system_audio: Value,
    mode: Option<String>,
) -> AppResult<()> {
    {
        let state = app.state::<Mutex<AppState>>();
        let mut state = state.lock().unwrap();
        if recording_init_is_blocked(&state) {
            return Err(AppError::General(
                "A recording session is already active, changing state, or waiting to be saved or discarded."
                    .to_string(),
            ));
        }
        state.recording_init_in_progress = true;
    }

    let result =
        init_recording_impl(app.clone(), source, camera_mic_config, system_audio, mode).await;

    let failed_recording_id = {
        let state = app.state::<Mutex<AppState>>();
        let mut state = state.lock().unwrap();
        state.recording_init_in_progress = false;
        if result.is_err() {
            state.is_recording = false;
            state.recording_capture_claimed = false;
            state.recording_stop_in_progress = false;
            state.project_id = None;
            state.camera_mic_config = None;
            close_camera_file_handle(&mut state);
            state.recording_id.take()
        } else {
            None
        }
    };

    if let Some(recording_id) = failed_recording_id {
        let state = app.state::<Mutex<AppState>>();
        let temp_dir = state.lock().unwrap().project_temp_dir(&recording_id);
        std::fs::remove_dir_all(temp_dir).ok();
    }

    result
}

async fn init_recording_impl(
    app: AppHandle,
    source: Value,
    camera_mic_config: Value,
    system_audio: Value,
    mode: Option<String>,
) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    crate::mouse_tracker::restore_macos_cursor();

    let is_live = mode.as_deref() == Some("live");

    // Live mode: skip the FFmpeg/recording pipeline entirely and open the
    // dedicated live overlay window. The composer + RTMP path is driven from
    // the overlay via `live:start`.
    if is_live {
        let state = app.state::<Mutex<AppState>>();
        {
            let mut state = state.lock().unwrap();
            state.camera_mic_config = Some(camera_mic_config.clone());
        }
        return open_live_overlay(app, source).await;
    }

    // Resolve persisted recorder settings before mutating recording state. The
    // encoder is tested with a real one-frame encode so a compiled-but-missing
    // GPU runtime cannot make the recording fail after the countdown.
    let has_system_audio = match &system_audio {
        Value::String(device) => !device.is_empty(),
        Value::Bool(enabled) => *enabled,
        _ => false,
    };
    let preferences = load_recording_preferences(&app, has_system_audio).await?;
    let fps = preferences.fps;
    let encoder = preferences.encoder;
    let capturer = preferences.capturer;
    let quality = preferences.quality;
    log::info!(
        "[recording] preferences: {} fps, encoder={}, capturer={}, quality={}, system_audio={}",
        fps,
        encoder,
        capturer,
        quality,
        has_system_audio
    );

    let state = app.state::<Mutex<AppState>>();

    // Create new recording ID and project temp dir
    let recording_id = format!("recording-{}", uuid::Uuid::new_v4());
    let project_id = uuid::Uuid::new_v4().to_string();

    {
        let mut state = state.lock().unwrap();
        if state.is_recording {
            return Err(AppError::General(
                "A recording is already being initialized or captured.".to_string(),
            ));
        }
        state.is_recording = true;
        state.recording_capture_claimed = false;
        state.recording_stop_in_progress = false;
        state.project_id = Some(project_id.clone());
        state.recording_id = Some(recording_id.clone());
        state.camera_mic_config = Some(camera_mic_config.clone());
        state.multi_app_children.clear();
        state.multi_app_tracks.clear();
        state.multi_app_init_in_progress = false;
        state.multi_app_stop_requested = false;
        state.multi_app_finalize_error = None;

        let temp_dir = state.project_temp_dir(&recording_id);
        std::fs::create_dir_all(&temp_dir)?;
    }

    // Build FFmpeg args for screen capture
    let screen_video_path = {
        let state = state.lock().unwrap();
        state
            .project_temp_dir(&recording_id)
            .join("screen.mp4")
            .to_string_lossy()
            .to_string()
    };

    let source_type = source
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("screen");

    let fallback_dimensions = app
        .get_webview_window("main")
        .and_then(|window| window.current_monitor().ok().flatten())
        .map(|monitor| {
            let size = monitor.size();
            (size.width, size.height)
        })
        .unwrap_or((1920, 1080));
    let (recording_width, recording_height) = estimated_recording_dimensions(
        &source,
        source_type,
        fallback_dimensions.0,
        fallback_dimensions.1,
    );

    // For window capture, we use a custom PrintWindow pipeline instead of gdigrab
    let is_window_capture = source_type == "window";

    // Detect pure Wayland (no XWayland) on Linux — x11grab won't work
    #[cfg(target_os = "linux")]
    {
        let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
        if session_type == "wayland" && std::env::var("DISPLAY").is_err() {
            return Err(AppError::General(
                "Screen recording requires X11 or XWayland. Pure Wayland is not yet supported."
                    .into(),
            ));
        }
    }

    let mut ffmpeg_args: Vec<String> = Vec::new();
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    let mut video_filters: Vec<String> = Vec::new();
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let video_filters: Vec<String> = Vec::new();
    let (recording_offset_x, recording_offset_y): (i64, i64);

    if is_window_capture {
        let x = source.get("x").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
        let y = source.get("y").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
        let w = source.get("width").and_then(|v| v.as_i64()).unwrap_or(1920);
        let h = source
            .get("height")
            .and_then(|v| v.as_i64())
            .unwrap_or(1080);
        let w = (w - (w % 2)).max(2);
        let h = (h - (h % 2)).max(2);

        #[cfg(target_os = "windows")]
        {
            let hwnd_str = source
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("0")
                .to_string();

            log::info!(
                "[recording] window PrintWindow capture: hwnd={} x={} y={} w={} h={}",
                hwnd_str,
                x,
                y,
                w,
                h
            );

            // FFmpeg reads raw BGRA frames from stdin pipe (Windows PrintWindow API)
            ffmpeg_args = window_capture_input_args(w, h, fps);
        }

        #[cfg(target_os = "macos")]
        {
            log::info!(
                "[recording] window capture via avfoundation+crop: x={} y={} w={} h={}",
                x,
                y,
                w,
                h
            );

            // Use avfoundation screen capture + crop to window region
            let screen_dev = macos_screen_device_index(0);
            ffmpeg_args = vec![
                "-y".to_string(),
                "-f".to_string(),
                "avfoundation".to_string(),
                "-framerate".to_string(),
                fps.to_string(),
                "-pixel_format".to_string(),
                "nv12".to_string(),
                "-capture_cursor".to_string(),
                "0".to_string(),
                "-i".to_string(),
                format!("{}:none", screen_dev),
            ];
            video_filters.push(format!("crop={}:{}:{}:{}", w, h, x, y));
        }

        #[cfg(target_os = "linux")]
        {
            let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());

            log::info!(
                "[recording] window capture via x11grab: x={} y={} w={} h={}",
                x,
                y,
                w,
                h
            );

            // Use x11grab with offset+video_size to capture window region
            ffmpeg_args = vec![
                "-y".to_string(),
                "-f".to_string(),
                "x11grab".to_string(),
                "-framerate".to_string(),
                fps.to_string(),
                "-draw_mouse".to_string(),
                "0".to_string(),
                "-video_size".to_string(),
                format!("{}x{}", w, h),
                "-i".to_string(),
                format!("{}+{},{}", display, x, y),
            ];
        }

        recording_offset_x = x;
        recording_offset_y = y;
    } else {
        // Screen/Area: use platform-specific capture.
        //
        // Windows uses `ddagrab` (DXGI Desktop Duplication) rather than `gdigrab`.
        // gdigrab's BitBlt-based capture causes the hardware cursor to visibly
        // flicker on screen at the capture framerate; ddagrab reads the GPU
        // presentation surface directly and does not interfere with the cursor.
        // `ddagrab` is a libavfilter source filter, so on Windows we feed it via
        // `-f lavfi` at the per-source push point below and the framerate lives
        // inside the filter string — don't emit a top-level `-f`/`-framerate` here.
        ffmpeg_args.push("-y".to_string());
        #[cfg(not(target_os = "windows"))]
        {
            let capture_format = platform_capture_format();
            ffmpeg_args.extend([
                "-f".to_string(),
                capture_format.to_string(),
                "-framerate".to_string(),
                fps.to_string(),
            ]);
        }

        // Get screen dimensions for area percentage conversion
        // On Windows, gdigrab operates in physical pixel space
        let (screen_w, screen_h) = if let Some(main_win) = app.get_webview_window("main") {
            if let Ok(Some(monitor)) = main_win.current_monitor() {
                let size = monitor.size();
                #[cfg(target_os = "windows")]
                {
                    (size.width as f64, size.height as f64)
                }
                #[cfg(not(target_os = "windows"))]
                {
                    let scale = monitor.scale_factor();
                    (size.width as f64 / scale, size.height as f64 / scale)
                }
            } else {
                (1920.0, 1080.0)
            }
        } else {
            (1920.0, 1080.0)
        };

        let (ox, oy) = match source_type {
            "area" => {
                let x_pct = source.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let y_pct = source.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let w_pct = source
                    .get("width")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(100.0);
                let h_pct = source
                    .get("height")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(100.0);

                let x = (x_pct / 100.0 * screen_w) as i64;
                let y = (y_pct / 100.0 * screen_h) as i64;
                let width = ((w_pct / 100.0 * screen_w) as i64).max(2);
                let height = ((h_pct / 100.0 * screen_h) as i64).max(2);
                let width = width - (width % 2);
                let height = height - (height % 2);

                #[cfg(target_os = "windows")]
                {
                    // ddagrab captures per-monitor (DXGI output). The area x/y/width/height
                    // are already in physical-pixel space relative to the selected monitor,
                    // so we pass them straight through as offset_x/offset_y/video_size.
                    // Note: ddagrab cannot capture across monitor boundaries — the area UI
                    // clamps to a single monitor, so this isn't a regression.
                    if capturer == "gdigrab" {
                        ffmpeg_args.extend([
                            "-f".to_string(),
                            "gdigrab".to_string(),
                            "-framerate".to_string(),
                            fps.to_string(),
                            "-draw_mouse".to_string(),
                            "0".to_string(),
                            "-offset_x".to_string(),
                            x.to_string(),
                            "-offset_y".to_string(),
                            y.to_string(),
                            "-video_size".to_string(),
                            format!("{}x{}", width, height),
                            "-i".to_string(),
                            "desktop".to_string(),
                        ]);
                    } else {
                        let monitor_idx = source
                            .get("monitorIndex")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(0);
                        ffmpeg_args.extend([
                            "-f".to_string(),
                            "lavfi".to_string(),
                            "-i".to_string(),
                            format!(
                                "ddagrab=output_idx={}:framerate={}:draw_mouse=0:offset_x={}:offset_y={}:video_size={}x{}",
                                monitor_idx, fps, x, y, width, height
                            ),
                        ]);
                        if let Some(filter) = ddagrab_transfer_filter(&encoder) {
                            video_filters.push(filter.to_string());
                        }
                    }
                }
                #[cfg(target_os = "macos")]
                {
                    // avfoundation: capture screen device, then crop
                    let screen_dev = macos_screen_device_index(0);
                    ffmpeg_args.extend([
                        "-pixel_format".to_string(),
                        "nv12".to_string(),
                        "-capture_cursor".to_string(),
                        "0".to_string(),
                        "-i".to_string(),
                        format!("{}:none", screen_dev),
                    ]);
                    video_filters.push(format!("crop={}:{}:{}:{}", width, height, x, y));
                }
                #[cfg(target_os = "linux")]
                {
                    // x11grab uses :DISPLAY+x,y with video_size
                    let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());
                    ffmpeg_args.extend([
                        "-draw_mouse".to_string(),
                        "0".to_string(),
                        "-video_size".to_string(),
                        format!("{}x{}", width, height),
                        "-i".to_string(),
                        format!("{}+{},{}", display, x, y),
                    ]);
                }
                (x, y)
            }
            _ => {
                // Screen capture - supports specific monitor selection
                // On Windows, use physical pixels for gdigrab; on other platforms use logical
                #[cfg(target_os = "windows")]
                let (monitor_x, monitor_y, monitor_w, monitor_h) = {
                    let mx = source
                        .get("physicalX")
                        .or_else(|| source.get("monitorX"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    let my = source
                        .get("physicalY")
                        .or_else(|| source.get("monitorY"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    let mw = source
                        .get("physicalWidth")
                        .or_else(|| source.get("monitorWidth"))
                        .and_then(|v| v.as_i64());
                    let mh = source
                        .get("physicalHeight")
                        .or_else(|| source.get("monitorHeight"))
                        .and_then(|v| v.as_i64());
                    (mx, my, mw, mh)
                };
                #[cfg(not(target_os = "windows"))]
                let (monitor_x, monitor_y, monitor_w, monitor_h) = {
                    let mx = source.get("monitorX").and_then(|v| v.as_i64()).unwrap_or(0);
                    let my = source.get("monitorY").and_then(|v| v.as_i64()).unwrap_or(0);
                    let mw = source.get("monitorWidth").and_then(|v| v.as_i64());
                    let mh = source.get("monitorHeight").and_then(|v| v.as_i64());
                    (mx, my, mw, mh)
                };

                #[cfg(target_os = "windows")]
                {
                    if capturer == "gdigrab" {
                        ffmpeg_args.extend([
                            "-f".to_string(),
                            "gdigrab".to_string(),
                            "-framerate".to_string(),
                            fps.to_string(),
                            "-draw_mouse".to_string(),
                            "0".to_string(),
                            "-offset_x".to_string(),
                            monitor_x.to_string(),
                            "-offset_y".to_string(),
                            monitor_y.to_string(),
                        ]);
                        if let (Some(w), Some(h)) = (monitor_w, monitor_h) {
                            let w = (w - (w % 2)).max(2);
                            let h = (h - (h % 2)).max(2);
                            ffmpeg_args.extend(["-video_size".to_string(), format!("{}x{}", w, h)]);
                        }
                        ffmpeg_args.extend(["-i".to_string(), "desktop".to_string()]);
                    } else {
                        // ddagrab captures one DXGI output at a time. Pick the monitor via
                        // output_idx; offsets are relative to that output, so for a whole-
                        // monitor capture they're (0, 0).
                        let monitor_idx = source
                            .get("monitorIndex")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(0);

                        let mut filter = format!(
                            "ddagrab=output_idx={}:framerate={}:draw_mouse=0",
                            monitor_idx, fps
                        );
                        if let (Some(w), Some(h)) = (monitor_w, monitor_h) {
                            let w = (w - (w % 2)).max(2);
                            let h = (h - (h % 2)).max(2);
                            log::info!(
                                "[recording] monitor capture (ddagrab): idx={} w={} h={}",
                                monitor_idx,
                                w,
                                h
                            );
                            filter.push_str(&format!(":video_size={}x{}", w, h));
                        } else {
                            log::info!(
                                "[recording] monitor capture (ddagrab): idx={} (native size)",
                                monitor_idx
                            );
                        }
                        // monitor_x/monitor_y are virtual-desktop coordinates — intentionally
                        // unused here because ddagrab is per-output.
                        let _ = (monitor_x, monitor_y);

                        ffmpeg_args.extend([
                            "-f".to_string(),
                            "lavfi".to_string(),
                            "-i".to_string(),
                            filter,
                        ]);
                        if let Some(filter) = ddagrab_transfer_filter(&encoder) {
                            video_filters.push(filter.to_string());
                        }
                    }
                }
                #[cfg(target_os = "macos")]
                {
                    // avfoundation: map monitor index to actual device index
                    // (cameras come before screens in the device list)
                    let monitor_idx = source
                        .get("monitorIndex")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    let screen_dev = macos_screen_device_index(monitor_idx);
                    ffmpeg_args.extend([
                        "-pixel_format".to_string(),
                        "nv12".to_string(),
                        "-capture_cursor".to_string(),
                        "0".to_string(),
                        "-i".to_string(),
                        format!("{}:none", screen_dev),
                    ]);
                    // Each AVFoundation screen device is already local to the
                    // selected display. Applying virtual-desktop x/y offsets a
                    // second time makes secondary-display capture out of bounds.
                    let _ = (monitor_x, monitor_y, monitor_w, monitor_h);
                }
                #[cfg(target_os = "linux")]
                {
                    let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());
                    ffmpeg_args.push("-draw_mouse".to_string());
                    ffmpeg_args.push("0".to_string());

                    if let (Some(w), Some(h)) = (monitor_w, monitor_h) {
                        let w = (w - (w % 2)).max(2);
                        let h = (h - (h % 2)).max(2);
                        log::info!(
                            "[recording] monitor capture: x={} y={} w={} h={}",
                            monitor_x,
                            monitor_y,
                            w,
                            h
                        );
                        ffmpeg_args.extend(["-video_size".to_string(), format!("{}x{}", w, h)]);
                    }

                    ffmpeg_args.extend([
                        "-i".to_string(),
                        format!("{}+{},{}", display, monitor_x, monitor_y),
                    ]);
                }
                (monitor_x, monitor_y)
            }
        };

        recording_offset_x = ox;
        recording_offset_y = oy;
    }

    // Add every input before any output/filter option. This also enables
    // system audio for window recordings, where the video arrives on stdin.
    if has_system_audio {
        let audio_device = match &system_audio {
            Value::String(device) => device.clone(),
            _ => platform_default_audio_device(),
        };
        let (audio_format, audio_input) = platform_audio_capture_args(&audio_device);
        ffmpeg_args.extend([
            "-thread_queue_size".to_string(),
            "512".to_string(),
            "-f".to_string(),
            audio_format,
            "-i".to_string(),
            audio_input,
        ]);
    }

    append_recording_output_args(
        &mut ffmpeg_args,
        RecordingOutputConfig {
            video_filters: &video_filters,
            encoder: &encoder,
            fps,
            width: recording_width,
            height: recording_height,
            quality: &quality,
            has_system_audio,
            stop_on_video_eof: is_window_capture && cfg!(target_os = "windows"),
        },
    );
    ffmpeg_args.push(screen_video_path.clone());

    #[cfg(target_os = "macos")]
    let (native_capture_args, native_capture_ready_file) =
        if capturer == "screencapturekit" && encoder == "h264_videotoolbox" {
            let ready_file = {
                let state = state.lock().unwrap();
                state
                    .project_temp_dir(&recording_id)
                    .join("native-capture.ready")
                    .to_string_lossy()
                    .to_string()
            };
            (
            Some(macos_native_capture_arguments(
                &source,
                MacCaptureArgumentConfig {
                    source_type,
                    output_path: &screen_video_path,
                    ready_file_path: &ready_file,
                    fps,
                    width: recording_width,
                    height: recording_height,
                    quality: &quality,
                    captures_system_audio: has_system_audio,
                    excluded_process_id: super::windows::is_content_protection_enabled(&app)
                        .then_some(std::process::id()),
                },
            )),
                Some(ready_file),
            )
        } else {
            if capturer == "screencapturekit" {
                log::info!(
                    "[macos-capture] Using AVFoundation compatibility path because encoder {} was selected",
                    encoder
                );
            }
            (None, None)
        };

    // Store config for start_recording
    {
        let mut state = state.lock().unwrap();
        let source_name = source
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Recording")
            .to_string();

        let mut config = serde_json::json!({
            "videoTrack": camera_mic_config.get("videoTrack"),
            "audioTrack": camera_mic_config.get("audioTrack"),
            "constraints": camera_mic_config.get("constraints"),
            "ffmpegArgs": ffmpeg_args,
            "sourceName": source_name,
            "recordingOffsetX": recording_offset_x,
            "recordingOffsetY": recording_offset_y,
            "isWindowCapture": is_window_capture,
            "sourceType": source_type,
            "source": source,
            "fps": fps,
            "encoder": encoder,
            "capturer": capturer,
            "quality": quality,
            "hasSystemAudio": has_system_audio,
        });

        #[cfg(target_os = "macos")]
        {
            config["nativeCaptureArgs"] =
                serde_json::to_value(native_capture_args).unwrap_or(Value::Null);
            config["nativeCaptureReadyFile"] =
                serde_json::to_value(native_capture_ready_file).unwrap_or(Value::Null);
        }

        // Store window handle info for the capture thread
        if is_window_capture {
            config["windowHwnd"] =
                serde_json::json!(source.get("id").and_then(|v| v.as_str()).unwrap_or("0"));
            config["windowWidth"] =
                serde_json::json!(source.get("width").and_then(|v| v.as_i64()).unwrap_or(1920));
            config["windowHeight"] = serde_json::json!(source
                .get("height")
                .and_then(|v| v.as_i64())
                .unwrap_or(1080));
        }

        state.camera_mic_config = Some(config);
    }

    // Minimize main window
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.minimize().ok();
    }

    // Create recorder overlay window (centered at top of screen)
    let monitor = app
        .get_webview_window("main")
        .and_then(|w| w.current_monitor().ok().flatten());

    let overlay_w = 460.0;
    let overlay_h = 72.0;
    let margin = 10.0;

    let win_x = if let Some(m) = &monitor {
        let size = m.size();
        let scale = m.scale_factor();
        let w = size.width as f64 / scale;
        (w - overlay_w) / 2.0
    } else {
        400.0
    };

    let recorder_window = WebviewWindowBuilder::new(
        &app,
        "recorder",
        WebviewUrl::App("app/windows/recorder/index.html".into()),
    )
    .title("Recording - Flowtake")
    .inner_size(overlay_w, overlay_h)
    .min_inner_size(overlay_w, overlay_h)
    .position(win_x, margin)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .closable(false)
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .content_protected(super::windows::is_content_protection_enabled(&app))
    .build();

    match recorder_window {
        Ok(ref win) => {
            // Explicitly set always-on-top after creation to ensure it sticks on Windows
            if let Err(e) = win.set_always_on_top(true) {
                log::warn!("Failed to set recorder always-on-top: {}", e);
            }
            win.show().ok();
            log::info!("Recorder window created successfully (always-on-top)");
        }
        Err(e) => {
            log::error!("Failed to create recorder window: {}", e);
            if let Some(main_win) = app.get_webview_window("main") {
                main_win.unminimize().ok();
            }
            return Err(AppError::General(format!(
                "Failed to create recorder window: {}",
                e
            )));
        }
    }

    // Emit recording-init event
    app.emit("recording-init", &source).ok();

    Ok(())
}

/// Build the dedicated live overlay pill window. Mirrors the recorder window's
/// geometry (centered top-of-screen, always-on-top, decoration-less) but uses
/// its own URL so the live UI lives independently from the recorder UI.
async fn open_live_overlay(app: AppHandle, source: Value) -> AppResult<()> {
    // Minimize main window the same way recording does
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.minimize().ok();
    }

    if app.get_webview_window("liveOverlay").is_some() {
        // Already open — just emit the init event so the existing window can react
        app.emit("live-init", &source).ok();
        return Ok(());
    }

    let monitor = app
        .get_webview_window("main")
        .and_then(|w| w.current_monitor().ok().flatten());

    let overlay_w = 500.0;
    let overlay_h = 72.0;
    let margin = 10.0;

    let win_x = if let Some(m) = &monitor {
        let size = m.size();
        let scale = m.scale_factor();
        let w = size.width as f64 / scale;
        (w - overlay_w) / 2.0
    } else {
        400.0
    };

    let live_window = WebviewWindowBuilder::new(
        &app,
        "liveOverlay",
        WebviewUrl::App("app/windows/liveOverlay/index.html".into()),
    )
    .title("Live - Flowtake")
    .inner_size(overlay_w, overlay_h)
    .min_inner_size(overlay_w, overlay_h)
    .position(win_x, margin)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .closable(false)
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .content_protected(super::windows::is_content_protection_enabled(&app))
    .build();

    match live_window {
        Ok(ref win) => {
            if let Err(e) = win.set_always_on_top(true) {
                log::warn!("Failed to set live overlay always-on-top: {}", e);
            }
            win.show().ok();
            log::info!("Live overlay window created (always-on-top)");
        }
        Err(e) => {
            log::error!("Failed to create live overlay window: {}", e);
            if let Some(main_win) = app.get_webview_window("main") {
                main_win.unminimize().ok();
            }
            return Err(AppError::General(format!(
                "Failed to create live overlay window: {}",
                e
            )));
        }
    }

    app.emit("live-init", &source).ok();
    Ok(())
}

fn try_claim_recording_capture(state: &mut AppState) -> bool {
    if state.recording_capture_claimed {
        return false;
    }
    state.recording_capture_claimed = true;
    true
}

fn recording_init_is_blocked(state: &AppState) -> bool {
    state.is_recording
        || state.recording_init_in_progress
        || state.recording_stop_in_progress
        // A failed save deliberately keeps recording_id as its retry token.
        // A new take must not overwrite the IDs and orphan those staged files.
        || state.recording_id.is_some()
}

fn recording_start_prerequisites_met(state: &AppState) -> bool {
    let has_ffmpeg_args = state
        .camera_mic_config
        .as_ref()
        .and_then(|config| config.get("ffmpegArgs"))
        .and_then(|args| args.as_array())
        .map(|args| !args.is_empty())
        .unwrap_or(false);

    state.is_recording
        && !state.recording_init_in_progress
        && !state.recording_stop_in_progress
        && state.recording_id.is_some()
        && has_ffmpeg_args
}

fn try_begin_recording_stop(state: &mut AppState) -> bool {
    // After FFmpeg has stopped, project packaging may still fail (disk full,
    // store write, temporarily locked destination, and so on). Keep the same
    // recording identifiers as a retry token until the complete save commits.
    let has_pending_save =
        !state.is_recording && state.recording_id.is_some() && state.project_id.is_some();
    if state.recording_stop_in_progress
        || (!state.is_recording
            && state.ffmpeg_process.is_none()
            && state.macos_capture_process.is_none()
            && state.ffmpeg_child_id.is_none()
            && !has_pending_save)
    {
        return false;
    }

    state.recording_stop_in_progress = true;
    state.recording_capture_claimed = false;
    state.is_recording = false;
    true
}

fn clear_failed_recording_start(state: &mut AppState) -> Vec<std::path::PathBuf> {
    state.is_recording = false;
    state.recording_capture_claimed = false;
    state.recording_start_timestamp = None;
    state.camera_mic_config = None;
    state.ffmpeg_child_id = None;
    state.ffmpeg_child = None;
    state.ffmpeg_process = None;
    state.macos_capture_process = None;
    state.multi_app_tracks.clear();
    state.multi_app_init_in_progress = false;
    state.multi_app_stop_requested = false;
    state.multi_app_finalize_error = None;
    state.file_handles.clear();
    close_camera_file_handle(state);

    let recording_id = state.recording_id.take();
    let project_id = state.project_id.take();
    let mut directories = Vec::with_capacity(2);
    for id in [recording_id, project_id].into_iter().flatten() {
        let path = state.project_temp_dir(&id);
        if !directories.contains(&path) {
            directories.push(path);
        }
    }
    directories
}

#[tauri::command]
pub async fn start_recording(app: AppHandle) -> AppResult<()> {
    let claim_result = {
        let state = app.state::<Mutex<AppState>>();
        let mut state = state.lock().unwrap();
        if !recording_start_prerequisites_met(&state) {
            Err(AppError::General(
                "Recording must be initialized before capture starts.".to_string(),
            ))
        } else {
            Ok(try_claim_recording_capture(&mut state))
        }
    };

    let claimed = claim_result?;

    if !claimed {
        log::warn!("[start_recording] Ignoring duplicate start command");
        return Ok(());
    }

    let result = start_recording_impl(app.clone()).await;
    if result.is_err() {
        let state = app.state::<Mutex<AppState>>();
        let should_rollback = {
            let mut state = state.lock().unwrap();
            state.recording_capture_claimed = false;
            !state.recording_stop_in_progress
        };

        // A spawn/configuration error happens after init_recording has claimed
        // the session and created the recorder window. Fully unwind that state
        // so the user can immediately try again. A concurrent stop/cancel owns
        // its own cleanup and must not be raced here.
        if should_rollback {
            tokio::task::spawn_blocking({
                let app = app.clone();
                move || kill_ffmpeg(&app)
            })
            .await
            .ok();
            crate::commands::audio::unmute_all_sessions(&app);

            let directories = {
                let mut state = state.lock().unwrap();
                clear_failed_recording_start(&mut state)
            };
            for directory in directories {
                if directory.exists() {
                    if let Err(error) = std::fs::remove_dir_all(&directory) {
                        log::warn!(
                            "[start_recording] Could not remove failed session {:?}: {}",
                            directory,
                            error
                        );
                    }
                }
            }

            if let Some(recorder) = app.get_webview_window("recorder") {
                recorder.close().ok();
            }
            if let Some(main) = app.get_webview_window("main") {
                main.unminimize().ok();
                main.show().ok();
                main.set_focus().ok();
            }
        }
    }
    result
}

async fn start_recording_impl(app: AppHandle) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    crate::mouse_tracker::restore_macos_cursor();

    let state = app.state::<Mutex<AppState>>();

    // Get config from stored state
    #[allow(unused_variables)]
    let (ffmpeg_args, is_window_capture, window_hwnd, window_width, window_height, fps) = {
        let state = state.lock().unwrap();
        let config = state.camera_mic_config.as_ref();
        let args = config
            .and_then(|c| c.get("ffmpegArgs"))
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<_>>()
            });
        let is_win = config
            .and_then(|c| c.get("isWindowCapture"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let hwnd = config
            .and_then(|c| c.get("windowHwnd"))
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<isize>().ok())
            .unwrap_or(0);
        let ww = config
            .and_then(|c| c.get("windowWidth"))
            .and_then(|v| v.as_i64())
            .unwrap_or(1920) as i32;
        let wh = config
            .and_then(|c| c.get("windowHeight"))
            .and_then(|v| v.as_i64())
            .unwrap_or(1080) as i32;
        let fps = config
            .and_then(|c| c.get("fps"))
            .and_then(|v| v.as_u64())
            .filter(|fps| *fps == 30 || *fps == 60)
            .unwrap_or(30) as u32;
        (args, is_win, hwnd, ww, wh, fps)
    };

    #[cfg(target_os = "macos")]
    let (native_capture_args, native_capture_ready_file) = {
        let state = state.lock().unwrap();
        let config = state.camera_mic_config.as_ref();
        let args = config
            .and_then(|value| value.get("nativeCaptureArgs"))
            .and_then(Value::as_array)
            .map(|args| {
                args.iter()
                    .filter_map(Value::as_str)
                    .map(str::to_owned)
                    .collect::<Vec<_>>()
            })
            .filter(|args| !args.is_empty());
        let ready_file = config
            .and_then(|value| value.get("nativeCaptureReadyFile"))
            .and_then(Value::as_str)
            .map(std::path::PathBuf::from);
        (args, ready_file)
    };

    if let Some(args) = ffmpeg_args {
        #[cfg(target_os = "macos")]
        let native_capture_started = if let (Some(native_args), Some(ready_file)) =
            (native_capture_args.as_deref(), native_capture_ready_file.as_deref())
        {
            match spawn_macos_capture(&app, native_args, ready_file) {
                Ok(mut process) => {
                    let pid = process.id();
                    let mut state = state.lock().unwrap();
                    if !state.recording_capture_claimed || !state.is_recording {
                        drop(state);
                        process.kill().ok();
                        process.wait().ok();
                        return Err(AppError::General(
                            "Recording start was canceled before native capture began.".to_string(),
                        ));
                    }
                    state.macos_capture_process = Some(process);
                    log::info!(
                        "[start_recording] ScreenCaptureKit helper started with PID: {}",
                        pid
                    );
                    true
                }
                Err(error) => {
                    log::warn!(
                        "[macos-capture] Native startup failed; using AVFoundation fallback: {}",
                        error
                    );
                    false
                }
            }
        } else {
            false
        };
        #[cfg(not(target_os = "macos"))]
        let native_capture_started = false;

        // Only use stdin pipe capture on Windows (PrintWindow API);
        // macOS/Linux window capture uses screen capture with crop via sidecar path
        #[cfg(target_os = "windows")]
        let use_stdin_pipe = is_window_capture;
        #[cfg(not(target_os = "windows"))]
        let use_stdin_pipe = false;

        if native_capture_started {
            log::info!("[start_recording] Native macOS capture path is active");
        } else if use_stdin_pipe {
            // Window capture: spawn FFmpeg via std::process::Command for stdin pipe access
            let ffmpeg_path = find_ffmpeg_path()
                .ok_or_else(|| AppError::General("FFmpeg binary not found".to_string()))?;

            log::info!(
                "[start_recording] Window capture mode, FFmpeg: {:?}",
                ffmpeg_path
            );

            use std::process::{Command, Stdio};

            let mut cmd = Command::new(&ffmpeg_path);
            cmd.args(&args)
                .stdin(Stdio::piped())
                .stdout(Stdio::null())
                .stderr(Stdio::piped());

            // Hide console window on Windows
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }

            let mut process = cmd
                .spawn()
                .map_err(|e| AppError::General(format!("Failed to spawn FFmpeg: {}", e)))?;
            crate::process_containment::contain_owned_child(&process, "window-capture FFmpeg");

            let pid = process.id();
            let stdin = process.stdin.take().unwrap();
            if let Some(stderr) = process.stderr.take() {
                spawn_ffmpeg_stderr_reader(stderr, app.clone());
            }
            verify_capture_process_start(&mut process, std::time::Duration::from_millis(200))?;

            // Reset stop flag and start capture thread
            let stop_flag = {
                let mut state = state.lock().unwrap();
                if !state.recording_capture_claimed || !state.is_recording {
                    drop(state);
                    process.kill().ok();
                    process.wait().ok();
                    return Err(AppError::General(
                        "Recording start was canceled before capture began.".to_string(),
                    ));
                }
                state.window_capture_stop.store(false, Ordering::Relaxed);
                state.ffmpeg_child_id = Some(pid);
                state.ffmpeg_process = Some(process);
                state.window_capture_stop.clone()
            };

            // Make dimensions even
            #[allow(unused_variables)]
            let w = (window_width - (window_width % 2)).max(2);
            #[allow(unused_variables)]
            let h = (window_height - (window_height % 2)).max(2);

            #[cfg(target_os = "windows")]
            let capture_thread = std::thread::spawn(move || {
                window_capture_loop(window_hwnd, w, h, fps, stdin, stop_flag);
            });

            // On macOS/Linux, window capture via stdin pipe is not yet supported;
            // fall back to closing stdin immediately (FFmpeg will use the screen capture input)
            #[cfg(not(target_os = "windows"))]
            let capture_thread = std::thread::spawn(move || {
                log::warn!("[start_recording] Window-specific PrintWindow capture not available on this platform, using screen-level capture");
                // Drop stdin to signal EOF - FFmpeg will finalize when stopped
                let _ = stop_flag;
                drop(stdin);
            });

            {
                let mut state = state.lock().unwrap();
                state.window_capture_thread = Some(capture_thread);
            }

            log::info!(
                "[start_recording] Window capture started, FFmpeg PID: {}",
                pid
            );
        } else {
            // Screen/Area capture
            use std::process::{Command, Stdio};

            let ffmpeg_path = find_ffmpeg_path().ok_or_else(|| {
                AppError::General("FFmpeg binary not found. Please install FFmpeg.".to_string())
            })?;

            log::info!(
                "[start_recording] Screen/area capture, FFmpeg: {:?}, args: {:?}",
                ffmpeg_path,
                args
            );

            let mut cmd = Command::new(&ffmpeg_path);
            cmd.args(&args)
                .stdin(Stdio::piped())
                .stdout(Stdio::null())
                .stderr(Stdio::piped());

            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000);
            }

            match cmd.spawn() {
                Ok(mut process) => {
                    crate::process_containment::contain_owned_child(
                        &process,
                        "screen-capture FFmpeg",
                    );
                    let pid = process.id();
                    if let Some(stderr) = process.stderr.take() {
                        spawn_ffmpeg_stderr_reader(stderr, app.clone());
                    }
                    verify_capture_process_start(
                        &mut process,
                        std::time::Duration::from_millis(200),
                    )?;
                    {
                        let mut state = state.lock().unwrap();
                        if !state.recording_capture_claimed || !state.is_recording {
                            drop(state);
                            process.kill().ok();
                            process.wait().ok();
                            return Err(AppError::General(
                                "Recording start was canceled before capture began.".to_string(),
                            ));
                        }
                        state.ffmpeg_child_id = Some(pid);
                        state.ffmpeg_process = Some(process);
                    }
                    log::info!("[start_recording] FFmpeg started with PID: {}", pid);
                }
                Err(e) => {
                    log::error!("Failed to spawn FFmpeg: {}", e);
                    #[cfg(target_os = "macos")]
                    crate::mouse_tracker::restore_macos_cursor();
                    app.emit("recording-error", "CaptureError").ok();
                    if let Some(win) = app.get_webview_window("recorder") {
                        win.close().ok();
                    }
                    if let Some(main_win) = app.get_webview_window("main") {
                        main_win.unminimize().ok();
                    }
                    return Err(AppError::General(format!(
                        "Failed to start recording: {}",
                        e
                    )));
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    crate::mouse_tracker::restore_macos_cursor();

    // Start mouse tracking with recording area offset
    {
        let mut state = state.lock().unwrap();
        let (offset_x, offset_y) = state
            .camera_mic_config
            .as_ref()
            .map(|c| {
                let x = c
                    .get("recordingOffsetX")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as i32;
                let y = c
                    .get("recordingOffsetY")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as i32;
                (x, y)
            })
            .unwrap_or((0, 0));
        state.mouse_tracker.set_offset(offset_x, offset_y);
        // On macOS, CGEvent reports logical points while AVFoundation records physical pixels.
        // Scale mouse coordinates to match video resolution on Retina displays.
        #[cfg(target_os = "macos")]
        {
            let scale = app
                .get_webview_window("main")
                .and_then(|w| w.current_monitor().ok().flatten())
                .map(|m| m.scale_factor())
                .unwrap_or(1.0);
            state.mouse_tracker.set_scale_factor(scale);
        }
        state.mouse_tracker.start();
        state.recording_start_timestamp = Some(chrono::Utc::now().timestamp_millis());
    }

    // Emit recording-started to the recorder window
    app.emit("recording-started", true).ok();
    Ok(())
}

#[tauri::command]
pub async fn pause_recording(app: AppHandle, pause: bool) -> AppResult<()> {
    app.emit("recording-paused", pause).ok();
    Ok(())
}

#[derive(Clone, Debug)]
struct ProjectArchiveEntry {
    archive_name: String,
    source_path: std::path::PathBuf,
}

fn recording_save_error(stage: &str, error: impl std::fmt::Display) -> AppError {
    AppError::General(format!("Recording save failed while {}: {}", stage, error))
}

fn ensure_non_empty_recording_file(path: &std::path::Path, description: &str) -> AppResult<u64> {
    let metadata = path
        .metadata()
        .map_err(|error| recording_save_error(&format!("checking {}", description), error))?;
    if !metadata.is_file() || metadata.len() == 0 {
        return Err(recording_save_error(
            &format!("checking {}", description),
            "the file is missing or empty",
        ));
    }
    Ok(metadata.len())
}

fn move_or_copy_recording_file(
    source: &std::path::Path,
    destination: &std::path::Path,
    description: &str,
) -> AppResult<()> {
    if source == destination {
        ensure_non_empty_recording_file(destination, description)?;
        return Ok(());
    }

    let expected_size = ensure_non_empty_recording_file(source, description)?;
    if let Err(rename_error) = std::fs::rename(source, destination) {
        log::warn!(
            "[stop_recording] Could not move {} ({}); falling back to copy",
            description,
            rename_error
        );
        let copied = std::fs::copy(source, destination).map_err(|copy_error| {
            recording_save_error(
                &format!("copying {} into the project", description),
                format!("{} (move also failed: {})", copy_error, rename_error),
            )
        })?;
        if copied != expected_size {
            return Err(recording_save_error(
                &format!("copying {} into the project", description),
                format!("copied {} of {} bytes", copied, expected_size),
            ));
        }
        if let Err(error) = std::fs::remove_file(source) {
            log::warn!(
                "[stop_recording] Saved {} but could not remove source {:?}: {}",
                description,
                source,
                error
            );
        }
    }

    let saved_size = ensure_non_empty_recording_file(destination, description)?;
    if saved_size != expected_size {
        return Err(recording_save_error(
            &format!("verifying {}", description),
            format!("expected {} bytes but saved {}", expected_size, saved_size),
        ));
    }
    Ok(())
}

/// Prefer an already-staged project file on retries. The first save moves the
/// capture from the recording workspace into the project workspace before
/// later fallible steps (device validation, archive creation, store commit).
/// Requiring the original capture path again would make every such retry fail.
fn recording_save_source(
    capture_path: &std::path::Path,
    staged_path: &std::path::Path,
) -> std::path::PathBuf {
    if staged_path.exists() {
        staged_path.to_path_buf()
    } else {
        capture_path.to_path_buf()
    }
}

fn successful_extra_tracks(
    project_temp: &std::path::Path,
    tracks: Vec<crate::commands::multi_app::CapturedTrack>,
) -> AppResult<Vec<crate::commands::multi_app::CapturedTrack>> {
    let mut successful = Vec::with_capacity(tracks.len());
    for track in tracks {
        let path = track.capture_path(project_temp)?;
        match path.metadata() {
            Ok(metadata) if metadata.is_file() && metadata.len() > 0 => successful.push(track),
            Ok(_) => {
                return Err(recording_save_error(
                    &format!("checking required App-layer track {:?}", path),
                    "the selected track is empty",
                ));
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Err(recording_save_error(
                    &format!("checking required App-layer track {:?}", path),
                    "the selected track is missing",
                ));
            }
            Err(error) => {
                return Err(recording_save_error(
                    &format!("checking multi-app track {:?}", path),
                    error,
                ));
            }
        }
    }
    Ok(successful)
}

fn validate_archive_entry_name(name: &str) -> AppResult<()> {
    if name.is_empty() || name == "." || name == ".." || name.contains('/') || name.contains('\\') {
        return Err(recording_save_error(
            "validating the project archive",
            format!("invalid entry name {:?}", name),
        ));
    }
    Ok(())
}

fn write_project_zip<W>(writer: W, entries: &[ProjectArchiveEntry]) -> AppResult<W>
where
    W: std::io::Write + std::io::Seek,
{
    let mut zip = zip::ZipWriter::new(writer);
    let options =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    let mut names = std::collections::HashSet::new();

    for entry in entries {
        validate_archive_entry_name(&entry.archive_name)?;
        if !names.insert(entry.archive_name.as_str()) {
            return Err(recording_save_error(
                "validating the project archive",
                format!("duplicate entry {:?}", entry.archive_name),
            ));
        }

        let expected_size = ensure_non_empty_recording_file(
            &entry.source_path,
            &format!("archive entry {}", entry.archive_name),
        )?;
        let mut source = std::fs::File::open(&entry.source_path).map_err(|error| {
            recording_save_error(
                &format!("opening archive entry {}", entry.archive_name),
                error,
            )
        })?;
        zip.start_file(&entry.archive_name, options)
            .map_err(|error| {
                recording_save_error(
                    &format!("starting archive entry {}", entry.archive_name),
                    error,
                )
            })?;
        let copied = std::io::copy(&mut source, &mut zip).map_err(|error| {
            recording_save_error(
                &format!("writing archive entry {}", entry.archive_name),
                error,
            )
        })?;
        if copied != expected_size {
            return Err(recording_save_error(
                &format!("writing archive entry {}", entry.archive_name),
                format!("wrote {} of {} bytes", copied, expected_size),
            ));
        }
    }

    zip.finish()
        .map_err(|error| recording_save_error("finalizing the project archive", error))
}

fn partial_archive_path(zip_path: &std::path::Path) -> std::path::PathBuf {
    let mut path = zip_path.as_os_str().to_os_string();
    path.push(".partial");
    path.into()
}

fn create_project_archive(
    zip_path: &std::path::Path,
    entries: &[ProjectArchiveEntry],
) -> AppResult<()> {
    let partial_path = partial_archive_path(zip_path);
    if partial_path.exists() {
        std::fs::remove_file(&partial_path).map_err(|error| {
            recording_save_error("removing an earlier partial project archive", error)
        })?;
    }
    if zip_path.exists() {
        return Err(recording_save_error(
            "committing the project archive",
            format!("the destination already exists: {:?}", zip_path),
        ));
    }

    let result = (|| -> AppResult<()> {
        let file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&partial_path)
            .map_err(|error| recording_save_error("creating the project archive", error))?;
        let file = write_project_zip(file, entries)?;
        file.sync_all()
            .map_err(|error| recording_save_error("syncing the project archive", error))?;
        std::fs::rename(&partial_path, zip_path)
            .map_err(|error| recording_save_error("committing the project archive", error))?;
        Ok(())
    })();

    if result.is_err() && partial_path.exists() {
        if let Err(cleanup_error) = std::fs::remove_file(&partial_path) {
            log::error!(
                "[stop_recording] Could not remove partial archive {:?}: {}",
                partial_path,
                cleanup_error
            );
        }
    }
    result
}

fn prepare_project_archive_destination(
    zip_path: &std::path::Path,
    staged_retry: bool,
) -> AppResult<()> {
    if !zip_path.exists() {
        return Ok(());
    }
    if !staged_retry {
        return Err(recording_save_error(
            "committing the project archive",
            format!("the destination already exists: {:?}", zip_path),
        ));
    }

    // A staged retry owns this UUID-scoped destination. The previous attempt
    // may have atomically committed the archive and then crashed or failed
    // while opening/updating the library store.
    std::fs::remove_file(zip_path)
        .map_err(|error| recording_save_error("preparing the project archive retry", error))
}

#[tauri::command]
pub async fn stop_recording(app: AppHandle) -> AppResult<()> {
    let should_stop = {
        let state = app.state::<Mutex<AppState>>();
        let mut state = state.lock().unwrap();
        try_begin_recording_stop(&mut state)
    };

    if !should_stop {
        log::warn!("[stop_recording] Ignoring duplicate stop command");
        return Ok(());
    }

    let result = stop_recording_impl(app.clone()).await;
    let state = app.state::<Mutex<AppState>>();
    state.lock().unwrap().recording_stop_in_progress = false;
    result
}

async fn stop_recording_impl(app: AppHandle) -> AppResult<()> {
    use tauri_plugin_store::StoreExt;

    let state = app.state::<Mutex<AppState>>();

    let stop_timestamp = chrono::Utc::now().timestamp_millis();

    // Gracefully stop FFmpeg (handles both window capture and screen/area capture)
    log::info!("[stop_recording] Stopping FFmpeg");
    tokio::task::spawn_blocking({
        let app = app.clone();
        move || kill_ffmpeg(&app)
    })
    .await
    .ok();

    #[cfg(target_os = "macos")]
    crate::mouse_tracker::restore_macos_cursor();

    // Restore any muted audio sessions
    crate::commands::audio::unmute_all_sessions(&app);

    // Stop any extra multi-app captures (plugin: individual app recording).
    // Keep cleaning up the primary/device trackers even when a required layer
    // fails, then surface the durable layer error before project packaging.
    let app_layer_finalize_failure =
        crate::commands::multi_app::finalize_state_captures(&state).err();

    let (project_id, recording_id, mouse_events, keyboard_events, extra_tracks, recording_start_ts) = {
        let mut state = state.lock().unwrap();
        state.is_recording = false;
        state.recording_capture_claimed = false;

        state.mouse_tracker.stop();
        state.keyboard_tracker.stop();
        close_camera_file_handle(&mut state);

        #[cfg(target_os = "macos")]
        crate::mouse_tracker::restore_macos_cursor();

        let start_ts = state.recording_start_timestamp.unwrap_or(stop_timestamp);
        let events = state.mouse_tracker.get_events(start_ts);
        let key_events = state.keyboard_tracker.get_events(start_ts);
        // Retain track metadata until the archive and library transaction has
        // committed so a failed package can be retried from the staged files.
        let tracks = state.multi_app_tracks.clone();

        let pid = state.project_id.clone();
        let rid = state.recording_id.clone();
        state.ffmpeg_child_id = None;
        state.ffmpeg_child = None;
        (pid, rid, events, key_events, tracks, start_ts)
    };

    log::info!(
        "[stop_recording] project_id={:?}, recording_id={:?}",
        project_id,
        recording_id
    );

    if let Some(error) = app_layer_finalize_failure {
        let message = error.to_string();
        app.emit_to("main", "recording-error", &message).ok();
        app.emit_to("main", "load", serde_json::Value::Null).ok();
        return Err(error);
    }

    app.emit_to("main", "load", "Creating project...").ok();

    // Check if we have a valid recording
    let recording_video_path = if let Some(ref rid) = recording_id {
        let state_lock = state.lock().unwrap();
        let capture_path = state_lock.project_temp_dir(rid).join("screen.mp4");
        let staged_path = project_id
            .as_ref()
            .map(|pid| state_lock.project_temp_dir(pid).join("screen.mp4"));
        drop(state_lock);
        Some(match staged_path {
            Some(path) => recording_save_source(&capture_path, &path),
            None => capture_path,
        })
    } else {
        None
    };

    let has_non_empty_video = recording_video_path
        .as_ref()
        .map(|p| {
            let exists = p.exists();
            let size = p.metadata().map(|m| m.len()).unwrap_or(0);
            log::info!(
                "[stop_recording] Video file: {:?}, exists={}, size={}",
                p,
                exists,
                size
            );
            exists && size > 0
        })
        .unwrap_or(false);

    let requires_system_audio = {
        let state = state.lock().unwrap();
        state
            .camera_mic_config
            .as_ref()
            .and_then(|config| config.get("hasSystemAudio"))
            .and_then(Value::as_bool)
            .unwrap_or(false)
    };

    let screen_metadata = if has_non_empty_video {
        if let Some(ref path) = recording_video_path {
            match probe_video_metadata(path, requires_system_audio).await {
                Ok(metadata) => Some(metadata),
                Err(error) => {
                    log::error!(
                        "[stop_recording] Recording video exists but its first frame is not readable: {:?}: {}",
                        path,
                        error
                    );
                    None
                }
            }
        } else {
            None
        }
    } else {
        None
    };
    let has_video = screen_metadata.is_some();

    let mut project_save_failure: Option<AppError> = None;

    if has_video {
        if let (Some(ref rid), Some(ref pid)) = (&recording_id, &project_id) {
            let save_result: AppResult<()> = async {
                let (project_temp, projects_dir) = {
                    let state_lock = state.lock().unwrap();
                    (
                        state_lock.project_temp_dir(pid),
                        state_lock.projects_dir.clone(),
                    )
                };

                std::fs::create_dir_all(&project_temp).map_err(|error| {
                    recording_save_error("creating the project workspace", error)
                })?;
                let dest_video = project_temp.join("screen.mp4");
                let recording_video = recording_video_path.clone().ok_or_else(|| {
                    recording_save_error(
                        "staging the screen recording",
                        "the recording source path is unavailable",
                    )
                })?;
                move_or_copy_recording_file(&recording_video, &dest_video, "screen recording")?;

                log::info!(
                    "[stop_recording] dest_video exists={}, size={}",
                    dest_video.exists(),
                    dest_video.metadata().map(|m| m.len()).unwrap_or(0)
                );

                #[cfg(target_os = "macos")]
                {
                    let preview_path = {
                        let state = state.lock().unwrap();
                        state.preview_video_file(pid)
                    };
                    app.emit_to("main", "load", "Optimizing editor preview...")
                        .ok();
                    if let Err(error) = crate::macos_capture::ensure_preview_proxy(
                        &app,
                        &dest_video,
                        &preview_path,
                    )
                    .await
                    {
                        log::warn!(
                            "[stop_recording] Native preview unavailable; editor will use full source: {}",
                            error
                        );
                    }
                    app.emit_to("main", "load", "Creating project...").ok();
                }

                let (
                    source_name,
                    left_trim,
                    right_trim,
                    top_trim,
                    bottom_trim,
                    has_camera,
                    has_mic,
                    has_system_audio,
                ) = {
                    let s = state.lock().unwrap();
                    let config = s.camera_mic_config.as_ref();
                    let name = config
                        .and_then(|c| c.get("sourceName"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("Recording")
                        .to_string();
                    let has_camera = config
                        .and_then(|c| c.get("videoTrack"))
                        .and_then(|v| v.as_str())
                        .map(|s| !s.is_empty())
                        .unwrap_or(false);
                    let has_mic = config
                        .and_then(|c| c.get("audioTrack"))
                        .and_then(|v| v.as_str())
                        .map(|s| !s.is_empty())
                        .unwrap_or(false);
                    let has_system_audio = config
                        .and_then(|c| c.get("hasSystemAudio"))
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    (name, 0, 0, 0, 0, has_camera, has_mic, has_system_audio)
                };

                // A selected camera or microphone is a required project track, not
                // an optional enhancement. Missing, empty, unreadable, or stream-
                // mismatched output must fail the save instead of publishing a
                // manifest that silently drops what the user selected.
                let has_camera_file = has_camera || has_mic;
                let camera_metadata = if has_camera_file {
                    let camera_dest = project_temp.join("camera.webm");
                    let camera_src = {
                        let state_lock = state.lock().unwrap();
                        let capture_path = state_lock.camera_video_file(rid);
                        if !capture_path.exists() && camera_dest.exists() {
                            camera_dest.clone()
                        } else {
                            capture_path
                        }
                    };
                    log::info!(
                        "[stop_recording] Staging camera/microphone file: {:?} -> {:?}",
                        camera_src,
                        camera_dest
                    );
                    move_or_copy_recording_file(
                        &camera_src,
                        &camera_dest,
                        "selected camera/microphone recording",
                    )?;
                    probe_device_recording(&camera_dest, has_camera, has_mic)
                        .await
                        .map_err(|error| {
                            recording_save_error(
                                "validating the selected camera/microphone recording",
                                error,
                            )
                        })?
                } else {
                    None
                };

                let camera_dims = camera_metadata.map(|metadata| {
                    log::info!(
                        "[stop_recording] Camera dimensions: {}x{}",
                        metadata.width,
                        metadata.height
                    );
                    (metadata.width, metadata.height)
                });

                // FFmpeg children that failed after spawning can leave no usable
                // file. Keep the main recording and every successful extra, while
                // ensuring the manifest only references entries actually saved.
                let extra_tracks = successful_extra_tracks(&project_temp, extra_tracks)?;

                let duration_ms = screen_metadata
                    .and_then(|metadata| metadata.duration_ms)
                    .unwrap_or_else(|| (stop_timestamp - recording_start_ts).max(1000));
                log::info!("[stop_recording] Video duration: {}ms", duration_ms);

                let camera_dims_json = match camera_dims {
                    Some((w, h)) => serde_json::json!({"x": w, "y": h}),
                    None => serde_json::json!(null),
                };

                let clip_layout = if has_camera && has_camera_file {
                    serde_json::json!({
                        "mode": "camera-overlay",
                        "config": {
                            "cameraPosition": { "x": 0, "y": 1 },
                            "cameraBaseScale": 0.5,
                            "cameraBorderRadius": 0.25
                        }
                    })
                } else {
                    serde_json::json!({
                        "mode": "screen-fullscreen"
                    })
                };

                let project_json = serde_json::json!({
                    "version": 1,
                    "project": {
                        "id": pid,
                        "name": source_name,
                        "hasCameraVideo": has_camera && has_camera_file,
                        "hasMicrophoneAudio": has_mic && has_camera_file,
                        "hasSystemAudio": has_system_audio,
                        "cameraVideoDimensions": camera_dims_json,
                        "padding": 1,
                        "borderRadius": 0,
                        "mouseEvents": mouse_events,
                        "keyboardEvents": keyboard_events,
                        "extraTracks": extra_tracks,
                        "leftTrim": left_trim,
                        "rightTrim": right_trim,
                        "topTrim": top_trim,
                        "bottomTrim": bottom_trim,
                        "videoDetails": {
                            "start": 0,
                            "end": duration_ms
                        }
                    },
                    "clipAnims": {
                        "entities": [{
                            "start": 0,
                            "end": duration_ms,
                            "layout": clip_layout
                        }]
                    }
                });

                let project_json_path = project_temp.join("project.json");
                let project_json_bytes =
                    serde_json::to_vec_pretty(&project_json).map_err(|error| {
                        recording_save_error("serializing the project manifest", error)
                    })?;
                std::fs::write(&project_json_path, project_json_bytes)
                    .map_err(|error| recording_save_error("writing the project manifest", error))?;

                let zip_path = projects_dir.join(format!("{}.zip", pid));
                std::fs::create_dir_all(&projects_dir).map_err(|error| {
                    recording_save_error("creating the project library directory", error)
                })?;

                // A prior attempt can have completed the ZIP but failed to publish
                // the library store. On a retry the capture is already staged at
                // dest_video, so replacing that unpublished archive is safe.
                prepare_project_archive_destination(&zip_path, recording_video == dest_video)?;

                log::info!("[stop_recording] Creating zip at: {:?}", zip_path);

                let mut archive_entries = vec![
                    ProjectArchiveEntry {
                        archive_name: "project.json".to_string(),
                        source_path: project_json_path.clone(),
                    },
                    ProjectArchiveEntry {
                        archive_name: "screen.mp4".to_string(),
                        source_path: dest_video.clone(),
                    },
                ];
                if has_camera_file {
                    archive_entries.push(ProjectArchiveEntry {
                        archive_name: "camera.webm".to_string(),
                        source_path: project_temp.join("camera.webm"),
                    });
                }
                for track in &extra_tracks {
                    let archive_name = track.archive_filename()?.to_string();
                    let source_path = track.capture_path(&project_temp)?;
                    log::info!(
                        "[stop_recording] Adding multi-app track {} from {:?}",
                        archive_name,
                        source_path
                    );
                    archive_entries.push(ProjectArchiveEntry {
                        archive_name,
                        source_path,
                    });
                }
                create_project_archive(&zip_path, &archive_entries)?;

                // Publish to the library only after the complete archive has been
                // finalized and atomically renamed into place.
                let store = match app.store("store.json") {
                    Ok(store) => store,
                    Err(error) => {
                        if let Err(cleanup_error) = std::fs::remove_file(&zip_path) {
                            log::error!(
                                "[stop_recording] Could not remove unpublished archive {:?}: {}",
                                zip_path,
                                cleanup_error
                            );
                        }
                        return Err(recording_save_error(
                            "opening the project library",
                            error,
                        ));
                    }
                };
                let zip_str = zip_path.to_string_lossy().to_string();
                let projects_key = "projects";
                let path_key = format!("projects.{}.path", pid);
                let previous_projects = store.get(projects_key);
                let previous_path = store.get(&path_key);
                let mut projects = previous_projects
                    .clone()
                    .and_then(|value| match value {
                        Value::Object(map) => Some(map),
                        _ => None,
                    })
                    .unwrap_or_default();

                projects.insert(
                    pid.clone(),
                    serde_json::json!({
                        "id": pid,
                        "lastSaved": chrono::Utc::now().timestamp_millis(),
                        "name": source_name,
                        "path": zip_str,
                    }),
                );
                store.set(projects_key, Value::Object(projects));
                store.set(&path_key, serde_json::json!(zip_str));
                if let Err(error) = store.save() {
                    match previous_projects {
                        Some(value) => store.set(projects_key, value),
                        None => {
                            store.delete(projects_key);
                        }
                    }
                    match previous_path {
                        Some(value) => store.set(&path_key, value),
                        None => {
                            store.delete(&path_key);
                        }
                    }
                    // Restore the last known in-memory state. If the first write
                    // partially touched disk, this best-effort second save also
                    // gives the store plugin a chance to put the old data back.
                    if let Err(rollback_error) = store.save() {
                        log::error!(
                            "[stop_recording] Project library rollback also failed: {}",
                            rollback_error
                        );
                    }
                    if let Err(cleanup_error) = std::fs::remove_file(&zip_path) {
                        log::error!(
                            "[stop_recording] Could not remove the unpublished archive {:?}: {}",
                            zip_path,
                            cleanup_error
                        );
                    }
                    return Err(recording_save_error("updating the project library", error));
                }
                log::info!("[stop_recording] Project stored: {}", pid);

                Ok(())
            }
            .await;

            if let Err(error) = save_result {
                project_save_failure = Some(error);
            }

            {
                let mut state = state.lock().unwrap();
                // Close any file handles left over from the recording phase.
                // Leave project_id set so that between this point and
                // open_project() running on the main window, any file/video
                // command keyed on state.project_id still resolves to the
                // just-recorded project. open_project will re-set it to the
                // same id moments later.
                state.file_handles.clear();
            }

            if project_save_failure.is_none() {
                log::info!("[stop_recording] Emitting project-created: {}", pid);
                app.emit_to("main", "project-created", pid.as_str()).ok();
                app.emit_to("main", "load", "").ok();
            }
        } else {
            project_save_failure = Some(recording_save_error(
                "finalizing the recording",
                "the project or recording identifier is missing",
            ));
        }
    } else {
        log::warn!(
            "[stop_recording] No valid video file found at: {:?}",
            recording_video_path
        );
        // Emit specific error so the UI can show a helpful message
        let error_code = if has_non_empty_video {
            "CaptureError"
        } else {
            #[cfg(target_os = "macos")]
            {
                macos_recording_error_code_for_empty_output()
            }
            #[cfg(not(target_os = "macos"))]
            {
                "CaptureError"
            }
        };
        app.emit("recording-error", error_code).ok();

        #[cfg(target_os = "macos")]
        {
            if error_code == "ScreenPermissionDenied" {
                log::error!("[stop_recording] No frames captured and macOS screen recording permission check failed. Go to System Settings > Privacy & Security > Screen Recording.");
            } else if has_non_empty_video {
                log::error!("[stop_recording] Frames were captured, but FFmpeg did not produce a readable MP4.");
            } else {
                log::error!("[stop_recording] No frames captured, but macOS screen recording permission check passed. Treating as a capture startup failure.");
            }
        }
        project_save_failure = Some(recording_save_error(
            "validating the screen recording",
            error_code,
        ));
    }

    if let Some(error) = project_save_failure.take() {
        let message = error.to_string();
        log::error!("[stop_recording] {}", message);
        app.emit_to("main", "recording-error", message).ok();
        app.emit_to("main", "load", serde_json::Value::Null).ok();
        // Do not close the recorder or clear the staging token. The renderer
        // remains available with Retry and Discard controls, and a retry can
        // package the already-stopped capture from the staged project files.
        return Err(error);
    }

    {
        let mut state = state.lock().unwrap();
        state.recording_id = None;
        state.recording_start_timestamp = None;
        state.multi_app_tracks.clear();
        state.multi_app_init_in_progress = false;
        state.multi_app_stop_requested = false;
        state.multi_app_finalize_error = None;
        state.file_handles.clear();
    }

    // The project is fully durable and registered. Only now close the retry UI
    // and return focus to the main window.
    if let Some(recorder_win) = app.get_webview_window("recorder") {
        recorder_win.close().ok();
    }
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.unminimize().ok();
        main_win.show().ok();
        main_win.set_focus().ok();
    }

    // Fan out "recording-stopped" to every live window except the recorder.
    // A broadcast emit() would target its closed HWND on Windows.
    for (label, _) in app.webview_windows() {
        if label == "recorder" {
            continue;
        }
        app.emit_to(label.as_str(), "recording-stopped", true).ok();
    }

    if let Some(ref rid) = recording_id {
        let state_lock = state.lock().unwrap();
        let rec_temp = state_lock.project_temp_dir(rid);
        drop(state_lock);
        if rec_temp.exists() {
            std::fs::remove_dir_all(&rec_temp).ok();
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn reset_recording(app: AppHandle) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    {
        let mut state = state.lock().unwrap();
        if !state.is_recording || state.recording_stop_in_progress {
            return Err(AppError::General(
                "Recording cleanup is already in progress.".to_string(),
            ));
        }
        state.recording_stop_in_progress = true;
        state.recording_capture_claimed = false;
    }

    tokio::task::spawn_blocking({
        let app = app.clone();
        move || kill_ffmpeg(&app)
    })
    .await
    .ok();

    let children = {
        let mut state = state.lock().unwrap();
        state.keyboard_tracker.stop();
        state.mouse_tracker.stop();
        close_camera_file_handle(&mut state);
        state.multi_app_tracks.clear();
        state.multi_app_init_in_progress = false;
        state.multi_app_stop_requested = false;
        state.multi_app_finalize_error = None;
        std::mem::take(&mut state.multi_app_children)
    };
    if let Err(error) = crate::commands::multi_app::graceful_shutdown(children) {
        log::warn!("[reset_recording] App-layer cleanup failed: {}", error);
    }

    #[cfg(target_os = "macos")]
    crate::mouse_tracker::restore_macos_cursor();

    let recording_id = {
        let mut state = state.lock().unwrap();
        state.ffmpeg_child_id = None;
        state.ffmpeg_child = None;
        state.ffmpeg_process = None;
        state.macos_capture_process = None;
        state.recording_id.clone()
    };

    if let Some(rid) = recording_id {
        let state_lock = state.lock().unwrap();
        let temp_dir = state_lock.project_temp_dir(&rid);
        drop(state_lock);

        if temp_dir.exists() {
            std::fs::remove_dir_all(&temp_dir).ok();
            std::fs::create_dir_all(&temp_dir).ok();
        }
    }

    state.lock().unwrap().recording_stop_in_progress = false;

    Ok(())
}

#[tauri::command]
pub async fn cancel_recording(app: AppHandle, error: Option<String>) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    {
        let mut state = state.lock().unwrap();
        if state.recording_stop_in_progress {
            log::warn!("[cancel_recording] Cleanup is already in progress");
            return Ok(());
        }
        state.recording_stop_in_progress = true;
        state.recording_capture_claimed = false;
        state.is_recording = false;
    }

    tokio::task::spawn_blocking({
        let app = app.clone();
        move || kill_ffmpeg(&app)
    })
    .await
    .ok();

    crate::commands::audio::unmute_all_sessions(&app);
    let children = {
        let mut state = state.lock().unwrap();
        state.keyboard_tracker.stop();
        state.multi_app_tracks.clear();
        state.multi_app_init_in_progress = false;
        state.multi_app_stop_requested = false;
        state.multi_app_finalize_error = None;
        std::mem::take(&mut state.multi_app_children)
    };
    if let Err(error) = crate::commands::multi_app::graceful_shutdown(children) {
        log::warn!("[cancel_recording] App-layer cleanup failed: {}", error);
    }

    #[cfg(target_os = "macos")]
    crate::mouse_tracker::restore_macos_cursor();

    let temp_dirs = {
        let mut state = state.lock().unwrap();
        state.is_recording = false;
        state.recording_capture_claimed = false;
        state.ffmpeg_child_id = None;
        state.ffmpeg_child = None;
        state.ffmpeg_process = None;
        state.macos_capture_process = None;
        state.mouse_tracker.stop();
        close_camera_file_handle(&mut state);
        #[cfg(target_os = "macos")]
        crate::mouse_tracker::restore_macos_cursor();
        state.recording_start_timestamp = None;
        state.camera_mic_config = None;
        let recording_id = state.recording_id.take();
        let project_id = state.project_id.take();
        let mut dirs = Vec::with_capacity(2);
        if let Some(ref rid) = recording_id {
            dirs.push(state.project_temp_dir(rid));
        }
        if let Some(ref pid) = project_id {
            let project_dir = state.project_temp_dir(pid);
            if !dirs.contains(&project_dir) {
                dirs.push(project_dir);
            }
        }
        dirs
    };

    for temp_dir in temp_dirs {
        if temp_dir.exists() {
            std::fs::remove_dir_all(&temp_dir).ok();
        }
    }

    if let Some(recorder_win) = app.get_webview_window("recorder") {
        recorder_win.close().ok();
    }

    if let Some(main_win) = app.get_webview_window("main") {
        main_win.unminimize().ok();
        main_win.show().ok();
        main_win.set_focus().ok();
    }

    let err_str = error.unwrap_or_default();
    app.emit_to("main", "recording-canceled", &err_str).ok();

    if !err_str.is_empty() {
        app.emit_to("main", "recording-error", &err_str).ok();
    }

    state.lock().unwrap().recording_stop_in_progress = false;

    Ok(())
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct VideoMetadata {
    duration_ms: Option<i64>,
    width: i64,
    height: i64,
}

fn parse_duration_ms(stderr: &str) -> Option<i64> {
    let duration = stderr
        .lines()
        .find_map(|line| line.split_once("Duration: ").map(|(_, value)| value))?
        .split(',')
        .next()?
        .trim();
    if duration.eq_ignore_ascii_case("N/A") {
        return None;
    }

    let mut parts = duration.split(':');
    let hours = parts.next()?.parse::<f64>().ok()?;
    let minutes = parts.next()?.parse::<f64>().ok()?;
    let seconds = parts.next()?.parse::<f64>().ok()?;
    if parts.next().is_some() {
        return None;
    }
    let duration_ms = ((hours * 3600.0 + minutes * 60.0 + seconds) * 1000.0).round() as i64;
    (duration_ms > 0).then_some(duration_ms)
}

fn dimensions_from_video_line(line: &str) -> Option<(i64, i64)> {
    if !line.contains("Video:") {
        return None;
    }

    let bytes = line.as_bytes();
    for index in 1..bytes.len().saturating_sub(1) {
        if bytes[index] != b'x' && bytes[index] != b'X' {
            continue;
        }
        let mut start = index;
        while start > 0 && bytes[start - 1].is_ascii_digit() {
            start -= 1;
        }
        let mut end = index + 1;
        while end < bytes.len() && bytes[end].is_ascii_digit() {
            end += 1;
        }
        if start == index || end == index + 1 {
            continue;
        }

        let width = line[start..index].parse::<i64>().ok()?;
        let height = line[index + 1..end].parse::<i64>().ok()?;
        if (16..=32768).contains(&width) && (16..=32768).contains(&height) {
            return Some((width, height));
        }
    }
    None
}

fn parse_video_metadata(stderr: &str) -> Result<VideoMetadata, String> {
    let (width, height) = stderr
        .lines()
        .find_map(dimensions_from_video_line)
        .ok_or_else(|| "Could not parse video dimensions".to_string())?;
    Ok(VideoMetadata {
        duration_ms: parse_duration_ms(stderr),
        width,
        height,
    })
}

/// Validate a recording and collect its metadata with one first-frame decode.
/// The old stop path decoded the complete screen file three times, making stop
/// time scale with recording length and needlessly consuming CPU/GPU.
fn screen_recording_probe_args(
    video_path: &std::path::Path,
    requires_audio: bool,
) -> Vec<String> {
    let mut args = vec![
        "-hide_banner".to_string(),
        "-nostdin".to_string(),
        "-i".to_string(),
        video_path.to_string_lossy().to_string(),
        "-map".to_string(),
        "0:v:0".to_string(),
        "-frames:v".to_string(),
        "1".to_string(),
    ];
    if requires_audio {
        args.extend([
            "-map".to_string(),
            "0:a:0".to_string(),
            "-frames:a".to_string(),
            "1".to_string(),
        ]);
    }
    args.extend(["-f".to_string(), "null".to_string(), "-".to_string()]);
    args
}

async fn probe_video_metadata(
    video_path: &std::path::Path,
    requires_audio: bool,
) -> Result<VideoMetadata, String> {
    let args = screen_recording_probe_args(video_path, requires_audio);
    let arg_refs = args.iter().map(String::as_str).collect::<Vec<_>>();
    let output = run_ffmpeg(&arg_refs)
    .await
    .map_err(|error| format!("FFmpeg error: {}", error))?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !output.status.success() {
        let reason = stderr
            .lines()
            .rev()
            .find(|line| !line.trim().is_empty())
            .unwrap_or("first-frame decode failed");
        return Err(reason.to_string());
    }
    parse_video_metadata(&stderr)
}

fn device_recording_probe_args(
    media_path: &std::path::Path,
    requires_video: bool,
    requires_audio: bool,
) -> Result<Vec<String>, String> {
    if !requires_video && !requires_audio {
        return Err("No camera or microphone stream was requested".to_string());
    }

    let mut args = vec![
        "-hide_banner".to_string(),
        "-nostdin".to_string(),
        "-i".to_string(),
        media_path.to_string_lossy().to_string(),
    ];
    if requires_video {
        args.extend([
            "-map".to_string(),
            "0:v:0".to_string(),
            "-frames:v".to_string(),
            "1".to_string(),
        ]);
    }
    if requires_audio {
        args.extend([
            "-map".to_string(),
            "0:a:0".to_string(),
            "-frames:a".to_string(),
            "1".to_string(),
        ]);
    }
    args.extend(["-f".to_string(), "null".to_string(), "-".to_string()]);
    Ok(args)
}

/// Decode one frame from every selected device stream. Mandatory FFmpeg maps
/// make a camera-only, microphone-only, or combined capture fail when any
/// requested stream is absent, while keeping validation independent of clip
/// duration.
async fn probe_device_recording(
    media_path: &std::path::Path,
    requires_video: bool,
    requires_audio: bool,
) -> Result<Option<VideoMetadata>, String> {
    let args = device_recording_probe_args(media_path, requires_video, requires_audio)?;
    let arg_refs = args.iter().map(String::as_str).collect::<Vec<_>>();
    let output = run_ffmpeg(&arg_refs)
        .await
        .map_err(|error| format!("FFmpeg error: {}", error))?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !output.status.success() {
        let reason = stderr
            .lines()
            .rev()
            .find(|line| !line.trim().is_empty())
            .unwrap_or("device stream decode failed");
        return Err(reason.to_string());
    }

    if requires_video {
        parse_video_metadata(&stderr).map(Some)
    } else {
        Ok(None)
    }
}

/// Stop the FFmpeg process gracefully by writing "q" to stdin and waiting for exit.
/// For window capture: signals capture thread to stop (which drops stdin → EOF).
/// For screen/area capture: writes "q\n" to stdin of std::process::Child.
fn wait_for_capture_thread(
    thread: &std::thread::JoinHandle<()>,
    timeout: std::time::Duration,
) -> bool {
    let deadline = std::time::Instant::now() + timeout;
    while !thread.is_finished() && std::time::Instant::now() < deadline {
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
    thread.is_finished()
}

#[cfg(target_os = "macos")]
fn stop_macos_capture_process(mut process: std::process::Child) {
    use std::io::Write;

    let pid = process.id();
    if let Some(mut stdin) = process.stdin.take() {
        if let Err(error) = stdin.write_all(b"stop\n").and_then(|_| stdin.flush()) {
            log::warn!(
                "[macos-capture] Could not request graceful stop for PID {}: {}",
                pid,
                error
            );
        }
    }

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
    loop {
        match process.try_wait() {
            Ok(Some(status)) => {
                if status.success() {
                    log::info!(
                        "[macos-capture] ScreenCaptureKit helper PID {} finalized successfully",
                        pid
                    );
                } else {
                    log::error!(
                        "[macos-capture] ScreenCaptureKit helper PID {} exited with {}",
                        pid,
                        status
                    );
                }
                return;
            }
            Ok(None) if std::time::Instant::now() < deadline => {
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            Ok(None) => {
                log::error!(
                    "[macos-capture] ScreenCaptureKit helper PID {} did not finalize in time",
                    pid
                );
                process.kill().ok();
                process.wait().ok();
                return;
            }
            Err(error) => {
                log::error!(
                    "[macos-capture] Could not wait for helper PID {}: {}",
                    pid,
                    error
                );
                process.kill().ok();
                process.wait().ok();
                return;
            }
        }
    }
}

fn kill_ffmpeg(app: &AppHandle) {
    let state = app.state::<Mutex<AppState>>();

    #[cfg(target_os = "macos")]
    {
        let native_process = state.lock().unwrap().macos_capture_process.take();
        if let Some(process) = native_process {
            stop_macos_capture_process(process);
            state.lock().unwrap().ffmpeg_child_id = None;
            return;
        }
    }

    let is_window_capture = {
        let s = state.lock().unwrap();
        s.camera_mic_config
            .as_ref()
            .and_then(|c| c.get("isWindowCapture"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    };
    let uses_stdin_pipe = is_window_capture && cfg!(target_os = "windows");

    if uses_stdin_pipe {
        // Signal the capture thread to stop
        {
            let s = state.lock().unwrap();
            s.window_capture_stop.store(true, Ordering::Relaxed);
        }

        // Join the capture thread (drops stdin → FFmpeg gets EOF)
        let thread = {
            let mut s = state.lock().unwrap();
            s.window_capture_thread.take()
        };
        if let Some(thread) = thread {
            let graceful_timeout = std::time::Duration::from_millis(750);
            if !wait_for_capture_thread(&thread, graceful_timeout) {
                log::warn!(
                    "[kill_ffmpeg] Window capture writer did not stop; terminating FFmpeg to unblock it"
                );
                let mut stalled_process = {
                    let mut state = state.lock().unwrap();
                    state.ffmpeg_process.take()
                };
                if let Some(process) = stalled_process.as_mut() {
                    let _ = process.kill();
                } else {
                    let pid = state.lock().unwrap().ffmpeg_child_id;
                    if let Some(pid) = pid {
                        force_kill_ffmpeg(pid);
                    }
                }
                if let Some(process) = stalled_process {
                    state.lock().unwrap().ffmpeg_process = Some(process);
                }
            }

            if wait_for_capture_thread(&thread, graceful_timeout) {
                thread.join().ok();
                log::info!("[kill_ffmpeg] Window capture thread joined");
            } else {
                // PrintWindow itself can block inside a hung target. FFmpeg is
                // already terminated, so detach rather than hanging Stop.
                log::error!(
                    "[kill_ffmpeg] Window capture thread remained blocked after FFmpeg termination; detaching it"
                );
            }
        }
    }

    // Take the FFmpeg process (used by both window and screen/area capture now)
    let (pid, mut process) = {
        let mut s = state.lock().unwrap();
        (s.ffmpeg_child_id.take(), s.ffmpeg_process.take())
    };

    if let Some(ref mut process) = process {
        let pid_val = pid.unwrap_or(0);

        if !uses_stdin_pipe {
            use std::io::Write;
            // Send "q\n" to FFmpeg stdin for graceful shutdown
            if let Some(ref mut stdin) = process.stdin.take() {
                match stdin.write_all(b"q\n").and_then(|_| stdin.flush()) {
                    Ok(_) => {
                        log::info!("[kill_ffmpeg] Sent 'q' to FFmpeg PID: {}", pid_val);
                    }
                    Err(e) => {
                        log::warn!("[kill_ffmpeg] Failed to write to stdin: {}", e);
                    }
                }
            }
        }

        // Wait for FFmpeg to finalize (up to 8 seconds)
        let start = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(8);
        loop {
            match process.try_wait() {
                Ok(Some(status)) => {
                    log::info!("[kill_ffmpeg] FFmpeg exited with: {:?}", status);
                    return;
                }
                Ok(None) => {
                    if start.elapsed() > timeout {
                        log::warn!("[kill_ffmpeg] FFmpeg didn't exit in time, force killing");
                        process.kill().ok();
                        process.wait().ok();
                        return;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                Err(e) => {
                    log::error!("[kill_ffmpeg] Error waiting for FFmpeg: {}", e);
                    process.kill().ok();
                    process.wait().ok();
                    return;
                }
            }
        }
    } else if let Some(pid) = pid {
        log::warn!(
            "[kill_ffmpeg] No process handle, force killing PID: {}",
            pid
        );
        force_kill_ffmpeg(pid);
    }
}

/// Force kill FFmpeg process by PID as a last resort
fn force_kill_ffmpeg(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()
            .ok();
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output()
            .ok();
    }
}

#[tauri::command]
pub async fn get_source_screenshot(app: AppHandle, source: Value) -> AppResult<String> {
    use base64::Engine;

    let state = app.state::<Mutex<AppState>>();
    let temp_dir = {
        let s = state.lock().unwrap();
        s.temp_dir.clone()
    };
    std::fs::create_dir_all(&temp_dir).ok();
    let screenshot_path = temp_dir.join("preview_screenshot.png");
    let screenshot_str = screenshot_path.to_string_lossy().to_string();

    // On Windows, gdigrab operates in physical pixel space
    let (screen_w, screen_h) = if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = main_win.current_monitor() {
            let size = monitor.size();
            #[cfg(target_os = "windows")]
            {
                (size.width as f64, size.height as f64)
            }
            #[cfg(not(target_os = "windows"))]
            {
                let scale = monitor.scale_factor();
                (size.width as f64 / scale, size.height as f64 / scale)
            }
        } else {
            (1920.0, 1080.0)
        }
    } else {
        (1920.0, 1080.0)
    };

    let source_type = source
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("screen");

    // For window screenshots, use PrintWindow API directly (no FFmpeg needed)
    if source_type == "window" {
        #[cfg(target_os = "windows")]
        {
            let hwnd: isize = source
                .get("id")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0);
            let w = source.get("width").and_then(|v| v.as_i64()).unwrap_or(1920) as i32;
            let h = source
                .get("height")
                .and_then(|v| v.as_i64())
                .unwrap_or(1080) as i32;

            if hwnd != 0 {
                if let Some(bmp_data) = screenshot_window_printwindow(hwnd, w, h) {
                    // Write BMP to temp file, convert to PNG via FFmpeg
                    let bmp_path = temp_dir.join("preview_window.bmp");
                    let bmp_str = bmp_path.to_string_lossy().to_string();
                    std::fs::write(&bmp_path, &bmp_data)?;

                    let output = run_ffmpeg(&["-y", "-i", &bmp_str, &screenshot_str]).await?;

                    std::fs::remove_file(&bmp_path).ok();

                    if !output.status.success() {
                        log::warn!(
                            "[screenshot] FFmpeg BMP->PNG stderr: {}",
                            String::from_utf8_lossy(&output.stderr)
                        );
                    }

                    if screenshot_path.exists() {
                        let data = std::fs::read(&screenshot_path)?;
                        std::fs::remove_file(&screenshot_path).ok();
                        if !data.is_empty() {
                            let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                            return Ok(format!("data:image/png;base64,{}", b64));
                        }
                    }
                }
            }

            // Fallback: use platform-specific offset-based capture
            let x = source.get("x").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
            let y = source.get("y").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
            let w64 = source.get("width").and_then(|v| v.as_i64()).unwrap_or(1920);
            let h64 = source
                .get("height")
                .and_then(|v| v.as_i64())
                .unwrap_or(1080);
            let w64 = w64.min(screen_w as i64 - x);
            let h64 = h64.min(screen_h as i64 - y);
            let w64 = (w64 - (w64 % 2)).max(2);
            let h64 = (h64 - (h64 % 2)).max(2);

            if let Some(main_win) = app.get_webview_window("main") {
                main_win
                    .set_content_protected(super::windows::is_content_protection_enabled(&app))
                    .ok();
            }

            let args = build_screenshot_args(x, y, w64, h64, &screenshot_str);
            let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

            let _output = run_ffmpeg(&args_refs).await?;

            if screenshot_path.exists() {
                let data = std::fs::read(&screenshot_path)?;
                std::fs::remove_file(&screenshot_path).ok();
                if !data.is_empty() {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                    return Ok(format!("data:image/png;base64,{}", b64));
                }
            }

            return Err(AppError::General("Window screenshot failed".to_string()));
        }

        #[cfg(not(target_os = "windows"))]
        {
            // On macOS, check screen recording permission before screencapture
            let x = source.get("x").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
            let y = source.get("y").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
            let w64 = source.get("width").and_then(|v| v.as_i64()).unwrap_or(1920);
            let h64 = source
                .get("height")
                .and_then(|v| v.as_i64())
                .unwrap_or(1080);

            #[cfg(target_os = "macos")]
            {
                if !crate::commands::app::macos_has_screen_recording_permission() {
                    return Err(AppError::General("ScreenPermissionDenied".to_string()));
                }
                let region = format!("{},{},{},{}", x, y, w64, h64);
                let output = super::run_macos_screencapture(
                    &["-x", "-R", &region, &screenshot_str],
                    std::time::Duration::from_secs(5),
                )
                .await?;
                if !output.status.success() {
                    log::warn!(
                        "[screenshot] screencapture stderr: {}",
                        String::from_utf8_lossy(&output.stderr)
                    );
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                let w64 = (w64 - (w64 % 2)).max(2);
                let h64 = (h64 - (h64 % 2)).max(2);
                let args = build_screenshot_args(x, y, w64, h64, &screenshot_str);
                let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
                let _output = run_ffmpeg(&args_refs).await?;
            }

            if screenshot_path.exists() {
                let data = std::fs::read(&screenshot_path)?;
                std::fs::remove_file(&screenshot_path).ok();
                if !data.is_empty() {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                    return Ok(format!("data:image/png;base64,{}", b64));
                }
            }

            return Err(AppError::General("Window screenshot failed".to_string()));
        }
    }

    // Screen/Area screenshot using platform-specific capture
    if let Some(main_win) = app.get_webview_window("main") {
        main_win
            .set_content_protected(super::windows::is_content_protection_enabled(&app))
            .ok();
    }

    // On macOS, check screen recording permission before calling screencapture
    // to avoid spamming the permission dialog on macOS Sequoia+
    #[cfg(target_os = "macos")]
    {
        if !crate::commands::app::macos_has_screen_recording_permission() {
            return Err(AppError::General("ScreenPermissionDenied".to_string()));
        }
        let (x, y, w, h) = match source_type {
            "area" => {
                let x_pct = source.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let y_pct = source.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let w_pct = source
                    .get("width")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(100.0);
                let h_pct = source
                    .get("height")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(100.0);
                let x = (x_pct / 100.0 * screen_w) as i64;
                let y = (y_pct / 100.0 * screen_h) as i64;
                let w = ((w_pct / 100.0 * screen_w) as i64).max(2);
                let h = ((h_pct / 100.0 * screen_h) as i64).max(2);
                (x, y, w, h)
            }
            _ => {
                let mx = source.get("monitorX").and_then(|v| v.as_i64()).unwrap_or(0);
                let my = source.get("monitorY").and_then(|v| v.as_i64()).unwrap_or(0);
                let mw = source.get("monitorWidth").and_then(|v| v.as_i64());
                let mh = source.get("monitorHeight").and_then(|v| v.as_i64());
                if let (Some(w), Some(h)) = (mw, mh) {
                    (mx, my, w, h)
                } else {
                    (0, 0, screen_w as i64, screen_h as i64)
                }
            }
        };

        let region = format!("{},{},{},{}", x, y, w, h);
        let output = super::run_macos_screencapture(
            &["-x", "-R", &region, &screenshot_str],
            std::time::Duration::from_secs(5),
        )
        .await?;

        if !output.status.success() {
            log::warn!(
                "[screenshot] screencapture stderr: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }

        if screenshot_path.exists() {
            let data = std::fs::read(&screenshot_path)?;
            std::fs::remove_file(&screenshot_path).ok();
            if !data.is_empty() {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                return Ok(format!("data:image/png;base64,{}", b64));
            }
        }
        Err(AppError::General("Screenshot capture failed".to_string()))
    }

    // Windows/Linux: use FFmpeg for screenshots
    #[cfg(not(target_os = "macos"))]
    {
        let args: Vec<String> = match source_type {
            "area" => {
                let x_pct = source.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let y_pct = source.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let w_pct = source
                    .get("width")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(100.0);
                let h_pct = source
                    .get("height")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(100.0);
                let x = (x_pct / 100.0 * screen_w) as i64;
                let y = (y_pct / 100.0 * screen_h) as i64;
                let w = ((w_pct / 100.0 * screen_w) as i64).max(2);
                let h = ((h_pct / 100.0 * screen_h) as i64).max(2);
                let w = w - (w % 2);
                let h = h - (h % 2);
                build_screenshot_args(x, y, w, h, &screenshot_str)
            }
            _ => {
                #[cfg(target_os = "windows")]
                let (monitor_x, monitor_y, monitor_w, monitor_h) = {
                    let mx = source
                        .get("physicalX")
                        .or_else(|| source.get("monitorX"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    let my = source
                        .get("physicalY")
                        .or_else(|| source.get("monitorY"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    let mw = source
                        .get("physicalWidth")
                        .or_else(|| source.get("monitorWidth"))
                        .and_then(|v| v.as_i64());
                    let mh = source
                        .get("physicalHeight")
                        .or_else(|| source.get("monitorHeight"))
                        .and_then(|v| v.as_i64());
                    (mx, my, mw, mh)
                };
                #[cfg(not(target_os = "windows"))]
                let (monitor_x, monitor_y, monitor_w, monitor_h) = {
                    let mx = source.get("monitorX").and_then(|v| v.as_i64()).unwrap_or(0);
                    let my = source.get("monitorY").and_then(|v| v.as_i64()).unwrap_or(0);
                    let mw = source.get("monitorWidth").and_then(|v| v.as_i64());
                    let mh = source.get("monitorHeight").and_then(|v| v.as_i64());
                    (mx, my, mw, mh)
                };

                if let (Some(w), Some(h)) = (monitor_w, monitor_h) {
                    let w = (w - (w % 2)).max(2);
                    let h = (h - (h % 2)).max(2);
                    build_screenshot_args(monitor_x, monitor_y, w, h, &screenshot_str)
                } else {
                    build_screenshot_args(0, 0, screen_w as i64, screen_h as i64, &screenshot_str)
                }
            }
        };

        let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        let output = run_ffmpeg(&args_refs).await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            log::warn!("[FFmpeg screenshot] stderr: {}", stderr);
        }

        if screenshot_path.exists() {
            let data = std::fs::read(&screenshot_path)?;
            std::fs::remove_file(&screenshot_path).ok();
            if data.is_empty() {
                return Err(AppError::General("Screenshot file is empty".to_string()));
            }
            let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
            Ok(format!("data:image/png;base64,{}", b64))
        } else {
            Err(AppError::General("Screenshot capture failed".to_string()))
        }
    }
}

#[tauri::command]
pub async fn take_recording_screenshot(app: AppHandle) -> AppResult<String> {
    let state = app.state::<Mutex<AppState>>();
    let temp_dir = {
        let s = state.lock().unwrap();
        s.temp_dir.clone()
    };

    let screenshots_dir = temp_dir.join("screenshots");
    std::fs::create_dir_all(&screenshots_dir).ok();

    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let screenshot_path = screenshots_dir.join(format!("screenshot_{}.png", timestamp));
    let screenshot_str = screenshot_path.to_string_lossy().to_string();

    // Get screen dimensions
    let (screen_w, screen_h) = if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = main_win.current_monitor() {
            let size = monitor.size();
            #[cfg(target_os = "windows")]
            {
                (size.width as i64, size.height as i64)
            }
            #[cfg(not(target_os = "windows"))]
            {
                let scale = monitor.scale_factor();
                (
                    (size.width as f64 / scale) as i64,
                    (size.height as f64 / scale) as i64,
                )
            }
        } else {
            (1920i64, 1080i64)
        }
    } else {
        (1920i64, 1080i64)
    };

    let args = build_screenshot_args(0, 0, screen_w, screen_h, &screenshot_str);
    let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let _output = run_ffmpeg(&args_refs).await?;

    if screenshot_path.exists() {
        // Open the screenshots folder in the file explorer
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("explorer")
                .arg("/select,")
                .arg(&screenshot_str)
                .spawn();
        }
        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("open")
                .arg("-R")
                .arg(&screenshot_str)
                .spawn();
        }
        #[cfg(target_os = "linux")]
        {
            let _ = std::process::Command::new("xdg-open")
                .arg(screenshots_dir.to_string_lossy().to_string())
                .spawn();
        }
        Ok(screenshot_str)
    } else {
        Err(AppError::General("Screenshot capture failed".to_string()))
    }
}

/// Get the platform-specific FFmpeg capture format for screen recording.
/// Windows no longer uses this — the screen/area recording path goes through
/// the `ddagrab` lavfi source filter directly.
#[cfg(not(target_os = "windows"))]
fn platform_capture_format() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "avfoundation"
    }
    #[cfg(target_os = "linux")]
    {
        "x11grab"
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        "x11grab"
    }
}

/// Get the platform default audio capture device name
fn platform_default_audio_device() -> String {
    #[cfg(target_os = "windows")]
    {
        "virtual-audio-capturer".to_string()
    }
    #[cfg(target_os = "macos")]
    {
        // Try to detect available virtual audio devices via FFmpeg
        // Common options: BlackHole 2ch, Soundflower (2ch), Background Music
        if let Some(ffmpeg) = find_ffmpeg_path() {
            if let Ok(output) = std::process::Command::new(&ffmpeg)
                .args(["-f", "avfoundation", "-list_devices", "true", "-i", ""])
                .stderr(std::process::Stdio::piped())
                .stdout(std::process::Stdio::null())
                .output()
            {
                let stderr = String::from_utf8_lossy(&output.stderr);
                for name in [
                    "BlackHole 2ch",
                    "BlackHole 16ch",
                    "Soundflower (2ch)",
                    "Background Music",
                ] {
                    if stderr.contains(name) {
                        log::info!("[audio] Found macOS virtual audio device: {}", name);
                        return name.to_string();
                    }
                }
            }
        }
        log::warn!("[audio] No virtual audio device found on macOS. System audio recording requires BlackHole or similar.");
        "BlackHole 2ch".to_string()
    }
    #[cfg(target_os = "linux")]
    {
        "default".to_string()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        "default".to_string()
    }
}

/// Get platform-specific audio capture FFmpeg args (format, input)
fn platform_audio_capture_args(device: &str) -> (String, String) {
    #[cfg(target_os = "windows")]
    {
        ("dshow".to_string(), format!("audio={}", device))
    }
    #[cfg(target_os = "macos")]
    {
        // avfoundation audio: "none:<audio_device_index_or_name>"
        ("avfoundation".to_string(), format!("none:{}", device))
    }
    #[cfg(target_os = "linux")]
    {
        ("pulse".to_string(), device.to_string())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        ("pulse".to_string(), device.to_string())
    }
}

/// Run FFmpeg with the given arguments and return the output.
/// Uses std::process::Command for consistent cross-platform behavior.
async fn run_ffmpeg(args: &[&str]) -> AppResult<std::process::Output> {
    let ffmpeg_path = find_ffmpeg_path().ok_or_else(|| {
        AppError::General("FFmpeg binary not found. Please install FFmpeg.".to_string())
    })?;
    let path = ffmpeg_path.clone();
    let args_owned: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    tokio::task::spawn_blocking(move || {
        let mut cmd = std::process::Command::new(&path);
        cmd.args(&args_owned)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        cmd.output()
            .map_err(|e| AppError::General(format!("FFmpeg error: {}", e)))
    })
    .await
    .map_err(|e| AppError::General(format!("FFmpeg task error: {}", e)))?
}

/// Build platform-specific FFmpeg args for taking a single screenshot
fn build_screenshot_args(x: i64, y: i64, w: i64, h: i64, output_path: &str) -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        vec![
            "-y".into(),
            "-f".into(),
            "gdigrab".into(),
            "-framerate".into(),
            "1".into(),
            "-draw_mouse".into(),
            "0".into(),
            "-offset_x".into(),
            x.to_string(),
            "-offset_y".into(),
            y.to_string(),
            "-video_size".into(),
            format!("{}x{}", w, h),
            "-i".into(),
            "desktop".into(),
            "-frames:v".into(),
            "1".into(),
            "-update".into(),
            "true".into(),
            output_path.into(),
        ]
    }
    #[cfg(target_os = "macos")]
    {
        let screen_dev = macos_screen_device_index(0);
        let mut args: Vec<String> = vec![
            "-y".into(),
            "-f".into(),
            "avfoundation".into(),
            "-framerate".into(),
            "30".into(),
            "-pixel_format".into(),
            "nv12".into(),
            "-capture_cursor".into(),
            "0".into(),
            "-i".into(),
            format!("{}:none", screen_dev),
            "-frames:v".into(),
            "1".into(),
        ];
        // Crop to the requested region (works for all cases including x=0,y=0)
        args.extend(["-vf".into(), format!("crop={}:{}:{}:{}", w, h, x, y)]);
        args.push(output_path.into());
        args
    }
    #[cfg(target_os = "linux")]
    {
        let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());
        vec![
            "-y".into(),
            "-f".into(),
            "x11grab".into(),
            "-framerate".into(),
            "1".into(),
            "-draw_mouse".into(),
            "0".into(),
            "-video_size".into(),
            format!("{}x{}", w, h),
            "-i".into(),
            format!("{}+{},{}", display, x, y),
            "-frames:v".into(),
            "1".into(),
            "-update".into(),
            "true".into(),
            output_path.into(),
        ]
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        vec![
            "-y".into(),
            "-f".into(),
            "x11grab".into(),
            "-framerate".into(),
            "1".into(),
            "-video_size".into(),
            format!("{}x{}", w, h),
            "-i".into(),
            format!(":0+{},{}", x, y),
            "-frames:v".into(),
            "1".into(),
            output_path.into(),
        ]
    }
}

#[tauri::command]
pub async fn init_camera_file(app: AppHandle) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    // Open the camera file for writing so chunks can be streamed directly to disk
    let recording_id = state
        .recording_id
        .clone()
        .or_else(|| state.project_id.clone())
        .ok_or(AppError::NoProjectOpen)?;
    let path = state.camera_video_file(&recording_id);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let file = std::fs::File::create(&path)?;
    state.camera_file_handle = Some(file);
    Ok(())
}

#[tauri::command]
pub async fn enqueue_camera_chunk(app: AppHandle, chunk_base64: String) -> AppResult<()> {
    use base64::Engine;

    let chunk = base64::engine::general_purpose::STANDARD
        .decode(chunk_base64)
        .map_err(|e| AppError::General(format!("Invalid camera chunk: {}", e)))?;

    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    // Write chunk directly to disk instead of accumulating in memory
    if let Some(ref mut file) = state.camera_file_handle {
        std::io::Write::write_all(file, &chunk)?;
    } else {
        return Err(AppError::General("Camera file not initialized".to_string()));
    }
    Ok(())
}

#[tauri::command]
pub async fn finalize_camera_file(app: AppHandle) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    // Flush and close the file handle
    if let Some(mut file) = state.camera_file_handle.take() {
        std::io::Write::flush(&mut file)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_directory(label: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("flowtake-{}-{}", label, uuid::Uuid::new_v4()))
    }

    #[derive(Debug)]
    struct RejectCentralDirectoryWriter {
        inner: std::io::Cursor<Vec<u8>>,
        reject_next_central_directory: bool,
    }

    impl Default for RejectCentralDirectoryWriter {
        fn default() -> Self {
            Self {
                inner: std::io::Cursor::new(Vec::new()),
                reject_next_central_directory: true,
            }
        }
    }

    impl std::io::Write for RejectCentralDirectoryWriter {
        fn write(&mut self, buffer: &[u8]) -> std::io::Result<usize> {
            if self.reject_next_central_directory
                && buffer.windows(4).any(|bytes| bytes == b"PK\x01\x02")
            {
                self.reject_next_central_directory = false;
                return Err(std::io::Error::new(
                    std::io::ErrorKind::WriteZero,
                    "injected central-directory failure",
                ));
            }
            std::io::Write::write(&mut self.inner, buffer)
        }

        fn flush(&mut self) -> std::io::Result<()> {
            std::io::Write::flush(&mut self.inner)
        }
    }

    impl std::io::Seek for RejectCentralDirectoryWriter {
        fn seek(&mut self, position: std::io::SeekFrom) -> std::io::Result<u64> {
            std::io::Seek::seek(&mut self.inner, position)
        }
    }

    fn option_value<'a>(args: &'a [String], option: &str) -> Option<&'a str> {
        args.iter()
            .position(|arg| arg == option)
            .and_then(|index| args.get(index + 1))
            .map(String::as_str)
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn native_capture_receives_the_flowtake_process_to_exclude() {
        let source = serde_json::json!({"type": "screen", "monitorIndex": 0});
        let protected = macos_native_capture_arguments(
            &source,
            MacCaptureArgumentConfig {
                source_type: "screen",
                output_path: "/tmp/screen.mp4",
                ready_file_path: "/tmp/ready",
                fps: 30,
                width: 1920,
                height: 1080,
                quality: "balanced",
                captures_system_audio: false,
                excluded_process_id: Some(4242),
            },
        );
        assert_eq!(
            option_value(&protected, "--exclude-process-id"),
            Some("4242")
        );

        let visible = macos_native_capture_arguments(
            &source,
            MacCaptureArgumentConfig {
                source_type: "screen",
                output_path: "/tmp/screen.mp4",
                ready_file_path: "/tmp/ready",
                fps: 30,
                width: 1920,
                height: 1080,
                quality: "balanced",
                captures_system_audio: false,
                excluded_process_id: None,
            },
        );
        assert_eq!(option_value(&visible, "--exclude-process-id"), None);
    }

    #[test]
    fn recording_capture_can_only_be_claimed_once_until_released() {
        let mut state = AppState::new();
        state.is_recording = true;
        assert!(try_claim_recording_capture(&mut state));
        assert!(!try_claim_recording_capture(&mut state));

        state.recording_capture_claimed = false;
        assert!(try_claim_recording_capture(&mut state));
    }

    #[test]
    fn pending_save_token_blocks_a_new_recording_init() {
        let mut state = AppState::new();
        state.project_id = Some("open-editor-project".to_string());
        assert!(!recording_init_is_blocked(&state));

        state.recording_id = Some("recording-retry".to_string());
        assert!(recording_init_is_blocked(&state));
    }

    #[test]
    fn failed_start_cleanup_releases_session_ids_and_retry_guards() {
        let root = test_directory("failed-start-cleanup");
        let mut state = AppState::new();
        state.temp_dir = root.clone();
        state.is_recording = true;
        state.recording_capture_claimed = true;
        state.recording_id = Some("recording-failed".to_string());
        state.project_id = Some("project-failed".to_string());
        state.camera_mic_config = Some(serde_json::json!({"ffmpegArgs": ["bad"]}));
        state.multi_app_finalize_error = Some("old failure".to_string());

        let directories = clear_failed_recording_start(&mut state);
        assert_eq!(directories.len(), 2);
        assert!(!state.is_recording);
        assert!(!state.recording_capture_claimed);
        assert!(state.recording_id.is_none());
        assert!(state.project_id.is_none());
        assert!(state.camera_mic_config.is_none());
        assert!(state.multi_app_finalize_error.is_none());
    }

    #[test]
    fn recording_lifecycle_requires_init_and_makes_stop_idempotent() {
        let mut state = AppState::new();
        assert!(!recording_start_prerequisites_met(&state));

        state.is_recording = true;
        state.recording_id = Some("recording-test".to_string());
        state.camera_mic_config = Some(serde_json::json!({
            "ffmpegArgs": ["-f", "lavfi", "-i", "ddagrab=output_idx=0"]
        }));
        assert!(recording_start_prerequisites_met(&state));

        state.recording_capture_claimed = true;
        assert!(try_begin_recording_stop(&mut state));
        assert!(!state.recording_capture_claimed);
        assert!(!state.is_recording);
        assert!(!try_begin_recording_stop(&mut state));
    }

    #[test]
    fn failed_project_save_keeps_one_retry_token_until_commit() {
        let mut state = AppState::new();
        state.is_recording = true;
        state.recording_id = Some("recording-retry".to_string());
        state.project_id = Some("project-retry".to_string());

        assert!(try_begin_recording_stop(&mut state));
        state.recording_stop_in_progress = false;
        assert!(try_begin_recording_stop(&mut state));

        state.recording_stop_in_progress = false;
        state.recording_id = None;
        assert!(!try_begin_recording_stop(&mut state));
    }

    #[test]
    fn recording_output_honors_selected_encoder_and_fps() {
        let args = recording_video_output_args("libx264", 60, 1920, 1080, "performance", false);
        assert_eq!(option_value(&args, "-c:v"), Some("libx264"));
        assert_eq!(option_value(&args, "-r"), Some("60"));
        assert_eq!(option_value(&args, "-preset"), Some("ultrafast"));
        assert_eq!(option_value(&args, "-pix_fmt"), Some("yuv420p"));

        let qsv = recording_video_output_args("h264_qsv", 60, 1920, 1080, "balanced", false);
        assert_eq!(option_value(&qsv, "-pix_fmt"), None);
        assert_eq!(option_value(&qsv, "-preset"), Some("veryfast"));
        assert_eq!(option_value(&qsv, "-async_depth"), Some("2"));

        let nvenc = recording_video_output_args("h264_nvenc", 60, 1920, 1080, "balanced", false);
        assert_eq!(option_value(&nvenc, "-pix_fmt"), None);
    }

    #[test]
    fn qsv_performance_tuning_does_not_change_balanced_or_quality() {
        let performance =
            recording_video_output_args("h264_qsv", 30, 1920, 1080, "performance", true);
        assert_eq!(option_value(&performance, "-preset"), Some("veryfast"));
        assert_eq!(option_value(&performance, "-async_depth"), Some("1"));
        assert_eq!(option_value(&performance, "-bf"), Some("0"));

        let balanced = recording_video_output_args("h264_qsv", 30, 1920, 1080, "balanced", true);
        assert_eq!(option_value(&balanced, "-preset"), Some("veryfast"));
        assert_eq!(option_value(&balanced, "-async_depth"), Some("2"));
        assert_eq!(option_value(&balanced, "-bf"), None);

        let quality = recording_video_output_args("h264_qsv", 30, 1920, 1080, "quality", true);
        assert_eq!(option_value(&quality, "-preset"), Some("medium"));
        assert_eq!(option_value(&quality, "-async_depth"), Some("2"));
        assert_eq!(option_value(&quality, "-bf"), None);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn qsv_pixel_format_is_hardware_only_for_ddagrab_zero_copy() {
        let mut dxgi_args = Vec::new();
        append_recording_output_args(
            &mut dxgi_args,
            RecordingOutputConfig {
                video_filters: &[ddagrab_transfer_filter("h264_qsv").unwrap().to_string()],
                encoder: "h264_qsv",
                fps: 30,
                width: 1920,
                height: 1080,
                quality: "balanced",
                has_system_audio: false,
                stop_on_video_eof: false,
            },
        );
        assert_eq!(option_value(&dxgi_args, "-pix_fmt"), Some("qsv"));

        let mut gdi_args = Vec::new();
        append_recording_output_args(
            &mut gdi_args,
            RecordingOutputConfig {
                video_filters: &[],
                encoder: "h264_qsv",
                fps: 30,
                width: 1920,
                height: 1080,
                quality: "balanced",
                has_system_audio: false,
                stop_on_video_eof: false,
            },
        );
        assert_eq!(option_value(&gdi_args, "-pix_fmt"), None);
    }

    #[test]
    fn hardware_bitrate_scales_with_resolution_fps_and_quality() {
        let hd = target_video_bitrate_kbps(1920, 1080, 30, "balanced");
        let high_motion_4k = target_video_bitrate_kbps(3840, 2160, 60, "quality");
        assert_eq!(hd, 9_000);
        assert!(high_motion_4k > hd);
        assert!(high_motion_4k <= 60_000);

        let area = serde_json::json!({ "type": "area", "width": 50.0, "height": 50.0 });
        assert_eq!(
            estimated_recording_dimensions(&area, "area", 3840, 2160),
            (1920, 1080)
        );
    }

    #[test]
    fn output_options_follow_all_inputs_and_map_audio_explicitly() {
        let mut args = vec![
            "-f".to_string(),
            "lavfi".to_string(),
            "-i".to_string(),
            "ddagrab=output_idx=0".to_string(),
            "-f".to_string(),
            "dshow".to_string(),
            "-i".to_string(),
            "audio=loopback".to_string(),
        ];
        append_recording_output_args(
            &mut args,
            RecordingOutputConfig {
                video_filters: &["hwdownload,format=bgra".to_string()],
                encoder: "libx264",
                fps: 30,
                width: 1920,
                height: 1080,
                quality: "balanced",
                has_system_audio: true,
                stop_on_video_eof: false,
            },
        );

        let last_input = args.iter().rposition(|arg| arg == "-i").unwrap();
        let video_filter = args.iter().position(|arg| arg == "-vf").unwrap();
        assert!(video_filter > last_input);
        assert!(args.windows(2).any(|pair| pair == ["-map", "0:v:0"]));
        assert!(args.windows(2).any(|pair| pair == ["-map", "1:a:0"]));
        assert!(!args.iter().any(|arg| arg.contains('?')));
        assert!(args.windows(2).any(|pair| pair == ["-c:a", "aac"]));
        assert!(!args.iter().any(|arg| arg == "-shortest"));
    }

    #[test]
    fn raw_window_audio_pads_before_using_video_eof_as_stop_signal() {
        let mut args = Vec::new();
        append_recording_output_args(
            &mut args,
            RecordingOutputConfig {
                video_filters: &[],
                encoder: "libx264",
                fps: 30,
                width: 1920,
                height: 1080,
                quality: "balanced",
                has_system_audio: true,
                stop_on_video_eof: true,
            },
        );
        assert_eq!(
            option_value(&args, "-af"),
            Some("aresample=async=1000:first_pts=0,apad")
        );
        assert!(args.iter().any(|arg| arg == "-shortest"));
    }

    #[test]
    fn parses_duration_and_dimensions_from_single_probe_output() {
        let stderr = r#"
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'screen.mp4':
  Duration: 00:02:03.45, start: 0.000000, bitrate: 8200 kb/s
  Stream #0:0: Video: h264, yuv420p(progressive), 2560x1440 [SAR 1:1 DAR 16:9], 60 fps
"#;
        assert_eq!(
            parse_video_metadata(stderr),
            Ok(VideoMetadata {
                duration_ms: Some(123_450),
                width: 2560,
                height: 1440,
            })
        );
    }

    #[test]
    fn selected_system_audio_is_required_by_screen_validation() {
        let path = std::path::Path::new("screen.mp4");
        let with_audio = screen_recording_probe_args(path, true);
        assert!(with_audio.windows(2).any(|pair| pair == ["-map", "0:v:0"]));
        assert!(with_audio.windows(2).any(|pair| pair == ["-map", "0:a:0"]));
        assert!(with_audio.windows(2).any(|pair| pair == ["-frames:a", "1"]));
        assert!(!with_audio.iter().any(|arg| arg.contains('?')));

        let video_only = screen_recording_probe_args(path, false);
        assert!(!video_only.iter().any(|arg| arg == "0:a:0"));
    }

    #[test]
    fn capture_thread_wait_has_a_hard_timeout() {
        let thread = std::thread::spawn(|| {
            std::thread::sleep(std::time::Duration::from_millis(120));
        });
        assert!(!wait_for_capture_thread(
            &thread,
            std::time::Duration::from_millis(5)
        ));
        assert!(wait_for_capture_thread(
            &thread,
            std::time::Duration::from_secs(1)
        ));
        thread.join().unwrap();
    }

    #[test]
    fn capture_start_rejects_an_immediate_child_exit() {
        #[cfg(target_os = "windows")]
        let mut exited = std::process::Command::new("cmd.exe")
            .args(["/C", "exit", "7"])
            .spawn()
            .unwrap();
        #[cfg(not(target_os = "windows"))]
        let mut exited = std::process::Command::new("sh")
            .args(["-c", "exit 7"])
            .spawn()
            .unwrap();

        let error = verify_capture_process_start(
            &mut exited,
            std::time::Duration::from_millis(250),
        )
        .unwrap_err()
        .to_string();
        assert!(error.contains("exited during capture startup"), "{error}");
    }

    #[test]
    fn device_probe_requires_every_selected_stream() {
        let path = std::path::Path::new("camera.webm");
        let combined = device_recording_probe_args(path, true, true).unwrap();
        assert!(combined.windows(2).any(|pair| pair == ["-map", "0:v:0"]));
        assert!(combined.windows(2).any(|pair| pair == ["-map", "0:a:0"]));
        assert!(!combined.iter().any(|arg| arg.contains('?')));

        let audio_only = device_recording_probe_args(path, false, true).unwrap();
        assert!(audio_only.windows(2).any(|pair| pair == ["-map", "0:a:0"]));
        assert!(!audio_only.iter().any(|arg| arg == "0:v:0"));
        assert!(device_recording_probe_args(path, false, false).is_err());
    }

    #[test]
    fn retry_accepts_an_already_staged_required_file() {
        let root = test_directory("staged-retry");
        std::fs::create_dir_all(&root).unwrap();
        let capture = root.join("recording").join("screen.mp4");
        let staged = root.join("screen.mp4");
        std::fs::write(&staged, b"screen-bytes").unwrap();

        let source = recording_save_source(&capture, &staged);
        assert_eq!(source, staged);
        move_or_copy_recording_file(&source, &staged, "screen recording").unwrap();
        assert_eq!(std::fs::read(&staged).unwrap(), b"screen-bytes");

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn selected_app_layer_cannot_be_silently_omitted() {
        let root = test_directory("missing-required-app-layer");
        std::fs::create_dir_all(&root).unwrap();
        let track = crate::commands::multi_app::CapturedTrack {
            id: "window-1".to_string(),
            name: "Required window".to_string(),
            filename: "extra-0.mp4".to_string(),
            width: 1280,
            height: 720,
            start_offset_ms: 0,
        };

        let error = successful_extra_tracks(&root, vec![track])
            .unwrap_err()
            .to_string();
        assert!(error.contains("selected track is missing"), "{error}");

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn staged_retry_replaces_only_its_unpublished_archive() {
        let root = test_directory("archive-retry");
        std::fs::create_dir_all(&root).unwrap();
        let archive = root.join("project.zip");
        std::fs::write(&archive, b"old-attempt").unwrap();

        assert!(prepare_project_archive_destination(&archive, false).is_err());
        assert!(archive.exists());
        prepare_project_archive_destination(&archive, true).unwrap();
        assert!(!archive.exists());

        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn ddagrab_only_downloads_frames_for_software_encoding() {
        assert_eq!(ddagrab_transfer_filter("h264_nvenc"), None);
        assert_eq!(
            ddagrab_transfer_filter("h264_qsv"),
            Some("hwmap=derive_device=qsv:mode=read+write+direct")
        );
        assert_eq!(
            ddagrab_transfer_filter("libx264"),
            Some("hwdownload,format=bgra")
        );
    }

    #[test]
    fn project_zip_contains_every_required_entry() {
        let root = test_directory("zip-success");
        std::fs::create_dir_all(&root).unwrap();
        let manifest = root.join("project.json");
        let screen = root.join("screen.mp4");
        let extra = root.join("extra-2.mp4");
        std::fs::write(&manifest, br#"{"version":1}"#).unwrap();
        std::fs::write(&screen, b"screen-bytes").unwrap();
        std::fs::write(&extra, b"extra-track-bytes").unwrap();
        let entries = vec![
            ProjectArchiveEntry {
                archive_name: "project.json".to_string(),
                source_path: manifest,
            },
            ProjectArchiveEntry {
                archive_name: "screen.mp4".to_string(),
                source_path: screen,
            },
            ProjectArchiveEntry {
                archive_name: "extra-2.mp4".to_string(),
                source_path: extra,
            },
        ];

        let writer = write_project_zip(std::io::Cursor::new(Vec::new()), &entries).unwrap();
        let mut archive = zip::ZipArchive::new(std::io::Cursor::new(writer.into_inner())).unwrap();
        assert_eq!(archive.len(), 3);
        assert_eq!(archive.by_name("screen.mp4").unwrap().size(), 12);
        assert_eq!(
            archive.by_name("screen.mp4").unwrap().compression(),
            zip::CompressionMethod::Stored
        );
        assert_eq!(archive.by_name("extra-2.mp4").unwrap().size(), 17);
        assert!(archive.by_name("extra-1.mp4").is_err());

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn project_zip_propagates_finish_failure() {
        let root = test_directory("zip-finish-failure");
        std::fs::create_dir_all(&root).unwrap();
        let screen = root.join("screen.mp4");
        std::fs::write(&screen, b"screen-bytes").unwrap();
        let entries = vec![ProjectArchiveEntry {
            archive_name: "screen.mp4".to_string(),
            source_path: screen,
        }];

        let error = write_project_zip(RejectCentralDirectoryWriter::default(), &entries)
            .unwrap_err()
            .to_string();
        assert!(error.contains("finalizing the project archive"), "{error}");
        assert!(
            error.contains("injected central-directory failure"),
            "{error}"
        );

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn failed_archive_removes_partial_file_and_never_commits_destination() {
        let root = test_directory("zip-cleanup");
        std::fs::create_dir_all(&root).unwrap();
        let destination = root.join("project.zip");
        let entries = vec![ProjectArchiveEntry {
            archive_name: "screen.mp4".to_string(),
            source_path: root.join("missing-screen.mp4"),
        }];

        let error = create_project_archive(&destination, &entries)
            .unwrap_err()
            .to_string();
        assert!(error.contains("screen.mp4"), "{error}");
        assert!(!destination.exists());
        assert!(!partial_archive_path(&destination).exists());

        std::fs::remove_dir_all(root).unwrap();
    }
}
