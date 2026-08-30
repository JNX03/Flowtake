use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde::Serialize;
use serde_json::Value;
use std::ffi::OsStr;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::sync::{LazyLock, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

const PROJECT_ASSETS_DIRECTORY: &str = "assets";
const PROJECT_MEDIA_COPY_ATTEMPTS: usize = 16;
static PROJECT_MEDIA_IO: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMediaMetadata {
    pub relative_path: String,
    pub absolute_path: String,
    pub original_name: String,
    pub file_name: String,
    pub size: u64,
    pub mime_type: String,
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

    log::info!("[open_project] Opening project: {}", id);
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
            .and_then(|v| {
                v.get("path")
                    .and_then(|p| p.as_str().map(|s| s.to_string()))
            });
    }

    let zip_path = match zip_path {
        Some(p) => p,
        None => {
            log::warn!("[open_project] zip path not found in store for id={}", id);
            store.delete(format!("projects.{}", id));
            let mut state = state.lock().unwrap();
            state.project_id = None;
            return Ok(Value::Null);
        }
    };

    log::info!("[open_project] zip_path={}", zip_path);

    // Unzip project
    let temp_dir = {
        let state = state.lock().unwrap();
        state.project_temp_dir(&id)
    };

    app.emit("load", "Opening project...").ok();

    match with_project_media_io(|| unzip_project(&zip_path, &temp_dir)) {
        Ok(_) => {
            log::info!("[open_project] unzipped into {:?}", temp_dir);
        }
        Err(e) => {
            log::error!("[open_project] unzip failed: {}", e);
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

    with_project_media_io(|| {
        if let Some(id) = &project_id {
            // Zip project back
            if let Some(temp) = &temp_dir {
                let zip_path = projects_dir.join(format!("{}.zip", id));
                zip_directory(temp, &zip_path)?;
            }

            // Clean up temp folder only after the archive contains any import
            // that was already in flight when close was requested.
            if let Some(temp) = &temp_dir {
                std::fs::remove_dir_all(temp).ok();
            }
        }

        // Do not clear a different project if a new open request arrived
        // while this close request was waiting for media I/O to finish.
        let mut state = state.lock().unwrap();
        if state.project_id == project_id {
            state.project_id = None;
            state.file_handles.clear();
        }

        Ok(())
    })
}

#[tauri::command]
pub async fn delete_project(app: AppHandle, project_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();

    let (temp, zip) = {
        let state = state.lock().unwrap();
        (
            state.project_temp_dir(&project_id),
            state.project_zip_path(&project_id),
        )
    };

    log::info!(
        "[delete_project] id={} zip={:?} temp={:?}",
        project_id,
        zip,
        temp
    );

    // Remove temp dir best-effort; on Windows handles from a recent open may linger.
    with_project_media_io(|| {
        if let Err(e) = std::fs::remove_dir_all(&temp) {
            if e.kind() != std::io::ErrorKind::NotFound {
                log::warn!(
                    "[delete_project] remove temp dir failed ({:?}): {}",
                    temp,
                    e
                );
            }
        }

        // Zip deletion must succeed — that's the canonical "project exists" signal.
        if zip.exists() {
            std::fs::remove_file(&zip).map_err(|e| {
                log::error!("[delete_project] remove zip failed ({:?}): {}", zip, e);
                AppError::General(format!("Failed to delete project file: {}", e))
            })?;
        }
        Ok(())
    })?;

    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;
    let mut projects = match store.get("projects") {
        Some(Value::Object(map)) => map,
        _ => Default::default(),
    };
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

    let state_lock = state.lock().unwrap();
    let json_path = state_lock.project_json_file(&project_id);
    drop(state_lock);

    let content = serde_json::to_string_pretty(&json)?;
    std::fs::write(&json_path, content)?;

    Ok(())
}

/// Copy a user-selected media file into the open project's durable asset
/// directory. The generated storage name is independent of the source name,
/// and the destination is opened with create_new so an existing asset can
/// never be overwritten by a collision.
#[tauri::command]
pub async fn import_project_media(
    app: AppHandle,
    source_path: String,
) -> AppResult<ProjectMediaMetadata> {
    let (temp_root, project_id) = {
        let state = app.state::<Mutex<AppState>>();
        let state = state.lock().unwrap();
        (
            state.temp_dir.clone(),
            state.project_id.clone().ok_or(AppError::NoProjectOpen)?,
        )
    };

    tauri::async_runtime::spawn_blocking(move || {
        with_project_media_io(|| {
            import_project_media_file(&temp_root, &project_id, Path::new(&source_path))
        })
    })
    .await
    .map_err(|error| AppError::General(format!("Project media import task failed: {error}")))?
}

/// Resolve an asset path stored in project JSON after the project archive has
/// been reopened. Only canonical files contained by this project's assets
/// directory are returned.
#[tauri::command]
pub async fn resolve_project_media(
    app: AppHandle,
    relative_path: String,
) -> AppResult<ProjectMediaMetadata> {
    let (temp_root, project_id) = {
        let state = app.state::<Mutex<AppState>>();
        let state = state.lock().unwrap();
        (
            state.temp_dir.clone(),
            state.project_id.clone().ok_or(AppError::NoProjectOpen)?,
        )
    };

    tauri::async_runtime::spawn_blocking(move || {
        with_project_media_io(|| {
            resolve_project_media_file(&temp_root, &project_id, &relative_path)
        })
    })
    .await
    .map_err(|error| AppError::General(format!("Project media resolve task failed: {error}")))?
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

fn with_project_media_io<T>(operation: impl FnOnce() -> AppResult<T>) -> AppResult<T> {
    let _guard = PROJECT_MEDIA_IO
        .lock()
        .map_err(|_| AppError::General("Project media I/O lock was poisoned".to_string()))?;
    operation()
}

pub(crate) fn open_project_media_file_for_read(
    temp_root: &Path,
    project_id: &str,
    relative_path: &str,
) -> AppResult<std::fs::File> {
    with_project_media_io(|| {
        let media_path = resolve_project_media_path(temp_root, project_id, relative_path)?;
        Ok(std::fs::File::open(media_path)?)
    })
}

fn import_project_media_file(
    temp_root: &Path,
    project_id: &str,
    source_path: &Path,
) -> AppResult<ProjectMediaMetadata> {
    if source_path.as_os_str().is_empty() {
        return Err(AppError::General(
            "A source media path is required".to_string(),
        ));
    }

    let source = source_path.canonicalize().map_err(|error| {
        AppError::General(format!("Unable to access selected media file: {error}"))
    })?;
    if !source.metadata()?.is_file() {
        return Err(AppError::General(
            "Selected media path is not a file".to_string(),
        ));
    }

    let original_name = source
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .filter(|name| !name.is_empty())
        .ok_or_else(|| AppError::General("Selected media file has no name".to_string()))?;

    let project_root = canonical_project_root(temp_root, project_id)?;
    let assets_dir = canonical_project_assets_dir(&project_root)?;
    let extension = safe_media_extension(source.extension());
    let (destination, file_name, mut destination_file) =
        create_unique_asset_destination(&assets_dir, extension.as_deref())?;
    let mut source_file = std::fs::File::open(&source)?;

    let copy_result = std::io::copy(&mut source_file, &mut destination_file)
        .and_then(|size| destination_file.flush().map(|_| size));
    drop(destination_file);

    let size = match copy_result {
        Ok(size) => size,
        Err(error) => {
            std::fs::remove_file(&destination).ok();
            return Err(error.into());
        }
    };

    let canonical_destination = match destination.canonicalize() {
        Ok(path) if path.starts_with(&assets_dir) => path,
        Ok(_) => {
            std::fs::remove_file(&destination).ok();
            return Err(AppError::General(
                "Imported media resolved outside the project assets directory".to_string(),
            ));
        }
        Err(error) => {
            std::fs::remove_file(&destination).ok();
            return Err(error.into());
        }
    };

    let relative_path = project_relative_path(&project_root, &canonical_destination)?;
    Ok(ProjectMediaMetadata {
        relative_path,
        absolute_path: canonical_destination.to_string_lossy().into_owned(),
        original_name,
        file_name,
        size,
        mime_type: mime_guess::from_path(&source)
            .first_or_octet_stream()
            .essence_str()
            .to_string(),
    })
}

fn resolve_project_media_file(
    temp_root: &Path,
    project_id: &str,
    relative_path: &str,
) -> AppResult<ProjectMediaMetadata> {
    let project_root = canonical_project_root(temp_root, project_id)?;
    let canonical_candidate = resolve_project_media_path(temp_root, project_id, relative_path)?;

    let file_name = canonical_candidate
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .ok_or_else(|| AppError::General("Stored project media has no file name".to_string()))?;
    let metadata = canonical_candidate.metadata()?;

    Ok(ProjectMediaMetadata {
        relative_path: project_relative_path(&project_root, &canonical_candidate)?,
        absolute_path: canonical_candidate.to_string_lossy().into_owned(),
        original_name: file_name.clone(),
        file_name,
        size: metadata.len(),
        mime_type: mime_guess::from_path(&canonical_candidate)
            .first_or_octet_stream()
            .essence_str()
            .to_string(),
    })
}

pub(crate) fn resolve_project_media_path(
    temp_root: &Path,
    project_id: &str,
    relative_path: &str,
) -> AppResult<PathBuf> {
    let safe_relative_path = validate_project_media_relative_path(relative_path)?;
    let project_root = canonical_project_root(temp_root, project_id)?;
    let assets_dir = canonical_project_assets_dir(&project_root)?;
    let candidate = project_root.join(&safe_relative_path);
    let canonical_candidate = candidate.canonicalize().map_err(|error| {
        AppError::General(format!(
            "Stored project media could not be resolved: {error}"
        ))
    })?;

    if !canonical_candidate.starts_with(&assets_dir) || !canonical_candidate.metadata()?.is_file() {
        return Err(AppError::General(
            "Stored media path is not a file inside this project's assets directory".to_string(),
        ));
    }

    Ok(canonical_candidate)
}

fn canonical_project_root(temp_root: &Path, project_id: &str) -> AppResult<PathBuf> {
    validate_project_id(project_id)?;
    let canonical_temp_root = temp_root.canonicalize().map_err(|error| {
        AppError::General(format!("Project temp directory is unavailable: {error}"))
    })?;
    let canonical_project_root = temp_root.join(project_id).canonicalize().map_err(|error| {
        AppError::General(format!("Open project directory is unavailable: {error}"))
    })?;

    if canonical_project_root == canonical_temp_root
        || !canonical_project_root.starts_with(&canonical_temp_root)
    {
        return Err(AppError::General(
            "Open project directory escaped the project temp directory".to_string(),
        ));
    }

    Ok(canonical_project_root)
}

fn canonical_project_assets_dir(project_root: &Path) -> AppResult<PathBuf> {
    let assets_candidate = project_root.join(PROJECT_ASSETS_DIRECTORY);
    std::fs::create_dir_all(&assets_candidate)?;
    let assets_dir = assets_candidate.canonicalize()?;

    if assets_dir == project_root || !assets_dir.starts_with(project_root) {
        return Err(AppError::General(
            "Project assets directory escaped the open project".to_string(),
        ));
    }

    Ok(assets_dir)
}

fn validate_project_id(project_id: &str) -> AppResult<()> {
    if project_id.is_empty()
        || project_id.contains('/')
        || project_id.contains(char::from(92))
        || project_id.contains(char::from(0))
    {
        return Err(AppError::General("Invalid open project ID".to_string()));
    }

    let mut components = Path::new(project_id).components();
    let is_single_normal_component =
        matches!(components.next(), Some(Component::Normal(_))) && components.next().is_none();
    if !is_single_normal_component {
        return Err(AppError::General("Invalid open project ID".to_string()));
    }

    Ok(())
}

fn validate_project_media_relative_path(relative_path: &str) -> AppResult<PathBuf> {
    if relative_path.is_empty()
        || relative_path.contains(char::from(92))
        || relative_path.contains(char::from(0))
    {
        return Err(AppError::General("Invalid project media path".to_string()));
    }

    let path = Path::new(relative_path);
    if path.is_absolute() {
        return Err(AppError::General(
            "Project media path must be relative".to_string(),
        ));
    }

    let mut normal_components = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => normal_components.push(value),
            _ => {
                return Err(AppError::General(
                    "Project media path contains an unsafe component".to_string(),
                ))
            }
        }
    }

    if normal_components.len() < 2
        || normal_components.first().copied() != Some(OsStr::new(PROJECT_ASSETS_DIRECTORY))
    {
        return Err(AppError::General(
            "Project media path must stay inside the assets directory".to_string(),
        ));
    }

    Ok(normal_components.into_iter().collect())
}

fn safe_media_extension(extension: Option<&OsStr>) -> Option<String> {
    let extension = extension?.to_str()?;
    if extension.is_empty()
        || extension.len() > 16
        || !extension
            .chars()
            .all(|character| character.is_ascii_alphanumeric())
    {
        return None;
    }
    Some(extension.to_ascii_lowercase())
}

fn create_unique_asset_destination(
    assets_dir: &Path,
    extension: Option<&str>,
) -> AppResult<(PathBuf, String, std::fs::File)> {
    for _ in 0..PROJECT_MEDIA_COPY_ATTEMPTS {
        let identifier = uuid::Uuid::new_v4().simple().to_string();
        let file_name = match extension {
            Some(extension) => format!("{identifier}.{extension}"),
            None => identifier,
        };
        let destination = assets_dir.join(&file_name);

        match std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&destination)
        {
            Ok(file) => return Ok((destination, file_name, file)),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.into()),
        }
    }

    Err(AppError::General(
        "Unable to allocate a unique project media path".to_string(),
    ))
}

fn project_relative_path(project_root: &Path, media_path: &Path) -> AppResult<String> {
    let relative_path = media_path.strip_prefix(project_root).map_err(|_| {
        AppError::General("Project media path escaped the open project".to_string())
    })?;
    let relative_path = relative_path
        .to_string_lossy()
        .replace(std::path::MAIN_SEPARATOR, "/");
    validate_project_media_relative_path(&relative_path)?;
    Ok(relative_path)
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
            std::io::copy(&mut f, &mut zip_writer)?;
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
mod project_media_tests {
    use super::{
        open_project_media_file_for_read, resolve_project_media_path, safe_media_extension,
        validate_project_id, validate_project_media_relative_path, ProjectMediaMetadata,
        PROJECT_ASSETS_DIRECTORY,
    };
    use std::ffi::OsStr;
    use std::io::Read;
    use std::path::PathBuf;

    fn create_open_project_fixture() -> (PathBuf, String, PathBuf) {
        let temp_root = std::env::temp_dir().join(format!(
            "flowtake-project-media-test-{}",
            uuid::Uuid::new_v4().simple()
        ));
        let project_id = "project-under-test".to_string();
        let assets_dir = temp_root.join(&project_id).join(PROJECT_ASSETS_DIRECTORY);
        std::fs::create_dir_all(&assets_dir).unwrap();
        (temp_root, project_id, assets_dir)
    }

    #[cfg(unix)]
    fn create_file_symlink(
        source: &std::path::Path,
        target: &std::path::Path,
    ) -> std::io::Result<()> {
        std::os::unix::fs::symlink(source, target)
    }

    #[cfg(windows)]
    fn create_file_symlink(
        source: &std::path::Path,
        target: &std::path::Path,
    ) -> std::io::Result<()> {
        std::os::windows::fs::symlink_file(source, target)
    }

    #[test]
    fn project_id_must_be_one_normal_path_component() {
        assert!(validate_project_id("project-123").is_ok());

        for unsafe_id in [
            "",
            ".",
            "..",
            "../other",
            "nested/project",
            r"nested\project",
        ] {
            assert!(
                validate_project_id(unsafe_id).is_err(),
                "{unsafe_id:?} should be rejected"
            );
        }
    }

    #[test]
    fn project_media_path_must_be_relative_and_inside_assets() {
        assert_eq!(
            validate_project_media_relative_path("assets/clip.mp4").unwrap(),
            PathBuf::from("assets").join("clip.mp4")
        );
        assert_eq!(
            validate_project_media_relative_path("assets/nested/voice.wav").unwrap(),
            PathBuf::from("assets").join("nested").join("voice.wav")
        );

        for unsafe_path in [
            "",
            "assets",
            "project.json",
            "../assets/clip.mp4",
            "assets/../project.json",
            "/assets/clip.mp4",
            r"assets\..\project.json",
        ] {
            assert!(
                validate_project_media_relative_path(unsafe_path).is_err(),
                "{unsafe_path:?} should be rejected"
            );
        }
    }

    #[test]
    fn storage_extensions_are_small_ascii_and_normalized() {
        assert_eq!(
            safe_media_extension(Some(OsStr::new("WEBM"))),
            Some("webm".to_string())
        );
        assert_eq!(safe_media_extension(Some(OsStr::new("tar.gz"))), None);
        assert_eq!(safe_media_extension(Some(OsStr::new("../mp4"))), None);
        assert_eq!(safe_media_extension(Some(OsStr::new(""))), None);
    }

    #[test]
    fn project_media_metadata_uses_frontend_field_names() {
        let metadata = ProjectMediaMetadata {
            relative_path: "assets/file.mp4".to_string(),
            absolute_path: "/tmp/project/assets/file.mp4".to_string(),
            original_name: "Demo.mp4".to_string(),
            file_name: "file.mp4".to_string(),
            size: 42,
            mime_type: "video/mp4".to_string(),
        };
        let value = serde_json::to_value(metadata).unwrap();

        for key in [
            "relativePath",
            "absolutePath",
            "originalName",
            "fileName",
            "size",
            "mimeType",
        ] {
            assert!(value.get(key).is_some(), "missing {key}");
        }
    }

    #[test]
    fn contained_media_handles_reject_traversal_and_can_be_reopened() {
        let (temp_root, project_id, assets_dir) = create_open_project_fixture();
        let media_path = assets_dir.join("clip.mp4");
        std::fs::write(&media_path, b"video-bytes").unwrap();

        for unsafe_path in ["../clip.mp4", "assets/../project.json", "/assets/clip.mp4"] {
            assert!(
                open_project_media_file_for_read(&temp_root, &project_id, unsafe_path).is_err(),
                "{unsafe_path:?} should not produce a file handle"
            );
        }

        for _ in 0..2 {
            let mut file =
                open_project_media_file_for_read(&temp_root, &project_id, "assets/clip.mp4")
                    .unwrap();
            let mut contents = Vec::new();
            file.read_to_end(&mut contents).unwrap();
            assert_eq!(contents, b"video-bytes");
        }

        std::fs::remove_dir_all(&temp_root).unwrap();
    }

    #[test]
    fn contained_media_resolution_rejects_symlinks_that_escape_assets() {
        let (temp_root, project_id, assets_dir) = create_open_project_fixture();
        let outside_file = temp_root.join("outside.mp4");
        let link_path = assets_dir.join("escape.mp4");
        std::fs::write(&outside_file, b"outside").unwrap();

        if let Err(error) = create_file_symlink(&outside_file, &link_path) {
            #[cfg(windows)]
            if error.kind() == std::io::ErrorKind::PermissionDenied
                || error.raw_os_error() == Some(1314)
            {
                std::fs::remove_dir_all(&temp_root).unwrap();
                return;
            }
            panic!("failed to create symlink fixture: {error}");
        }

        assert!(
            resolve_project_media_path(&temp_root, &project_id, "assets/escape.mp4").is_err(),
            "a symlink resolving outside assets must be rejected"
        );

        std::fs::remove_dir_all(&temp_root).unwrap();
    }
}
