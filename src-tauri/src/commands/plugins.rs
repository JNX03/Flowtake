use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[derive(Serialize)]
pub struct PluginEntry {
    pub name: String,
    pub size: u64,
    pub modified_ms: i64,
    pub kind: String,
    pub is_dir: bool,
}

fn plugins_dir(state: &State<'_, Mutex<AppState>>) -> AppResult<PathBuf> {
    let dir = {
        let s = state.lock().unwrap();
        s.app_data_dir.join("plugins")
    };
    std::fs::create_dir_all(&dir)
        .map_err(|e| AppError::General(format!("Failed to create plugins dir: {}", e)))?;
    Ok(dir)
}

#[tauri::command]
pub async fn ensure_plugins_dir(state: State<'_, Mutex<AppState>>) -> AppResult<String> {
    let dir = plugins_dir(&state)?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn list_plugins(state: State<'_, Mutex<AppState>>) -> AppResult<Vec<PluginEntry>> {
    let dir = plugins_dir(&state)?;
    let entries = match std::fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Ok(Vec::new()),
    };

    let mut out = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        // Skip hidden / dotfiles
        if name.starts_with('.') {
            continue;
        }
        let kind = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_string();
        let modified_ms = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        out.push(PluginEntry {
            name,
            size: metadata.len(),
            modified_ms,
            kind,
            is_dir: metadata.is_dir(),
        });
    }
    out.sort_by_key(|entry| entry.name.to_lowercase());
    Ok(out)
}

#[tauri::command]
pub async fn open_plugins_folder(state: State<'_, Mutex<AppState>>) -> AppResult<()> {
    let dir = plugins_dir(&state)?;
    open::that(&dir)
        .map_err(|e| AppError::General(format!("Failed to open plugins folder: {}", e)))?;
    Ok(())
}
