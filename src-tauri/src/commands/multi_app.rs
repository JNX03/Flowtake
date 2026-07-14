use std::collections::HashMap;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::{Child, ExitStatus, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::state::AppState;

const FINALIZE_TIMEOUT: Duration = Duration::from_secs(8);
const FINALIZE_POLL_INTERVAL: Duration = Duration::from_millis(50);
const VALIDATION_TIMEOUT: Duration = Duration::from_secs(6);
const STARTUP_HEALTH_DELAY: Duration = Duration::from_millis(200);

#[derive(Debug, Clone)]
struct CaptureOutput {
    path: PathBuf,
    ffmpeg: PathBuf,
}

fn capture_outputs() -> &'static Mutex<HashMap<u32, CaptureOutput>> {
    static OUTPUTS: OnceLock<Mutex<HashMap<u32, CaptureOutput>>> = OnceLock::new();
    OUTPUTS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn invalid_capture_outputs() -> &'static Mutex<HashMap<PathBuf, String>> {
    static INVALID_OUTPUTS: OnceLock<Mutex<HashMap<PathBuf, String>>> = OnceLock::new();
    INVALID_OUTPUTS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn register_capture_output(pid: u32, ffmpeg: &Path, path: &Path) {
    let path = path.to_path_buf();
    capture_outputs()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .insert(
            pid,
            CaptureOutput {
                path: path.clone(),
                ffmpeg: ffmpeg.to_path_buf(),
            },
        );
    invalid_capture_outputs()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .remove(&path);
}

fn take_capture_output(pid: u32) -> Option<CaptureOutput> {
    capture_outputs()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .remove(&pid)
}

fn clear_multi_app_init(state: &Mutex<AppState>) {
    let mut state = state.lock().unwrap();
    state.multi_app_init_in_progress = false;
    state.multi_app_stop_requested = false;
}

fn abort_capture_start(children: Vec<Child>) {
    for child in children {
        let pid = child.id();
        crate::process_containment::terminate_owned_child(child, "App-layer startup FFmpeg").ok();
        if let Some(output) = take_capture_output(pid) {
            std::fs::remove_file(output.path).ok();
        }
    }
}

fn startup_must_be_canceled(state: &AppState, session_project_id: &str) -> bool {
    state.multi_app_stop_requested
        || !state.is_recording
        || !state.recording_capture_claimed
        || state.recording_stop_in_progress
        || state.project_id.as_deref() != Some(session_project_id)
}

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
    /// Milliseconds between the main recording's start and this extra's
    /// FFmpeg child being spawned. The editor uses this to bias the seek
    /// position so extras stay aligned with the main timeline. Best-effort:
    /// the value is the time from `recording_start_timestamp` to spawn, not
    /// to first frame, so a few extra millis of jitter is expected.
    #[serde(rename = "startOffsetMs", default)]
    pub start_offset_ms: i64,
}

impl CapturedTrack {
    /// Return the exact capture filename used for this track. Track filenames
    /// are generated internally, but validating the value here keeps a
    /// corrupted manifest from escaping the project directory or creating a
    /// path-traversal entry in the saved ZIP.
    pub(crate) fn archive_filename(&self) -> AppResult<&str> {
        if self.filename.is_empty()
            || self.filename == "."
            || self.filename == ".."
            || self.filename.contains('/')
            || self.filename.contains('\\')
        {
            return Err(AppError::General(format!(
                "Invalid multi-app track filename: {:?}",
                self.filename
            )));
        }
        Ok(self.filename.as_str())
    }

    pub(crate) fn capture_path(&self, project_temp: &std::path::Path) -> AppResult<PathBuf> {
        let path = project_temp.join(self.archive_filename()?);
        if let Some(reason) = invalid_capture_outputs()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .get(&path)
            .cloned()
        {
            return Err(AppError::General(format!(
                "App-layer recording {:?} is invalid and cannot be packaged: {}",
                path, reason
            )));
        }
        Ok(path)
    }
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

    let (session_project_id, project_temp, recording_start_ts) = {
        let mut s = state.lock().unwrap();
        if !s.is_recording || !s.recording_capture_claimed {
            return Err(AppError::General(
                "The main recording must be running before App layers can start.".to_string(),
            ));
        }
        if s.multi_app_init_in_progress || !s.multi_app_children.is_empty() {
            return Err(AppError::General(
                "App-layer capture is already active.".to_string(),
            ));
        }
        let pid = s.project_id.clone().ok_or(AppError::NoProjectOpen)?;
        s.multi_app_init_in_progress = true;
        s.multi_app_stop_requested = false;
        (
            pid.clone(),
            s.project_temp_dir(&pid),
            s.recording_start_timestamp,
        )
    };
    if let Err(error) = std::fs::create_dir_all(&project_temp) {
        clear_multi_app_init(&state);
        return Err(AppError::General(format!(
            "Could not create the App-layer recording workspace: {}",
            error
        )));
    }

    // Reuse the same path-resolution as the main recorder so we find the
    // bundled sidecar in dev AND in production.
    let ffmpeg_path = match crate::commands::recording::find_ffmpeg_path() {
        Some(p) => p,
        None => {
            clear_multi_app_init(&state);
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
    let mut startup_failures = Vec::new();

    for (idx, w) in windows.iter().enumerate() {
        let filename = format!("extra-{}.mp4", idx);
        let out_path = project_temp.join(&filename);
        log::info!(
            "[multi_app] spawning capture {} for window '{}' ({}x{}) at ({}, {}) -> {:?}",
            idx,
            w.name,
            w.width,
            w.height,
            w.x,
            w.y,
            out_path
        );

        let spawn_ts_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        let start_offset_ms = match recording_start_ts {
            Some(start) => (spawn_ts_ms - start).max(0),
            None => 0,
        };

        let mut child = match spawn_window_capture(&app, &ffmpeg_path, w, &out_path) {
            Ok(c) => c,
            Err(e) => {
                log::warn!(
                    "[multi_app] failed to spawn capture for '{}': {}",
                    w.name,
                    e
                );
                startup_failures.push(format!("{}: {}", w.name, e));
                continue;
            }
        };
        crate::process_containment::contain_owned_child(&child, "app-layer FFmpeg");
        register_capture_output(child.id(), &ffmpeg_path, &out_path);

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
            start_offset_ms,
        });
    }

    // `Command::spawn` succeeds even when FFmpeg immediately rejects a device,
    // display, crop, or encoder. Give every selected layer one short health
    // window and make startup all-or-none so the returned manifest is truthful.
    if startup_failures.is_empty() && !children.is_empty() {
        std::thread::sleep(STARTUP_HEALTH_DELAY);
        for (index, child) in children.iter_mut().enumerate() {
            match child.try_wait() {
                Ok(Some(status)) => startup_failures.push(format!(
                    "{}: FFmpeg exited during startup with {}",
                    tracks
                        .get(index)
                        .map(|track| track.name.as_str())
                        .unwrap_or("App layer"),
                    status
                )),
                Ok(None) => {}
                Err(error) => startup_failures.push(format!(
                    "{}: could not verify FFmpeg startup: {}",
                    tracks
                        .get(index)
                        .map(|track| track.name.as_str())
                        .unwrap_or("App layer"),
                    error
                )),
            }
        }
    }

    if !startup_failures.is_empty() || tracks.len() != windows.len() {
        abort_capture_start(children);
        clear_multi_app_init(&state);
        return Err(AppError::General(format!(
            "Could not start every selected App layer: {}",
            startup_failures.join(" | ")
        )));
    }

    let startup_was_canceled = {
        let mut s = state.lock().unwrap();
        s.multi_app_init_in_progress = false;
        let canceled = startup_must_be_canceled(&s, &session_project_id);
        s.multi_app_stop_requested = false;
        if !canceled {
            s.multi_app_children = std::mem::take(&mut children);
            s.multi_app_tracks = tracks.clone();
            s.multi_app_finalize_error = None;
        }
        canceled
    };

    if startup_was_canceled {
        // Stop won the race before the children were published. They are still
        // locally owned here, so terminate/finalize them rather than orphaning
        // them after the project has already been saved or closed.
        abort_capture_start(children);
        return Err(AppError::General(
            "App-layer startup was canceled because recording stop had already begun.".to_string(),
        ));
    }

    log::info!("[multi_app] started {} extra captures", tracks.len());
    Ok(tracks)
}

#[tauri::command]
pub async fn stop_multi_app_capture(state: State<'_, Mutex<AppState>>) -> AppResult<()> {
    finalize_state_captures(&state)
}

/// Stop and validate the App-layer children owned by a recording session. A
/// failed result is cached in AppState because the first attempt necessarily
/// consumes the Child handles. Subsequent Stop/Retry calls must return the
/// same failure rather than treating an empty child list as success.
pub fn finalize_state_captures(state: &Mutex<AppState>) -> AppResult<()> {
    let (children, previous_error, startup_in_progress) = {
        let mut state = state.lock().unwrap();
        let startup_in_progress = state.multi_app_init_in_progress;
        if startup_in_progress {
            state.multi_app_stop_requested = true;
        }
        (
            std::mem::take(&mut state.multi_app_children),
            state.multi_app_finalize_error.clone(),
            startup_in_progress,
        )
    };

    if children.is_empty() {
        if let Some(error) = previous_error {
            return Err(AppError::General(error));
        }
        if startup_in_progress {
            log::info!("[multi_app] Stop requested while App-layer startup was in progress");
        }
        return Ok(());
    }

    match shutdown_and_validate(children) {
        Ok(()) => {
            state.lock().unwrap().multi_app_finalize_error = None;
            log::info!("[multi_app] stopped and validated extra captures");
            Ok(())
        }
        Err(error) => {
            let message = error.to_string();
            state.lock().unwrap().multi_app_finalize_error = Some(message.clone());
            log::error!("[multi_app] app-layer finalization failed: {}", message);
            Err(AppError::General(message))
        }
    }
}

/// Shared shutdown helper used by both the explicit stop command and
/// stop_recording to ensure all FFmpeg children are quiesced and their files
/// have valid moov atoms before we return.
pub fn graceful_shutdown(children: Vec<Child>) -> AppResult<()> {
    shutdown_and_validate(children)
}

#[derive(Debug)]
struct ManagedCapture {
    child: Child,
    pid: u32,
    status: Option<ExitStatus>,
    poll_error: Option<String>,
    forced: bool,
}

fn shutdown_and_validate(children: Vec<Child>) -> AppResult<()> {
    if children.is_empty() {
        return Ok(());
    }

    let mut captures: Vec<ManagedCapture> = children
        .into_iter()
        .map(|child| ManagedCapture {
            pid: child.id(),
            child,
            status: None,
            poll_error: None,
            forced: false,
        })
        .collect();

    for capture in captures.iter_mut() {
        // Closing stdin via take() signals EOF to FFmpeg after sending 'q'.
        if let Some(mut stdin) = capture.child.stdin.take() {
            use std::io::Write;
            if let Err(error) = stdin.write_all(b"q\n") {
                // A broken pipe commonly means FFmpeg exited on its own. The
                // exit status and output validation below remain authoritative.
                log::debug!(
                    "[multi_app] could not send quit to FFmpeg pid {}: {}",
                    capture.pid,
                    error
                );
            }
            // Drop closes the pipe.
        }
    }

    let deadline = Instant::now() + FINALIZE_TIMEOUT;
    loop {
        for capture in captures.iter_mut() {
            if capture.status.is_some() || capture.poll_error.is_some() {
                continue;
            }
            match capture.child.try_wait() {
                Ok(Some(status)) => capture.status = Some(status),
                Ok(None) => {}
                Err(error) => capture.poll_error = Some(error.to_string()),
            }
        }

        if captures
            .iter()
            .all(|capture| capture.status.is_some() || capture.poll_error.is_some())
            || Instant::now() >= deadline
        {
            break;
        }
        std::thread::sleep(FINALIZE_POLL_INTERVAL);
    }

    for capture in captures.iter_mut() {
        if capture.status.is_some() {
            continue;
        }
        capture.forced = true;
        if let Err(error) = capture.child.kill() {
            log::debug!(
                "[multi_app] FFmpeg pid {} could not be killed after finalization timeout: {}",
                capture.pid,
                error
            );
        }
        match capture.child.wait() {
            Ok(status) => capture.status = Some(status),
            Err(error) => {
                let message = error.to_string();
                capture.poll_error = Some(match capture.poll_error.take() {
                    Some(previous) => format!("{}; wait failed: {}", previous, message),
                    None => format!("wait failed: {}", message),
                });
            }
        }
    }

    let mut failures = Vec::new();
    for capture in captures {
        let output = take_capture_output(capture.pid);
        let mut reasons = Vec::new();

        if capture.forced {
            reasons.push(format!(
                "FFmpeg did not finalize within {} seconds",
                FINALIZE_TIMEOUT.as_secs()
            ));
        }
        if let Some(error) = capture.poll_error {
            reasons.push(format!("could not observe FFmpeg exit: {}", error));
        }
        match capture.status {
            Some(status) if !status.success() => {
                reasons.push(format!("FFmpeg exited with {}", status));
            }
            None => reasons.push("FFmpeg exit status was unavailable".to_string()),
            _ => {}
        }

        match output.as_ref() {
            Some(output) if reasons.is_empty() => {
                if let Err(error) = validate_capture_output(output) {
                    reasons.push(error);
                }
            }
            None => reasons.push("capture output was not registered".to_string()),
            _ => {}
        }

        if reasons.is_empty() {
            if let Some(output) = output {
                log::info!(
                    "[multi_app] finalized and validated app-layer output {:?}",
                    output.path
                );
            }
            continue;
        }

        let label = output
            .as_ref()
            .map(|output| output.path.display().to_string())
            .unwrap_or_else(|| format!("FFmpeg pid {}", capture.pid));
        let mut reason = reasons.join("; ");

        if let Some(output) = output {
            if let Err(exclusion_error) = exclude_invalid_output(&output.path) {
                invalid_capture_outputs()
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner())
                    .insert(output.path.clone(), reason.clone());
                reason.push_str(&format!(
                    "; could not exclude invalid output: {}",
                    exclusion_error
                ));
            }
        }
        failures.push(format!("{}: {}", label, reason));
    }

    if failures.is_empty() {
        Ok(())
    } else {
        Err(AppError::General(format!(
            "One or more app-layer recordings could not be finalized: {}",
            failures.join(" | ")
        )))
    }
}

fn validate_capture_output(output: &CaptureOutput) -> Result<(), String> {
    validate_mp4_structure(&output.path)?;
    run_decode_probe(&output.ffmpeg, &output.path, false)?;
    run_decode_probe(&output.ffmpeg, &output.path, true)?;
    Ok(())
}

fn validate_mp4_structure(path: &Path) -> Result<(), String> {
    let mut file = std::fs::File::open(path)
        .map_err(|error| format!("could not open finalized MP4: {}", error))?;
    let file_len = file
        .metadata()
        .map_err(|error| format!("could not inspect finalized MP4: {}", error))?
        .len();
    if file_len < 24 {
        return Err(format!(
            "finalized MP4 is too small to be readable ({} bytes)",
            file_len
        ));
    }

    let mut offset = 0_u64;
    let mut has_ftyp = false;
    let mut has_moov = false;
    let mut has_mdat = false;

    while offset < file_len {
        let remaining = file_len - offset;
        if remaining < 8 {
            return Err(format!(
                "finalized MP4 has a truncated box header at byte {}",
                offset
            ));
        }

        file.seek(SeekFrom::Start(offset))
            .map_err(|error| format!("could not seek finalized MP4: {}", error))?;
        let mut header = [0_u8; 8];
        file.read_exact(&mut header)
            .map_err(|error| format!("could not read finalized MP4 header: {}", error))?;
        let size32 = u32::from_be_bytes(header[0..4].try_into().expect("four-byte size"));
        let box_type: [u8; 4] = header[4..8].try_into().expect("four-byte box type");

        let (box_size, header_size) = if size32 == 1 {
            if remaining < 16 {
                return Err(format!(
                    "finalized MP4 has a truncated extended box header at byte {}",
                    offset
                ));
            }
            let mut extended = [0_u8; 8];
            file.read_exact(&mut extended).map_err(|error| {
                format!("could not read finalized MP4 extended header: {}", error)
            })?;
            (u64::from_be_bytes(extended), 16_u64)
        } else if size32 == 0 {
            (remaining, 8_u64)
        } else {
            (u64::from(size32), 8_u64)
        };

        if box_size < header_size || box_size > remaining {
            return Err(format!(
                "finalized MP4 has an invalid {} box size {} at byte {}",
                String::from_utf8_lossy(&box_type),
                box_size,
                offset
            ));
        }

        match &box_type {
            b"ftyp" => has_ftyp = true,
            b"moov" => has_moov = true,
            b"mdat" => has_mdat = true,
            _ => {}
        }
        offset = offset
            .checked_add(box_size)
            .ok_or_else(|| "finalized MP4 box offsets overflowed".to_string())?;
    }

    let mut missing = Vec::new();
    if !has_ftyp {
        missing.push("ftyp");
    }
    if !has_moov {
        missing.push("moov");
    }
    if !has_mdat {
        missing.push("mdat");
    }
    if missing.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "finalized MP4 is missing required {} box(es)",
            missing.join(", ")
        ))
    }
}

fn run_decode_probe(ffmpeg: &Path, path: &Path, tail: bool) -> Result<(), String> {
    let mut command = std::process::Command::new(ffmpeg);
    command.args(["-hide_banner", "-loglevel", "error", "-xerror", "-nostdin"]);
    if tail {
        command.args(["-sseof", "-1"]);
    }
    command
        .arg("-i")
        .arg(path)
        .args(["-map", "0:v:0", "-frames:v", "1", "-f", "null", "-"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("could not start FFmpeg decode validation: {}", error))?;
    crate::process_containment::contain_owned_child(&child, "decode-validation FFmpeg");
    let stderr = child.stderr.take();
    let diagnostics = std::thread::spawn(move || {
        let mut message = String::new();
        if let Some(mut stderr) = stderr {
            let _ = stderr.read_to_string(&mut message);
        }
        message
    });

    let deadline = Instant::now() + VALIDATION_TIMEOUT;
    let mut wait_error = None;
    let mut timed_out = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) if Instant::now() < deadline => {
                std::thread::sleep(FINALIZE_POLL_INTERVAL);
            }
            Ok(None) => {
                timed_out = true;
                let _ = child.kill();
                break child.wait().ok();
            }
            Err(error) => {
                wait_error = Some(error.to_string());
                let _ = child.kill();
                break child.wait().ok();
            }
        }
    };
    let diagnostics = diagnostics.join().unwrap_or_default();

    let probe_label = if tail { "tail-frame" } else { "first-frame" };
    if timed_out {
        return Err(format!(
            "{} decode validation timed out after {} seconds",
            probe_label,
            VALIDATION_TIMEOUT.as_secs()
        ));
    }
    if let Some(error) = wait_error {
        return Err(format!(
            "{} decode validation could not be observed: {}",
            probe_label, error
        ));
    }
    match status {
        Some(status) if status.success() => Ok(()),
        Some(status) => {
            let detail = diagnostics.trim();
            if detail.is_empty() {
                Err(format!(
                    "{} decode validation failed with {}",
                    probe_label, status
                ))
            } else {
                Err(format!(
                    "{} decode validation failed with {}: {}",
                    probe_label, status, detail
                ))
            }
        }
        None => Err(format!(
            "{} decode validation exit status was unavailable",
            probe_label
        )),
    }
}

fn exclude_invalid_output(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    if std::fs::remove_file(path).is_ok() {
        return Ok(());
    }

    let quarantine = path.with_extension("mp4.invalid");
    let _ = std::fs::remove_file(&quarantine);
    if std::fs::rename(path, &quarantine).is_ok() {
        let _ = std::fs::remove_file(&quarantine);
        return Ok(());
    }

    let file = std::fs::OpenOptions::new()
        .write(true)
        .truncate(true)
        .open(path)
        .map_err(|error| format!("could not remove, quarantine, or truncate file: {}", error))?;
    file.sync_all()
        .map_err(|error| format!("could not sync truncated invalid file: {}", error))
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
        "ddagrab=output_idx={}:framerate=30:draw_mouse=0:offset_x={}:offset_y={}:video_size={}x{}",
        mon_idx, off_x, off_y, w, h
    );

    let mut cmd = std::process::Command::new(ffmpeg);
    cmd.args([
        "-y",
        "-f",
        "lavfi",
        "-i",
        &ddagrab,
        "-vf",
        "hwdownload,format=bgra,format=yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
    ])
    .arg(out_path)
    .stdin(Stdio::piped())
    .stdout(Stdio::null())
    .stderr(Stdio::piped())
    .creation_flags(CREATE_NO_WINDOW);
    cmd.spawn()
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
fn monitor_for(
    app: &AppHandle,
    win_x: i32,
    win_y: i32,
    win_w: u32,
    win_h: u32,
) -> (usize, i32, i32) {
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
    app: &AppHandle,
    ffmpeg: &PathBuf,
    spec: &WindowSpec,
    out_path: &PathBuf,
) -> std::io::Result<std::process::Child> {
    let (monitor_index, monitor_x, monitor_y) =
        monitor_for(app, spec.x, spec.y, spec.width, spec.height);
    let screen_device = crate::commands::recording::macos_screen_device_index(monitor_index as i64);
    let w = (spec.width as i32) & !1;
    let h = (spec.height as i32) & !1;
    let offset_x = (spec.x - monitor_x).max(0);
    let offset_y = (spec.y - monitor_y).max(0);
    std::process::Command::new(ffmpeg)
        .args([
            "-y",
            "-f",
            "avfoundation",
            "-framerate",
            "30",
            "-i",
            &format!("{}:none", screen_device),
            "-vf",
            &format!("crop={}:{}:{}:{}", w, h, offset_x, offset_y),
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
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
    let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());
    let w = (spec.width as i32) & !1;
    let h = (spec.height as i32) & !1;
    std::process::Command::new(ffmpeg)
        .args([
            "-y",
            "-f",
            "x11grab",
            "-framerate",
            "30",
            "-video_size",
            &format!("{}x{}", w, h),
            "-i",
            &format!("{}+{},{}", display, spec.x, spec.y),
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
        ])
        .arg(out_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_path(label: &str) -> PathBuf {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "flowtake-multi-app-{}-{}-{}.mp4",
            std::process::id(),
            nonce,
            label
        ))
    }

    fn mp4_box(kind: &[u8; 4], payload: &[u8]) -> Vec<u8> {
        let size = u32::try_from(8 + payload.len()).expect("test box fits u32");
        let mut bytes = Vec::with_capacity(size as usize);
        bytes.extend_from_slice(&size.to_be_bytes());
        bytes.extend_from_slice(kind);
        bytes.extend_from_slice(payload);
        bytes
    }

    fn write_structural_mp4(path: &Path, include_moov: bool) {
        let mut bytes = mp4_box(b"ftyp", b"isom\0\0\0\0");
        if include_moov {
            bytes.extend(mp4_box(b"moov", b"metadata"));
        }
        bytes.extend(mp4_box(b"mdat", b"video-payload"));
        std::fs::write(path, bytes).expect("write test MP4");
    }

    fn track(filename: &str) -> CapturedTrack {
        CapturedTrack {
            id: "window-id".to_string(),
            name: "Window".to_string(),
            filename: filename.to_string(),
            width: 1280,
            height: 720,
            start_offset_ms: 0,
        }
    }

    #[test]
    fn capture_path_uses_the_track_actual_filename() {
        let root = std::path::Path::new("project-temp");
        let captured = track("extra-2.mp4");

        assert_eq!(captured.archive_filename().unwrap(), "extra-2.mp4");
        assert_eq!(
            captured.capture_path(root).unwrap(),
            root.join("extra-2.mp4")
        );
    }

    #[test]
    fn track_filename_rejects_paths_and_parent_segments() {
        for filename in [
            "",
            ".",
            "..",
            "../extra-0.mp4",
            "nested/extra-0.mp4",
            "nested\\extra-0.mp4",
        ] {
            assert!(track(filename).archive_filename().is_err(), "{filename}");
        }
    }

    #[test]
    fn structural_validation_requires_complete_mp4_boxes() {
        let valid_path = test_path("valid");
        write_structural_mp4(&valid_path, true);
        assert!(validate_mp4_structure(&valid_path).is_ok());

        let missing_moov_path = test_path("missing-moov");
        write_structural_mp4(&missing_moov_path, false);
        let missing_error = validate_mp4_structure(&missing_moov_path).unwrap_err();
        assert!(missing_error.contains("moov"), "{missing_error}");

        let truncated_path = test_path("truncated");
        let mut truncated = Vec::new();
        truncated.extend_from_slice(&64_u32.to_be_bytes());
        truncated.extend_from_slice(b"ftyp");
        truncated.extend_from_slice(&[0_u8; 20]);
        std::fs::write(&truncated_path, truncated).expect("write truncated MP4");
        let truncated_error = validate_mp4_structure(&truncated_path).unwrap_err();
        assert!(
            truncated_error.contains("invalid ftyp box size"),
            "{truncated_error}"
        );

        let _ = std::fs::remove_file(valid_path);
        let _ = std::fs::remove_file(missing_moov_path);
        let _ = std::fs::remove_file(truncated_path);
    }

    #[test]
    fn invalid_finalized_output_returns_error_and_is_excluded() {
        let output_path = test_path("invalid-finalized");
        // This passes the lightweight box checks, then proves the decoder gate
        // is authoritative before a track can be reported as successful.
        write_structural_mp4(&output_path, true);

        #[cfg(target_os = "windows")]
        let child = std::process::Command::new("cmd")
            .args(["/C", "exit", "0"])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn successful child");

        #[cfg(not(target_os = "windows"))]
        let child = std::process::Command::new("sh")
            .args(["-c", "exit 0"])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn successful child");

        register_capture_output(child.id(), Path::new("unused-ffmpeg"), &output_path);
        let error = shutdown_and_validate(vec![child]).unwrap_err();
        let message = error.to_string();
        assert!(message.contains("could not be finalized"), "{message}");
        assert!(message.contains("decode validation"), "{message}");
        assert!(
            !output_path.exists()
                || output_path
                    .metadata()
                    .map(|metadata| metadata.len() == 0)
                    .unwrap_or(true),
            "invalid output must not remain packageable"
        );
    }

    #[test]
    fn shutdown_waits_for_delayed_clean_exit_instead_of_killing_at_500ms() {
        let output_path = test_path("delayed-finalize");
        write_structural_mp4(&output_path, true);

        #[cfg(target_os = "windows")]
        let child = std::process::Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Start-Sleep -Milliseconds 750; exit 0",
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn delayed successful child");

        #[cfg(not(target_os = "windows"))]
        let child = std::process::Command::new("sh")
            .args(["-c", "sleep 0.75; exit 0"])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn delayed successful child");

        register_capture_output(child.id(), Path::new("unused-ffmpeg"), &output_path);
        let started = Instant::now();
        let error = shutdown_and_validate(vec![child]).unwrap_err();
        let message = error.to_string();

        assert!(
            started.elapsed() >= Duration::from_millis(600),
            "shutdown returned before delayed finalization"
        );
        assert!(
            !message.contains("did not finalize within"),
            "delayed clean exit must not be force-killed: {message}"
        );
    }

    #[test]
    fn unexcludable_invalid_track_is_rejected_by_packaging_path() {
        let root = test_path("invalid-root").with_extension("");
        let path = root.join("extra-0.mp4");
        invalid_capture_outputs()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .insert(path.clone(), "decode failed".to_string());

        let error = track("extra-0.mp4").capture_path(&root).unwrap_err();
        assert!(error.to_string().contains("cannot be packaged"));

        invalid_capture_outputs()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(&path);
    }

    #[test]
    fn app_layer_finalize_failure_remains_durable_across_stop_retries() {
        let state = Mutex::new(AppState::new());
        state.lock().unwrap().multi_app_finalize_error =
            Some("required App layer failed".to_string());

        let first = finalize_state_captures(&state).unwrap_err().to_string();
        let second = finalize_state_captures(&state).unwrap_err().to_string();
        assert!(first.contains("required App layer failed"));
        assert_eq!(first, second);
        assert!(state.lock().unwrap().multi_app_finalize_error.is_some());
    }

    #[test]
    fn immediate_stop_cancels_unpublished_app_layer_startup() {
        let state = Mutex::new(AppState::new());
        {
            let mut session = state.lock().unwrap();
            session.is_recording = true;
            session.recording_capture_claimed = true;
            session.multi_app_init_in_progress = true;
            session.project_id = Some("session-a".to_string());
        }

        // Stop sees no published children yet, but must leave a cancellation
        // token for the starter that still owns them locally.
        finalize_state_captures(&state).unwrap();
        let session = state.lock().unwrap();
        assert!(session.multi_app_stop_requested);
        assert!(startup_must_be_canceled(&session, "session-a"));
        assert!(session.multi_app_children.is_empty());
    }

    #[test]
    fn old_startup_cannot_publish_into_a_replacement_recording_session() {
        let mut state = AppState::new();
        state.is_recording = true;
        state.recording_capture_claimed = true;
        state.project_id = Some("new-session".to_string());

        assert!(startup_must_be_canceled(&state, "old-session"));
        assert!(!startup_must_be_canceled(&state, "new-session"));
    }
}
