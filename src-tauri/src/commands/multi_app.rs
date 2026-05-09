use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

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

    let project_temp = {
        let s = state.lock().unwrap();
        let pid = s
            .project_id
            .clone()
            .ok_or(AppError::NoProjectOpen)?;
        s.project_temp_dir(&pid)
    };
    std::fs::create_dir_all(&project_temp).ok();

    // Reuse the same path-resolution as the main recorder so we find the
    // bundled sidecar in dev AND in production.
    let ffmpeg_path = match crate::commands::recording::find_ffmpeg_path() {
        Some(p) => p,
        None => {
            log::error!("[multi_app] FFmpeg binary not found; multi-app capture skipped");
            return Err(AppError::General(
                "FFmpeg binary not found for multi-app capture".to_string(),
            ));
        }
    };
    log::info!("[multi_app] using ffmpeg at {:?}", ffmpeg_path);
    let _ = &app; // app no longer needed but kept for API stability

    let mut tracks = Vec::with_capacity(windows.len());
    let mut children = Vec::with_capacity(windows.len());

    for (idx, w) in windows.iter().enumerate() {
        let filename = format!("extra-{}.mp4", idx);
        let out_path = project_temp.join(&filename);
        log::info!(
            "[multi_app] spawning capture {} for window '{}' ({}x{}) at ({}, {}) -> {:?}",
            idx, w.name, w.width, w.height, w.x, w.y, out_path
        );

        let mut child = match spawn_window_capture(&app, &ffmpeg_path, w, &out_path) {
            Ok(c) => c,
            Err(e) => {
                log::warn!("[multi_app] failed to spawn capture for '{}': {}", w.name, e);
                continue;
            }
        };

        // Drain stderr to log so we can see if FFmpeg fails (gdigrab windowing
        // errors, libx264 errors, etc.) instead of silent /dev/null.
        if let Some(stderr) = child.stderr.take() {
            let label = format!("extra-{}-{}", idx, w.name);
            std::thread::spawn(move || {
                use std::io::{BufRead, BufReader};
                let reader = BufReader::new(stderr);
                for line in reader.lines().map_while(Result::ok) {
                    if !line.trim().is_empty() {
                        log::info!("[ffmpeg/{}] {}", label, line);
                    }
                }
            });
        }
        children.push(child);
        tracks.push(CapturedTrack {
            id: w.id.clone(),
            name: w.name.clone(),
            filename,
            width: w.width,
            height: w.height,
        });
    }

    if tracks.is_empty() {
        log::warn!("[multi_app] no extra captures spawned (all failed?)");
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

#[cfg(target_os = "windows")]
fn spawn_window_capture(
    app: &AppHandle,
    ffmpeg: &PathBuf,
    spec: &WindowSpec,
    out_path: &PathBuf,
) -> std::io::Result<std::process::Child> {
    use std::os::windows::process::CommandExt;
    // CREATE_NO_WINDOW (0x08000000) so FFmpeg doesn't flash a console per child.
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // Use ddagrab (DXGI Desktop Duplication) instead of gdigrab. Reasons:
    //  - GPU-accelerated, ~10x lower CPU than gdigrab BitBlt
    //  - Captures the *composited* desktop, so hardware-accelerated apps
    //    (Chrome, VSCode, modern Win32, UWP) appear correctly. gdigrab title=
    //    capture returns black frames for those apps.
    //  - Doesn't cause the hardware cursor to flicker on screen.
    // Tradeoff: ddagrab captures a fixed monitor region, so if the user moves
    // the window during recording it will capture whatever is at the original
    // position. Acceptable for demos.
    let (mon_idx, mon_x, mon_y) = monitor_for(app, spec.x, spec.y, spec.width, spec.height);

    // libx264 requires even dimensions.
    let w = (spec.width as i32) & !1;
    let h = (spec.height as i32) & !1;
    let off_x = (spec.x - mon_x).max(0);
    let off_y = (spec.y - mon_y).max(0);

    let ddagrab = format!(
        "ddagrab=output_idx={}:framerate=15:draw_mouse=0:offset_x={}:offset_y={}:video_size={}x{}",
        mon_idx, off_x, off_y, w, h
    );

    let mut cmd = std::process::Command::new(ffmpeg);
    cmd.args([
        "-y",
        "-f", "lavfi",
        "-i", &ddagrab,
        "-vf", "hwdownload,format=bgra,format=yuv420p",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
    ])
    .arg(out_path)
    .stdin(Stdio::piped())
    .stdout(Stdio::null())
    .stderr(Stdio::piped())
    .creation_flags(CREATE_NO_WINDOW);
    cmd.spawn()
}

#[cfg(target_os = "windows")]
fn monitor_for(app: &AppHandle, win_x: i32, win_y: i32, win_w: u32, win_h: u32) -> (usize, i32, i32) {
    let cx = win_x + (win_w as i32) / 2;
    let cy = win_y + (win_h as i32) / 2;
    if let Ok(monitors) = app.available_monitors() {
        for (i, m) in monitors.iter().enumerate() {
            let pos = m.position();
            let size = m.size();
            let mx = pos.x;
            let my = pos.y;
            let mw = size.width as i32;
            let mh = size.height as i32;
            if cx >= mx && cx < mx + mw && cy >= my && cy < my + mh {
                return (i, mx, my);
            }
        }
    }
    (0, 0, 0)
}

#[cfg(target_os = "macos")]
fn spawn_window_capture(
    _app: &AppHandle,
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
        .stderr(Stdio::piped())
        .spawn()
}

#[cfg(all(unix, not(target_os = "macos")))]
fn spawn_window_capture(
    _app: &AppHandle,
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
        .stderr(Stdio::piped())
        .spawn()
}

