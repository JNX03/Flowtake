use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::error::AppResult;

#[tauri::command]
pub async fn store_get(app: AppHandle, key: String) -> AppResult<Value> {
    let store = app
        .store("store.json")
        .map_err(|e| crate::error::AppError::General(e.to_string()))?;
    let value = store.get(&key).unwrap_or(Value::Null);
    Ok(value)
}

#[tauri::command]
pub async fn store_set(app: AppHandle, key: String, value: Value) -> AppResult<()> {
    let store = app
        .store("store.json")
        .map_err(|e| crate::error::AppError::General(e.to_string()))?;
    store.set(&key, value);
    store
        .save()
        .map_err(|e| crate::error::AppError::General(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn store_get_paginated(
    app: AppHandle,
    key: String,
    requested_page: usize,
    items_per_page: usize,
) -> AppResult<Value> {
    let store = app
        .store("store.json")
        .map_err(|e| crate::error::AppError::General(e.to_string()))?;
    let all_data = store.get(&key).unwrap_or(Value::Object(Default::default()));

    let items: Vec<Value> = if let Value::Object(map) = &all_data {
        let mut entries: Vec<Value> = map
            .values()
            .filter(|v| v.get("lastSaved").is_some())
            .cloned()
            .collect();
        entries.sort_by(|a, b| {
            let a_saved = a.get("lastSaved").and_then(|v| v.as_str()).unwrap_or("");
            let b_saved = b.get("lastSaved").and_then(|v| v.as_str()).unwrap_or("");
            b_saved.cmp(a_saved)
        });
        entries
    } else {
        vec![]
    };

    let total_pages = if items.is_empty() {
        0
    } else {
        (items.len() + items_per_page - 1) / items_per_page
    };
    let page = requested_page.min(total_pages.saturating_sub(1));
    let start = page * items_per_page;
    let end = (start + items_per_page).min(items.len());
    let page_items: Vec<Value> = items[start..end].to_vec();

    Ok(serde_json::json!({
        "items": page_items,
        "page": page,
        "totalPages": total_pages
    }))
}
