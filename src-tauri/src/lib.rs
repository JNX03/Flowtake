#![allow(unexpected_cfgs)]

#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;

mod commands;
mod error;
mod identifiers;
mod keyboard_tracker;
#[cfg(target_os = "macos")]
mod macos_capture;
mod mouse_tracker;
mod process_containment;
mod state;

use state::AppState;
use std::sync::Mutex;
use tauri::{Manager, WebviewWindowBuilder};

fn debug_log(msg: &str) {
    use std::io::Write;
    let log_path = dirs::data_dir()
        .unwrap_or_default()
        .join("com.flowtake.app")
        .join("debug.log");
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let _ = writeln!(f, "[{}] {}", chrono::Local::now().format("%H:%M:%S"), msg);
    }
}

fn cleanup_stale_recording_temp_dirs(temp_dir: &std::path::Path) {
    let Ok(entries) = std::fs::read_dir(temp_dir) else {
        return;
    };
    let cutoff = std::time::Duration::from_secs(24 * 60 * 60);
    let now = std::time::SystemTime::now();

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !name.starts_with("recording-") {
            continue;
        }

        let is_stale = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|modified| now.duration_since(modified).ok())
            .map(|age| age > cutoff)
            .unwrap_or(false);

        if is_stale {
            match std::fs::remove_dir_all(&path) {
                Ok(_) => log::info!("[startup] Removed stale recording temp dir: {:?}", path),
                Err(e) => log::warn!(
                    "[startup] Failed to remove stale recording temp dir {:?}: {}",
                    path,
                    e
                ),
            }
        }
    }
}

fn terminate_owned_recording_children_on_exit(app: &tauri::AppHandle) {
    use std::io::Write;
    use std::sync::atomic::Ordering;

    let (main_capture, native_macos_capture, app_layers, live_stream, window_thread, camera_file) = {
        let state = app.state::<Mutex<AppState>>();
        let mut state = state.lock().unwrap();
        state.window_capture_stop.store(true, Ordering::Relaxed);
        state.live_stop_flag.store(true, Ordering::Relaxed);
        state.live_stdin_tx = None;
        state.live_stream_credential = None;
        state.is_recording = false;
        state.recording_capture_claimed = false;
        state.recording_stop_in_progress = false;
        state.multi_app_init_in_progress = false;
        state.multi_app_stop_requested = true;
        state.ffmpeg_child_id = None;
        (
            state.ffmpeg_process.take(),
            state.macos_capture_process.take(),
            std::mem::take(&mut state.multi_app_children),
            state.live_ffmpeg_process.take(),
            state.window_capture_thread.take(),
            state.camera_file_handle.take(),
        )
    };

    if let Some(mut camera_file) = camera_file {
        camera_file.flush().ok();
    }
    if let Some(child) = main_capture {
        process_containment::terminate_owned_child(child, "screen-capture FFmpeg").ok();
    }
    if let Some(child) = native_macos_capture {
        process_containment::terminate_owned_child(child, "ScreenCaptureKit helper").ok();
    }
    process_containment::terminate_owned_children(app_layers, "App-layer FFmpeg");
    if let Some(child) = live_stream {
        process_containment::terminate_owned_child(child, "live-stream FFmpeg").ok();
    }

    if let Some(thread) = window_thread {
        let deadline = std::time::Instant::now() + std::time::Duration::from_millis(500);
        while !thread.is_finished() && std::time::Instant::now() < deadline {
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        if thread.is_finished() {
            thread.join().ok();
        } else {
            log::warn!("[shutdown] Window capture thread did not exit before app shutdown");
        }
    }

    // Recording can temporarily mute selected application sessions. Restore
    // them on every normal desktop exit, including macOS/Linux where the
    // Windows Job Object crash guarantee is unavailable.
    commands::audio::unmute_all_sessions(app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    log::info!("[Flowtake] Starting app...");

    let app_state = AppState::new();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_denylist(&[
                    "recorder",
                    "drawingOverlay",
                    "areaPicker",
                    "windowPicker",
                    "liveComposer",
                ])
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Mutex::new(app_state))
        // Register video:// protocol for streaming video files to the editor
        .register_uri_scheme_protocol("video", |ctx, request| {
            let app = ctx.app_handle();
            let state = app.state::<Mutex<AppState>>();

            let uri = request.uri().to_string();
            log::info!("[video://] Request URI: {}", uri);
            debug_log(&format!("[video://] Request URI: {}", uri));

            // Parse video type and query from URI
            // Tauri on Windows WebView2: http://video.localhost/screen?projectId=xxx
            // Tauri on other platforms: video://screen?projectId=xxx or video://localhost/screen?...
            let (path_part, query) = if let Some(q_pos) = uri.find('?') {
                (&uri[..q_pos], &uri[q_pos + 1..])
            } else {
                (uri.as_str(), "")
            };

            // Extract the video type (screen/camera/microphone) from the path
            let video_type = if path_part.contains("localhost") {
                // http://video.localhost/screen or http://video.localhost/camera
                path_part.rsplit('/').next().unwrap_or("screen")
            } else if let Some(stripped) = path_part.strip_prefix("video://") {
                // video://screen or video://camera
                stripped
            } else {
                path_part.rsplit('/').next().unwrap_or("screen")
            };
            let video_type = video_type.trim_start_matches('/');

            // Get projectId from query string
            let project_id = query.split('&').find_map(|p| {
                let mut parts = p.splitn(2, '=');
                if parts.next() == Some("projectId") {
                    parts.next().map(|s| {
                        percent_encoding::percent_decode_str(s)
                            .decode_utf8_lossy()
                            .to_string()
                    })
                } else {
                    None
                }
            });

            // Determine file path
            let file_path = {
                let state = state.lock().unwrap();
                let Some(active_project_id) = state.project_id.as_deref() else {
                    return tauri::http::Response::builder()
                        .status(404)
                        .body(Vec::<u8>::new())
                        .unwrap();
                };
                let pid = project_id.as_deref().unwrap_or(active_project_id);
                if crate::identifiers::validate_project_id(pid).is_err() || pid != active_project_id
                {
                    return tauri::http::Response::builder()
                        .status(400)
                        .body(Vec::<u8>::new())
                        .unwrap();
                }

                match video_type {
                    "screen" => state.screen_video_file(pid),
                    "camera" | "microphone" => state.camera_video_file(pid),
                    v if v.starts_with("extra-") => {
                        let Ok(idx) = v.trim_start_matches("extra-").parse::<usize>() else {
                            return tauri::http::Response::builder()
                                .status(400)
                                .body(Vec::<u8>::new())
                                .unwrap();
                        };
                        state
                            .project_temp_dir(pid)
                            .join(format!("extra-{}.mp4", idx))
                    }
                    _ => {
                        return tauri::http::Response::builder()
                            .status(404)
                            .body(Vec::<u8>::new())
                            .unwrap();
                    }
                }
            };

            if !file_path.exists() {
                log::warn!("[video://] File NOT FOUND: {:?}", file_path);
                debug_log(&format!("[video://] File not found: {:?}", file_path));
                return tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::<u8>::new())
                    .unwrap();
            }
            log::info!(
                "[video://] Serving file: {:?} (size={})",
                file_path,
                file_path.metadata().map(|m| m.len()).unwrap_or(0)
            );
            debug_log(&format!(
                "[video://] Serving file: {:?} (size={})",
                file_path,
                file_path.metadata().map(|m| m.len()).unwrap_or(0)
            ));

            let file_size = file_path.metadata().map(|m| m.len()).unwrap_or(0);
            if file_size == 0 {
                return tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::<u8>::new())
                    .unwrap();
            }

            // Determine MIME type
            let mime_type = if video_type == "microphone" {
                "audio/webm"
            } else if file_path.extension().and_then(|e| e.to_str()) == Some("webm") {
                "video/webm"
            } else {
                "video/mp4"
            };

            // Parse Range header for streaming support
            let range_header = request
                .headers()
                .get("range")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");

            const MAX_PROTOCOL_CHUNK: u64 = 16 * 1024 * 1024;
            let requested_range = range_header.strip_prefix("bytes=").and_then(|range| {
                if range.contains(',') {
                    return None;
                }
                let (start, end) = range.split_once('-')?;
                let start = start.parse::<u64>().ok()?;
                let end = if end.is_empty() {
                    file_size - 1
                } else {
                    end.parse::<u64>().ok()?.min(file_size - 1)
                };
                (start < file_size && end >= start).then_some((start, end))
            });
            if !range_header.is_empty() && requested_range.is_none() {
                return tauri::http::Response::builder()
                    .status(416)
                    .header("Content-Range", format!("bytes */{}", file_size))
                    .body(Vec::<u8>::new())
                    .unwrap();
            }
            let (start, requested_end) = requested_range.unwrap_or((0, file_size - 1));
            let end = requested_end.min(start.saturating_add(MAX_PROTOCOL_CHUNK - 1));

            // Read the requested range
            let data = {
                use std::io::{Read, Seek, SeekFrom};
                let mut file = match std::fs::File::open(&file_path) {
                    Ok(f) => f,
                    Err(e) => {
                        log::error!("[video://] Failed to open file: {}", e);
                        return tauri::http::Response::builder()
                            .status(500)
                            .body(Vec::<u8>::new())
                            .unwrap();
                    }
                };

                let len = (end - start + 1) as usize;
                let mut buf = vec![0u8; len];
                if file.seek(SeekFrom::Start(start)).is_err() {
                    return tauri::http::Response::builder()
                        .status(500)
                        .body(Vec::<u8>::new())
                        .unwrap();
                }
                let bytes_read = file.read(&mut buf).unwrap_or(0);
                buf.truncate(bytes_read);
                buf
            };

            let is_range = !range_header.is_empty() || end.saturating_add(1) < file_size;
            let status = if is_range { 206 } else { 200 };

            debug_log(&format!(
                "[video://] Serving {} bytes (status {}) for {:?}",
                data.len(),
                status,
                file_path
            ));

            let mut builder = tauri::http::Response::builder()
                .status(status)
                .header("Content-Type", mime_type)
                .header("Accept-Ranges", "bytes")
                .header("Content-Length", data.len().to_string())
                .header("Access-Control-Allow-Origin", "*");

            if is_range && !data.is_empty() {
                let content_range = format!(
                    "bytes {}-{}/{}",
                    start,
                    start + data.len() as u64 - 1,
                    file_size
                );
                builder = builder.header("Content-Range", content_range);
            }

            builder.body(data).unwrap_or_else(|_| {
                tauri::http::Response::builder()
                    .status(500)
                    .body(Vec::<u8>::new())
                    .unwrap()
            })
        })
        // Register image:// protocol for serving background images and wallpaper thumbnails
        .register_uri_scheme_protocol("image", |ctx, request| {
            let app = ctx.app_handle();
            let state = app.state::<Mutex<AppState>>();

            let uri = request.uri().to_string();

            // Parse path and query from URI
            // Windows WebView2: http://image.localhost/background?renderId=xxx
            // Other platforms: image://background?renderId=xxx or image://localhost/background?...
            let (path_part, query) = if let Some(q_pos) = uri.find('?') {
                (&uri[..q_pos], &uri[q_pos + 1..])
            } else {
                (uri.as_str(), "")
            };

            let image_type = if path_part.contains("localhost") {
                path_part.rsplit('/').next().unwrap_or("")
            } else if let Some(stripped) = path_part.strip_prefix("image://") {
                stripped
            } else {
                path_part.rsplit('/').next().unwrap_or("")
            };
            let image_type = image_type.trim_start_matches('/');

            // Parse query parameters
            let get_param = |key: &str| -> Option<String> {
                query.split('&').find_map(|p| {
                    let mut parts = p.splitn(2, '=');
                    if parts.next() == Some(key) {
                        parts.next().map(|s| {
                            percent_encoding::percent_decode_str(s)
                                .decode_utf8_lossy()
                                .to_string()
                        })
                    } else {
                        None
                    }
                })
            };

            let file_path = {
                let state = state.lock().unwrap();

                match image_type {
                    "background" => {
                        // Resolve project_id: try renderId lookup, fall back to current project
                        let render_id = get_param("renderId");
                        let project_id = render_id
                            .as_deref()
                            .filter(|id| *id != "null" && !id.is_empty())
                            .and_then(|rid| state.renders.get(rid).map(|r| r.project_id.clone()))
                            .or_else(|| state.project_id.clone());

                        match project_id {
                            Some(pid) if crate::identifiers::validate_project_id(&pid).is_ok() => {
                                state.background_file(&pid)
                            }
                            None => {
                                return tauri::http::Response::builder()
                                    .status(404)
                                    .body(Vec::<u8>::new())
                                    .unwrap();
                            }
                            Some(_) => {
                                return tauri::http::Response::builder()
                                    .status(400)
                                    .body(Vec::<u8>::new())
                                    .unwrap();
                            }
                        }
                    }
                    "wallpaper" => {
                        let filename = match get_param("path") {
                            Some(f) => f,
                            None => {
                                return tauri::http::Response::builder()
                                    .status(400)
                                    .body(Vec::<u8>::new())
                                    .unwrap();
                            }
                        };

                        // Prevent path traversal
                        if filename.contains("..")
                            || filename.contains('/')
                            || filename.contains('\\')
                        {
                            return tauri::http::Response::builder()
                                .status(400)
                                .body(Vec::<u8>::new())
                                .unwrap();
                        }

                        let wallpapers_dir = state.app_data_dir.join("wallpapers");
                        let candidate = wallpapers_dir.join(&filename);
                        if let (Ok(canonical), Ok(base)) =
                            (candidate.canonicalize(), wallpapers_dir.canonicalize())
                        {
                            if !canonical.starts_with(&base) {
                                return tauri::http::Response::builder()
                                    .status(400)
                                    .body(Vec::<u8>::new())
                                    .unwrap();
                            }
                            canonical
                        } else {
                            return tauri::http::Response::builder()
                                .status(404)
                                .body(Vec::<u8>::new())
                                .unwrap();
                        }
                    }
                    _ => {
                        return tauri::http::Response::builder()
                            .status(404)
                            .body(Vec::<u8>::new())
                            .unwrap();
                    }
                }
            };

            if !file_path.exists() {
                return tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::<u8>::new())
                    .unwrap();
            }

            let data = match std::fs::read(&file_path) {
                Ok(d) => d,
                Err(_) => {
                    return tauri::http::Response::builder()
                        .status(500)
                        .body(Vec::<u8>::new())
                        .unwrap();
                }
            };

            let mime_type = match file_path.extension().and_then(|e| e.to_str()) {
                Some("png") => "image/png",
                Some("jpg") | Some("jpeg") => "image/jpeg",
                Some("webp") => "image/webp",
                Some("gif") => "image/gif",
                _ => "application/octet-stream",
            };

            tauri::http::Response::builder()
                .status(200)
                .header("Content-Type", mime_type)
                .header("Content-Length", data.len().to_string())
                .header("Access-Control-Allow-Origin", "*")
                .body(data)
                .unwrap_or_else(|_| {
                    tauri::http::Response::builder()
                        .status(500)
                        .body(Vec::<u8>::new())
                        .unwrap()
                })
        })
        .invoke_handler(tauri::generate_handler![
            // Store
            commands::store::store_get,
            commands::store::store_set,
            commands::store::store_get_paginated,
            // Projects
            commands::projects::get_projects,
            commands::projects::open_project,
            commands::projects::close_project,
            commands::projects::delete_project,
            commands::projects::save_json,
            commands::projects::find_project,
            commands::projects::open_project_dir,
            commands::projects::open_logs_dir,
            // Recording
            commands::recording::init_recording,
            commands::recording::start_recording,
            commands::recording::pause_recording,
            commands::recording::stop_recording,
            commands::recording::reset_recording,
            commands::recording::cancel_recording,
            commands::recording::get_camera_mic_config,
            commands::recording::get_source_screenshot,
            commands::recording::init_camera_file,
            commands::recording::enqueue_camera_chunk,
            commands::recording::finalize_camera_file,
            commands::recording::take_recording_screenshot,
            // Exporter
            commands::exporter::open_export_window,
            commands::exporter::close_export_window,
            commands::exporter::close_exporter_window,
            commands::exporter::get_project_for_export,
            commands::exporter::get_project_state,
            commands::exporter::get_open_section,
            commands::exporter::queue_render,
            commands::exporter::process_audio,
            commands::exporter::add_audio,
            commands::exporter::set_progress_bar,
            commands::exporter::set_close_mode,
            commands::exporter::set_has_rendering_or_completed_renders,
            commands::exporter::clean_up_temp_folder,
            commands::exporter::copy_to_videos_folder,
            commands::exporter::reveal_video_in_file_explorer,
            commands::exporter::play_video,
            commands::exporter::cancel_render,
            commands::exporter::send_notification,
            commands::exporter::get_shareable_url,
            commands::exporter::upload,
            commands::exporter::clear_pending_renders,
            commands::exporter::cancel_running_render,
            commands::exporter::get_render_video_path,
            commands::exporter::open_url_in_browser,
            // File operations
            commands::files::open_file,
            commands::files::read_file,
            commands::files::write_file,
            commands::files::close_file,
            commands::files::get_size,
            commands::files::get_video_path,
            // Window management
            commands::windows::close_window,
            commands::windows::destroy_window,
            commands::windows::open_window_picker,
            commands::windows::close_window_picker_window,
            commands::windows::select_window,
            commands::windows::get_windows,
            commands::windows::get_picker_screenshot,
            commands::windows::open_area_picker,
            commands::windows::close_area_picker_window,
            commands::windows::select_area,
            commands::windows::add_note,
            commands::windows::get_window_at_point,
            commands::windows::get_monitors,
            commands::windows::toggle_drawing_overlay,
            commands::windows::get_content_protection,
            commands::windows::set_content_protection,
            // App
            commands::app::get_version,
            commands::app::get_system_info,
            commands::app::get_machine_id,
            commands::app::get_is_sentry_enabled,
            commands::app::check_permissions,
            commands::app::check_for_updates,
            commands::app::install_update,
            commands::app::get_changelog,
            commands::app::choose_export_directory,
            commands::app::check_dependencies,
            commands::app::install_dependencies,
            commands::app::get_autostart,
            commands::app::set_autostart,
            // Background
            commands::background::update_background,
            commands::background::get_wallpapers,
            commands::background::sync_background,
            commands::background::get_background_images,
            commands::background::choose_background_image,
            // Presets
            commands::presets::save_preset,
            commands::presets::get_presets,
            commands::presets::delete_preset,
            commands::presets::get_preset,
            commands::presets::open_preset_dir,
            commands::presets::import_preset,
            // Encoders/Capturers
            commands::encoding::get_encoders,
            commands::encoding::set_encoder,
            commands::encoding::get_capturers,
            commands::encoding::set_capturer,
            commands::encoding::extract_audio_buffer,
            // Audio
            commands::audio::get_audio_sessions,
            commands::audio::mute_audio_sessions,
            commands::audio::unmute_audio_sessions,
            // Live streaming
            commands::live::set_live_stream_key,
            commands::live::has_live_stream_key,
            commands::live::start_live_streaming,
            commands::live::push_live_frame,
            commands::live::stop_live_streaming,
            commands::live::get_live_stats,
            commands::live::register_live_zoom_hotkey,
            commands::live::unregister_live_zoom_hotkey,
            commands::live::get_cursor_position,
            commands::windows::open_live_composer,
            commands::windows::close_live_composer,
            // Plugins
            commands::plugins::ensure_plugins_dir,
            commands::plugins::list_plugins,
            commands::plugins::open_plugins_folder,
            // Keyboard tracker (plugin: keyboard overlay)
            commands::keyboard::keyboard_start,
            commands::keyboard::keyboard_stop,
            commands::keyboard::keyboard_get_events,
            // Multi-app recording (plugin: individual app recording)
            commands::multi_app::start_multi_app_capture,
            commands::multi_app::stop_multi_app_capture,
            // Social Upload
            commands::social_upload::youtube_set_credentials,
            commands::social_upload::youtube_auth_start,
            commands::social_upload::youtube_auth_status,
            commands::social_upload::youtube_auth_disconnect,
            commands::social_upload::youtube_upload_video,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Legacy builds wrote reusable Google credentials and YouTube tokens to
            // social_auth.json. Refuse to show a renderer unless that plaintext is gone;
            // current builds retain OAuth material only in native process memory.
            match commands::social_upload::migrate_legacy_youtube_auth(&app_handle) {
                Ok(true) => log::info!(
                    "[startup] Removed legacy persisted YouTube OAuth credentials and tokens"
                ),
                Ok(false) => {}
                Err(error) => {
                    log::error!("[startup] Could not remove legacy YouTube OAuth secrets");
                    return Err(Box::new(error));
                }
            }

            // Remove plaintext stream keys written by earlier versions before any renderer is
            // shown. New versions keep the destination-bound credential in process memory only.
            match commands::store::migrate_legacy_live_settings(&app_handle) {
                Ok(true) => {
                    log::info!("[startup] Removed a legacy persisted live-stream credential")
                }
                Ok(false) => {}
                Err(error) => {
                    log::error!(
                        "[startup] Could not remove legacy live-stream credentials from settings"
                    );
                    return Err(Box::new(error));
                }
            }

            // Initialize paths
            let app_data_dir = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            let projects_dir = app_data_dir.join("projects");
            let temp_dir = app_data_dir.join("temp");
            let plugins_dir = app_data_dir.join("plugins");

            std::fs::create_dir_all(&projects_dir).ok();
            std::fs::create_dir_all(&temp_dir).ok();
            std::fs::create_dir_all(&plugins_dir).ok();
            cleanup_stale_recording_temp_dirs(&temp_dir);

            // Store paths in state
            {
                let state = app_handle.state::<Mutex<AppState>>();
                let mut state = state.lock().unwrap();
                state.app_data_dir = app_data_dir;
                state.projects_dir = projects_dir;
                state.temp_dir = temp_dir;
            }

            // The declarative main window has `create: false`, so no renderer exists while
            // the fail-closed legacy-secret migrations above run. Build it only after both
            // plaintext stores have been scrubbed and native state is initialized.
            let main_window_config = app
                .config()
                .app
                .windows
                .iter()
                .find(|config| config.label == "main")
                .cloned()
                .ok_or_else(|| {
                    crate::error::AppError::General(
                        "Main window configuration is missing".to_string(),
                    )
                })?;
            WebviewWindowBuilder::from_config(app.handle(), &main_window_config)?.build()?;

            // Show main window once webview is ready (avoid white screen flash)
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Wait briefly for webview to initialize
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                if let Some(win) = handle.get_webview_window("main") {
                    // Exclude main window from screen captures (preview & recording)
                    let protected = commands::windows::is_content_protection_enabled(&handle);
                    win.set_content_protected(protected).ok();
                    win.show().ok();
                    win.set_focus().ok();

                    // Auto-open devtools in debug builds so the console is
                    // visible without needing F12 / right-click (which may be
                    // intercepted by the app's custom title bar / CSS).
                    #[cfg(debug_assertions)]
                    win.open_devtools();
                }
            });

            log::info!(
                "Flowtake v{} started",
                app.config().version.as_deref().unwrap_or("unknown")
            );

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            if commands::social_upload::clear_youtube_oauth_session(app_handle).is_err() {
                log::warn!("[shutdown] Could not clear the YouTube OAuth session cleanly");
            }
            terminate_owned_recording_children_on_exit(app_handle);
        }
    });
}
