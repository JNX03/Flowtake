use crate::error::{AppError, AppResult};
use crate::state::{AppState, LiveStats};
use serde::Deserialize;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LiveConfig {
    /// Full RTMP/RTMPS endpoint to stream to. May be empty if user only wants local.
    #[serde(default)]
    pub rtmp_url: String,
    /// Stream key — appended to rtmp_url with a `/` separator if non-empty.
    #[serde(default)]
    pub stream_key: String,
    /// Output bitrate in kbps. Used for both -b:v and CBR-ish targets.
    pub video_bitrate_kbps: u32,
    /// Width of the inbound video (informational; FFmpeg infers from container).
    #[allow(dead_code)]
    pub width: u32,
    /// Height of the inbound video (informational; FFmpeg infers from container).
    #[allow(dead_code)]
    pub height: u32,
    /// Target encode framerate.
    pub framerate: u32,
    /// If true, also tee a local MP4 next to the streaming output.
    pub save_local: bool,
    /// Directory to write the local MP4 in. Falls back to videos dir if None.
    #[serde(default)]
    pub local_dir: Option<String>,
}

fn join_rtmp(base: &str, key: &str) -> String {
    if key.is_empty() {
        return base.to_string();
    }
    if base.ends_with('/') {
        format!("{}{}", base, key)
    } else {
        format!("{}/{}", base, key)
    }
}

fn pick_local_path(config: &LiveConfig) -> PathBuf {
    let dir = config
        .local_dir
        .as_ref()
        .map(PathBuf::from)
        .or_else(dirs::video_dir)
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    let _ = std::fs::create_dir_all(&dir);
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    dir.join(format!("Flowtake-Live-{}.mp4", stamp))
}

fn build_ffmpeg_args(config: &LiveConfig, local_path: Option<&PathBuf>) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();

    // Input: webm/matroska from MediaRecorder over stdin
    args.push("-f".into());
    args.push("matroska".into());
    args.push("-i".into());
    args.push("pipe:0".into());

    // Encoding (real-time, low latency)
    args.push("-c:v".into());
    args.push("libx264".into());
    args.push("-preset".into());
    args.push("veryfast".into());
    args.push("-tune".into());
    args.push("zerolatency".into());
    args.push("-pix_fmt".into());
    args.push("yuv420p".into());
    args.push("-b:v".into());
    args.push(format!("{}k", config.video_bitrate_kbps));
    args.push("-maxrate".into());
    args.push(format!("{}k", config.video_bitrate_kbps));
    args.push("-bufsize".into());
    args.push(format!("{}k", config.video_bitrate_kbps * 2));
    let gop = (config.framerate.max(1) * 2).max(60);
    args.push("-g".into());
    args.push(gop.to_string());
    args.push("-keyint_min".into());
    args.push(gop.to_string());
    args.push("-r".into());
    args.push(config.framerate.to_string());

    // Audio: AAC at 160k stereo
    args.push("-c:a".into());
    args.push("aac".into());
    args.push("-b:a".into());
    args.push("160k".into());
    args.push("-ar".into());
    args.push("44100".into());
    args.push("-ac".into());
    args.push("2".into());

    // Outputs
    let rtmp_target = if config.rtmp_url.is_empty() {
        None
    } else {
        Some(join_rtmp(&config.rtmp_url, &config.stream_key))
    };

    match (rtmp_target, local_path) {
        (Some(rtmp), Some(local)) => {
            // Tee: RTMP (FLV) + local MP4 with fragmented moov so partial writes survive crashes.
            args.push("-flags".into());
            args.push("+global_header".into());
            args.push("-f".into());
            args.push("tee".into());
            args.push("-map".into());
            args.push("0:v:0".into());
            args.push("-map".into());
            args.push("0:a:0?".into());
            let local_str = local.to_string_lossy().replace('|', "\\|");
            args.push(format!(
                "[f=flv:onfail=ignore]{}|[f=mp4:movflags=+faststart+frag_keyframe+empty_moov]{}",
                rtmp, local_str
            ));
        }
        (Some(rtmp), None) => {
            args.push("-f".into());
            args.push("flv".into());
            args.push(rtmp);
        }
        (None, Some(local)) => {
            args.push("-movflags".into());
            args.push("+faststart+frag_keyframe+empty_moov".into());
            args.push("-f".into());
            args.push("mp4".into());
            args.push(local.to_string_lossy().to_string());
        }
        (None, None) => {
            // Nothing to write — caller mistake; emit to /dev/null equivalent.
            args.push("-f".into());
            args.push("null".into());
            args.push("-".into());
        }
    }

    args
}

/// Find the bundled FFmpeg binary (mirrors recording.rs::find_ffmpeg_path semantics).
fn find_ffmpeg_path() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let names: &[&str] = if cfg!(target_os = "windows") {
        &["ffmpeg.exe", "ffmpeg-x86_64-pc-windows-msvc.exe"]
    } else if cfg!(target_os = "macos") {
        &[
            "ffmpeg",
            "ffmpeg-aarch64-apple-darwin",
            "ffmpeg-x86_64-apple-darwin",
        ]
    } else {
        &["ffmpeg", "ffmpeg-x86_64-unknown-linux-gnu"]
    };
    for name in names {
        let p = dir.join(name);
        if p.exists() {
            return Some(p);
        }
        let p2 = dir.join("binaries").join(name);
        if p2.exists() {
            return Some(p2);
        }
    }
    // PATH fallback
    #[cfg(target_os = "windows")]
    {
        if let Ok(out) = std::process::Command::new("where").arg("ffmpeg").output() {
            if out.status.success() {
                if let Some(first) = String::from_utf8_lossy(&out.stdout).lines().next() {
                    let p = PathBuf::from(first.trim());
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(out) = std::process::Command::new("which").arg("ffmpeg").output() {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !s.is_empty() {
                    return Some(PathBuf::from(s));
                }
            }
        }
    }
    None
}

fn parse_stats_line(line: &str, stats: &mut LiveStats) -> bool {
    // FFmpeg progress lines look like:
    //   frame= 123 fps= 30 q=27.0 size=  234kB time=00:00:04.10 bitrate=4500.2kbits/s drop=0 dup=0 speed=1.0x
    let mut updated = false;
    for token in line.split_whitespace() {
        if let Some(rest) = token.strip_prefix("fps=") {
            if let Ok(v) = rest.parse::<f64>() {
                stats.fps = v;
                updated = true;
            }
        } else if let Some(rest) = token.strip_prefix("bitrate=") {
            let cleaned = rest.trim_end_matches("kbits/s");
            if let Ok(v) = cleaned.parse::<f64>() {
                stats.bitrate_kbps = v;
                updated = true;
            }
        } else if let Some(rest) = token.strip_prefix("drop=") {
            if let Ok(v) = rest.parse::<u64>() {
                stats.dropped_frames = v;
                updated = true;
            }
        } else if let Some(rest) = token.strip_prefix("dup=") {
            if let Ok(v) = rest.parse::<u64>() {
                stats.dup_frames = v;
                updated = true;
            }
        } else if let Some(rest) = token.strip_prefix("speed=") {
            let cleaned = rest.trim_end_matches('x');
            if let Ok(v) = cleaned.parse::<f64>() {
                stats.speed = v;
                updated = true;
            }
        } else if let Some(rest) = token.strip_prefix("time=") {
            if let Some(ms) = parse_time_to_ms(rest) {
                stats.elapsed_ms = ms;
                updated = true;
            }
        }
    }
    updated
}

fn parse_time_to_ms(s: &str) -> Option<i64> {
    // hh:mm:ss.xx
    let mut parts = s.split(':');
    let h: i64 = parts.next()?.parse().ok()?;
    let m: i64 = parts.next()?.parse().ok()?;
    let sec: f64 = parts.next()?.parse().ok()?;
    Some(h * 3_600_000 + m * 60_000 + (sec * 1000.0) as i64)
}

#[tauri::command]
pub async fn start_live_streaming(app: AppHandle, config: LiveConfig) -> AppResult<String> {
    let state_handle = app.state::<Mutex<AppState>>();
    {
        let st = state_handle.lock().unwrap();
        if st.live_ffmpeg_process.is_some() {
            return Err(AppError::General("Live stream already active".to_string()));
        }
    }

    let local_path = if config.save_local {
        Some(pick_local_path(&config))
    } else {
        None
    };

    let ffmpeg_path = find_ffmpeg_path()
        .ok_or_else(|| AppError::General("FFmpeg binary not found".to_string()))?;

    let args = build_ffmpeg_args(&config, local_path.as_ref());
    // Never log the command line: the RTMP target contains the user's stream
    // key. Keep only non-sensitive operational fields in diagnostics.
    log::info!(
        "[live] starting stream: fps={} bitrate_kbps={} remote={} save_local={}",
        config.framerate,
        config.video_bitrate_kbps,
        !config.rtmp_url.is_empty(),
        config.save_local
    );

    use std::process::{Command, Stdio};
    let mut cmd = Command::new(&ffmpeg_path);
    cmd.args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| AppError::General(format!("Failed to spawn FFmpeg: {}", e)))?;
    crate::process_containment::contain_owned_child(&child, "live-stream FFmpeg");

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| AppError::General("Failed to acquire FFmpeg stdin".into()))?;
    let stderr = child.stderr.take();

    // Channel for pushing chunks
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Vec<u8>>();

    // Stats handle (cloned into stderr thread)
    let stats_arc;
    let stop_flag;
    {
        let mut st = state_handle.lock().unwrap();
        st.live_stop_flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        stop_flag = st.live_stop_flag.clone();
        st.live_stats = std::sync::Arc::new(Mutex::new(LiveStats {
            connected: !config.rtmp_url.is_empty(),
            ..Default::default()
        }));
        stats_arc = st.live_stats.clone();
        st.live_local_path = local_path.clone();
        st.live_started_at_ms = Some(chrono::Utc::now().timestamp_millis());
    }

    // stdin pump task
    let stop_flag_pump = stop_flag.clone();
    tokio::spawn(async move {
        let mut stdin = stdin;
        while let Some(chunk) = rx.recv().await {
            if stop_flag_pump.load(Ordering::Relaxed) {
                break;
            }
            if let Err(e) = stdin.write_all(&chunk) {
                log::warn!("[live] stdin write failed: {}", e);
                break;
            }
        }
        // Closing stdin signals EOF to FFmpeg so it can flush.
        drop(stdin);
    });

    // stderr parser thread
    if let Some(mut err) = stderr {
        let app_for_stderr = app.clone();
        let stats_for_stderr = stats_arc.clone();
        let stop_for_stderr = stop_flag.clone();
        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(&mut err);
            for line in reader.lines().map_while(Result::ok) {
                if stop_for_stderr.load(Ordering::Relaxed) {
                    break;
                }
                let snapshot = {
                    let mut s = stats_for_stderr.lock().unwrap();
                    parse_stats_line(&line, &mut s);
                    s.clone()
                };
                // Throttle: emit once per second based on elapsed_ms tick
                let _ = app_for_stderr.emit("live-stats", &snapshot);
                if line.contains("error") || line.contains("Error") {
                    log::warn!("[live] {}", line);
                }
            }
            log::info!("[live] stderr stream ended");
        });
    }

    {
        let mut st = state_handle.lock().unwrap();
        st.live_stdin_tx = Some(tx);
        st.live_ffmpeg_process = Some(child);
    }

    let info = local_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    Ok(info)
}

#[tauri::command]
pub async fn push_live_frame(app: AppHandle, chunk: Vec<u8>) -> AppResult<()> {
    let state_handle = app.state::<Mutex<AppState>>();
    let tx = {
        let st = state_handle.lock().unwrap();
        st.live_stdin_tx.clone()
    };
    if let Some(tx) = tx {
        tx.send(chunk)
            .map_err(|_| AppError::General("Live stream stdin channel closed".to_string()))?;
        Ok(())
    } else {
        Err(AppError::General("Live stream not active".to_string()))
    }
}

#[tauri::command]
pub async fn stop_live_streaming(app: AppHandle) -> AppResult<serde_json::Value> {
    let state_handle = app.state::<Mutex<AppState>>();
    let (mut child_opt, stop_flag, local_path, started_at, final_stats) = {
        let mut st = state_handle.lock().unwrap();
        let child = st.live_ffmpeg_process.take();
        let stop = st.live_stop_flag.clone();
        let local = st.live_local_path.take();
        let started = st.live_started_at_ms.take();
        let stats = st.live_stats.lock().unwrap().clone();
        st.live_stdin_tx = None; // closes the channel → stdin pump drops stdin → FFmpeg flushes
        (child, stop, local, started, stats)
    };

    stop_flag.store(true, Ordering::Relaxed);

    if let Some(child) = child_opt.as_mut() {
        // Give FFmpeg a couple seconds to flush trailers (writes moov atom).
        for _ in 0..40 {
            match child.try_wait() {
                Ok(Some(_)) => break,
                Ok(None) => {
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                }
                Err(_) => break,
            }
        }
        // Hard kill if still running.
        if let Ok(None) = child.try_wait() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    let elapsed_ms = started_at
        .map(|t| chrono::Utc::now().timestamp_millis() - t)
        .unwrap_or(0);

    let summary = serde_json::json!({
        "localPath": local_path.as_ref().map(|p| p.to_string_lossy().to_string()),
        "elapsedMs": elapsed_ms,
        "fps": final_stats.fps,
        "bitrateKbps": final_stats.bitrate_kbps,
        "droppedFrames": final_stats.dropped_frames,
    });

    Ok(summary)
}

#[tauri::command]
pub async fn get_live_stats(app: AppHandle) -> AppResult<LiveStats> {
    let state_handle = app.state::<Mutex<AppState>>();
    let stats_arc = {
        let st = state_handle.lock().unwrap();
        st.live_stats.clone()
    };
    let stats = stats_arc.lock().unwrap().clone();
    Ok(stats)
}

/// Map a string like "Ctrl+Shift+Z" into a Tauri Shortcut.
fn parse_shortcut(spec: &str) -> Option<Shortcut> {
    let mut mods = Modifiers::empty();
    let mut key_code: Option<Code> = None;
    for part in spec.split('+') {
        let t = part.trim();
        match t.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => mods |= Modifiers::CONTROL,
            "shift" => mods |= Modifiers::SHIFT,
            "alt" | "option" => mods |= Modifiers::ALT,
            "meta" | "cmd" | "command" | "super" => mods |= Modifiers::SUPER,
            other => {
                key_code = match other {
                    "a" => Some(Code::KeyA),
                    "b" => Some(Code::KeyB),
                    "c" => Some(Code::KeyC),
                    "d" => Some(Code::KeyD),
                    "e" => Some(Code::KeyE),
                    "f" => Some(Code::KeyF),
                    "g" => Some(Code::KeyG),
                    "h" => Some(Code::KeyH),
                    "i" => Some(Code::KeyI),
                    "j" => Some(Code::KeyJ),
                    "k" => Some(Code::KeyK),
                    "l" => Some(Code::KeyL),
                    "m" => Some(Code::KeyM),
                    "n" => Some(Code::KeyN),
                    "o" => Some(Code::KeyO),
                    "p" => Some(Code::KeyP),
                    "q" => Some(Code::KeyQ),
                    "r" => Some(Code::KeyR),
                    "s" => Some(Code::KeyS),
                    "t" => Some(Code::KeyT),
                    "u" => Some(Code::KeyU),
                    "v" => Some(Code::KeyV),
                    "w" => Some(Code::KeyW),
                    "x" => Some(Code::KeyX),
                    "y" => Some(Code::KeyY),
                    "z" => Some(Code::KeyZ),
                    "f1" => Some(Code::F1),
                    "f2" => Some(Code::F2),
                    "f3" => Some(Code::F3),
                    "f4" => Some(Code::F4),
                    "f5" => Some(Code::F5),
                    "f6" => Some(Code::F6),
                    "f7" => Some(Code::F7),
                    "f8" => Some(Code::F8),
                    "f9" => Some(Code::F9),
                    "f10" => Some(Code::F10),
                    "f11" => Some(Code::F11),
                    "f12" => Some(Code::F12),
                    "space" => Some(Code::Space),
                    "tab" => Some(Code::Tab),
                    "esc" | "escape" => Some(Code::Escape),
                    _ => None,
                };
            }
        }
    }
    Some(Shortcut::new(Some(mods), key_code?))
}

#[tauri::command]
pub async fn register_live_zoom_hotkey(app: AppHandle, accelerator: String) -> AppResult<()> {
    // Unregister previous binding (if any)
    {
        let state_handle = app.state::<Mutex<AppState>>();
        let prev = {
            let mut st = state_handle.lock().unwrap();
            st.live_zoom_hotkey.replace(accelerator.clone())
        };
        if let Some(prev_spec) = prev {
            if let Some(prev_shortcut) = parse_shortcut(&prev_spec) {
                let _ = app.global_shortcut().unregister(prev_shortcut);
            }
        }
    }

    let shortcut = parse_shortcut(&accelerator)
        .ok_or_else(|| AppError::General(format!("Invalid hotkey: {}", accelerator)))?;

    let app_for_handler = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _sc, evt| {
            let event_name = match evt.state() {
                ShortcutState::Pressed => "live:zoom-pressed",
                ShortcutState::Released => "live:zoom-released",
            };
            let _ = app_for_handler.emit(event_name, ());
        })
        .map_err(|e| AppError::General(format!("Failed to register hotkey: {}", e)))?;

    Ok(())
}

/// Live snapshot of OS cursor position in screen pixels. Polled at ~60Hz from the compositor.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CursorSample {
    pub x: i32,
    pub y: i32,
    pub timestamp_ms: i64,
}

#[tauri::command]
pub async fn get_cursor_position(_app: AppHandle) -> AppResult<CursorSample> {
    let timestamp_ms = chrono::Utc::now().timestamp_millis();

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::POINT;
        use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
        let mut p = POINT { x: 0, y: 0 };
        unsafe {
            let _ = GetCursorPos(&mut p);
        }
        Ok(CursorSample {
            x: p.x,
            y: p.y,
            timestamp_ms,
        })
    }

    #[cfg(target_os = "macos")]
    {
        use core_graphics::event::CGEvent;
        use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
        if let Ok(source) = CGEventSource::new(CGEventSourceStateID::CombinedSessionState) {
            if let Ok(event) = CGEvent::new(source) {
                let loc = event.location();
                return Ok(CursorSample {
                    x: loc.x as i32,
                    y: loc.y as i32,
                    timestamp_ms,
                });
            }
        }
        return Ok(CursorSample {
            x: 0,
            y: 0,
            timestamp_ms,
        });
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(output) = std::process::Command::new("xdotool")
            .args(["getmouselocation", "--shell"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let mut x: i32 = 0;
            let mut y: i32 = 0;
            for line in stdout.lines() {
                if let Some(v) = line.strip_prefix("X=") {
                    x = v.parse().unwrap_or(0);
                } else if let Some(v) = line.strip_prefix("Y=") {
                    y = v.parse().unwrap_or(0);
                }
            }
            return Ok(CursorSample { x, y, timestamp_ms });
        }
        return Ok(CursorSample {
            x: 0,
            y: 0,
            timestamp_ms,
        });
    }
}

#[tauri::command]
pub async fn unregister_live_zoom_hotkey(app: AppHandle) -> AppResult<()> {
    let state_handle = app.state::<Mutex<AppState>>();
    let prev = {
        let mut st = state_handle.lock().unwrap();
        st.live_zoom_hotkey.take()
    };
    if let Some(spec) = prev {
        if let Some(shortcut) = parse_shortcut(&spec) {
            let _ = app.global_shortcut().unregister(shortcut);
        }
    }
    Ok(())
}
