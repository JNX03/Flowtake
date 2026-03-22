use crate::error::{AppError, AppResult};
use crate::state::{AppState, RenderState};
use serde_json::Value;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub async fn open_export_window(
    app: AppHandle,
    state_data: Option<Value>,
    section: Option<String>,
) -> AppResult<()> {
    // Store state data and section so the exporter can fetch them after loading
    {
        let state = app.state::<Mutex<AppState>>();
        let mut state = state.lock().unwrap();
        state.export_state_data = state_data.clone();
        state.export_section = section.clone();
    }

    // Close existing exporter window if any
    if let Some(existing) = app.get_webview_window("exporter") {
        existing.close().map_err(AppError::Tauri)?;
    }

    let _window = WebviewWindowBuilder::new(
        &app,
        "exporter",
        WebviewUrl::App("app/windows/exporter/index.html".into()),
    )
    .title("Export - Flowtake")
    .inner_size(520.0, 580.0)
    .center()
    .resizable(true)
    .min_inner_size(400.0, 400.0)
    .decorations(false)
    .build()
    .map_err(AppError::Tauri)?;

    // Also emit events for already-open windows that have listeners registered
    if let Some(state_data) = state_data {
        app.emit_to("exporter", "project-state", &state_data).ok();
    }
    if let Some(section) = section {
        app.emit_to("exporter", "open-section", &section).ok();
    }

    Ok(())
}

#[tauri::command]
pub async fn close_export_window(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("exporter") {
        window.close().map_err(AppError::Tauri)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn close_exporter_window(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("exporter") {
        window.close().map_err(AppError::Tauri)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_project_for_export(app: AppHandle) -> AppResult<Value> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    let project_id = state
        .project_id
        .clone()
        .ok_or(AppError::NoProjectOpen)?;
    let json_path = state.project_json_file(&project_id);
    drop(state);

    if json_path.exists() {
        let content = std::fs::read_to_string(&json_path)?;
        let json: Value = serde_json::from_str(&content)?;
        Ok(json)
    } else {
        Ok(Value::Null)
    }
}

#[tauri::command]
pub async fn get_project_state(app: AppHandle) -> AppResult<Value> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    Ok(state.export_state_data.clone().unwrap_or(Value::Null))
}

#[tauri::command]
pub async fn get_open_section(app: AppHandle) -> AppResult<Value> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    Ok(state.export_section.clone().map(Value::String).unwrap_or(Value::Null))
}

#[tauri::command]
pub async fn queue_render(app: AppHandle, render: Value) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let render_id = render
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let project_id = {
        let state = state.lock().unwrap();
        state.project_id.clone().unwrap_or_default()
    };

    let mut state = state.lock().unwrap();
    let render_temp = state.render_temp_dir(&render_id);
    std::fs::create_dir_all(&render_temp)?;

    // Copy project files to render temp directory
    let project_temp = state.project_temp_dir(&project_id);
    if project_temp.exists() {
        copy_dir_contents(&project_temp, &render_temp)?;
    }

    let export_dir = state.export_dir();
    std::fs::create_dir_all(&export_dir)?;

    let output_path = export_dir.join(format!(
        "{}.mp4",
        render
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("export")
    ));

    state.renders.insert(
        render_id.clone(),
        RenderState {
            id: render_id,
            project_id,
            output_path,
            temp_dir: render_temp,
            is_cancelled: false,
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn process_audio(app: AppHandle, render_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    let _render = state
        .renders
        .get(&render_id)
        .ok_or_else(|| AppError::General(format!("Render not found: {}", render_id)))?;
    Ok(())
}

#[tauri::command]
pub async fn add_audio(app: AppHandle, render_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    let _render = state
        .renders
        .get(&render_id)
        .ok_or_else(|| AppError::General(format!("Render not found: {}", render_id)))?;
    Ok(())
}

#[tauri::command]
pub async fn set_progress_bar(app: AppHandle, progress: f64) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("main") {
        if progress < 0.0 {
            window
                .set_progress_bar(tauri::window::ProgressBarState {
                    status: Some(tauri::window::ProgressBarStatus::None),
                    progress: None,
                })
                .ok();
        } else {
            window
                .set_progress_bar(tauri::window::ProgressBarState {
                    status: Some(tauri::window::ProgressBarStatus::Normal),
                    progress: Some((progress * 100.0) as u64),
                })
                .ok();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn set_close_mode(_app: AppHandle, _mode: String) -> AppResult<()> {
    Ok(())
}

#[tauri::command]
pub async fn set_has_rendering_or_completed_renders(
    _app: AppHandle,
    _has_renders: bool,
) -> AppResult<()> {
    Ok(())
}

#[tauri::command]
pub async fn clean_up_temp_folder(app: AppHandle, render_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    if let Some(render) = state.renders.get(&render_id) {
        std::fs::remove_dir_all(&render.temp_dir).ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn copy_to_videos_folder(app: AppHandle, render_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let (source, dest) = {
        let state = state.lock().unwrap();
        if let Some(render) = state.renders.get(&render_id) {
            (render.temp_dir.join("output.mp4"), render.output_path.clone())
        } else {
            log::error!("[copy_to_videos] Render not found: {}", render_id);
            return Err(AppError::General(format!("Render not found: {}", render_id)));
        }
    };

    log::info!("[copy_to_videos] source={:?} exists={} dest={:?}", source, source.exists(), dest);

    if source.exists() {
        let source_size = source.metadata().map(|m| m.len()).unwrap_or(0);
        log::info!("[copy_to_videos] source size: {} bytes", source_size);
        if source_size == 0 {
            return Err(AppError::General("Output video is empty".to_string()));
        }
        // Ensure export directory exists
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::copy(&source, &dest)?;
        log::info!("[copy_to_videos] Copied to {:?}", dest);
    } else {
        log::error!("[copy_to_videos] Output file not found at {:?}", source);
        return Err(AppError::General(format!("Output video not found: {:?}", source)));
    }
    Ok(())
}

#[tauri::command]
pub async fn reveal_video_in_file_explorer(app: AppHandle, render_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    if let Some(render) = state.renders.get(&render_id) {
        if let Some(parent) = render.output_path.parent() {
            open::that(parent).ok();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn play_video(app: AppHandle, render_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    if let Some(render) = state.renders.get(&render_id) {
        open::that(&render.output_path).ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn cancel_render(app: AppHandle, render_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    if let Some(render) = state.renders.get_mut(&render_id) {
        render.is_cancelled = true;
    }
    Ok(())
}

#[tauri::command]
pub async fn send_notification(app: AppHandle, render_id: String) -> AppResult<()> {
    app.emit("export-completed", serde_json::json!({ "renderId": render_id }))
        .ok();
    Ok(())
}

#[tauri::command]
pub async fn get_shareable_url(_app: AppHandle, _title: Option<String>) -> AppResult<Value> {
    Ok(serde_json::json!({
        "id": null,
        "presignedUrl": null
    }))
}

#[tauri::command]
pub async fn upload(app: AppHandle, _render_id: String) -> AppResult<()> {
    app.emit_to("exporter", "upload-progress", 100).ok();
    Ok(())
}

#[tauri::command]
pub async fn clear_pending_renders(app: AppHandle) -> AppResult<()> {
    app.emit_to("exporter", "clear-pending-renders", ()).ok();
    Ok(())
}

#[tauri::command]
pub async fn cancel_running_render(app: AppHandle) -> AppResult<()> {
    app.emit_to("exporter", "cancel-running-render", ()).ok();
    Ok(())
}

#[tauri::command]
pub async fn get_render_video_path(app: AppHandle, render_id: String) -> AppResult<String> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    if let Some(render) = state.renders.get(&render_id) {
        Ok(render.output_path.to_string_lossy().to_string())
    } else {
        Err(AppError::General(format!(
            "Render not found: {}",
            render_id
        )))
    }
}

#[tauri::command]
pub async fn open_url_in_browser(_app: AppHandle, url: String) -> AppResult<()> {
    open::that(&url).map_err(|e| AppError::General(format!("Failed to open URL: {}", e)))?;
    Ok(())
}

fn copy_dir_contents(
    src: &std::path::Path,
    dst: &std::path::Path,
) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_contents(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}
