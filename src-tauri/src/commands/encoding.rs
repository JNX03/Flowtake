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
    // On Windows, available capture methods
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
