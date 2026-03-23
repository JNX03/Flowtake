#![allow(unexpected_cfgs)]

#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;

mod commands;
mod state;
mod error;
mod mouse_tracker;

use state::AppState;
use std::sync::Mutex;
use tauri::Manager;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    log::info!("[Flowtake] Starting app...");

    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .manage(Mutex::new(app_state))
        // Register video:// protocol for streaming video files to the editor
        .register_uri_scheme_protocol("video", |ctx, request| {
            let app = ctx.app_handle();
            let state = app.state::<Mutex<AppState>>();

            let uri = request.uri().to_string();
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
            let project_id = query
                .split('&')
                .find_map(|p| {
                    let mut parts = p.splitn(2, '=');
                    if parts.next() == Some("projectId") {
                        parts.next().map(|s| s.to_string())
                    } else {
                        None
                    }
                });

            // Determine file path
            let file_path = {
                let state = state.lock().unwrap();
                let pid = project_id
                    .as_deref()
                    .or(state.project_id.as_deref())
                    .unwrap_or("");

                if pid.is_empty() {
                    return tauri::http::Response::builder()
                        .status(404)
                        .body(Vec::<u8>::new())
                        .unwrap();
                }

                match video_type {
                    "screen" => state.screen_video_file(pid),
                    "camera" | "microphone" => state.camera_video_file(pid),
                    _ => state.screen_video_file(pid),
                }
            };

            if !file_path.exists() {
                debug_log(&format!("[video://] File not found: {:?}", file_path));
                return tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::<u8>::new())
                    .unwrap();
            }
            debug_log(&format!("[video://] Serving file: {:?} (size={})", file_path, file_path.metadata().map(|m| m.len()).unwrap_or(0)));

            let file_size = file_path
                .metadata()
                .map(|m| m.len())
                .unwrap_or(0);

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

            let (start, end) = if let Some(range_str) = range_header.strip_prefix("bytes=") {
                let parts: Vec<&str> = range_str.split('-').collect();
                let start: u64 = parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
                let end: u64 = parts
                    .get(1)
                    .and_then(|s| {
                        if s.is_empty() {
                            None
                        } else {
                            s.parse().ok()
                        }
                    })
                    .unwrap_or(file_size.saturating_sub(1));
                (start, end.min(file_size.saturating_sub(1)))
            } else {
                (0, file_size.saturating_sub(1))
            };

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

            let is_range = !range_header.is_empty();
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
            // App
            commands::app::get_version,
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
            commands::encoding::get_camera_video_buffer,
            commands::encoding::get_screen_video_buffer,
            commands::encoding::extract_audio_buffer,
            // Social Upload
            commands::social_upload::youtube_set_credentials,
            commands::social_upload::youtube_auth_start,
            commands::social_upload::youtube_auth_status,
            commands::social_upload::youtube_auth_disconnect,
            commands::social_upload::youtube_upload_video,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Initialize paths
            let app_data_dir = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            let projects_dir = app_data_dir.join("projects");
            let temp_dir = app_data_dir.join("temp");

            std::fs::create_dir_all(&projects_dir).ok();
            std::fs::create_dir_all(&temp_dir).ok();

            // Store paths in state
            {
                let state = app_handle.state::<Mutex<AppState>>();
                let mut state = state.lock().unwrap();
                state.app_data_dir = app_data_dir;
                state.projects_dir = projects_dir;
                state.temp_dir = temp_dir;
            }

            // Show main window once webview is ready (avoid white screen flash)
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Wait briefly for webview to initialize
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                if let Some(win) = handle.get_webview_window("main") {
                    // Exclude main window from screen captures (preview & recording)
                    win.set_content_protected(true).ok();
                    win.show().ok();
                    win.set_focus().ok();
                }
            });

            log::info!(
                "Flowtake v{} started",
                app.config().version.as_deref().unwrap_or("unknown")
            );

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
