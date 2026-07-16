use crate::error::{AppError, AppResult};
use crate::state::{AppState, LiveStats, LiveStreamCredential};
use serde::Deserialize;
use std::io::Write;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::path::Path;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const LIVE_FRAME_CHANNEL_CAPACITY: usize = 8;
const MAX_LIVE_FRAME_CHUNK_BYTES: usize = 4 * 1024 * 1024;
const MAX_RTMP_URL_BYTES: usize = 2 * 1024;
const MAX_STREAM_KEY_BYTES: usize = 2 * 1024;

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LiveConfig {
    /// Full RTMP/RTMPS endpoint to stream to. May be empty if user only wants local.
    #[serde(default)]
    pub rtmp_url: String,
    /// Session-only stream key supplied from backend memory, never renderer config.
    #[serde(skip)]
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
}

fn invalid_tee_text(value: &str) -> bool {
    value.chars().any(|character| {
        character.is_control()
            || character.is_whitespace()
            || matches!(character, '|' | '[' | ']' | '\\' | '\'')
    })
}

fn is_non_public_ipv4(address: Ipv4Addr) -> bool {
    let [a, b, c, _] = address.octets();
    a == 0
        || a == 10
        || a == 127
        || (a == 100 && (64..=127).contains(&b))
        || (a == 169 && b == 254)
        || (a == 172 && (16..=31).contains(&b))
        || (a == 192 && b == 0 && c == 0)
        || (a == 192 && b == 0 && c == 2)
        || (a == 192 && b == 168)
        || (a == 198 && (b == 18 || b == 19))
        || (a == 198 && b == 51 && c == 100)
        || (a == 203 && b == 0 && c == 113)
        || a >= 224
}

fn embedded_ipv4(address: Ipv6Addr) -> Option<Ipv4Addr> {
    let segments = address.segments();
    let compatible =
        segments[..6] == [0, 0, 0, 0, 0, 0] || segments[..6] == [0, 0, 0, 0, 0, 0xffff];
    if compatible {
        return Some(Ipv4Addr::new(
            (segments[6] >> 8) as u8,
            segments[6] as u8,
            (segments[7] >> 8) as u8,
            segments[7] as u8,
        ));
    }

    None
}

fn is_non_public_ipv6(address: Ipv6Addr) -> bool {
    let segments = address.segments();
    address.is_unspecified()
        || address.is_loopback()
        || (segments[0] & 0xfe00) == 0xfc00 // unique-local fc00::/7
        || (segments[0] & 0xffc0) == 0xfe80 // link-local fe80::/10
        || (segments[0] & 0xffc0) == 0xfec0 // deprecated site-local fec0::/10
        || (segments[0] & 0xff00) == 0xff00 // multicast ff00::/8
        || (segments[0] == 0x2001 && segments[1] == 0x0db8) // documentation
        || (segments[0] == 0x2001 && segments[1] == 0) // Teredo
        || segments[0] == 0x2002 // 6to4 can encode private IPv4 destinations
        || (segments[0] == 0x0064 && segments[1] == 0xff9b) // NAT64 prefixes
        || embedded_ipv4(address).is_some_and(is_non_public_ipv4)
}

fn validate_public_rtmp_host(host: &str) -> AppResult<()> {
    let normalized = host
        .trim_start_matches('[')
        .trim_end_matches(']')
        .trim_end_matches('.')
        .to_ascii_lowercase();

    if normalized.is_empty() {
        return Err(AppError::General(
            "RTMP URL must include a public host".to_string(),
        ));
    }

    if let Ok(address) = normalized.parse::<IpAddr>() {
        let non_public = match address {
            IpAddr::V4(address) => is_non_public_ipv4(address),
            IpAddr::V6(address) => is_non_public_ipv6(address),
        };
        if non_public {
            return Err(AppError::General(
                "RTMP URL must not target a local or private address".to_string(),
            ));
        }
        return Ok(());
    }

    let local_name = !normalized.contains('.')
        || normalized == "localhost"
        || normalized.ends_with(".localhost")
        || normalized.ends_with(".local")
        || normalized.ends_with(".localdomain")
        || normalized.ends_with(".internal")
        || normalized.ends_with(".home")
        || normalized.ends_with(".lan")
        || normalized.ends_with(".test")
        || normalized.ends_with(".invalid");
    if local_name {
        return Err(AppError::General(
            "RTMP URL must use a public fully qualified host".to_string(),
        ));
    }

    Ok(())
}

fn parse_public_rtmp_url(raw: &str) -> AppResult<reqwest::Url> {
    if raw.is_empty()
        || raw.len() > MAX_RTMP_URL_BYTES
        || raw.trim() != raw
        || invalid_tee_text(raw)
    {
        return Err(AppError::General("Invalid RTMP URL".to_string()));
    }

    let url =
        reqwest::Url::parse(raw).map_err(|_| AppError::General("Invalid RTMP URL".to_string()))?;
    if !matches!(url.scheme(), "rtmp" | "rtmps") {
        return Err(AppError::General(
            "Only RTMP and RTMPS destinations are allowed".to_string(),
        ));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(AppError::General(
            "RTMP URL credentials are not allowed".to_string(),
        ));
    }
    if url.fragment().is_some() || url.port() == Some(0) {
        return Err(AppError::General("Invalid RTMP URL".to_string()));
    }
    validate_public_rtmp_host(
        url.host_str()
            .ok_or_else(|| AppError::General("RTMP URL must include a public host".to_string()))?,
    )?;

    Ok(url)
}

fn validate_live_stream_key(stream_key: &str) -> AppResult<()> {
    if stream_key.len() > MAX_STREAM_KEY_BYTES
        || invalid_tee_text(stream_key)
        || stream_key.contains('#')
    {
        return Err(AppError::General("Invalid stream key".to_string()));
    }
    Ok(())
}

fn canonical_rtmp_base(raw: &str) -> AppResult<String> {
    let url = parse_public_rtmp_url(raw)?;
    if url.query().is_some() {
        return Err(AppError::General(
            "RTMP base URL cannot contain a query when a stream key is supplied".to_string(),
        ));
    }
    Ok(url.as_str().trim_end_matches('/').to_string())
}

fn bind_live_stream_credential(
    rtmp_url: &str,
    stream_key: String,
) -> AppResult<Option<LiveStreamCredential>> {
    validate_live_stream_key(&stream_key)?;
    if stream_key.is_empty() {
        return Ok(None);
    }

    Ok(Some(LiveStreamCredential {
        canonical_rtmp_url: canonical_rtmp_base(rtmp_url)?,
        stream_key,
    }))
}

fn apply_live_stream_credential(
    config: &mut LiveConfig,
    credential: Option<&LiveStreamCredential>,
) -> AppResult<()> {
    config.stream_key.clear();
    let Some(credential) = credential else {
        return Ok(());
    };

    let requested = canonical_rtmp_base(&config.rtmp_url)?;
    if requested != credential.canonical_rtmp_url {
        return Err(AppError::General(
            "Configured stream key is bound to a different RTMP destination".to_string(),
        ));
    }

    // Use only the canonical destination retained with the credential. The renderer value is
    // checked for an exact match above but never remains authoritative once a key is attached.
    config.rtmp_url = credential.canonical_rtmp_url.clone();
    config.stream_key = credential.stream_key.clone();
    Ok(())
}

fn validated_rtmp_target(config: &LiveConfig) -> AppResult<Option<String>> {
    if !(500..=50_000).contains(&config.video_bitrate_kbps) {
        return Err(AppError::General(
            "Live video bitrate must be between 500 and 50000 kbps".to_string(),
        ));
    }
    if !(1..=120).contains(&config.framerate) {
        return Err(AppError::General(
            "Live framerate must be between 1 and 120 fps".to_string(),
        ));
    }
    if config.width == 0 || config.height == 0 || config.width > 16_384 || config.height > 16_384 {
        return Err(AppError::General(
            "Invalid live-stream dimensions".to_string(),
        ));
    }

    if config.rtmp_url.is_empty() {
        if !config.stream_key.is_empty() {
            return Err(AppError::General(
                "A stream key requires an RTMP URL".to_string(),
            ));
        }
        if !config.save_local {
            return Err(AppError::General(
                "Live streaming requires a remote or local output".to_string(),
            ));
        }
        return Ok(None);
    }

    validate_live_stream_key(&config.stream_key)?;

    let base = parse_public_rtmp_url(&config.rtmp_url)?;
    let target = if config.stream_key.is_empty() {
        base.to_string()
    } else {
        if base.query().is_some() {
            return Err(AppError::General(
                "RTMP base URL cannot contain a query when a stream key is supplied".to_string(),
            ));
        }
        format!(
            "{}/{}",
            base.as_str().trim_end_matches('/'),
            config.stream_key
        )
    };

    // Parse the composed target again so stream-key query syntax cannot change the host or scheme.
    let composed = parse_public_rtmp_url(&target)?;
    if composed.scheme() != base.scheme()
        || composed.host_str() != base.host_str()
        || composed.port_or_known_default() != base.port_or_known_default()
    {
        return Err(AppError::General("Invalid stream destination".to_string()));
    }

    Ok(Some(composed.to_string()))
}

fn pick_local_path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .video_dir()
        .map_err(|error| AppError::General(format!("Unable to locate Videos folder: {error}")))?
        .join("Flowtake");
    std::fs::create_dir_all(&dir)?;
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    Ok(dir.join(format!(
        "Flowtake-Live-{}-{}.mp4",
        stamp,
        uuid::Uuid::new_v4().simple()
    )))
}

fn local_file_url(path: &Path) -> AppResult<String> {
    let mut url = reqwest::Url::from_file_path(path)
        .map_err(|_| AppError::General("Invalid local live-stream output path".to_string()))?
        .to_string();
    // FFmpeg's tee muxer treats these characters as its own grammar. Percent-encode them so
    // the derived local path contributes data only and cannot add or alter a slave output.
    for (character, encoding) in [
        ("\\", "%5C"),
        ("'", "%27"),
        ("|", "%7C"),
        ("[", "%5B"),
        ("]", "%5D"),
    ] {
        url = url.replace(character, encoding);
    }
    Ok(url)
}

fn tee_output_spec(remote: &str, local: &Path) -> AppResult<String> {
    // The remote target has already passed `parse_public_rtmp_url`; keep the check next to
    // interpolation as a defense against future call sites bypassing validation.
    parse_public_rtmp_url(remote)?;
    let local = local_file_url(local)?;
    Ok(format!(
        "[f=flv:onfail=ignore]{}|[f=mp4:movflags=+faststart+frag_keyframe+empty_moov]{}",
        remote, local
    ))
}

fn validate_live_frame_chunk(chunk: &[u8]) -> AppResult<()> {
    validate_live_frame_chunk_size(chunk.len())
}

fn validate_live_frame_chunk_size(size: usize) -> AppResult<()> {
    if size == 0 {
        return Err(AppError::General("Live frame chunk is empty".to_string()));
    }
    if size > MAX_LIVE_FRAME_CHUNK_BYTES {
        return Err(AppError::General(format!(
            "Live frame chunk exceeds the {} byte limit",
            MAX_LIVE_FRAME_CHUNK_BYTES
        )));
    }
    Ok(())
}

fn build_ffmpeg_args(
    config: &LiveConfig,
    rtmp_target: Option<&str>,
    local_path: Option<&Path>,
) -> AppResult<Vec<String>> {
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
    args.push(format!(
        "{}k",
        config
            .video_bitrate_kbps
            .checked_mul(2)
            .ok_or_else(|| AppError::General("Live video bitrate is too large".to_string()))?
    ));
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
            args.push(tee_output_spec(rtmp, local)?);
        }
        (Some(rtmp), None) => {
            args.push("-f".into());
            args.push("flv".into());
            args.push(rtmp.to_string());
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

    Ok(args)
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
pub async fn set_live_stream_key(
    app: AppHandle,
    rtmp_url: String,
    stream_key: String,
) -> AppResult<()> {
    let credential = bind_live_stream_credential(&rtmp_url, stream_key)?;
    let state_handle = app.state::<Mutex<AppState>>();
    let mut state = state_handle.lock().unwrap();
    state.live_stream_credential = credential;
    Ok(())
}

#[tauri::command]
pub async fn has_live_stream_key(app: AppHandle) -> AppResult<bool> {
    let state_handle = app.state::<Mutex<AppState>>();
    let state = state_handle.lock().unwrap();
    Ok(state.live_stream_credential.is_some())
}

#[tauri::command]
pub async fn start_live_streaming(app: AppHandle, mut config: LiveConfig) -> AppResult<String> {
    let state_handle = app.state::<Mutex<AppState>>();
    let start_lock = {
        let st = state_handle.lock().unwrap();
        st.live_stream_start_lock.clone()
    };

    // Hold this reservation from the active-process check through publishing
    // the new child. A concurrent Start waits, then observes the published
    // process instead of spawning and overwriting it.
    let _start_guard = start_lock.lock().await;
    {
        let st = state_handle.lock().unwrap();
        if st.live_ffmpeg_process.is_some() {
            return Err(AppError::General("Live stream already active".to_string()));
        }
        apply_live_stream_credential(&mut config, st.live_stream_credential.as_ref())?;
    }

    let rtmp_target = validated_rtmp_target(&config)?;
    let local_path = if config.save_local {
        Some(pick_local_path(&app)?)
    } else {
        None
    };

    let ffmpeg_path = find_ffmpeg_path()
        .ok_or_else(|| AppError::General("FFmpeg binary not found".to_string()))?;

    let args = build_ffmpeg_args(&config, rtmp_target.as_deref(), local_path.as_deref())?;
    // Never log the command line: the RTMP target contains the user's stream
    // key. Keep only non-sensitive operational fields in diagnostics.
    log::info!(
        "[live] starting stream: fps={} bitrate_kbps={} remote={} save_local={}",
        config.framerate,
        config.video_bitrate_kbps,
        rtmp_target.is_some(),
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

    // Bound queued media so a stalled FFmpeg process cannot grow memory without limit.
    let (tx, mut rx) = tokio::sync::mpsc::channel::<Vec<u8>>(LIVE_FRAME_CHANNEL_CAPACITY);

    // Stats handle (cloned into stderr thread)
    let stats_arc;
    let stop_flag;
    {
        let mut st = state_handle.lock().unwrap();
        st.live_stop_flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        stop_flag = st.live_stop_flag.clone();
        st.live_stats = std::sync::Arc::new(Mutex::new(LiveStats {
            connected: rtmp_target.is_some(),
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
            let mut reported_error = false;
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
                if !reported_error && (line.contains("error") || line.contains("Error")) {
                    // FFmpeg commonly echoes its output URL in diagnostics. That URL contains
                    // the stream key, so never forward raw stderr into application logs.
                    log::warn!(
                        "[live] FFmpeg reported a streaming error; sensitive details suppressed"
                    );
                    reported_error = true;
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
    validate_live_frame_chunk(&chunk)?;
    let state_handle = app.state::<Mutex<AppState>>();
    let tx = {
        let st = state_handle.lock().unwrap();
        st.live_stdin_tx.clone()
    };
    if let Some(tx) = tx {
        match tx.try_send(chunk) {
            Ok(()) => Ok(()),
            Err(tokio::sync::mpsc::error::TrySendError::Full(_)) => Err(AppError::General(
                "Live stream input is busy; retry the frame chunk".to_string(),
            )),
            Err(tokio::sync::mpsc::error::TrySendError::Closed(_)) => Err(AppError::General(
                "Live stream stdin channel closed".to_string(),
            )),
        }
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
        Ok(CursorSample {
            x: 0,
            y: 0,
            timestamp_ms,
        })
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
        Ok(CursorSample {
            x: 0,
            y: 0,
            timestamp_ms,
        })
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

#[cfg(test)]
mod security_tests {
    use super::*;

    fn config(rtmp_url: &str, stream_key: &str) -> LiveConfig {
        LiveConfig {
            rtmp_url: rtmp_url.to_string(),
            stream_key: stream_key.to_string(),
            video_bitrate_kbps: 6_000,
            width: 1_920,
            height: 1_080,
            framerate: 30,
            save_local: true,
        }
    }

    #[test]
    fn public_rtmp_target_is_validated_and_composed() {
        let target = validated_rtmp_target(&config(
            "rtmps://live-api-s.facebook.com:443/rtmp/",
            "stream-key?backup=1",
        ))
        .unwrap()
        .unwrap();

        assert_eq!(
            target,
            "rtmps://live-api-s.facebook.com:443/rtmp/stream-key?backup=1"
        );
        assert!(validated_rtmp_target(&config("rtmp://8.8.8.8/live", "key")).is_ok());
    }

    #[test]
    fn non_rtmp_credentials_and_tee_injection_are_rejected() {
        for (url, key) in [
            ("file:///tmp/output.flv", "key"),
            ("https://public.example.com/live", "key"),
            ("rtmp://user:secret@public.example.com/live", "key"),
            ("rtmp://public.example.com/live|file:///tmp/pwn", "key"),
            ("rtmp://public.example.com/live", "key|[f=mp4]/tmp/pwn"),
            ("rtmp://public.example.com/live", "key\\|file:///tmp/pwn"),
            ("rtmp://public.example.com/live\n", "key"),
        ] {
            assert!(
                validated_rtmp_target(&config(url, key)).is_err(),
                "accepted unsafe destination"
            );
        }
    }

    #[test]
    fn local_private_and_ambiguous_hosts_are_rejected() {
        for url in [
            "rtmp://127.0.0.1/live",
            "rtmp://2130706433/live",
            "rtmp://10.0.0.1/live",
            "rtmp://169.254.169.254/live",
            "rtmp://192.168.1.1/live",
            "rtmp://[::1]/live",
            "rtmp://[::ffff:127.0.0.1]/live",
            "rtmp://localhost/live",
            "rtmp://encoder.internal/live",
            "rtmp://singlelabel/live",
        ] {
            assert!(
                validated_rtmp_target(&config(url, "key")).is_err(),
                "accepted non-public host"
            );
        }
    }

    #[test]
    fn renderer_local_dir_and_stream_key_fields_are_ignored() {
        let parsed: LiveConfig = serde_json::from_value(serde_json::json!({
            "rtmpUrl": "rtmp://public.example.com/live",
            "streamKey": "key",
            "videoBitrateKbps": 6000,
            "width": 1920,
            "height": 1080,
            "framerate": 30,
            "saveLocal": true,
            "localDir": "C:\\Windows\\System32"
        }))
        .unwrap();

        assert!(parsed.stream_key.is_empty());
        assert!(validated_rtmp_target(&parsed).is_ok());
    }

    #[test]
    fn session_stream_keys_reject_tee_and_url_syntax() {
        assert!(validate_live_stream_key("normal-stream-key_123").is_ok());
        for invalid in [
            "key|file:///tmp/pwn",
            "key[bad]",
            "key with space",
            "key#fragment",
        ] {
            assert!(validate_live_stream_key(invalid).is_err());
        }
    }

    #[test]
    fn session_stream_keys_are_bound_to_one_canonical_destination() {
        let credential = bind_live_stream_credential(
            "rtmps://live-api-s.facebook.com:443/rtmp/",
            "session-secret".to_string(),
        )
        .unwrap()
        .unwrap();
        assert_eq!(
            credential.canonical_rtmp_url,
            "rtmps://live-api-s.facebook.com:443/rtmp"
        );

        let mut matching = config("rtmps://live-api-s.facebook.com:443/rtmp", "renderer-value");
        apply_live_stream_credential(&mut matching, Some(&credential)).unwrap();
        assert_eq!(matching.rtmp_url, credential.canonical_rtmp_url);
        assert_eq!(matching.stream_key, "session-secret");

        let mut attacker = config("rtmp://attacker.example.com/live", "renderer-value");
        assert!(apply_live_stream_credential(&mut attacker, Some(&credential)).is_err());
        assert!(attacker.stream_key.is_empty());
    }

    #[test]
    fn tee_local_path_is_encoded_as_one_slave_target() {
        let local = std::env::temp_dir()
            .join("Flow|take[security]'")
            .join("output.mp4");
        let spec = tee_output_spec("rtmp://public.example.com/live/key", &local).unwrap();
        assert_eq!(spec.matches('|').count(), 1);

        let local_slave = spec.split_once('|').unwrap().1;
        let local_target = local_slave.rsplit_once(']').unwrap().1;
        assert!(local_target.starts_with("file:"));
        assert!(local_target.contains("%7C"));
        assert!(local_target.contains("%5B"));
        assert!(local_target.contains("%5D"));
        assert!(local_target.contains("%27"));
        assert!(!local_target
            .chars()
            .any(|character| matches!(character, '|' | '[' | ']' | '\\' | '\'')));
    }

    #[test]
    fn frame_chunks_and_numeric_limits_are_bounded() {
        assert!(validate_live_frame_chunk_size(0).is_err());
        assert!(validate_live_frame_chunk_size(MAX_LIVE_FRAME_CHUNK_BYTES).is_ok());
        assert!(validate_live_frame_chunk_size(MAX_LIVE_FRAME_CHUNK_BYTES + 1).is_err());

        let mut invalid = config("rtmp://public.example.com/live", "key");
        invalid.video_bitrate_kbps = u32::MAX;
        assert!(validated_rtmp_target(&invalid).is_err());
        invalid.video_bitrate_kbps = 6_000;
        invalid.framerate = 0;
        assert!(validated_rtmp_target(&invalid).is_err());
    }

    #[tokio::test]
    async fn live_stream_start_lock_serializes_the_spawn_boundary() {
        let state = AppState::new();
        let start_lock = state.live_stream_start_lock.clone();

        let first_start = start_lock.lock().await;
        assert!(
            start_lock.try_lock().is_err(),
            "a concurrent Start must not enter the FFmpeg spawn boundary"
        );

        drop(first_start);
        assert!(
            start_lock.try_lock().is_ok(),
            "a failed or completed Start must release the reservation"
        );
    }
}
