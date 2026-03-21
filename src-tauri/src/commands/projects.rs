use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde_json::Value;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

#[tauri::command]
pub async fn get_projects(app: AppHandle, page: Option<usize>) -> AppResult<Value> {
    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;
    let projects = store
        .get("projects")
        .unwrap_or(Value::Object(Default::default()));

    let items_per_page = 12;
    let page = page.unwrap_or(0);

    let mut entries: Vec<Value> = if let Value::Object(map) = &projects {
        map.values()
            .filter(|v| v.get("lastSaved").is_some())
            .cloned()
            .collect()
    } else {
        vec![]
    };
    entries.sort_by(|a, b| {
        let a_saved = a.get("lastSaved").and_then(|v| v.as_i64()).unwrap_or(0);
        let b_saved = b.get("lastSaved").and_then(|v| v.as_i64()).unwrap_or(0);
        b_saved.cmp(&a_saved)
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
pub async fn open_project(app: AppHandle, id: String) -> AppResult<Value> {
    let state = app.state::<Mutex<AppState>>();

    crate::debug_log(&format!("[open_project] Opening project: {}", id));

    // Set project ID
    {
        let mut state = state.lock().unwrap();
        state.project_id = Some(id.clone());
        let temp_dir = state.project_temp_dir(&id);
        std::fs::create_dir_all(&temp_dir)?;
    }

    // Get zip path from store (check both flat key and nested "projects" object)
    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;

    // Try flat key first
    let project_key = format!("projects.{}.path", id);
    let mut zip_path = store
        .get(&project_key)
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    // Fall back to nested projects object
    if zip_path.is_none() {
        zip_path = store
            .get("projects")
            .and_then(|v| v.get(&id).cloned())
            .and_then(|v| v.get("path").and_then(|p| p.as_str().map(|s| s.to_string())));
    }

    let zip_path = match zip_path {
        Some(p) => p,
        None => {
            store.delete(format!("projects.{}", id));
            let mut state = state.lock().unwrap();
            state.project_id = None;
            return Ok(Value::Null);
        }
    };

    // Unzip project
    let temp_dir = {
        let state = state.lock().unwrap();
        state.project_temp_dir(&id)
    };

    app.emit("load", "Opening project...").ok();

    match unzip_project(&zip_path, &temp_dir) {
        Ok(_) => {}
        Err(_) => {
            store.delete(format!("projects.{}", id));
            let mut state = state.lock().unwrap();
            state.project_id = None;
            return Ok(Value::Null);
        }
    }

    // Read project.json
    let project_json_path = temp_dir.join("project.json");
    if project_json_path.exists() {
        let content = std::fs::read_to_string(&project_json_path)?;
        let json: Value = serde_json::from_str(&content)?;
        app.emit("load", "").ok();
        Ok(json)
    } else {
        let mut state = state.lock().unwrap();
        state.project_id = None;
        Ok(Value::Null)
    }
}

#[tauri::command]
pub async fn close_project(app: AppHandle) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let (project_id, projects_dir, temp_dir) = {
        let state = state.lock().unwrap();
        (
            state.project_id.clone(),
            state.projects_dir.clone(),
            state.project_id.as_ref().map(|id| state.project_temp_dir(id)),
        )
    };

    if let Some(id) = &project_id {
        // Zip project back
        if let Some(temp) = &temp_dir {
            let zip_path = projects_dir.join(format!("{}.zip", id));
            zip_directory(temp, &zip_path)?;
        }

        // Clean up temp folder
        if let Some(temp) = &temp_dir {
            std::fs::remove_dir_all(temp).ok();
        }
    }

    // Clear project ID
    {
        let mut state = state.lock().unwrap();
        state.project_id = None;
        state.file_handles.clear();
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_project(app: AppHandle, project_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();

    // Remove files
    {
        let state = state.lock().unwrap();
        let temp = state.project_temp_dir(&project_id);
        let zip = state.project_zip_path(&project_id);
        std::fs::remove_dir_all(&temp).ok();
        std::fs::remove_file(&zip).ok();
    }

    // Remove from store
    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;
    store.delete(format!("projects.{}", project_id));
    store
        .save()
        .map_err(|e| AppError::General(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub async fn save_json(app: AppHandle, json: Value) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let project_id = {
        let state = state.lock().unwrap();
        state
            .project_id
            .clone()
            .ok_or(AppError::NoProjectOpen)?
    };

    let state_lock = state.lock().unwrap();
    let json_path = state_lock.project_json_file(&project_id);
    drop(state_lock);

    let content = serde_json::to_string_pretty(&json)?;
    std::fs::write(&json_path, content)?;

    Ok(())
}

#[tauri::command]
pub async fn find_project(app: AppHandle) -> AppResult<Value> {
    use tauri_plugin_dialog::DialogExt;

    let file = app
        .dialog()
        .file()
        .add_filter("Flowtake Project", &["zip"])
        .blocking_pick_file();

    match file {
        Some(path) => {
            let path_str = path.to_string();
            Ok(Value::String(path_str))
        }
        None => Ok(Value::Null),
    }
}

#[tauri::command]
pub async fn open_project_dir(app: AppHandle, project_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let zip_path = {
        let state = state.lock().unwrap();
        state.project_zip_path(&project_id)
    };
    if let Some(parent) = zip_path.parent() {
        open::that(parent).ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn open_logs_dir(app: AppHandle) -> AppResult<()> {
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|e| AppError::General(e.to_string()))?;
    open::that(&log_dir).ok();
    Ok(())
}

fn unzip_project(
    zip_path: &str,
    dest_dir: &std::path::Path,
) -> AppResult<()> {
    let file = std::fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let outpath = dest_dir.join(entry.mangled_name());

        if entry.is_dir() {
            std::fs::create_dir_all(&outpath)?;
        } else {
            if let Some(parent) = outpath.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut outfile = std::fs::File::create(&outpath)?;
            std::io::copy(&mut entry, &mut outfile)?;
        }
    }
    Ok(())
}

fn zip_directory(
    src_dir: &std::path::Path,
    zip_path: &std::path::Path,
) -> AppResult<()> {
    use std::io::{Read, Write};

    let file = std::fs::File::create(zip_path)?;
    let mut zip_writer = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Stored);

    let walkdir = walkdir(src_dir)?;
    for entry in walkdir {
        let path = &entry;
        let name = path
            .strip_prefix(src_dir)
            .unwrap()
            .to_string_lossy()
            .replace('\\', "/");

        if path.is_file() {
            zip_writer.start_file(&name, options)?;
            let mut f = std::fs::File::open(path)?;
            let mut buffer = Vec::new();
            f.read_to_end(&mut buffer)?;
            zip_writer.write_all(&buffer)?;
        } else if path.is_dir() && !name.is_empty() {
            zip_writer.add_directory(&name, options)?;
        }
    }
    zip_writer.finish()?;
    Ok(())
}

fn walkdir(dir: &std::path::Path) -> AppResult<Vec<std::path::PathBuf>> {
    let mut entries = Vec::new();
    if dir.is_dir() {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                entries.push(path.clone());
                entries.extend(walkdir(&path)?);
            } else {
                entries.push(path);
            }
        }
    }
    Ok(entries)
}
