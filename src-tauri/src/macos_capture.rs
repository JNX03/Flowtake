use serde_json::Value;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DisplayFrame {
    pub index: i64,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct NativeCaptureSettings {
    pub fps: u32,
    pub width: u32,
    pub height: u32,
    pub bitrate_kbps: u32,
    pub captures_system_audio: bool,
}

fn finite_number(source: &Value, key: &str) -> Option<f64> {
    source
        .get(key)
        .and_then(Value::as_f64)
        .filter(|value| value.is_finite())
}

fn display_frame_from_source(source: &Value, fallback: DisplayFrame) -> DisplayFrame {
    DisplayFrame {
        index: source
            .get("monitorIndex")
            .and_then(Value::as_i64)
            .unwrap_or(fallback.index)
            .clamp(0, 64),
        x: finite_number(source, "monitorX").unwrap_or(fallback.x),
        y: finite_number(source, "monitorY").unwrap_or(fallback.y),
        width: finite_number(source, "monitorWidth")
            .filter(|value| *value > 0.0)
            .unwrap_or(fallback.width),
        height: finite_number(source, "monitorHeight")
            .filter(|value| *value > 0.0)
            .unwrap_or(fallback.height),
    }
}

pub fn build_sidecar_args(
    source: &Value,
    output_path: &str,
    settings: NativeCaptureSettings,
    fallback_display: DisplayFrame,
) -> Option<Vec<String>> {
    if output_path.trim().is_empty() || settings.width < 2 || settings.height < 2 {
        return None;
    }

    let source_type = source
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("screen");
    let mut args = vec![
        "record".to_string(),
        "--output".to_string(),
        output_path.to_string(),
        "--fps".to_string(),
        settings.fps.clamp(1, 120).to_string(),
        "--width".to_string(),
        (settings.width & !1).max(2).to_string(),
        "--height".to_string(),
        (settings.height & !1).max(2).to_string(),
        "--bitrate-kbps".to_string(),
        settings.bitrate_kbps.clamp(1_000, 100_000).to_string(),
        "--exclude-bundle-id".to_string(),
        "com.flowtake.desktop".to_string(),
    ];

    if settings.captures_system_audio {
        args.push("--system-audio".to_string());
    }

    if source_type == "window" {
        let window_id = source
            .get("id")
            .and_then(|value| {
                value
                    .as_u64()
                    .and_then(|value| u32::try_from(value).ok())
                    .or_else(|| value.as_str().and_then(|value| value.parse::<u32>().ok()))
            })
            .filter(|value| *value > 0)?;
        args.extend(["--window-id".to_string(), window_id.to_string()]);
        return Some(args);
    }

    let display = display_frame_from_source(source, fallback_display);
    args.extend([
        "--display-index".to_string(),
        display.index.to_string(),
        "--display-x".to_string(),
        display.x.to_string(),
        "--display-y".to_string(),
        display.y.to_string(),
        "--display-width".to_string(),
        display.width.to_string(),
        "--display-height".to_string(),
        display.height.to_string(),
    ]);

    if source_type == "area" {
        let x = finite_number(source, "x").unwrap_or(0.0).clamp(0.0, 100.0);
        let y = finite_number(source, "y").unwrap_or(0.0).clamp(0.0, 100.0);
        let region_width = finite_number(source, "width")
            .unwrap_or(100.0)
            .clamp(0.1, 100.0);
        let region_height = finite_number(source, "height")
            .unwrap_or(100.0)
            .clamp(0.1, 100.0);
        args.extend([
            "--region-percent".to_string(),
            format!("{x},{y},{region_width},{region_height}"),
        ]);
    }

    Some(args)
}

#[cfg(target_os = "macos")]
fn macos_13_or_newer() -> bool {
    sysinfo::System::os_version()
        .and_then(|version| {
            version
                .split('.')
                .next()
                .and_then(|major| major.parse::<u32>().ok())
        })
        .is_some_and(|major| major >= 13)
}

#[cfg(target_os = "macos")]
fn helper_names() -> Vec<&'static str> {
    let mut names = vec![
        "flowtake-macos-capture",
        "flowtake-macos-capture-universal-apple-darwin",
    ];
    if cfg!(target_arch = "aarch64") {
        names.push("flowtake-macos-capture-aarch64-apple-darwin");
    } else {
        names.push("flowtake-macos-capture-x86_64-apple-darwin");
    }
    names
}

#[cfg(target_os = "macos")]
fn find_helper_path() -> Option<std::path::PathBuf> {
    let mut directories = Vec::new();
    if let Ok(executable) = std::env::current_exe() {
        if let Some(parent) = executable.parent() {
            directories.push(parent.to_path_buf());
        }
    }
    if let Ok(current_directory) = std::env::current_dir() {
        directories.push(current_directory.join("src-tauri").join("binaries"));
        directories.push(current_directory.join("binaries"));
    }

    for directory in directories {
        for name in helper_names() {
            let candidate = directory.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn helper_error_code(line: &str) -> Option<&'static str> {
    let Ok(payload) = serde_json::from_str::<Value>(line) else {
        return None;
    };
    if payload.get("event").and_then(Value::as_str) != Some("error") {
        return None;
    }
    let code = payload
        .get("code")
        .and_then(Value::as_str)
        .unwrap_or("native-capture-error");
    Some(if code == "screen-permission-denied" {
        "ScreenPermissionDenied"
    } else {
        "CaptureError"
    })
}

#[cfg(target_os = "macos")]
fn clean_up_failed_native_capture(app: tauri::AppHandle, error_code: &'static str) {
    tauri::async_runtime::spawn(async move {
        if let Err(error) =
            crate::commands::recording::cancel_recording(app, Some(error_code.to_string())).await
        {
            log::error!(
                "[macos-capture] Could not clean up failed native capture: {}",
                error
            );
        }
    });
}

#[cfg(target_os = "macos")]
pub fn try_spawn(
    app: &tauri::AppHandle,
    args: &[String],
) -> Result<Option<std::process::Child>, String> {
    use std::io::BufRead;
    use std::process::{Command, Stdio};

    if !macos_13_or_newer() {
        log::info!(
            "[macos-capture] ScreenCaptureKit helper requires macOS 13; using FFmpeg fallback"
        );
        return Ok(None);
    }
    let Some(helper_path) = find_helper_path() else {
        log::info!("[macos-capture] Native helper is not bundled; using FFmpeg fallback");
        return Ok(None);
    };

    let mut child = match Command::new(&helper_path)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            log::warn!(
                "[macos-capture] Could not launch {:?}: {}; using FFmpeg fallback",
                helper_path,
                error
            );
            return Ok(None);
        }
    };

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Native capture helper did not expose stdout.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Native capture helper did not expose stderr.".to_string())?;
    let (readiness_tx, readiness_rx) = std::sync::mpsc::channel::<String>();
    let native_selected = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let failure_reported = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let stdout_app = app.clone();
    let stdout_selected = native_selected.clone();
    let stdout_failure_reported = failure_reported.clone();
    std::thread::spawn(move || {
        let reader = std::io::BufReader::new(stdout);
        let mut stopped_cleanly = false;
        for line in reader.lines().map_while(Result::ok) {
            let event = serde_json::from_str::<Value>(&line)
                .ok()
                .and_then(|payload| {
                    payload
                        .get("event")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                });
            if event.as_deref() == Some("ready") {
                // Mark selection in the pipe reader itself so an immediate
                // post-ready crash cannot race the command thread.
                stdout_selected.store(true, std::sync::atomic::Ordering::Release);
            }
            readiness_tx.send(line.clone()).ok();
            stopped_cleanly = event.as_deref() == Some("stopped");
            log::debug!("[macos-capture] {}", line);
        }
        if stdout_selected.load(std::sync::atomic::Ordering::Acquire)
            && !stopped_cleanly
            && !stdout_failure_reported.swap(true, std::sync::atomic::Ordering::AcqRel)
        {
            clean_up_failed_native_capture(stdout_app, "CaptureError");
        }
    });

    let stderr_app = app.clone();
    let stderr_selected = native_selected.clone();
    let stderr_failure_reported = failure_reported.clone();
    let recent_stderr = std::sync::Arc::new(std::sync::Mutex::new(Vec::<String>::new()));
    let stderr_snapshot = recent_stderr.clone();
    std::thread::spawn(move || {
        let reader = std::io::BufReader::new(stderr);
        for line in reader.lines().map_while(Result::ok) {
            log::warn!("[macos-capture] {}", line);
            if stderr_selected.load(std::sync::atomic::Ordering::Acquire) {
                if let Some(error_code) = helper_error_code(&line) {
                    if !stderr_failure_reported.swap(true, std::sync::atomic::Ordering::AcqRel) {
                        clean_up_failed_native_capture(stderr_app.clone(), error_code);
                    }
                }
            }
            let mut lines = stderr_snapshot.lock().unwrap();
            lines.push(line);
            if lines.len() > 8 {
                lines.remove(0);
            }
        }
    });

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(8);
    loop {
        match readiness_rx.recv_timeout(std::time::Duration::from_millis(100)) {
            Ok(line) => {
                let is_ready = serde_json::from_str::<Value>(&line)
                    .ok()
                    .and_then(|payload| {
                        payload
                            .get("event")
                            .and_then(Value::as_str)
                            .map(|event| event == "ready")
                    })
                    .unwrap_or(false);
                if is_ready {
                    native_selected.store(true, std::sync::atomic::Ordering::Release);
                    log::info!(
                        "[macos-capture] ScreenCaptureKit helper ready with PID {}",
                        child.id()
                    );
                    return Ok(Some(child));
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {}
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
        }

        if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
            let details = recent_stderr.lock().unwrap().join(" | ");
            log::warn!(
                "[macos-capture] Native helper exited before ready ({status}); {}Using FFmpeg fallback",
                if details.is_empty() {
                    String::new()
                } else {
                    format!("{details}. ")
                }
            );
            return Ok(None);
        }
        if std::time::Instant::now() >= deadline {
            child.kill().ok();
            child.wait().ok();
            let details = recent_stderr.lock().unwrap().join(" | ");
            log::warn!(
                "[macos-capture] Native helper timed out before ready. {}Using FFmpeg fallback",
                if details.is_empty() {
                    String::new()
                } else {
                    format!("{details}. ")
                }
            );
            return Ok(None);
        }
    }
}

#[tauri::command]
pub async fn get_macos_capture_status() -> Value {
    #[cfg(target_os = "macos")]
    {
        let os_supported = macos_13_or_newer();
        let helper_available = find_helper_path().is_some();
        return serde_json::json!({
            "available": os_supported && helper_available,
            "backend": "ScreenCaptureKit",
            "minimumMacOS": "13.0",
            "nativeSystemAudio": os_supported && helper_available,
        });
    }
    #[cfg(not(target_os = "macos"))]
    {
        serde_json::json!({
            "available": false,
            "backend": null,
            "minimumMacOS": "13.0",
            "nativeSystemAudio": false,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fallback_display() -> DisplayFrame {
        DisplayFrame {
            index: 0,
            x: 0.0,
            y: 0.0,
            width: 1920.0,
            height: 1080.0,
        }
    }

    #[test]
    fn native_window_capture_uses_stable_cg_window_id() {
        let source = serde_json::json!({
            "type": "window",
            "id": "49152",
        });
        let args = build_sidecar_args(
            &source,
            "/tmp/screen.mp4",
            NativeCaptureSettings {
                fps: 60,
                width: 1440,
                height: 900,
                bitrate_kbps: 12_000,
                captures_system_audio: true,
            },
            fallback_display(),
        )
        .unwrap();
        assert!(args.windows(2).any(|pair| pair == ["--window-id", "49152"]));
        assert!(args.iter().any(|argument| argument == "--system-audio"));
    }

    #[test]
    fn native_area_capture_preserves_display_hint_and_percentages() {
        let source = serde_json::json!({
            "type": "area",
            "x": 12.5,
            "y": 8.0,
            "width": 50.0,
            "height": 40.0,
            "monitorIndex": 1,
            "monitorX": -1440,
            "monitorY": 0,
            "monitorWidth": 1440,
            "monitorHeight": 900,
        });
        let args = build_sidecar_args(
            &source,
            "/tmp/screen.mp4",
            NativeCaptureSettings {
                fps: 30,
                width: 720,
                height: 360,
                bitrate_kbps: 6_000,
                captures_system_audio: false,
            },
            fallback_display(),
        )
        .unwrap();
        assert!(args.windows(2).any(|pair| pair == ["--display-index", "1"]));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["--region-percent", "12.5,8,50,40"]));
    }

    #[test]
    fn invalid_window_id_falls_back_without_spawning() {
        let source = serde_json::json!({ "type": "window", "id": "not-a-window" });
        assert!(build_sidecar_args(
            &source,
            "/tmp/screen.mp4",
            NativeCaptureSettings {
                fps: 30,
                width: 1920,
                height: 1080,
                bitrate_kbps: 9_000,
                captures_system_audio: false,
            },
            fallback_display(),
        )
        .is_none());
    }
}
