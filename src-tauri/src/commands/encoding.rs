use crate::error::{AppError, AppResult};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub async fn get_encoders(app: AppHandle, _force: Option<bool>) -> AppResult<Value> {
    // Query FFmpeg for available encoders
    let shell = app.shell();
    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| AppError::General(e.to_string()))?
        .args(["-encoders", "-hide_banner"])
        .output()
        .await
        .map_err(|e| AppError::General(e.to_string()))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let mut encoders = Vec::new();

    // Parse encoder list - look for video encoders
    let relevant_encoders = [
        "libx264",
        "libx265",
        "h264_nvenc",
        "hevc_nvenc",
        "h264_amf",
        "hevc_amf",
        "h264_qsv",
        "hevc_qsv",
    ];

    for encoder in &relevant_encoders {
        if stdout.contains(encoder) {
            encoders.push(serde_json::json!({
                "name": encoder,
                "available": true
            }));
        }
    }

    // Always include libx264 as fallback
    if encoders.is_empty() {
        encoders.push(serde_json::json!({
            "name": "libx264",
            "available": true
        }));
    }

    Ok(Value::Array(encoders))
}

#[tauri::command]
pub async fn set_encoder(app: AppHandle, encoder: String) -> AppResult<()> {
    use tauri_plugin_store::StoreExt;
    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;
    store.set("encoder", Value::String(encoder));
    store
        .save()
        .map_err(|e| AppError::General(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn get_capturers(_app: AppHandle, _force: Option<bool>) -> AppResult<Value> {
    // Platform-specific capture methods
    #[cfg(target_os = "windows")]
    let capturers = vec![
        serde_json::json!({
            "name": "GDI",
            "value": "gdigrab",
            "available": true
        }),
        serde_json::json!({
            "name": "DirectX (DXGI)",
            "value": "dxgi",
            "available": true
        }),
    ];

    #[cfg(target_os = "macos")]
    let capturers = vec![
        serde_json::json!({
            "name": "AVFoundation",
            "value": "avfoundation",
            "available": true
        }),
    ];

    #[cfg(target_os = "linux")]
    let capturers = {
        let mut caps = vec![
            serde_json::json!({
                "name": "X11 Grab",
                "value": "x11grab",
                "available": true
            }),
        ];
        // Check if PipeWire is available
        if std::process::Command::new("pw-cli")
            .arg("info")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            caps.push(serde_json::json!({
                "name": "PipeWire",
                "value": "pipewire",
                "available": true
            }));
        }
        caps
    };

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    let capturers = vec![
        serde_json::json!({
            "name": "X11 Grab",
            "value": "x11grab",
            "available": true
        }),
    ];

    Ok(Value::Array(capturers))
}

#[tauri::command]
pub async fn set_capturer(app: AppHandle, capturer: String) -> AppResult<()> {
    use tauri_plugin_store::StoreExt;
    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;
    store.set("capturer", Value::String(capturer));
    store
        .save()
        .map_err(|e| AppError::General(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn get_camera_video_buffer(app: AppHandle) -> AppResult<Vec<u8>> {
    use crate::state::AppState;
    use std::sync::Mutex;

    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    let project_id = state
        .project_id
        .clone()
        .ok_or(AppError::NoProjectOpen)?;
    let camera_file = state.camera_video_file(&project_id);
    drop(state);

    if camera_file.exists() {
        Ok(std::fs::read(&camera_file)?)
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub async fn get_screen_video_buffer(app: AppHandle) -> AppResult<Vec<u8>> {
    use crate::state::AppState;
    use std::sync::Mutex;

    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    let project_id = state
        .project_id
        .clone()
        .ok_or(AppError::NoProjectOpen)?;
    let screen_file = state.screen_video_file(&project_id);
    drop(state);

    if screen_file.exists() {
        Ok(std::fs::read(&screen_file)?)
    } else {
        Ok(Vec::new())
    }
}

/// Extract audio from a video file using FFmpeg sidecar and return as WAV buffer.
/// This is more memory-efficient for large screen recordings since it only returns
/// the audio track, not the full video.
#[tauri::command]
pub async fn extract_audio_buffer(app: AppHandle, source: String) -> AppResult<Vec<u8>> {
    use crate::state::AppState;
    use std::sync::Mutex;

    let source_file = {
        let state = app.state::<Mutex<AppState>>();
        let state = state.lock().unwrap();
        let project_id = state
            .project_id
            .clone()
            .ok_or(AppError::NoProjectOpen)?;
        match source.as_str() {
            "screen" => state.screen_video_file(&project_id),
            "camera" | "microphone" => state.camera_video_file(&project_id),
            _ => return Err(AppError::General(format!("Unknown audio source: {}", source))),
        }
    };

    if !source_file.exists() {
        return Ok(Vec::new());
    }

    // Use FFmpeg to extract audio as WAV (PCM s16le, mono, 16kHz - optimal for Whisper)
    let shell = app.shell();
    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| AppError::General(e.to_string()))?
        .args([
            "-i",
            source_file.to_str().unwrap_or_default(),
            "-vn",           // no video
            "-acodec", "pcm_s16le",
            "-ar", "16000",  // 16kHz sample rate (Whisper expects this)
            "-ac", "1",      // mono
            "-f", "wav",     // WAV format
            "pipe:1",        // output to stdout
        ])
        .output()
        .await
        .map_err(|e| AppError::General(format!("FFmpeg audio extraction failed: {}", e)))?;

    if output.stdout.is_empty() {
        // No audio track in the video
        return Ok(Vec::new());
    }

    Ok(output.stdout)
}
