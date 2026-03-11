use crate::error::AppResult;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub async fn get_license(app: AppHandle) -> AppResult<()> {
    // License check - emit result to frontend
    // For now, default to valid license (user can implement their own license server)
    let license_result = serde_json::json!({
        "isValid": true,
        "message": null,
        "isReceivingUpdates": true,
        "email": null
    });

    app.emit_to("main", "license", &license_result).ok();
    Ok(())
}

#[tauri::command]
pub async fn activate(app: AppHandle, license_key: String) -> AppResult<Value> {
    // License activation - can be implemented with your license server
    let license_result = serde_json::json!({
        "isValid": true,
        "message": null,
        "isReceivingUpdates": true,
        "email": null,
        "key": license_key
    });

    app.emit_to("main", "license", &license_result).ok();
    Ok(license_result)
}
