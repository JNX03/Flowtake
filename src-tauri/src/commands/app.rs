use crate::error::AppResult;
use serde_json::Value;
use tauri::AppHandle;
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
    // Returns array format expected by PermissionsModal.jsx

    #[cfg(target_os = "windows")]
    {
        // On Windows, screen capture permissions are generally available
        Ok(serde_json::json!([
            { "hasPermission": true, "label": "Screen Capture", "permission": "screenCapture", "path": "" },
            { "hasPermission": true, "label": "Camera", "permission": "camera", "path": "" },
            { "hasPermission": true, "label": "Microphone", "permission": "microphone", "path": "" }
        ]))
    }

    #[cfg(target_os = "macos")]
    {
        // On macOS, check screen recording permission by attempting a 1-pixel capture
        let screen_capture_ok = std::process::Command::new("osascript")
            .args(["-e", r#"tell application "System Events" to return true"#])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

        Ok(serde_json::json!([
            {
                "hasPermission": screen_capture_ok,
                "label": "Screen Capture",
                "permission": "screenCapture",
                "path": "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
            },
            {
                "hasPermission": true,
                "label": "Camera",
                "permission": "camera",
                "path": "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera"
            },
            {
                "hasPermission": true,
                "label": "Microphone",
                "permission": "microphone",
                "path": "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
            }
        ]))
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, check if X11 or Wayland session and required tools
        let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_else(|_| "x11".to_string());
        let is_wayland = session_type == "wayland";

        // Check for required screen capture tools
        let has_capture_tool = if is_wayland {
            // Wayland needs pipewire for screen capture
            std::process::Command::new("pw-cli")
                .arg("info")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        } else {
            // X11: check if DISPLAY is set (x11grab works with any X server)
            std::env::var("DISPLAY").is_ok()
        };

        Ok(serde_json::json!([
            {
                "hasPermission": has_capture_tool,
                "label": if is_wayland { "Screen Capture (PipeWire required)" } else { "Screen Capture" },
                "permission": "screenCapture",
                "path": ""
            },
            { "hasPermission": true, "label": "Camera", "permission": "camera", "path": "" },
            { "hasPermission": true, "label": "Microphone", "permission": "microphone", "path": "" }
        ]))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(serde_json::json!([
            { "hasPermission": true, "label": "Screen Capture", "permission": "screenCapture", "path": "" },
            { "hasPermission": true, "label": "Camera", "permission": "camera", "path": "" },
            { "hasPermission": true, "label": "Microphone", "permission": "microphone", "path": "" }
        ]))
    }
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
