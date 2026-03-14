use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde_json::Value;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn update_background(
    app: AppHandle,
    r#type: String,
    relative_path: Option<String>,
) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    let project_id = state
        .project_id
        .clone()
        .ok_or(AppError::NoProjectOpen)?;
    let bg_file = state.background_file(&project_id);
    drop(state);

    match r#type.as_str() {
        "wallpaper" => {
            if let Some(rel_path) = relative_path {
                let state = app.state::<Mutex<AppState>>();
                let state = state.lock().unwrap();
                let wallpapers_dir = state.app_data_dir.join("wallpapers");
                let src = wallpapers_dir.join(&rel_path);
                if src.exists() {
                    std::fs::copy(&src, &bg_file)?;
                }
            }
        }
        "image" => {
            if let Some(rel_path) = relative_path {
                let state = app.state::<Mutex<AppState>>();
                let state = state.lock().unwrap();
                let project_temp = state.project_temp_dir(&project_id);
                let src = project_temp.join(&rel_path);
                if src.exists() {
                    std::fs::copy(&src, &bg_file)?;
                }
            }
        }
        _ => {}
    }

    Ok(())
}

#[tauri::command]
pub async fn get_wallpapers(app: AppHandle) -> AppResult<Value> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    let wallpapers_dir = state.app_data_dir.join("wallpapers");
    drop(state);

    if !wallpapers_dir.exists() {
        return Ok(Value::Array(vec![]));
    }

    let mut wallpapers = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&wallpapers_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    let ext = ext.to_string_lossy().to_lowercase();
                    if ["png", "jpg", "jpeg", "webp", "gif"].contains(&ext.as_str()) {
                        wallpapers.push(Value::String(
                            path.file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string(),
                        ));
                    }
                }
            }
        }
    }

    Ok(Value::Array(wallpapers))
}

#[tauri::command]
pub async fn sync_background(_app: AppHandle, background: Value) -> AppResult<Value> {
    // Background sync - returns the background config
    Ok(background)
}

#[tauri::command]
pub async fn get_background_images(app: AppHandle) -> AppResult<Value> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    let project_id = state
        .project_id
        .clone()
        .ok_or(AppError::NoProjectOpen)?;
    let project_temp = state.project_temp_dir(&project_id);
    drop(state);

    let bg_dir = project_temp.join("backgrounds");
    if !bg_dir.exists() {
        return Ok(Value::Array(vec![]));
    }

    let mut images = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&bg_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                images.push(Value::String(
                    path.file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string(),
                ));
            }
        }
    }

    Ok(Value::Array(images))
}

#[tauri::command]
pub async fn choose_background_image(app: AppHandle) -> AppResult<Value> {
    let file = app
        .dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "webp", "gif"])
        .blocking_pick_file();

    match file {
        Some(path) => {
            let state = app.state::<Mutex<AppState>>();
            let state = state.lock().unwrap();
            let project_id = state
                .project_id
                .clone()
                .ok_or(AppError::NoProjectOpen)?;
            let bg_dir = state.project_temp_dir(&project_id).join("backgrounds");
            drop(state);

            std::fs::create_dir_all(&bg_dir)?;
            let filename = std::path::Path::new(&path.to_string())
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let dest = bg_dir.join(&filename);
            std::fs::copy(path.to_string(), &dest)?;

            Ok(Value::String(filename))
        }
        None => Ok(Value::Null),
    }
}
