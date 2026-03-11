use crate::error::{AppError, AppResult};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn get_version(app: AppHandle) -> AppResult<String> {
    Ok(app
        .config()
        .version
        .clone()
        .unwrap_or_else(|| "0.0.0".to_string()))
}

#[tauri::command]
pub async fn get_machine_id() -> AppResult<String> {
    // Generate a machine-specific ID using system info
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(hostname.as_bytes());
    let result = hasher.finalize();
    Ok(format!("{:x}", result)[..32].to_string())
}

#[tauri::command]
pub async fn get_is_sentry_enabled() -> AppResult<bool> {
    // Sentry is disabled in Tauri version for now
    // Can be re-enabled with tauri-plugin-sentry
    Ok(false)
}

#[tauri::command]
pub async fn check_permissions() -> AppResult<Value> {
    // On Windows, screen capture permissions are generally available
    // On macOS, we'd need to check screen recording permission
    // Returns array format expected by PermissionsModal.jsx
    Ok(serde_json::json!([
        { "hasPermission": true, "label": "Screen Capture", "permission": "screenCapture", "path": "" },
        { "hasPermission": true, "label": "Camera", "permission": "camera", "path": "" },
        { "hasPermission": true, "label": "Microphone", "permission": "microphone", "path": "" }
    ]))
}

#[tauri::command]
pub async fn check_for_updates(_app: AppHandle) -> AppResult<()> {
    // Tauri updater plugin handles this
    // For now, no-op - can be integrated with tauri-plugin-updater
    Ok(())
}

#[tauri::command]
pub async fn install_update(_app: AppHandle) -> AppResult<()> {
    // Tauri updater plugin handles this
    Ok(())
}

#[tauri::command]
pub async fn choose_export_directory(app: AppHandle) -> AppResult<Value> {
    let folder = app.dialog().file().blocking_pick_folder();

    match folder {
        Some(path) => Ok(Value::String(path.to_string())),
        None => Ok(Value::Null),
    }
}
