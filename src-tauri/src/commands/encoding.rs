use crate::error::{AppError, AppResult};
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

// Probes run concurrently, so discovery is bounded by one timeout rather than
// one timeout per GPU vendor.
const ENCODER_PROBE_TIMEOUT: Duration = Duration::from_secs(7);

const RECORDING_ENCODERS: &[(&str, &str)] = &[
    ("h264_videotoolbox", "H.264 (VideoToolbox)"),
    ("h264_nvenc", "H.264 (NVIDIA)"),
    ("h264_qsv", "H.264 (Intel Quick Sync)"),
    ("h264_amf", "H.264 (AMD)"),
    ("libx264", "H.264 (CPU)"),
];

static ENCODER_PROBE_CACHE: LazyLock<Mutex<HashMap<String, bool>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn platform_recording_encoders() -> &'static [&'static str] {
    #[cfg(target_os = "macos")]
    {
        &["h264_videotoolbox", "libx264"]
    }
    #[cfg(target_os = "windows")]
    {
        &["h264_nvenc", "h264_qsv", "h264_amf", "libx264"]
    }
    #[cfg(target_os = "linux")]
    {
        &["h264_nvenc", "h264_qsv", "libx264"]
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        &["libx264"]
    }
}

fn preferred_encoder_order() -> &'static [&'static str] {
    #[cfg(target_os = "macos")]
    {
        &["h264_videotoolbox", "libx264"]
    }
    #[cfg(target_os = "windows")]
    {
        &["h264_nvenc", "h264_qsv", "h264_amf", "libx264"]
    }
    #[cfg(target_os = "linux")]
    {
        &["h264_nvenc", "h264_qsv", "libx264"]
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        &["libx264"]
    }
}

fn encoder_cache_key(ffmpeg: &Path, encoder: &str) -> String {
    format!("{}\0{}", ffmpeg.to_string_lossy(), encoder)
}

fn probe_encoder_uncached(ffmpeg: &Path, encoder: &str) -> bool {
    use std::process::{Command, Stdio};

    if !platform_recording_encoders().contains(&encoder) {
        return false;
    }

    let mut command = Command::new(ffmpeg);
    command
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=128x128:r=30",
            "-frames:v",
            "1",
            "-an",
            "-c:v",
            encoder,
            "-f",
            "null",
            "-",
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let Ok(mut child) = command.spawn() else {
        return false;
    };
    crate::process_containment::contain_owned_child(&child, "encoder-probe FFmpeg");
    let started = Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(status)) => return status.success(),
            Ok(None) if started.elapsed() < ENCODER_PROBE_TIMEOUT => {
                std::thread::sleep(Duration::from_millis(25));
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                log::warn!("[encoder] Runtime probe timed out for {}", encoder);
                return false;
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                log::warn!("[encoder] Runtime probe failed for {}: {}", encoder, error);
                return false;
            }
        }
    }
}

pub(crate) fn encoder_is_runtime_usable(ffmpeg: &Path, encoder: &str, force: bool) -> bool {
    let key = encoder_cache_key(ffmpeg, encoder);
    if !force {
        if let Some(available) = ENCODER_PROBE_CACHE
            .lock()
            .ok()
            .and_then(|cache| cache.get(&key).copied())
        {
            return available;
        }
    }

    let available = probe_encoder_uncached(ffmpeg, encoder);
    if let Ok(mut cache) = ENCODER_PROBE_CACHE.lock() {
        cache.insert(key, available);
    }
    available
}

fn choose_encoder_from_availability<F>(
    requested: Option<&str>,
    mut is_available: F,
) -> Option<String>
where
    F: FnMut(&str) -> bool,
{
    if let Some(requested) = requested {
        if RECORDING_ENCODERS
            .iter()
            .any(|(name, _)| *name == requested)
            && is_available(requested)
        {
            return Some(requested.to_string());
        }
    }

    preferred_encoder_order()
        .iter()
        .copied()
        .find(|encoder| is_available(encoder))
        .map(str::to_string)
}

fn probe_platform_encoders(ffmpeg: &Path, force: bool) -> Vec<String> {
    std::thread::scope(|scope| {
        let probes: Vec<_> = platform_recording_encoders()
            .iter()
            .copied()
            .map(|encoder| {
                scope.spawn(move || (encoder, encoder_is_runtime_usable(ffmpeg, encoder, force)))
            })
            .collect();

        probes
            .into_iter()
            .filter_map(|probe| match probe.join() {
                Ok((encoder, true)) => Some(encoder.to_string()),
                Ok((_, false)) => None,
                Err(_) => None,
            })
            .collect()
    })
}

pub(crate) fn resolve_recording_encoder(
    ffmpeg: &Path,
    requested: Option<&str>,
    force: bool,
) -> Option<String> {
    let available = probe_platform_encoders(ffmpeg, force);
    choose_encoder_from_availability(requested, |encoder| {
        available.iter().any(|available| available == encoder)
    })
}

fn encoder_display_name(encoder: &str) -> &str {
    RECORDING_ENCODERS
        .iter()
        .find_map(|(name, display_name)| (*name == encoder).then_some(*display_name))
        .unwrap_or(encoder)
}

#[tauri::command]
pub async fn get_encoders(app: AppHandle, force: Option<bool>) -> AppResult<Value> {
    let Some(ffmpeg) = super::recording::find_ffmpeg_path() else {
        return Ok(Value::Array(Vec::new()));
    };

    let store = app
        .store("store.json")
        .map_err(|error| AppError::General(error.to_string()))?;
    let requested = store
        .get("encoder")
        .and_then(|value| value.as_str().map(str::to_owned));
    let is_automatic = store
        .get("encoderMode")
        .and_then(|value| value.as_str().map(|mode| mode != "manual"))
        .unwrap_or(true);
    let refresh = force == Some(true);
    let ffmpeg_for_probe = ffmpeg.clone();
    let requested_for_probe = if is_automatic {
        None
    } else {
        requested.clone()
    };

    let (available_names, selected) = tokio::task::spawn_blocking(move || {
        let available_names = probe_platform_encoders(&ffmpeg_for_probe, refresh);
        let selected =
            choose_encoder_from_availability(requested_for_probe.as_deref(), |encoder| {
                available_names.iter().any(|available| available == encoder)
            });
        (available_names, selected)
    })
    .await
    .map_err(|error| AppError::General(format!("Encoder probe failed: {}", error)))?;

    let mut encoders: Vec<Value> = Vec::new();
    if is_automatic && selected.is_some() {
        let selected_name = selected
            .as_deref()
            .map(encoder_display_name)
            .unwrap_or_default();
        encoders.push(serde_json::json!({
            "name": "auto",
            "displayName": format!("Automatic · {}", selected_name),
            "available": true,
            "isSelected": true,
        }));
    }
    encoders.extend(available_names.iter().map(|encoder| {
        serde_json::json!({
            "name": encoder,
            "displayName": encoder_display_name(encoder),
            "available": true,
            "isSelected": !is_automatic && selected.as_deref() == Some(encoder.as_str()),
        })
    }));

    let mut changed = false;
    if store.get("encoderMode").is_none() {
        store.set("encoderMode", Value::String("auto".to_string()));
        changed = true;
    }
    if let Some(selected) = selected {
        if requested.as_deref() != Some(selected.as_str()) {
            store.set("encoder", Value::String(selected));
            changed = true;
        }
    } else {
        log::error!("[encoder] No H.264 recording encoder passed the runtime probe");
    }
    if changed {
        store
            .save()
            .map_err(|error| AppError::General(error.to_string()))?;
    }

    Ok(Value::Array(encoders))
}

#[tauri::command]
pub async fn set_encoder(app: AppHandle, encoder: String) -> AppResult<()> {
    if encoder == "auto" {
        let store = app
            .store("store.json")
            .map_err(|error| AppError::General(error.to_string()))?;
        store.set("encoderMode", Value::String("auto".to_string()));
        store
            .save()
            .map_err(|error| AppError::General(error.to_string()))?;
        return Ok(());
    }

    if !platform_recording_encoders().contains(&encoder.as_str()) {
        return Err(AppError::General(format!(
            "Unsupported encoder: {}",
            encoder
        )));
    }

    let ffmpeg = super::recording::find_ffmpeg_path()
        .ok_or_else(|| AppError::General("FFmpeg binary not found".to_string()))?;
    let encoder_for_probe = encoder.clone();
    let usable = tokio::task::spawn_blocking(move || {
        encoder_is_runtime_usable(&ffmpeg, &encoder_for_probe, false)
    })
    .await
    .map_err(|error| AppError::General(format!("Encoder probe failed: {}", error)))?;

    if !usable {
        return Err(AppError::General(format!(
            "Encoder {} is installed but cannot run on this device",
            encoder
        )));
    }

    let store = app
        .store("store.json")
        .map_err(|error| AppError::General(error.to_string()))?;
    store.set("encoder", Value::String(encoder));
    store.set("encoderMode", Value::String("manual".to_string()));
    store
        .save()
        .map_err(|error| AppError::General(error.to_string()))?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn windows_is_remote_session() -> bool {
    use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_REMOTESESSION};

    // Desktop Duplication is not available in many RDP sessions. Detect this
    // without capturing a frame during app startup (which would be both slow
    // and surprising) and choose the compatible GDI path instead.
    unsafe { GetSystemMetrics(SM_REMOTESESSION) != 0 }
}

#[cfg(target_os = "windows")]
fn normalize_windows_capturer(capturer: Option<&str>, is_remote_session: bool) -> &'static str {
    if is_remote_session {
        return "gdigrab";
    }

    match capturer.unwrap_or_default().to_ascii_lowercase().as_str() {
        "gdi" | "gdigrab" => "gdigrab",
        _ => "ddagrab",
    }
}

pub(crate) fn normalize_capturer(capturer: Option<&str>) -> &'static str {
    #[cfg(target_os = "windows")]
    {
        normalize_windows_capturer(capturer, windows_is_remote_session())
    }
    #[cfg(target_os = "macos")]
    {
        match capturer.unwrap_or_default().to_ascii_lowercase().as_str() {
            "avfoundation" => "avfoundation",
            "screencapturekit" | "screen-capture-kit" | "native" => "screencapturekit",
            _ => "screencapturekit",
        }
    }
    #[cfg(target_os = "linux")]
    {
        // PipeWire capture requires an XDG Desktop Portal session and a node/FD,
        // not merely a `pw-cli` binary. Do not advertise a path we cannot start.
        let _ = capturer;
        "x11grab"
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = capturer;
        "x11grab"
    }
}

pub(crate) async fn resolve_capturer(
    app: &AppHandle,
    capturer: Option<&str>,
    requires_system_audio: bool,
) -> &'static str {
    let normalized = normalize_capturer(capturer);

    #[cfg(target_os = "macos")]
    {
        if normalized == "avfoundation" {
            return normalized;
        }
        let capabilities = crate::macos_capture::capabilities(app).await;
        if capabilities.available
            && (!requires_system_audio || capabilities.supports_system_audio)
        {
            "screencapturekit"
        } else {
            if requires_system_audio
                && capabilities.available
                && !capabilities.supports_system_audio
            {
                log::info!(
                    "[capturer] Falling back to AVFoundation because native system audio requires macOS 13"
                );
            }
            "avfoundation"
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, requires_system_audio);
        normalized
    }
}

#[tauri::command]
pub async fn get_capturers(app: AppHandle, _force: Option<bool>) -> AppResult<Value> {
    let store = app
        .store("store.json")
        .map_err(|error| AppError::General(error.to_string()))?;
    let stored = store
        .get("capturer")
        .and_then(|value| value.as_str().map(str::to_owned));
    let is_automatic = store
        .get("capturerMode")
        .and_then(|value| value.as_str().map(|mode| mode != "manual"))
        .unwrap_or(true);
    let selected = resolve_capturer(
        &app,
        if is_automatic {
            None
        } else {
            stored.as_deref()
        },
        false,
    )
    .await;

    #[cfg(target_os = "windows")]
    let capturers = {
        let is_remote_session = windows_is_remote_session();
        let selected_name = if selected == "ddagrab" {
            "DirectX (DXGI)"
        } else {
            "GDI (compatibility)"
        };
        let mut values = if is_automatic {
            vec![serde_json::json!({
                "name": "auto",
                "displayName": format!("Automatic · {}", selected_name),
                "available": true,
                "isSelected": true,
            })]
        } else {
            Vec::new()
        };
        if !is_remote_session {
            values.push(serde_json::json!({
            "name": "ddagrab",
            "displayName": "DirectX (DXGI)",
            "available": true,
            "isSelected": !is_automatic && selected == "ddagrab",
            }));
        }
        values.push(serde_json::json!({
            "name": "gdigrab",
            "displayName": "GDI (compatibility)",
            "available": true,
            "isSelected": !is_automatic && selected == "gdigrab",
        }));
        values
    };

    #[cfg(target_os = "macos")]
    let capturers = {
        let capabilities = crate::macos_capture::capabilities(&app).await;
        let mut values = if is_automatic {
            vec![serde_json::json!({
                "name": "auto",
                "displayName": format!(
                    "Automatic · {}",
                    if selected == "screencapturekit" {
                        "ScreenCaptureKit"
                    } else {
                        "AVFoundation"
                    }
                ),
                "available": true,
                "isSelected": true,
            })]
        } else {
            Vec::new()
        };
        values.push(serde_json::json!({
            "name": "screencapturekit",
            "displayName": "ScreenCaptureKit (native)",
            "available": capabilities.available,
            "isSelected": !is_automatic && selected == "screencapturekit",
        }));
        values.push(serde_json::json!({
            "name": "avfoundation",
            "displayName": "AVFoundation (compatibility)",
            "available": true,
            "isSelected": !is_automatic && selected == "avfoundation",
        }));
        values
    };

    #[cfg(target_os = "linux")]
    let capturers = vec![serde_json::json!({
        "name": "x11grab",
        "displayName": "X11 Grab",
        "available": true,
        "isSelected": true,
    })];

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    let capturers = vec![serde_json::json!({
        "name": "x11grab",
        "displayName": "X11 Grab",
        "available": true,
        "isSelected": true,
    })];

    let mut changed = false;
    if store.get("capturerMode").is_none() {
        store.set("capturerMode", Value::String("auto".to_string()));
        changed = true;
    }
    if stored.as_deref() != Some(selected) {
        store.set("capturer", Value::String(selected.to_string()));
        changed = true;
    }
    if changed {
        store
            .save()
            .map_err(|error| AppError::General(error.to_string()))?;
    }

    Ok(Value::Array(capturers))
}

#[tauri::command]
pub async fn set_capturer(app: AppHandle, capturer: String) -> AppResult<()> {
    if capturer == "auto" {
        let selected = resolve_capturer(&app, None, false).await.to_string();
        let store = app
            .store("store.json")
            .map_err(|error| AppError::General(error.to_string()))?;
        store.set("capturer", Value::String(selected));
        store.set("capturerMode", Value::String("auto".to_string()));
        store
            .save()
            .map_err(|error| AppError::General(error.to_string()))?;
        return Ok(());
    }

    let capturer = normalize_capturer(Some(&capturer)).to_string();
    #[cfg(target_os = "macos")]
    if capturer == "screencapturekit" {
        let capabilities = crate::macos_capture::capabilities(&app).await;
        if !capabilities.available {
            return Err(AppError::General(
                "ScreenCaptureKit is unavailable. Build the native helper or use AVFoundation."
                    .to_string(),
            ));
        }
    }
    let store = app
        .store("store.json")
        .map_err(|error| AppError::General(error.to_string()))?;
    store.set("capturer", Value::String(capturer));
    store.set("capturerMode", Value::String("manual".to_string()));
    store
        .save()
        .map_err(|error| AppError::General(error.to_string()))?;
    Ok(())
}

/// Extract audio from a video file using FFmpeg sidecar and return as WAV buffer.
/// This is more memory-efficient for large screen recordings since it only returns
/// the audio track, not the full video.
#[tauri::command]
pub async fn extract_audio_buffer(app: AppHandle, source: String) -> AppResult<Vec<u8>> {
    use crate::state::AppState;

    let source_file = {
        let state = app.state::<Mutex<AppState>>();
        let state = state.lock().unwrap();
        let project_id = state.project_id.clone().ok_or(AppError::NoProjectOpen)?;
        match source.as_str() {
            "screen" => state.screen_video_file(&project_id),
            "camera" | "microphone" => state.camera_video_file(&project_id),
            _ => {
                return Err(AppError::General(format!(
                    "Unknown audio source: {}",
                    source
                )))
            }
        }
    };

    if !source_file.exists() {
        return Ok(Vec::new());
    }

    // Use FFmpeg to extract audio as WAV (PCM s16le, mono, 16kHz - optimal for Whisper)
    let output = super::ffmpeg_from_app(&app)?
        .args([
            "-i",
            source_file.to_str().unwrap_or_default(),
            "-vn",
            "-acodec",
            "pcm_s16le",
            "-ar",
            "16000",
            "-ac",
            "1",
            "-f",
            "wav",
            "pipe:1",
        ])
        .output()
        .await
        .map_err(|e| AppError::General(format!("FFmpeg audio extraction failed: {}", e)))?;

    if output.stdout.is_empty() {
        return Ok(Vec::new());
    }

    Ok(output.stdout)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requested_runtime_usable_encoder_wins() {
        let selected = choose_encoder_from_availability(Some("libx264"), |name| {
            matches!(name, "h264_qsv" | "libx264")
        });
        assert_eq!(selected.as_deref(), Some("libx264"));
    }

    #[test]
    fn unavailable_request_falls_back_to_preferred_runtime_encoder() {
        let selected = choose_encoder_from_availability(Some("h264_nvenc"), |name| {
            matches!(name, "h264_qsv" | "libx264")
        });
        #[cfg(target_os = "windows")]
        assert_eq!(selected.as_deref(), Some("h264_qsv"));
        #[cfg(not(target_os = "windows"))]
        assert!(selected.is_some());
    }

    #[test]
    fn capturer_aliases_normalize_to_a_real_backend() {
        #[cfg(target_os = "windows")]
        {
            assert_eq!(normalize_windows_capturer(Some("GDI"), false), "gdigrab");
            assert_eq!(normalize_windows_capturer(Some("dxgi"), false), "ddagrab");
            assert_eq!(normalize_windows_capturer(Some("ddagrab"), true), "gdigrab");
        }
        #[cfg(target_os = "macos")]
        {
            assert_eq!(
                normalize_capturer(Some("screencapturekit")),
                "screencapturekit"
            );
            assert_eq!(normalize_capturer(Some("avfoundation")), "avfoundation");
            assert_eq!(normalize_capturer(Some("anything")), "screencapturekit");
        }
        #[cfg(target_os = "linux")]
        assert_eq!(normalize_capturer(Some("pipewire")), "x11grab");
    }
}
