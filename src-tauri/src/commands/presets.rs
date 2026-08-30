use crate::error::{AppError, AppResult};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreExt;

#[tauri::command]
pub async fn save_preset(app: AppHandle, preset: Value) -> AppResult<()> {
    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;

    let preset_id = preset
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let key = format!("presets.{}", preset_id);
    store.set(&key, preset);
    store.save().map_err(|e| AppError::General(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub async fn get_presets(app: AppHandle, page: Option<usize>) -> AppResult<Value> {
    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;
    let presets = store
        .get("presets")
        .unwrap_or(Value::Object(Default::default()));

    let items_per_page = 12;
    let page = page.unwrap_or(0);

    let mut entries: Vec<Value> = if let Value::Object(map) = &presets {
        map.values()
            .filter(|v| v.get("lastSaved").is_some())
            .cloned()
            .collect()
    } else {
        vec![]
    };
    entries.sort_by(|a, b| {
        let a_saved = a.get("lastSaved").and_then(|v| v.as_str()).unwrap_or("");
        let b_saved = b.get("lastSaved").and_then(|v| v.as_str()).unwrap_or("");
        b_saved.cmp(a_saved)
    });

    let total_pages = if entries.is_empty() {
        0
    } else {
        entries.len().div_ceil(items_per_page)
    };
    let clamped_page = page.min(total_pages.saturating_sub(1));
    let start = clamped_page * items_per_page;
    let end = (start + items_per_page).min(entries.len());
    let page_items: Vec<Value> = entries[start..end].to_vec();

    Ok(serde_json::json!({
        "items": page_items,
        "page": clamped_page,
        "totalPages": total_pages
    }))
}

#[tauri::command]
pub async fn delete_preset(app: AppHandle, id: String) -> AppResult<()> {
    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;
    store.delete(format!("presets.{}", id));
    store.save().map_err(|e| AppError::General(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn get_preset(app: AppHandle, id: String) -> AppResult<Value> {
    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;
    let key = format!("presets.{}", id);
    Ok(store.get(&key).unwrap_or(Value::Null))
}

#[tauri::command]
pub async fn open_preset_dir(app: AppHandle, _id: String) -> AppResult<()> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::General(e.to_string()))?;
    open::that(&app_data).ok();
    Ok(())
}

#[tauri::command]
pub async fn import_preset(app: AppHandle) -> AppResult<Value> {
    let file = app
        .dialog()
        .file()
        .add_filter("Flowtake Preset", &["json"])
        .blocking_pick_file();

    match file {
        Some(path) => {
            let content = std::fs::read_to_string(path.to_string())?;
            let preset: Value = serde_json::from_str(&content)?;
            Ok(preset)
        }
        None => Ok(Value::Null),
    }
}
