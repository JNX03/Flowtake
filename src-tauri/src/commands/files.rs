use crate::error::{AppError, AppResult};
use crate::identifiers::{validate_project_id, validate_render_id};
use crate::state::AppState;
use base64::Engine as _;
use std::io::{Read, Seek, SeekFrom, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum FileAccess {
    Read,
    Write,
}

fn file_access(file_type: &str, flag: &str) -> AppResult<FileAccess> {
    let expected = match file_type {
        "projectScreenVideo"
        | "projectCameraVideo"
        | "renderScreenVideo"
        | "renderCameraVideo"
        | "recordingScreenVideo"
        | "recordingCameraVideo" => FileAccess::Read,
        "renderOutputVideo" => FileAccess::Write,
        _ => return Err(AppError::General(format!("Unknown file type: {file_type}"))),
    };

    let supplied = match flag {
        "r" => FileAccess::Read,
        "w" => FileAccess::Write,
        _ => return Err(AppError::General("Invalid file open flag".to_string())),
    };

    if supplied != expected {
        return Err(AppError::General(format!(
            "File type {file_type} does not allow flag {flag}"
        )));
    }

    Ok(expected)
}

fn registered_render_file(
    state: &AppState,
    args: &Option<serde_json::Value>,
    file_name: &str,
) -> AppResult<std::path::PathBuf> {
    let render_id = args
        .as_ref()
        .and_then(|value| value.get("renderId"))
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::General("Render id is required".to_string()))?;
    validate_render_id(render_id)?;
    let render = state
        .renders
        .get(render_id)
        .ok_or_else(|| AppError::General("Render is not registered".to_string()))?;
    Ok(render.temp_dir.join(file_name))
}

#[tauri::command]
pub async fn open_file(
    app: AppHandle,
    r#type: String,
    flag: String,
    args: Option<serde_json::Value>,
) -> AppResult<String> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();

    let project_id = state.project_id.clone().ok_or(AppError::NoProjectOpen)?;
    validate_project_id(&project_id)?;
    let access = file_access(&r#type, &flag)?;

    let file_path = match r#type.as_str() {
        "projectScreenVideo" => state.screen_video_file(&project_id),
        "projectCameraVideo" => state.camera_video_file(&project_id),
        "renderScreenVideo" => registered_render_file(&state, &args, "screen.mp4")?,
        "renderCameraVideo" => registered_render_file(&state, &args, "camera.webm")?,
        "renderOutputVideo" => registered_render_file(&state, &args, "output.mp4")?,
        "recordingScreenVideo" => state.screen_video_file(&project_id),
        "recordingCameraVideo" => state.camera_video_file(&project_id),
        _ => unreachable!("file_access rejects unknown file types"),
    };

    crate::debug_log(&format!(
        "[open_file] type={}, flag={}, path={:?}",
        r#type, flag, file_path
    ));

    let file = match access {
        FileAccess::Read => std::fs::File::open(&file_path)?,
        FileAccess::Write => std::fs::File::create(&file_path)?,
    };

    let id = format!("fh-{}", uuid::Uuid::new_v4());
    crate::debug_log(&format!("[open_file] Opened {} as {}", r#type, id));
    state.file_handles.insert(id.clone(), file);
    Ok(id)
}

#[tauri::command]
pub async fn read_file(app: AppHandle, fh_id: String, start: u64, end: u64) -> AppResult<String> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();

    let file = state
        .file_handles
        .get_mut(&fh_id)
        .ok_or_else(|| AppError::FileHandleNotFound(fh_id.clone()))?;

    if end < start || end - start > 64 * 1024 * 1024 {
        return Err(AppError::General("Invalid file read range".to_string()));
    }
    let len = (end - start) as usize;
    let mut buffer = vec![0u8; len];
    file.seek(SeekFrom::Start(start))?;
    file.read_exact(&mut buffer)?;

    // Return as base64 to avoid slow JSON array serialization of Vec<u8>
    Ok(base64::engine::general_purpose::STANDARD.encode(&buffer))
}

#[tauri::command]
pub async fn write_file(
    app: AppHandle,
    fh_id: String,
    data: String,
    position: u64,
) -> AppResult<()> {
    // Data arrives as base64-encoded string for efficient IPC transfer
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| AppError::General(format!("Base64 decode error: {}", e)))?;

    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();

    let file = state
        .file_handles
        .get_mut(&fh_id)
        .ok_or_else(|| AppError::FileHandleNotFound(fh_id.clone()))?;

    file.seek(SeekFrom::Start(position))?;
    file.write_all(&bytes)?;
    Ok(())
}

#[tauri::command]
pub async fn close_file(app: AppHandle, fh_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();

    state
        .file_handles
        .remove(&fh_id)
        .ok_or_else(|| AppError::FileHandleNotFound(fh_id.clone()))?;
    // File is dropped/closed when removed from HashMap
    Ok(())
}

#[tauri::command]
pub async fn get_size(app: AppHandle, fh_id: String) -> AppResult<u64> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();

    let file = state
        .file_handles
        .get(&fh_id)
        .ok_or_else(|| AppError::FileHandleNotFound(fh_id.clone()))?;

    let metadata = file.metadata()?;
    Ok(metadata.len())
}

/// Get the absolute file path for a video file so frontend can use convertFileSrc
#[tauri::command]
pub async fn get_video_path(
    app: AppHandle,
    video_type: String,
    project_id: Option<String>,
) -> AppResult<String> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();

    let active_project_id = state.project_id.as_deref().ok_or(AppError::NoProjectOpen)?;
    validate_project_id(active_project_id)?;
    if let Some(requested_project_id) = project_id.as_deref() {
        validate_project_id(requested_project_id)?;
        if requested_project_id != active_project_id {
            return Err(AppError::General(
                "Requested project is not the active project".to_string(),
            ));
        }
    }
    let pid = active_project_id;

    let path = match video_type.as_str() {
        "screen" => state.screen_video_file(pid),
        "screen-preview" => state.editor_screen_video_file(pid),
        "camera" | "microphone" => state.camera_video_file(pid),
        v if v.starts_with("extra-") => {
            let idx: usize = v
                .trim_start_matches("extra-")
                .parse()
                .map_err(|_| AppError::General("Invalid extra video index".to_string()))?;
            state
                .project_temp_dir(pid)
                .join(format!("extra-{}.mp4", idx))
        }
        _ => {
            return Err(AppError::General(format!(
                "Unknown video type: {video_type}"
            )))
        }
    };

    crate::debug_log(&format!(
        "[get_video_path] type={}, path={:?}, exists={}",
        video_type,
        path,
        path.exists()
    ));

    Ok(path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::{file_access, registered_render_file, FileAccess};
    use crate::state::{AppState, RenderState};
    use serde_json::json;
    use std::path::PathBuf;

    const RENDER_ID: &str = "render-123e4567-e89b-42d3-a456-426614174000";

    #[test]
    fn file_modes_are_least_privilege_by_type() {
        for file_type in [
            "projectScreenVideo",
            "projectCameraVideo",
            "renderScreenVideo",
            "renderCameraVideo",
            "recordingScreenVideo",
            "recordingCameraVideo",
        ] {
            assert_eq!(file_access(file_type, "r").unwrap(), FileAccess::Read);
            assert!(file_access(file_type, "w").is_err());
            assert!(file_access(file_type, "rw").is_err());
            assert!(file_access(file_type, "r+").is_err());
        }

        assert_eq!(
            file_access("renderOutputVideo", "w").unwrap(),
            FileAccess::Write
        );
        assert!(file_access("renderOutputVideo", "r").is_err());
        assert!(file_access("unknown", "r").is_err());
    }

    #[test]
    fn render_files_resolve_only_from_registered_backend_state() {
        let mut state = AppState::new();
        let render_dir = PathBuf::from("trusted-render-dir");
        state.renders.insert(
            RENDER_ID.to_string(),
            RenderState {
                id: RENDER_ID.to_string(),
                project_id: "123e4567-e89b-42d3-a456-426614174000".to_string(),
                output_path: render_dir.join("output.mp4"),
                temp_dir: render_dir.clone(),
                is_cancelled: false,
            },
        );

        let args = Some(json!({ "renderId": RENDER_ID }));
        assert_eq!(
            registered_render_file(&state, &args, "screen.mp4").unwrap(),
            render_dir.join("screen.mp4")
        );
        assert!(registered_render_file(
            &state,
            &Some(json!({
                "renderId": "render-123e4567-e89b-42d3-a456-426614174001"
            })),
            "screen.mp4"
        )
        .is_err());
        assert!(registered_render_file(
            &state,
            &Some(json!({ "renderId": "render-../../outside" })),
            "screen.mp4"
        )
        .is_err());
    }
}
