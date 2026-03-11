mod commands;
mod state;
mod error;

use state::AppState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(Mutex::new(app_state))
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
            // File operations
            commands::files::open_file,
            commands::files::read_file,
            commands::files::write_file,
            commands::files::close_file,
            commands::files::get_size,
            // Window management
            commands::windows::close_window,
            commands::windows::destroy_window,
            commands::windows::open_window_picker,
            commands::windows::close_window_picker_window,
            commands::windows::select_window,
            commands::windows::get_windows,
            commands::windows::open_area_picker,
            commands::windows::close_area_picker_window,
            commands::windows::select_area,
            commands::windows::add_note,
            // App
            commands::app::get_version,
            commands::app::get_machine_id,
            commands::app::get_is_sentry_enabled,
            commands::app::check_permissions,
            commands::app::check_for_updates,
            commands::app::install_update,
            commands::app::choose_export_directory,
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

            log::info!(
                "Flowtake v{} started",
                app.config().version.as_deref().unwrap_or("unknown")
            );

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
