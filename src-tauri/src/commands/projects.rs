use crate::error::{AppError, AppResult};
use crate::identifiers::validate_project_id;
use crate::state::AppState;
use serde_json::Value;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

fn project_storage_paths(
    state: &AppState,
    project_id: &str,
) -> AppResult<(std::path::PathBuf, std::path::PathBuf)> {
    validate_project_id(project_id)?;
    Ok((
        state.project_temp_dir(project_id),
        state.project_zip_path(project_id),
    ))
}

fn remove_project_storage(state: &AppState, project_id: &str) -> AppResult<()> {
    let (temp, zip) = project_storage_paths(state, project_id)?;
    if let Err(error) = std::fs::remove_dir_all(&temp) {
        if error.kind() != std::io::ErrorKind::NotFound {
            log::warn!(
                "[delete_project] remove temp dir failed ({:?}): {}",
                temp,
                error
            );
        }
    }
    if zip.exists() {
        std::fs::remove_file(&zip).map_err(|error| {
            log::error!("[delete_project] remove zip failed ({:?}): {}", zip, error);
            AppError::General(format!("Failed to delete project file: {}", error))
        })?;
    }
    Ok(())
}

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
        map.iter()
            .filter(|(id, value)| {
                validate_project_id(id).is_ok()
                    && value.get("id").and_then(Value::as_str) == Some(id.as_str())
                    && value.get("lastSaved").is_some()
            })
            .map(|(_, value)| value.clone())
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
    validate_project_id(&id)?;
    let state = app.state::<Mutex<AppState>>();

    log::info!("[open_project] Opening project: {}", id);
    crate::debug_log(&format!("[open_project] Opening project: {}", id));

    // Require a backend-recorded project before deriving or touching any path.
    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;
    let is_registered = store
        .get("projects")
        .and_then(|projects| projects.get(&id).cloned())
        .is_some();
    if !is_registered {
        return Err(AppError::General("Project is not registered".to_string()));
    }

    let (zip_path, temp_dir) = {
        let mut state = state.lock().unwrap();
        let (temp_dir, zip_path) = project_storage_paths(&state, &id)?;
        state.project_id = Some(id.clone());
        (zip_path, temp_dir)
    };
    if !zip_path.is_file() {
        state.lock().unwrap().project_id = None;
        return Ok(Value::Null);
    }

    if temp_dir.exists() {
        std::fs::remove_dir_all(&temp_dir)?;
    }
    std::fs::create_dir_all(&temp_dir)?;

    log::info!("[open_project] zip_path={:?}", zip_path);

    app.emit("load", "Opening project...").ok();

    match unzip_project(&zip_path.to_string_lossy(), &temp_dir) {
        Ok(_) => {
            log::info!("[open_project] unzipped into {:?}", temp_dir);
        }
        Err(e) => {
            log::error!("[open_project] unzip failed: {}", e);
            std::fs::remove_dir_all(&temp_dir).ok();
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
        log::info!("[open_project] returning JSON to frontend for id={}", id);
        Ok(json)
    } else {
        log::warn!(
            "[open_project] project.json MISSING at {:?}",
            project_json_path
        );
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
            state
                .project_id
                .as_ref()
                .map(|id| state.project_temp_dir(id)),
        )
    };

    if let Some(id) = &project_id {
        validate_project_id(id)?;
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
    validate_project_id(&project_id)?;
    let state = app.state::<Mutex<AppState>>();

    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;
    let mut projects = match store.get("projects") {
        Some(Value::Object(map)) => map,
        _ => Default::default(),
    };
    if !projects.contains_key(&project_id) {
        return Err(AppError::General("Project is not registered".to_string()));
    }

    let (temp, zip) = {
        let state = state.lock().unwrap();
        project_storage_paths(&state, &project_id)?
    };

    log::info!(
        "[delete_project] id={} zip={:?} temp={:?}",
        project_id,
        zip,
        temp
    );

    {
        let state = state.lock().unwrap();
        remove_project_storage(&state, &project_id)?;
    }

    let removed = projects.remove(&project_id).is_some();
    store.set("projects", Value::Object(projects));
    store.save().map_err(|e| AppError::General(e.to_string()))?;

    log::info!(
        "[delete_project] done id={} removed_from_store={}",
        project_id,
        removed
    );
    Ok(())
}

#[tauri::command]
pub async fn save_json(app: AppHandle, json: Value) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let project_id = {
        let state = state.lock().unwrap();
        state.project_id.clone().ok_or(AppError::NoProjectOpen)?
    };
    validate_project_id(&project_id)?;

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
        Some(path) => import_project_archive(&app, std::path::Path::new(&path.to_string())),
        None => Ok(Value::Null),
    }
}

fn import_project_archive(app: &AppHandle, source: &std::path::Path) -> AppResult<Value> {
    if !source.is_file() {
        return Err(AppError::General(
            "Selected project archive is not a regular file".to_string(),
        ));
    }
    {
        let file = std::fs::File::open(source)?;
        let mut archive = zip::ZipArchive::new(file)?;
        let has_project_manifest = (0..archive.len()).any(|index| {
            archive
                .by_index(index)
                .map(|entry| entry.mangled_name() == std::path::Path::new("project.json"))
                .unwrap_or(false)
        });
        if !has_project_manifest {
            return Err(AppError::General(
                "Selected archive is not a Flowtake project".to_string(),
            ));
        }
    }

    let id = uuid::Uuid::new_v4().hyphenated().to_string();
    let state = app.state::<Mutex<AppState>>();
    let destination = {
        let state = state.lock().unwrap();
        std::fs::create_dir_all(&state.projects_dir)?;
        state.project_zip_path(&id)
    };
    let staging = destination.with_extension("zip.importing");
    std::fs::copy(source, &staging)?;
    if let Err(error) = std::fs::rename(&staging, &destination) {
        let _ = std::fs::remove_file(&staging);
        return Err(error.into());
    }

    let project_name = source
        .file_stem()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("Imported project");
    let destination_string = destination.to_string_lossy().to_string();
    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;
    let mut projects = match store.get("projects") {
        Some(Value::Object(map)) => map,
        _ => Default::default(),
    };
    projects.insert(
        id.clone(),
        serde_json::json!({
            "id": id,
            "lastSaved": chrono::Utc::now().timestamp_millis(),
            "name": project_name,
            "path": destination_string,
        }),
    );
    store.set("projects", Value::Object(projects));
    store.set(
        format!("projects.{}.path", id),
        Value::String(destination_string),
    );
    if let Err(error) = store.save() {
        let _ = std::fs::remove_file(&destination);
        return Err(AppError::General(error.to_string()));
    }

    Ok(Value::String(id))
}

#[tauri::command]
pub async fn open_project_dir(app: AppHandle, project_id: String) -> AppResult<()> {
    validate_project_id(&project_id)?;
    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;
    if store
        .get("projects")
        .and_then(|projects| projects.get(&project_id).cloned())
        .is_none()
    {
        return Err(AppError::General("Project is not registered".to_string()));
    }
    let state = app.state::<Mutex<AppState>>();
    let projects_dir = {
        let state = state.lock().unwrap();
        state.projects_dir.clone()
    };
    open::that(projects_dir).ok();
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

fn unzip_project(zip_path: &str, dest_dir: &std::path::Path) -> AppResult<()> {
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

fn zip_directory(src_dir: &std::path::Path, zip_path: &std::path::Path) -> AppResult<()> {
    use std::io::{Read, Write};

    let file = std::fs::File::create(zip_path)?;
    let mut zip_writer = zip::ZipWriter::new(file);
    let options =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

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

#[cfg(test)]
mod path_boundary_tests {
    use super::remove_project_storage;
    use crate::state::AppState;

    #[test]
    fn invalid_project_ids_cannot_delete_outside_storage_roots() {
        let root = std::env::temp_dir().join(format!(
            "flowtake-project-boundary-test-{}",
            uuid::Uuid::new_v4()
        ));
        let sentinel = root.join("sentinel");
        std::fs::create_dir_all(&sentinel).unwrap();
        std::fs::write(sentinel.join("keep.txt"), b"keep").unwrap();

        let mut state = AppState::new();
        state.temp_dir = root.join("temp");
        state.projects_dir = root.join("projects");
        std::fs::create_dir_all(&state.temp_dir).unwrap();
        std::fs::create_dir_all(&state.projects_dir).unwrap();

        for invalid in ["..", "../sentinel", "..\\sentinel", "/tmp", "C:\\"] {
            assert!(remove_project_storage(&state, invalid).is_err());
            assert_eq!(std::fs::read(sentinel.join("keep.txt")).unwrap(), b"keep");
        }

        let project_id = uuid::Uuid::new_v4().hyphenated().to_string();
        let project_temp = state.project_temp_dir(&project_id);
        let project_zip = state.project_zip_path(&project_id);
        std::fs::create_dir_all(&project_temp).unwrap();
        std::fs::write(project_temp.join("project.json"), b"{}").unwrap();
        std::fs::write(&project_zip, b"zip").unwrap();
        remove_project_storage(&state, &project_id).unwrap();

        assert!(!project_temp.exists());
        assert!(!project_zip.exists());
        assert_eq!(std::fs::read(sentinel.join("keep.txt")).unwrap(), b"keep");
        let _ = std::fs::remove_dir_all(&root);
    }
}
