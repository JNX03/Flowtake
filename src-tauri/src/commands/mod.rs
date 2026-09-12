pub mod app;
pub mod audio;
pub mod background;
pub mod encoding;
pub mod exporter;
pub mod files;
pub mod keyboard;
pub mod live;
pub mod multi_app;
pub mod plugins;
pub mod presets;
pub mod projects;
pub mod recording;
pub mod social_upload;
pub mod store;
pub mod windows;

use tauri_plugin_shell::ShellExt;

#[cfg(target_os = "macos")]
pub async fn run_macos_screencapture(
    args: &[&str],
    timeout: std::time::Duration,
) -> Result<std::process::Output, crate::error::AppError> {
    let mut command = tokio::process::Command::new("screencapture");
    command
        .args(args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);

    let child = command
        .spawn()
        .map_err(|e| crate::error::AppError::General(format!("screencapture error: {}", e)))?;

    tokio::time::timeout(timeout, child.wait_with_output())
        .await
        .map_err(|_| crate::error::AppError::General("ScreenCaptureTimedOut".to_string()))?
        .map_err(|e| crate::error::AppError::General(format!("screencapture error: {}", e)))
}

/// Helper to get FFmpeg command from an AppHandle.
/// Release packages do not redistribute FFmpeg, so resolve and execute-probe a
/// separately installed copy before constructing the shell command.
pub fn ffmpeg_from_app(
    app: &tauri::AppHandle,
) -> Result<tauri_plugin_shell::process::Command, crate::error::AppError> {
    let path = recording::find_ffmpeg_path().ok_or_else(|| {
        crate::error::AppError::General(
            "FFmpeg is required. Install it with your platform package manager and restart Flowtake."
                .to_string(),
        )
    })?;
    Ok(app.shell().command(path.to_string_lossy().into_owned()))
}
