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

    // Get screen dimensions for area percentage conversion
    let (screen_w, screen_h) = if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = main_win.current_monitor() {
            let size = monitor.size();
            (size.width as f64, size.height as f64)
        } else {
            (1920.0, 1080.0)
        }
    } else {
        (1920.0, 1080.0)
    };

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
            // Area picker returns percentage-based coordinates (0-100)
            let x_pct = source.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let y_pct = source.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let w_pct = source.get("width").and_then(|v| v.as_f64()).unwrap_or(100.0);
            let h_pct = source.get("height").and_then(|v| v.as_f64()).unwrap_or(100.0);

            // Convert percentages to pixels
            let x = (x_pct / 100.0 * screen_w) as i64;
            let y = (y_pct / 100.0 * screen_h) as i64;
            let width = ((w_pct / 100.0 * screen_w) as i64).max(2);
            let height = ((h_pct / 100.0 * screen_h) as i64).max(2);

            // Make dimensions even (required by many codecs)
            let width = width - (width % 2);
            let height = height - (height % 2);

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
    // Use frag_keyframe+empty_moov to create fragmented MP4 that's valid even if FFmpeg is killed abruptly
    ffmpeg_args.extend([
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "ultrafast".to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        "-movflags".to_string(),
        "frag_keyframe+empty_moov+default_base_moof".to_string(),
        screen_video_path,
    ]);

    // Store FFmpeg args for start_recording
    {
        let mut state = state.lock().unwrap();
        // We'll store args as a JSON value in camera_mic_config alongside the config
        // Actually, let's store the args path for later use
        let source_name = source
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Recording")
            .to_string();
        state.camera_mic_config = Some(serde_json::json!({
            "videoTrack": camera_mic_config.get("videoTrack"),
            "audioTrack": camera_mic_config.get("audioTrack"),
            "constraints": camera_mic_config.get("constraints"),
            "ffmpegArgs": ffmpeg_args,
            "sourceName": source_name,
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
    use tauri_plugin_store::StoreExt;

    let state = app.state::<Mutex<AppState>>();

    // Kill FFmpeg process
    kill_ffmpeg(&app);

    // Wait for FFmpeg to fully terminate and flush file
    // Graceful shutdown needs more time than force kill
    tokio::time::sleep(std::time::Duration::from_millis(3000)).await;

    let (project_id, recording_id) = {
        let mut state = state.lock().unwrap();
        state.is_recording = false;
        let pid = state.project_id.clone();
        let rid = state.recording_id.clone();
        state.ffmpeg_child_id = None;
        (pid, rid)
    };

    log::info!(
        "[stop_recording] project_id={:?}, recording_id={:?}",
        project_id,
        recording_id
    );

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

    app.emit_to("main", "load", "Creating project...").ok();

    // Check if we have a valid recording
    let recording_video_path = if let Some(ref rid) = recording_id {
        let state_lock = state.lock().unwrap();
        let path = state_lock.project_temp_dir(rid).join("screen.mp4");
        drop(state_lock);
        Some(path)
    } else {
        None
    };

    let has_video = recording_video_path
        .as_ref()
        .map(|p| {
            let exists = p.exists();
            let size = p.metadata().map(|m| m.len()).unwrap_or(0);
            log::info!(
                "[stop_recording] Video file: {:?}, exists={}, size={}",
                p,
                exists,
                size
            );
            exists && size > 0
        })
        .unwrap_or(false);

    if has_video {
        if let (Some(ref rid), Some(ref pid)) = (&recording_id, &project_id) {
            let (recording_video, project_temp, projects_dir) = {
                let state_lock = state.lock().unwrap();
                (
                    state_lock.project_temp_dir(rid).join("screen.mp4"),
                    state_lock.project_temp_dir(pid),
                    state_lock.projects_dir.clone(),
                )
            };

            // Create project temp dir
            if let Err(e) = std::fs::create_dir_all(&project_temp) {
                log::error!("[stop_recording] Failed to create project temp dir: {}", e);
            }
            let dest_video = project_temp.join("screen.mp4");

            // Move video: try rename first, fall back to copy+delete
            if std::fs::rename(&recording_video, &dest_video).is_err() {
                log::warn!("[stop_recording] rename failed, trying copy");
                if let Err(e) = std::fs::copy(&recording_video, &dest_video) {
                    log::error!("[stop_recording] copy also failed: {}", e);
                } else {
                    std::fs::remove_file(&recording_video).ok();
                }
            }

            log::info!(
                "[stop_recording] dest_video exists={}, size={}",
                dest_video.exists(),
                dest_video.metadata().map(|m| m.len()).unwrap_or(0)
            );

            // Get source name from stored config
            let source_name = {
                let s = state.lock().unwrap();
                s.camera_mic_config
                    .as_ref()
                    .and_then(|c| c.get("sourceName"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Recording")
                    .to_string()
            };

            // Create a basic project.json
            let project_json = serde_json::json!({
                "version": 1,
                "project": {
                    "id": pid,
                    "name": source_name,
                    "hasCameraVideo": false,
                    "hasMicrophoneAudio": false,
                    "hasSystemAudio": false,
                    "cameraVideoDimensions": null,
                    "padding": 1,
                    "borderRadius": 0,
                    "mouseEvents": [],
                    "leftTrim": 0,
                    "rightTrim": 0,
                    "topTrim": 0,
                    "bottomTrim": 0,
                    "videoDetails": {
                        "start": 0,
                        "end": 10000
                    }
                },
                "clipAnims": {
                    "entities": [{
                        "start": 0,
                        "end": 10000,
                        "layout": {
                            "mode": "screen-fullscreen"
                        }
                    }]
                }
            });

            // Write project.json
            let project_json_path = project_temp.join("project.json");
            if let Err(e) = std::fs::write(
                &project_json_path,
                serde_json::to_string_pretty(&project_json).unwrap_or_default(),
            ) {
                log::error!("[stop_recording] Failed to write project.json: {}", e);
            }

            // Create zip with video + project.json
            let zip_path = projects_dir.join(format!("{}.zip", pid));
            std::fs::create_dir_all(&projects_dir).ok();

            log::info!("[stop_recording] Creating zip at: {:?}", zip_path);

            let zip_ok = if let Ok(zip_file) = std::fs::File::create(&zip_path) {
                let mut zip = zip::ZipWriter::new(zip_file);
                let options = zip::write::SimpleFileOptions::default()
                    .compression_method(zip::CompressionMethod::Stored);

                // Add project.json
                if let Ok(pj_data) = std::fs::read(&project_json_path) {
                    zip.start_file("project.json", options).ok();
                    std::io::Write::write_all(&mut zip, &pj_data).ok();
                }

                // Add screen.mp4 - stream it to avoid loading full video in memory
                if let Ok(video_meta) = dest_video.metadata() {
                    let video_size = video_meta.len();
                    log::info!(
                        "[stop_recording] Adding video to zip, size={}",
                        video_size
                    );
                    if let Ok(mut video_file) = std::fs::File::open(&dest_video) {
                        zip.start_file("screen.mp4", options).ok();
                        std::io::copy(&mut video_file, &mut zip).ok();
                    }
                }

                zip.finish().ok();
                true
            } else {
                log::error!("[stop_recording] Failed to create zip file");
                false
            };

            // Store project metadata in the Tauri store
            if zip_ok {
                if let Ok(store) = app.store("store.json") {
                    let zip_str = zip_path.to_string_lossy().to_string();

                    // Get existing projects map or create new one
                    let mut projects = store
                        .get("projects")
                        .and_then(|v| {
                            if let Value::Object(map) = v {
                                Some(map)
                            } else {
                                None
                            }
                        })
                        .unwrap_or_default();

                    // Add new project entry
                    projects.insert(
                        pid.clone(),
                        serde_json::json!({
                            "id": pid,
                            "lastSaved": chrono::Utc::now().timestamp_millis(),
                            "name": source_name,
                            "path": zip_str,
                        }),
                    );

                    store.set("projects", Value::Object(projects));

                    // Also store flat key for open_project compatibility
                    store.set(
                        format!("projects.{}.path", pid),
                        serde_json::json!(zip_str),
                    );
                    store.save().ok();
                    log::info!("[stop_recording] Project stored: {}", pid);
                } else {
                    log::error!("[stop_recording] Failed to open store");
                }
            }

            // Clear project_id so open_project can set it fresh
            {
                let mut state = state.lock().unwrap();
                state.project_id = None;
                state.file_handles.clear();
            }

            // Emit project-created to the main window
            log::info!("[stop_recording] Emitting project-created: {}", pid);
            app.emit_to("main", "project-created", pid.as_str()).ok();
            // Clear the loader message
            app.emit_to("main", "load", "").ok();
        }
    } else {
        // No valid recording - reset cleanly
        log::warn!(
            "[stop_recording] No video file found at: {:?}",
            recording_video_path
        );
        app.emit_to("main", "recording-canceled", "").ok();
        app.emit_to("main", "load", serde_json::Value::Null).ok();
    }

    app.emit("recording-stopped", true).ok();

    // Clean up recording temp dir (not project temp dir!)
    if let Some(ref rid) = recording_id {
        let state_lock = state.lock().unwrap();
        let rec_temp = state_lock.project_temp_dir(rid);
        drop(state_lock);
        if rec_temp.exists() {
            std::fs::remove_dir_all(&rec_temp).ok();
        }
    }

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

/// Stop the FFmpeg process gracefully so it can flush and finalize the output file.
/// On Windows, we first try to send Ctrl+C (GenerateConsoleCtrlEvent) to allow
/// FFmpeg to write remaining fragments. If that fails, we fall back to taskkill /F.
fn kill_ffmpeg(app: &AppHandle) {
    let state = app.state::<Mutex<AppState>>();
    let pid = {
        let state = state.lock().unwrap();
        state.ffmpeg_child_id
    };

    if let Some(pid) = pid {
        log::info!("[kill_ffmpeg] Stopping FFmpeg PID: {}", pid);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;

            // First, try graceful stop: taskkill WITHOUT /F sends WM_CLOSE
            // which FFmpeg handles by flushing and closing the file
            let graceful = std::process::Command::new("taskkill")
                .args(["/PID", &pid.to_string()])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output();

            match graceful {
                Ok(output) => {
                    log::info!(
                        "[kill_ffmpeg] Graceful stop result: status={}, stderr={}",
                        output.status,
                        String::from_utf8_lossy(&output.stderr)
                    );
                }
                Err(e) => {
                    log::warn!("[kill_ffmpeg] Graceful stop failed: {}, using force kill", e);
                    std::process::Command::new("taskkill")
                        .args(["/PID", &pid.to_string(), "/F"])
                        .creation_flags(0x08000000)
                        .output()
                        .ok();
                }
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            // Send SIGINT to FFmpeg for graceful shutdown
            std::process::Command::new("kill")
                .args(["-SIGINT", &pid.to_string()])
                .output()
                .ok();
        }
    }
}

#[tauri::command]
pub async fn get_source_screenshot(app: AppHandle, source: Value) -> AppResult<String> {
    use base64::Engine;

    let state = app.state::<Mutex<AppState>>();
    let temp_dir = {
        let s = state.lock().unwrap();
        s.temp_dir.clone()
    };
    std::fs::create_dir_all(&temp_dir).ok();
    let screenshot_path = temp_dir.join("preview_screenshot.png");
    let screenshot_str = screenshot_path.to_string_lossy().to_string();

    // Get screen dimensions for coordinate calculations
    let (screen_w, screen_h) = if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = main_win.current_monitor() {
            let size = monitor.size();
            (size.width as f64, size.height as f64)
        } else {
            (1920.0, 1080.0)
        }
    } else {
        (1920.0, 1080.0)
    };

    // Determine capture coordinates based on source type (like original Electron code)
    let source_type = source
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("screen");

    let (offset_x, offset_y, cap_w, cap_h) = match source_type {
        "area" => {
            // Area source has percentage-based coordinates
            let x_pct = source.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let y_pct = source.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let w_pct = source.get("width").and_then(|v| v.as_f64()).unwrap_or(100.0);
            let h_pct = source.get("height").and_then(|v| v.as_f64()).unwrap_or(100.0);

            let x = (x_pct / 100.0 * screen_w) as i64;
            let y = (y_pct / 100.0 * screen_h) as i64;
            let w = ((w_pct / 100.0 * screen_w) as i64).max(2);
            let h = ((h_pct / 100.0 * screen_h) as i64).max(2);
            // Make dimensions even
            (x, y, w - (w % 2), h - (h % 2))
        }
        "window" => {
            // Window source has pixel coordinates from GetWindowRect
            let x = source.get("x").and_then(|v| v.as_i64()).unwrap_or(0);
            let y = source.get("y").and_then(|v| v.as_i64()).unwrap_or(0);
            let w = source.get("width").and_then(|v| v.as_i64()).unwrap_or(screen_w as i64);
            let h = source.get("height").and_then(|v| v.as_i64()).unwrap_or(screen_h as i64);
            let w = w.max(2);
            let h = h.max(2);
            (x, y, w - (w % 2), h - (h % 2))
        }
        _ => {
            // Full screen
            (0, 0, screen_w as i64, screen_h as i64)
        }
    };

    let offset_x_str = offset_x.to_string();
    let offset_y_str = offset_y.to_string();
    let video_size_str = format!("{}x{}", cap_w, cap_h);

    let args = vec![
        "-y",
        "-f", "gdigrab",
        "-framerate", "1",
        "-draw_mouse", "0",
        "-offset_x", &offset_x_str,
        "-offset_y", &offset_y_str,
        "-video_size", &video_size_str,
        "-i", "desktop",
        "-frames:v", "1",
        "-update", "true",
        &screenshot_str,
    ];

    let shell = app.shell();
    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| AppError::General(format!("FFmpeg sidecar error: {}", e)))?
        .args(&args)
        .output()
        .await
        .map_err(|e| AppError::General(format!("FFmpeg execution error: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        log::warn!("[FFmpeg screenshot] stderr: {}", stderr);
    }

    if screenshot_path.exists() {
        let data = std::fs::read(&screenshot_path)?;
        std::fs::remove_file(&screenshot_path).ok();
        if data.is_empty() {
            return Err(AppError::General("Screenshot file is empty".to_string()));
        }
        let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
        Ok(format!("data:image/png;base64,{}", b64))
    } else {
        Err(AppError::General("Screenshot capture failed".to_string()))
    }
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
