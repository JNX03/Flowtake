use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[derive(Debug, Clone, Deserialize)]
pub struct WindowSpec {
    pub id: String,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct CapturedTrack {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub width: u32,
    pub height: u32,
}

/// Spawn one FFmpeg child per selected window. Each writes to
/// `<project_temp>/extra-<idx>.mp4` using a platform-specific screen-grab
/// input. Returns the manifest of tracks so the recorder can stash it for the
/// project save step.
#[tauri::command]
pub async fn start_multi_app_capture(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    windows: Vec<WindowSpec>,
) -> AppResult<Vec<CapturedTrack>> {
    if windows.is_empty() {
        return Ok(Vec::new());
    }

    let (project_temp, ffmpeg_path) = {
        let s = state.lock().unwrap();
        let pid = s
            .project_id
            .clone()
            .ok_or(AppError::NoProjectOpen)?;
        (s.project_temp_dir(&pid), resolve_ffmpeg(&app))
    };
    std::fs::create_dir_all(&project_temp).ok();

    let mut tracks = Vec::with_capacity(windows.len());
    let mut children = Vec::with_capacity(windows.len());

    for (idx, w) in windows.iter().enumerate() {
        let filename = format!("extra-{}.mp4", idx);
        let out_path = project_temp.join(&filename);

        let child = match spawn_window_capture(&ffmpeg_path, w, &out_path) {
            Ok(c) => c,
            Err(e) => {
                log::warn!("[multi_app] failed to spawn capture for {}: {}", w.name, e);
                continue;
            }
        };
        children.push(child);
        tracks.push(CapturedTrack {
            id: w.id.clone(),
            name: w.name.clone(),
            filename,
            width: w.width,
            height: w.height,
        });
    }

    {
        let mut s = state.lock().unwrap();
        s.multi_app_children = children;
        s.multi_app_tracks = tracks.clone();
    }

    log::info!("[multi_app] started {} extra captures", tracks.len());
    Ok(tracks)
}

#[tauri::command]
pub async fn stop_multi_app_capture(state: State<'_, Mutex<AppState>>) -> AppResult<()> {
    let children = {
        let mut s = state.lock().unwrap();
        std::mem::take(&mut s.multi_app_children)
    };
    graceful_shutdown(children);
    log::info!("[multi_app] stopped extra captures");
    Ok(())
}

/// Shared shutdown helper used by both the explicit stop command and
/// stop_recording to ensure all FFmpeg children are quiesced and their files
/// have valid moov atoms before we return.
pub fn graceful_shutdown(mut children: Vec<std::process::Child>) {
    if children.is_empty() {
        return;
    }
    for child in children.iter_mut() {
        // Closing stdin via take() signals EOF to FFmpeg after sending 'q'.
        if let Some(mut stdin) = child.stdin.take() {
            use std::io::Write;
            let _ = stdin.write_all(b"q\n");
            // Drop closes the pipe.
        }
    }
    std::thread::sleep(std::time::Duration::from_millis(500));
    for mut child in children {
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn resolve_ffmpeg(app: &AppHandle) -> PathBuf {
    // Prefer the bundled sidecar if present; fall back to PATH `ffmpeg`.
    if let Ok(resource_dir) = app.path().resource_dir() {
        let sidecar = resource_dir.join("binaries").join(if cfg!(target_os = "windows") {
            "ffmpeg.exe"
        } else {
            "ffmpeg"
        });
        if sidecar.exists() {
            return sidecar;
        }
    }
    PathBuf::from(if cfg!(target_os = "windows") { "ffmpeg.exe" } else { "ffmpeg" })
}

#[cfg(target_os = "windows")]
fn spawn_window_capture(
    ffmpeg: &PathBuf,
    spec: &WindowSpec,
    out_path: &PathBuf,
) -> std::io::Result<std::process::Child> {
    use std::os::windows::process::CommandExt;
    // CREATE_NO_WINDOW (0x08000000) so FFmpeg doesn't flash a console per child.
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // Use gdigrab with explicit offset + size to capture the window region.
    // Even values only — odd dimensions break libx264.
    let w = (spec.width as i32) & !1;
    let h = (spec.height as i32) & !1;

    std::process::Command::new(ffmpeg)
        .args([
            "-y",
            "-f", "gdigrab",
            "-framerate", "30",
            "-offset_x", &spec.x.to_string(),
            "-offset_y", &spec.y.to_string(),
            "-video_size", &format!("{}x{}", w, h),
            "-i", "desktop",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
        ])
        .arg(out_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
}

#[cfg(target_os = "macos")]
fn spawn_window_capture(
    ffmpeg: &PathBuf,
    spec: &WindowSpec,
    out_path: &PathBuf,
) -> std::io::Result<std::process::Child> {
    let w = (spec.width as i32) & !1;
    let h = (spec.height as i32) & !1;
    std::process::Command::new(ffmpeg)
        .args([
            "-y",
            "-f", "avfoundation",
            "-framerate", "30",
            "-i", "1:none",
            "-vf", &format!("crop={}:{}:{}:{}", w, h, spec.x.max(0), spec.y.max(0)),
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
        ])
        .arg(out_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
}

#[cfg(all(unix, not(target_os = "macos")))]
fn spawn_window_capture(
    ffmpeg: &PathBuf,
    spec: &WindowSpec,
    out_path: &PathBuf,
) -> std::io::Result<std::process::Child> {
    let w = (spec.width as i32) & !1;
    let h = (spec.height as i32) & !1;
    std::process::Command::new(ffmpeg)
        .args([
            "-y",
            "-f", "x11grab",
            "-framerate", "30",
            "-video_size", &format!("{}x{}", w, h),
            "-i", &format!(":0.0+{},{}", spec.x, spec.y),
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
        ])
        .arg(out_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
}

