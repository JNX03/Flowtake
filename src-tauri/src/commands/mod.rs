pub mod app;
pub mod background;
pub mod encoding;
pub mod exporter;
pub mod files;
pub mod presets;
pub mod projects;
pub mod recording;
pub mod social_upload;
pub mod store;
pub mod windows;

use tauri_plugin_shell::ShellExt;

/// Helper to get FFmpeg command from an AppHandle.
/// Tries the bundled sidecar first, then falls back to system-installed FFmpeg.
/// This ensures the app works on macOS/Linux where FFmpeg may not be bundled as a sidecar
/// but is installed system-wide (via Homebrew, apt, etc.).
pub fn ffmpeg_from_app(app: &tauri::AppHandle) -> Result<tauri_plugin_shell::process::Command, crate::error::AppError> {
    let shell = app.shell();
    match shell.sidecar("ffmpeg") {
        Ok(cmd) => Ok(cmd),
        Err(_) => {
            log::info!("[ffmpeg] Sidecar not found, using system FFmpeg");
            Ok(shell.command("ffmpeg"))
        }
    }
}
