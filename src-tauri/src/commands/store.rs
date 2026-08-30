use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::error::{AppError, AppResult};
use crate::identifiers::validate_project_id;

const LIVE_SETTINGS_KEY: &str = "live.settings";

fn sanitize_store_value(key: &str, mut value: Value) -> (Value, bool) {
    if key != LIVE_SETTINGS_KEY {
        return (value, false);
    }

    let mut removed = false;
    if let Value::Object(settings) = &mut value {
        removed |= settings.remove("streamKey").is_some();
        removed |= settings.remove("stream_key").is_some();
    }
    (value, removed)
}

pub fn migrate_legacy_live_settings(app: &AppHandle) -> AppResult<bool> {
    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;
    let Some(value) = store.get(LIVE_SETTINGS_KEY) else {
        return Ok(false);
    };
    let (sanitized, removed_secret) = sanitize_store_value(LIVE_SETTINGS_KEY, value);
    if removed_secret {
        store.set(LIVE_SETTINGS_KEY, sanitized);
        store.save().map_err(|e| AppError::General(e.to_string()))?;
    }
    Ok(removed_secret)
}

#[tauri::command]
pub async fn store_get(app: AppHandle, key: String) -> AppResult<Value> {
    let store = app
        .store("store.json")
        .map_err(|e| crate::error::AppError::General(e.to_string()))?;
    let value = store.get(&key).unwrap_or(Value::Null);
    let (value, removed_secret) = sanitize_store_value(&key, value);
    if removed_secret {
        store.set(&key, value.clone());
        store
            .save()
            .map_err(|e| crate::error::AppError::General(e.to_string()))?;
    }
    Ok(value)
}

#[tauri::command]
pub async fn store_set(app: AppHandle, key: String, value: Value) -> AppResult<()> {
    if key == "projects" || key.starts_with("projects.") {
        return Err(AppError::General(
            "Project library state is backend-owned".to_string(),
        ));
    }
    let (value, _) = sanitize_store_value(&key, value);
    let store = app
        .store("store.json")
        .map_err(|e| crate::error::AppError::General(e.to_string()))?;
    store.set(&key, value);
    store
        .save()
        .map_err(|e| crate::error::AppError::General(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::sanitize_store_value;
    use serde_json::json;

    #[test]
    fn live_stream_keys_are_never_returned_or_persisted_in_generic_settings() {
        let (sanitized, removed) = sanitize_store_value(
            "live.settings",
            json!({
                "platform": "youtube",
                "streamKey": "secret-one",
                "stream_key": "secret-two"
            }),
        );

        assert!(removed);
        assert_eq!(sanitized, json!({ "platform": "youtube" }));

        let untouched = json!({ "streamKey": "ordinary-field" });
        assert_eq!(
            sanitize_store_value("unrelated", untouched.clone()),
            (untouched, false)
        );
    }
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
            .iter()
            .filter(|(id, value)| {
                value.get("lastSaved").is_some()
                    && (key != "projects"
                        || (validate_project_id(id).is_ok()
                            && value.get("id").and_then(Value::as_str) == Some(id.as_str())))
            })
            .map(|(_, value)| value.clone())
            .collect();
        entries.sort_by(|a, b| {
            let a_saved = a
                .get("lastSaved")
                .and_then(|v| {
                    v.as_i64()
                        .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
                })
                .unwrap_or(0);
            let b_saved = b
                .get("lastSaved")
                .and_then(|v| {
                    v.as_i64()
                        .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
                })
                .unwrap_or(0);
            b_saved.cmp(&a_saved)
        });
        entries
    } else {
        vec![]
    };

    let total_pages = if items.is_empty() {
        0
    } else {
        items.len().div_ceil(items_per_page)
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
