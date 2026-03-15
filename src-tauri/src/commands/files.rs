use crate::error::{AppError, AppResult};
use crate::state::AppState;
use base64::Engine as _;
use std::io::{Read, Seek, SeekFrom, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn open_file(
    app: AppHandle,
    r#type: String,
    flag: String,
    args: Option<serde_json::Value>,
) -> AppResult<String> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();

    let project_id = state
        .project_id
        .clone()
        .ok_or(AppError::NoProjectOpen)?;

    let file_path = match r#type.as_str() {
        "projectScreenVideo" => state.screen_video_file(&project_id),
        "projectCameraVideo" => state.camera_video_file(&project_id),
        "renderScreenVideo" => {
            let render_id = args
                .as_ref()
                .and_then(|v| v.get("renderId"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            state.render_temp_dir(render_id).join("screen.mp4")
        }
        "renderCameraVideo" => {
            let render_id = args
                .as_ref()
                .and_then(|v| v.get("renderId"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            state.render_temp_dir(render_id).join("camera.webm")
        }
        "renderOutputVideo" => {
            let render_id = args
                .as_ref()
                .and_then(|v| v.get("renderId"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            state.render_temp_dir(render_id).join("output.mp4")
        }
        "recordingScreenVideo" => state.screen_video_file(&project_id),
        "recordingCameraVideo" => state.camera_video_file(&project_id),
        _ => {
            return Err(AppError::General(format!("Unknown file type: {}", r#type)));
        }
    };

    crate::debug_log(&format!("[open_file] type={}, flag={}, path={:?}", r#type, flag, file_path));

    let file = match flag.as_str() {
        "r" => std::fs::File::open(&file_path)?,
        "w" => std::fs::File::create(&file_path)?,
        "rw" | "r+" => std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&file_path)?,
        _ => std::fs::File::open(&file_path)?,
    };

    let id = format!("fh-{}", uuid::Uuid::new_v4());
    crate::debug_log(&format!("[open_file] Opened {} as {}", r#type, id));
    state.file_handles.insert(id.clone(), file);
    Ok(id)
}

#[tauri::command]
pub async fn read_file(
    app: AppHandle,
    fh_id: String,
    start: u64,
    end: u64,
) -> AppResult<String> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();

    let file = state
        .file_handles
        .get_mut(&fh_id)
        .ok_or_else(|| AppError::FileHandleNotFound(fh_id.clone()))?;

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

    let pid = project_id
        .as_deref()
        .or(state.project_id.as_deref())
        .ok_or(AppError::NoProjectOpen)?;

    let path = match video_type.as_str() {
        "screen" => state.screen_video_file(pid),
        "camera" | "microphone" => state.camera_video_file(pid),
        _ => state.screen_video_file(pid),
    };

    crate::debug_log(&format!("[get_video_path] type={}, path={:?}, exists={}", video_type, path, path.exists()));

    Ok(path.to_string_lossy().to_string())
}
