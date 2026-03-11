use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde_json::Value;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

#[tauri::command]
pub async fn get_camera_mic_config(app: AppHandle) -> AppResult<Value> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    // Return the config that was stored during init_recording
    Ok(state
        .camera_mic_config
        .clone()
        .unwrap_or(serde_json::json!({
            "cameraDeviceId": null,
            "microphoneDeviceId": null
        })))
}

#[tauri::command]
pub async fn init_recording(
    app: AppHandle,
    source: Value,
    camera_mic_config: Value,
    system_audio: Value,
) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();

    // Create new recording ID and project temp dir
    let recording_id = format!("recording-{}", uuid::Uuid::new_v4());
    let project_id = uuid::Uuid::new_v4().to_string();

    {
        let mut state = state.lock().unwrap();
        state.is_recording = true;
        state.project_id = Some(project_id.clone());
        state.recording_id = Some(recording_id.clone());
        state.camera_mic_config = Some(camera_mic_config.clone());

        let temp_dir = state.project_temp_dir(&recording_id);
        std::fs::create_dir_all(&temp_dir)?;
    }

    // Build FFmpeg args for screen capture
    let screen_video_path = {
        let state = state.lock().unwrap();
        state
            .project_temp_dir(&recording_id)
            .join("screen.mp4")
            .to_string_lossy()
            .to_string()
    };

    let source_type = source
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("screen");

    let mut ffmpeg_args: Vec<String> = vec![
        "-y".to_string(),
        "-f".to_string(),
        "gdigrab".to_string(),
        "-framerate".to_string(),
        "30".to_string(),
    ];

    match source_type {
        "window" => {
            let title = source
                .get("name")
                .or_else(|| source.get("title"))
                .and_then(|v| v.as_str())
                .unwrap_or("Desktop");
            ffmpeg_args.extend(["-i".to_string(), format!("title={}", title)]);
        }
        "area" => {
            let x = source.get("x").and_then(|v| v.as_i64()).unwrap_or(0);
            let y = source.get("y").and_then(|v| v.as_i64()).unwrap_or(0);
            let width = source
                .get("width")
                .and_then(|v| v.as_i64())
                .unwrap_or(1920);
            let height = source
                .get("height")
                .and_then(|v| v.as_i64())
                .unwrap_or(1080);
            ffmpeg_args.extend([
                "-offset_x".to_string(),
                x.to_string(),
                "-offset_y".to_string(),
                y.to_string(),
                "-video_size".to_string(),
                format!("{}x{}", width, height),
                "-i".to_string(),
                "desktop".to_string(),
            ]);
        }
        _ => {
            // Full screen capture
            ffmpeg_args.extend(["-i".to_string(), "desktop".to_string()]);
        }
    }

    // Add system audio capture if requested
    let has_system_audio = match &system_audio {
        Value::String(s) if !s.is_empty() => true,
        Value::Bool(b) => *b,
        _ => false,
    };
    if has_system_audio {
        let audio_device = match &system_audio {
            Value::String(s) => s.clone(),
            _ => "virtual-audio-capturer".to_string(),
        };
        ffmpeg_args.extend([
            "-f".to_string(),
            "dshow".to_string(),
            "-i".to_string(),
            format!("audio={}", audio_device),
        ]);
    }

    // Output settings
    ffmpeg_args.extend([
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "ultrafast".to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        screen_video_path,
    ]);

    // Store FFmpeg args for start_recording
    {
        let mut state = state.lock().unwrap();
        // We'll store args as a JSON value in camera_mic_config alongside the config
        // Actually, let's store the args path for later use
        state.camera_mic_config = Some(serde_json::json!({
            "videoTrack": camera_mic_config.get("videoTrack"),
            "audioTrack": camera_mic_config.get("audioTrack"),
            "constraints": camera_mic_config.get("constraints"),
            "ffmpegArgs": ffmpeg_args,
        }));
    }

    // Minimize main window
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.minimize().ok();
    }

    // Create recorder overlay window (small window at bottom-left)
    let monitor = app
        .get_webview_window("main")
        .and_then(|w| w.current_monitor().ok().flatten());

    let (win_y, _screen_h) = if let Some(m) = &monitor {
        let size = m.size();
        let scale = m.scale_factor();
        let h = (size.height as f64 / scale) as f64;
        (h - 100.0, h)
    } else {
        (800.0, 900.0)
    };

    let recorder_window = WebviewWindowBuilder::new(
        &app,
        "recorder",
        WebviewUrl::App("src/renderer/recorder/index.html".into()),
    )
    .title("Recording - Flowtake")
    .inner_size(210.0, 90.0)
    .position(10.0, win_y)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .closable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .build();

    match recorder_window {
        Ok(_) => {
            log::info!("Recorder window created successfully");
        }
        Err(e) => {
            log::error!("Failed to create recorder window: {}", e);
            // Restore main window if recorder creation fails
            if let Some(main_win) = app.get_webview_window("main") {
                main_win.unminimize().ok();
            }
            return Err(AppError::General(format!(
                "Failed to create recorder window: {}",
                e
            )));
        }
    }

    // Emit recording-init event
    app.emit("recording-init", &source).ok();

    Ok(())
}

#[tauri::command]
pub async fn start_recording(app: AppHandle) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();

    // Get FFmpeg args from stored config
    let ffmpeg_args = {
        let state = state.lock().unwrap();
        state
            .camera_mic_config
            .as_ref()
            .and_then(|c| c.get("ffmpegArgs"))
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<_>>()
            })
    };

    if let Some(args) = ffmpeg_args {
        // Spawn FFmpeg as sidecar
        let shell = app.shell();
        let sidecar_result = shell.sidecar("ffmpeg");

        match sidecar_result {
            Ok(cmd) => {
                let cmd = cmd.args(&args);
                match cmd.spawn() {
                    Ok((mut rx, child)) => {
                        let pid = child.pid();
                        {
                            let mut state = state.lock().unwrap();
                            state.ffmpeg_child_id = Some(pid);
                        }

                        // Spawn a task to monitor FFmpeg output
                        let app_clone = app.clone();
                        tauri::async_runtime::spawn(async move {
                            while let Some(event) = rx.recv().await {
                                match event {
                                    CommandEvent::Stderr(line) => {
                                        log::info!("[FFmpeg] {}", String::from_utf8_lossy(&line));
                                    }
                                    CommandEvent::Stdout(line) => {
                                        log::info!(
                                            "[FFmpeg stdout] {}",
                                            String::from_utf8_lossy(&line)
                                        );
                                    }
                                    CommandEvent::Error(err) => {
                                        log::error!("[FFmpeg error] {}", err);
                                        app_clone
                                            .emit("recording-error", "CaptureError")
                                            .ok();
                                    }
                                    CommandEvent::Terminated(status) => {
                                        log::info!("[FFmpeg] Terminated with: {:?}", status);
                                        break;
                                    }
                                    _ => {}
                                }
                            }
                        });

                        log::info!("FFmpeg started with PID: {}", pid);
                    }
                    Err(e) => {
                        log::error!("Failed to spawn FFmpeg: {}", e);
                        app.emit("recording-error", "CaptureError").ok();
                    }
                }
            }
            Err(e) => {
                log::error!("Failed to create FFmpeg sidecar: {}", e);
                app.emit("recording-error", "CaptureError").ok();
            }
        }
    }

    // Emit recording-started to the recorder window
    app.emit("recording-started", true).ok();
    Ok(())
}

#[tauri::command]
pub async fn pause_recording(app: AppHandle, pause: bool) -> AppResult<()> {
    // Note: FFmpeg gdigrab doesn't natively support pause
    // We emit the event for the UI, but the actual FFmpeg process keeps running
    app.emit("recording-paused", pause).ok();
    Ok(())
}

#[tauri::command]
pub async fn stop_recording(app: AppHandle) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();

    // Kill FFmpeg process
    kill_ffmpeg(&app);

    let (project_id, recording_id) = {
        let mut state = state.lock().unwrap();
        state.is_recording = false;
        let pid = state.project_id.clone();
        let rid = state.recording_id.clone();
        state.ffmpeg_child_id = None;
        (pid, rid)
    };

    // Close recorder window
    if let Some(recorder_win) = app.get_webview_window("recorder") {
        recorder_win.close().ok();
    }

    // Restore main window
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.unminimize().ok();
        main_win.show().ok();
        main_win.set_focus().ok();
    }

    // If we have a recording, move the screen video to the project folder
    if let Some(ref rid) = recording_id {
        if let Some(ref pid) = project_id {
            let state_lock = state.lock().unwrap();
            let recording_video = state_lock.project_temp_dir(rid).join("screen.mp4");
            let project_temp = state_lock.project_temp_dir(pid);
            drop(state_lock);

            std::fs::create_dir_all(&project_temp).ok();
            let dest = project_temp.join("screen.mp4");

            if recording_video.exists() {
                std::fs::rename(&recording_video, &dest).ok();
            }
        }
    }

    // Emit events
    if let Some(id) = project_id {
        app.emit_to("main", "load", "Creating project...").ok();
        app.emit_to("main", "project-created", &id).ok();
    }
    app.emit("recording-stopped", true).ok();

    Ok(())
}

#[tauri::command]
pub async fn reset_recording(app: AppHandle) -> AppResult<()> {
    // Kill FFmpeg
    kill_ffmpeg(&app);

    // Clean up temp files but keep the recorder window open
    let state = app.state::<Mutex<AppState>>();
    let recording_id = {
        let mut state = state.lock().unwrap();
        state.ffmpeg_child_id = None;
        state.recording_id.clone()
    };

    if let Some(rid) = recording_id {
        let state_lock = state.lock().unwrap();
        let temp_dir = state_lock.project_temp_dir(&rid);
        drop(state_lock);

        if temp_dir.exists() {
            std::fs::remove_dir_all(&temp_dir).ok();
            std::fs::create_dir_all(&temp_dir).ok();
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn cancel_recording(app: AppHandle, error: Option<String>) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();

    // Kill FFmpeg
    kill_ffmpeg(&app);

    let recording_id = {
        let mut state = state.lock().unwrap();
        state.is_recording = false;
        state.ffmpeg_child_id = None;
        state.recording_id.take()
    };

    // Clean up temp files
    if let Some(rid) = recording_id {
        let state_lock = state.lock().unwrap();
        let temp_dir = state_lock.project_temp_dir(&rid);
        drop(state_lock);

        if temp_dir.exists() {
            std::fs::remove_dir_all(&temp_dir).ok();
        }
    }

    // Close recorder window
    if let Some(recorder_win) = app.get_webview_window("recorder") {
        recorder_win.close().ok();
    }

    // Restore main window
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.unminimize().ok();
        main_win.show().ok();
        main_win.set_focus().ok();
    }

    // Emit cancellation event
    let err_str = error.unwrap_or_default();
    app.emit_to("main", "recording-canceled", &err_str).ok();

    if !err_str.is_empty() {
        app.emit_to("main", "recording-error", &err_str).ok();
    }

    Ok(())
}

/// Kill the FFmpeg process if running
fn kill_ffmpeg(app: &AppHandle) {
    let state = app.state::<Mutex<AppState>>();
    let pid = {
        let state = state.lock().unwrap();
        state.ffmpeg_child_id
    };

    if let Some(pid) = pid {
        // Send 'q' to FFmpeg via taskkill on Windows
        // FFmpeg responds to 'q' key to gracefully stop, but since we're using sidecar
        // we need to kill the process
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/F"])
                .output()
                .ok();
        }
        #[cfg(not(target_os = "windows"))]
        {
            std::process::Command::new("kill")
                .args(["-SIGINT", &pid.to_string()])
                .output()
                .ok();
        }
    }
}

#[tauri::command]
pub async fn get_source_screenshot(app: AppHandle, source: Value) -> AppResult<Vec<u8>> {
    let shell = app.shell();
    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| AppError::General(e.to_string()))?
        .args([
            "-f",
            "gdigrab",
            "-i",
            "desktop",
            "-frames:v",
            "1",
            "-f",
            "image2pipe",
            "-vcodec",
            "png",
            "pipe:1",
        ])
        .output()
        .await
        .map_err(|e| AppError::General(e.to_string()))?;

    Ok(output.stdout)
}

#[tauri::command]
pub async fn init_camera_file(app: AppHandle) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    state.camera_chunks.clear();
    Ok(())
}

#[tauri::command]
pub async fn enqueue_camera_chunk(app: AppHandle, chunk: Vec<u8>) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    state.camera_chunks.push(chunk);
    Ok(())
}

#[tauri::command]
pub async fn finalize_camera_file(app: AppHandle) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let (chunks, camera_path) = {
        let mut state = state.lock().unwrap();
        let recording_id = state
            .recording_id
            .clone()
            .or_else(|| state.project_id.clone())
            .ok_or(AppError::NoProjectOpen)?;
        let path = state.camera_video_file(&recording_id);
        let chunks = std::mem::take(&mut state.camera_chunks);
        (chunks, path)
    };

    let mut file = std::fs::File::create(&camera_path)?;
    for chunk in chunks {
        std::io::Write::write_all(&mut file, &chunk)?;
    }

    Ok(())
}
