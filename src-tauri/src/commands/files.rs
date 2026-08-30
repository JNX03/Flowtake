use crate::error::{AppError, AppResult};
use crate::state::{AppState, RenderState};
use base64::Engine as _;
use std::io::{Read, Seek, SeekFrom, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

fn render_output_path(
    render: &RenderState,
    flag: &str,
    args: &serde_json::Value,
) -> AppResult<std::path::PathBuf> {
    if flag != "w" {
        return Err(AppError::General(
            "Render output handles are write-only".to_string(),
        ));
    }
    if args.get("path").is_some()
        || args.get("outputPath").is_some()
        || args.get("fileName").is_some()
    {
        return Err(AppError::General(
            "Custom render output paths are not allowed".to_string(),
        ));
    }

    let format = args
        .get("format")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::General("Render output format is required".to_string()))?;
    let extension = args
        .get("extension")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::General("Render output extension is required".to_string()))?;

    if format != render.format.as_str() || extension != render.format.extension() {
        return Err(AppError::General(
            "Render output format does not match the queued render".to_string(),
        ));
    }

    Ok(render.temp_dir.join(render.format.output_file_name()))
}

#[tauri::command]
pub async fn open_file(
    app: AppHandle,
    r#type: String,
    flag: String,
    args: Option<serde_json::Value>,
) -> AppResult<String> {
    if r#type == "projectMedia" {
        if flag != "r" {
            return Err(AppError::General(
                "Project media handles are read-only".to_string(),
            ));
        }

        let relative_path = args
            .as_ref()
            .and_then(|value| value.get("relativePath"))
            .and_then(|value| value.as_str())
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                AppError::General("A relative project media path is required".to_string())
            })?
            .to_string();
        let (temp_root, project_id) = {
            let state = app.state::<Mutex<AppState>>();
            let state = state.lock().unwrap();
            (
                state.temp_dir.clone(),
                state.project_id.clone().ok_or(AppError::NoProjectOpen)?,
            )
        };
        let file = crate::commands::projects::open_project_media_file_for_read(
            &temp_root,
            &project_id,
            &relative_path,
        )?;
        let id = format!("fh-{}", uuid::Uuid::new_v4());
        let state = app.state::<Mutex<AppState>>();
        let mut state = state.lock().unwrap();
        state.file_handles.insert(id.clone(), file);
        crate::debug_log(&format!(
            "[open_file] Opened contained project media {} as {}",
            relative_path, id
        ));
        return Ok(id);
    }

    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();

    let project_id = state.project_id.clone().ok_or(AppError::NoProjectOpen)?;

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
            let render_args = args
                .as_ref()
                .ok_or_else(|| AppError::General("Render output arguments are required".to_string()))?;
            let render_id = render_args
                .get("renderId")
                .and_then(|v| v.as_str())
                .filter(|value| !value.is_empty())
                .ok_or_else(|| AppError::General("Render id is required".to_string()))?;
            let render = state
                .renders
                .get(render_id)
                .ok_or_else(|| AppError::General(format!("Render not found: {render_id}")))?;
            render_output_path(render, &flag, render_args)?
        }
        "recordingScreenVideo" => state.screen_video_file(&project_id),
        "recordingCameraVideo" => state.camera_video_file(&project_id),
        _ => {
            return Err(AppError::General(format!("Unknown file type: {}", r#type)));
        }
    };

    crate::debug_log(&format!(
        "[open_file] type={}, flag={}, path={:?}",
        r#type, flag, file_path
    ));

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
pub async fn read_file(app: AppHandle, fh_id: String, start: u64, end: u64) -> AppResult<String> {
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
        v if v.starts_with("extra-") => {
            let idx: usize = v.trim_start_matches("extra-").parse().unwrap_or(0);
            state
                .project_temp_dir(pid)
                .join(format!("extra-{}.mp4", idx))
        }
        _ => state.screen_video_file(pid),
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
    use super::*;
    use crate::state::RenderFormat;

    fn render_state(format: RenderFormat) -> RenderState {
        RenderState {
            id: "render-test".to_string(),
            project_id: "project-test".to_string(),
            output_path: std::path::PathBuf::from("final").with_extension(format.extension()),
            temp_dir: std::path::PathBuf::from("render-temp"),
            format,
            is_cancelled: false,
        }
    }

    #[test]
    fn render_output_handle_requires_exact_format_and_disallows_paths() {
        let render = render_state(RenderFormat::WebM);
        let valid = serde_json::json!({ "format": "webm", "extension": "webm" });
        assert_eq!(
            render_output_path(&render, "w", &valid).expect("valid output path"),
            std::path::PathBuf::from("render-temp").join("output.webm")
        );

        let wrong_extension = serde_json::json!({ "format": "webm", "extension": "../mp4" });
        assert!(render_output_path(&render, "w", &wrong_extension).is_err());

        let wrong_format = serde_json::json!({ "format": "mp4", "extension": "mp4" });
        assert!(render_output_path(&render, "w", &wrong_format).is_err());

        let custom_path = serde_json::json!({
            "format": "webm",
            "extension": "webm",
            "outputPath": "../escape.webm"
        });
        assert!(render_output_path(&render, "w", &custom_path).is_err());
        assert!(render_output_path(&render, "r", &valid).is_err());
    }
}
