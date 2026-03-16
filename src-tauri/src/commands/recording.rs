use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde_json::Value;
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

#[tauri::command]
pub async fn get_camera_mic_config(app: AppHandle) -> AppResult<Value> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    // Return the config that was stored during init_recording
    Ok(state
        .camera_mic_config
        .clone()
        .unwrap_or(serde_json::json!({
            "cameraDeviceId": null,
            "microphoneDeviceId": null
        })))
}

/// Find the FFmpeg binary path (for std::process::Command usage)
fn find_ffmpeg_path() -> Option<std::path::PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;

    // Try sidecar name with target triple
    let sidecar = dir.join("ffmpeg-x86_64-pc-windows-msvc.exe");
    if sidecar.exists() {
        return Some(sidecar);
    }

    // Try plain name
    let plain = dir.join("ffmpeg.exe");
    if plain.exists() {
        return Some(plain);
    }

    // Try binaries subdirectory (dev mode)
    let binaries = dir.join("binaries").join("ffmpeg-x86_64-pc-windows-msvc.exe");
    if binaries.exists() {
        return Some(binaries);
    }

    None
}

/// Capture a single window frame using PrintWindow API.
/// Returns raw BGRA pixel data. Only the window's own content is captured,
/// excluding any overlapping windows (DWM composited).
#[cfg(target_os = "windows")]
fn capture_window_frame(hwnd_raw: isize, width: i32, height: i32) -> Option<Vec<u8>> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::*;
    use windows::Win32::Storage::Xps::{PrintWindow, PRINT_WINDOW_FLAGS};

    unsafe {
        let hwnd = HWND(hwnd_raw as *mut _);
        let hdc_window = GetDC(hwnd);
        if hdc_window.is_invalid() {
            return None;
        }

        let hdc_mem = CreateCompatibleDC(hdc_window);
        let hbmp = CreateCompatibleBitmap(hdc_window, width, height);
        let old_obj = SelectObject(hdc_mem, hbmp);

        // PW_RENDERFULLCONTENT = 2 - captures full content including DirectX/Aero effects
        let success = PrintWindow(hwnd, hdc_mem, PRINT_WINDOW_FLAGS(2));

        if !success.as_bool() {
            // Fallback to BitBlt from window DC (works for most GDI windows)
            let _ = BitBlt(hdc_mem, 0, 0, width, height, hdc_window, 0, 0, SRCCOPY);
        }

        // Extract bitmap data as BGRA (top-down)
        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height, // negative = top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0 as u32,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default()],
        };

        let buf_size = (width * height * 4) as usize;
        let mut buffer = vec![0u8; buf_size];
        GetDIBits(
            hdc_mem,
            hbmp,
            0,
            height as u32,
            Some(buffer.as_mut_ptr() as *mut _),
            &mut { bmi },
            DIB_RGB_COLORS,
        );

        // Cleanup
        SelectObject(hdc_mem, old_obj);
        let _ = DeleteObject(hbmp);
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(hwnd, hdc_window);

        Some(buffer)
    }
}

/// Capture loop for window recording. Runs in a dedicated thread.
/// Captures frames using PrintWindow at ~30fps and writes raw BGRA to FFmpeg stdin.
#[cfg(target_os = "windows")]
fn window_capture_loop(
    hwnd: isize,
    width: i32,
    height: i32,
    mut stdin: std::process::ChildStdin,
    stop_flag: std::sync::Arc<std::sync::atomic::AtomicBool>,
) {
    use std::io::Write;

    let frame_duration = std::time::Duration::from_nanos(1_000_000_000 / 30); // ~33ms for 30fps

    log::info!(
        "[capture_loop] Starting window capture: hwnd={} {}x{}",
        hwnd, width, height
    );

    while !stop_flag.load(Ordering::Relaxed) {
        let start = std::time::Instant::now();

        if let Some(frame) = capture_window_frame(hwnd, width, height) {
            if stdin.write_all(&frame).is_err() {
                log::warn!("[capture_loop] FFmpeg stdin pipe broken, stopping");
                break;
            }
        } else {
            // Window might be minimized or closed, write a black frame
            let black_frame = vec![0u8; (width * height * 4) as usize];
            if stdin.write_all(&black_frame).is_err() {
                break;
            }
        }

        let elapsed = start.elapsed();
        if elapsed < frame_duration {
            std::thread::sleep(frame_duration - elapsed);
        }
    }

    // stdin is dropped here, sending EOF to FFmpeg
    log::info!("[capture_loop] Window capture stopped");
}

/// Take a single screenshot of a window using PrintWindow API.
/// Returns PNG data as base64 data URL.
#[cfg(target_os = "windows")]
fn screenshot_window_printwindow(hwnd_raw: isize, width: i32, height: i32) -> Option<Vec<u8>> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::*;
    use windows::Win32::Storage::Xps::{PrintWindow, PRINT_WINDOW_FLAGS};

    unsafe {
        let hwnd = HWND(hwnd_raw as *mut _);
        let hdc_window = GetDC(hwnd);
        if hdc_window.is_invalid() {
            return None;
        }

        let hdc_mem = CreateCompatibleDC(hdc_window);
        let hbmp = CreateCompatibleBitmap(hdc_window, width, height);
        let old_obj = SelectObject(hdc_mem, hbmp);

        let success = PrintWindow(hwnd, hdc_mem, PRINT_WINDOW_FLAGS(2));
        if !success.as_bool() {
            let _ = BitBlt(hdc_mem, 0, 0, width, height, hdc_window, 0, 0, SRCCOPY);
        }

        // Extract as BMP-style BGRA data (top-down)
        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0 as u32,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default()],
        };

        let buf_size = (width * height * 4) as usize;
        let mut buffer = vec![0u8; buf_size];
        GetDIBits(
            hdc_mem,
            hbmp,
            0,
            height as u32,
            Some(buffer.as_mut_ptr() as *mut _),
            &mut { bmi },
            DIB_RGB_COLORS,
        );

        SelectObject(hdc_mem, old_obj);
        let _ = DeleteObject(hbmp);
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(hwnd, hdc_window);

        // Convert BGRA to BMP file format for encoding
        // Build a simple BMP file in memory
        let file_size = 54 + buf_size; // header + data
        let mut bmp = Vec::with_capacity(file_size);

        // BMP file header (14 bytes)
        bmp.extend_from_slice(b"BM");
        bmp.extend_from_slice(&(file_size as u32).to_le_bytes());
        bmp.extend_from_slice(&0u16.to_le_bytes()); // reserved
        bmp.extend_from_slice(&0u16.to_le_bytes()); // reserved
        bmp.extend_from_slice(&54u32.to_le_bytes()); // pixel data offset

        // DIB header (40 bytes)
        bmp.extend_from_slice(&40u32.to_le_bytes()); // header size
        bmp.extend_from_slice(&(width as i32).to_le_bytes());
        bmp.extend_from_slice(&(-(height as i32)).to_le_bytes()); // top-down
        bmp.extend_from_slice(&1u16.to_le_bytes()); // planes
        bmp.extend_from_slice(&32u16.to_le_bytes()); // bits per pixel
        bmp.extend_from_slice(&0u32.to_le_bytes()); // compression (BI_RGB)
        bmp.extend_from_slice(&(buf_size as u32).to_le_bytes());
        bmp.extend_from_slice(&0i32.to_le_bytes()); // x pixels per meter
        bmp.extend_from_slice(&0i32.to_le_bytes()); // y pixels per meter
        bmp.extend_from_slice(&0u32.to_le_bytes()); // colors used
        bmp.extend_from_slice(&0u32.to_le_bytes()); // important colors

        // Pixel data
        bmp.extend_from_slice(&buffer);

        Some(bmp)
    }
}

#[tauri::command]
pub async fn init_recording(
    app: AppHandle,
    source: Value,
    camera_mic_config: Value,
    system_audio: Value,
) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();

    // Create new recording ID and project temp dir
    let recording_id = format!("recording-{}", uuid::Uuid::new_v4());
    let project_id = uuid::Uuid::new_v4().to_string();

    {
        let mut state = state.lock().unwrap();
        state.is_recording = true;
        state.project_id = Some(project_id.clone());
        state.recording_id = Some(recording_id.clone());
        state.camera_mic_config = Some(camera_mic_config.clone());

        let temp_dir = state.project_temp_dir(&recording_id);
        std::fs::create_dir_all(&temp_dir)?;
    }

    // Build FFmpeg args for screen capture
    let screen_video_path = {
        let state = state.lock().unwrap();
        state
            .project_temp_dir(&recording_id)
            .join("screen.mp4")
            .to_string_lossy()
            .to_string()
    };

    let source_type = source
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("screen");

    // For window capture, we use a custom PrintWindow pipeline instead of gdigrab
    let is_window_capture = source_type == "window";

    let mut ffmpeg_args: Vec<String> = Vec::new();
    let (recording_offset_x, recording_offset_y): (i64, i64);

    if is_window_capture {
        // Window capture: build rawvideo FFmpeg args (stdin pipe input)
        let x = source.get("x").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
        let y = source.get("y").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
        let w = source.get("width").and_then(|v| v.as_i64()).unwrap_or(1920);
        let h = source.get("height").and_then(|v| v.as_i64()).unwrap_or(1080);
        let w = (w - (w % 2)).max(2);
        let h = (h - (h % 2)).max(2);
        let hwnd_str = source
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("0")
            .to_string();

        log::info!(
            "[recording] window PrintWindow capture: hwnd={} x={} y={} w={} h={}",
            hwnd_str, x, y, w, h
        );

        // FFmpeg reads raw BGRA frames from stdin pipe
        ffmpeg_args = vec![
            "-y".to_string(),
            "-f".to_string(),
            "rawvideo".to_string(),
            "-pixel_format".to_string(),
            "bgra".to_string(),
            "-video_size".to_string(),
            format!("{}x{}", w, h),
            "-framerate".to_string(),
            "30".to_string(),
            "-i".to_string(),
            "pipe:0".to_string(),
        ];

        recording_offset_x = x;
        recording_offset_y = y;
    } else {
        // Screen/Area: use gdigrab (existing approach)
        ffmpeg_args.extend([
            "-y".to_string(),
            "-f".to_string(),
            "gdigrab".to_string(),
            "-framerate".to_string(),
            "30".to_string(),
        ]);

        // Get screen dimensions in logical pixels for area percentage conversion
        // gdigrab operates in DPI-unaware (logical) coordinate space
        let (screen_w, screen_h) = if let Some(main_win) = app.get_webview_window("main") {
            if let Ok(Some(monitor)) = main_win.current_monitor() {
                let size = monitor.size();
                let scale = monitor.scale_factor();
                (size.width as f64 / scale, size.height as f64 / scale)
            } else {
                (1920.0, 1080.0)
            }
        } else {
            (1920.0, 1080.0)
        };

        let (ox, oy) = match source_type {
            "area" => {
                let x_pct = source.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let y_pct = source.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let w_pct = source.get("width").and_then(|v| v.as_f64()).unwrap_or(100.0);
                let h_pct = source.get("height").and_then(|v| v.as_f64()).unwrap_or(100.0);

                let x = (x_pct / 100.0 * screen_w) as i64;
                let y = (y_pct / 100.0 * screen_h) as i64;
                let width = ((w_pct / 100.0 * screen_w) as i64).max(2);
                let height = ((h_pct / 100.0 * screen_h) as i64).max(2);
                let width = width - (width % 2);
                let height = height - (height % 2);

                ffmpeg_args.extend([
                    "-draw_mouse".to_string(),
                    "0".to_string(),
                    "-offset_x".to_string(),
                    x.to_string(),
                    "-offset_y".to_string(),
                    y.to_string(),
                    "-video_size".to_string(),
                    format!("{}x{}", width, height),
                    "-i".to_string(),
                    "desktop".to_string(),
                ]);
                (x, y)
            }
            _ => {
                // Screen capture - supports specific monitor selection
                let monitor_x = source
                    .get("monitorX")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                let monitor_y = source
                    .get("monitorY")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                let monitor_w = source.get("monitorWidth").and_then(|v| v.as_i64());
                let monitor_h = source.get("monitorHeight").and_then(|v| v.as_i64());

                ffmpeg_args.push("-draw_mouse".to_string());
                ffmpeg_args.push("0".to_string());

                if let (Some(w), Some(h)) = (monitor_w, monitor_h) {
                    let w = (w - (w % 2)).max(2);
                    let h = (h - (h % 2)).max(2);
                    log::info!(
                        "[recording] monitor capture: x={} y={} w={} h={}",
                        monitor_x, monitor_y, w, h
                    );
                    ffmpeg_args.extend([
                        "-offset_x".to_string(),
                        monitor_x.to_string(),
                        "-offset_y".to_string(),
                        monitor_y.to_string(),
                        "-video_size".to_string(),
                        format!("{}x{}", w, h),
                    ]);
                }

                ffmpeg_args.extend(["-i".to_string(), "desktop".to_string()]);
                (monitor_x, monitor_y)
            }
        };

        recording_offset_x = ox;
        recording_offset_y = oy;
    }

    // Add system audio capture if requested (only for gdigrab mode)
    if !is_window_capture {
        let has_system_audio = match &system_audio {
            Value::String(s) if !s.is_empty() => true,
            Value::Bool(b) => *b,
            _ => false,
        };
        if has_system_audio {
            let audio_device = match &system_audio {
                Value::String(s) => s.clone(),
                _ => "virtual-audio-capturer".to_string(),
            };
            ffmpeg_args.extend([
                "-f".to_string(),
                "dshow".to_string(),
                "-i".to_string(),
                format!("audio={}", audio_device),
            ]);
        }
    }

    // Output settings
    ffmpeg_args.extend([
        "-c:v".to_string(),
        "libx264".to_string(),
        "-crf".to_string(),
        "25".to_string(),
        "-preset".to_string(),
        "ultrafast".to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        screen_video_path,
    ]);

    // Store config for start_recording
    {
        let mut state = state.lock().unwrap();
        let source_name = source
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Recording")
            .to_string();

        let mut config = serde_json::json!({
            "videoTrack": camera_mic_config.get("videoTrack"),
            "audioTrack": camera_mic_config.get("audioTrack"),
            "constraints": camera_mic_config.get("constraints"),
            "ffmpegArgs": ffmpeg_args,
            "sourceName": source_name,
            "recordingOffsetX": recording_offset_x,
            "recordingOffsetY": recording_offset_y,
            "isWindowCapture": is_window_capture,
        });

        // Store window handle info for the capture thread
        if is_window_capture {
            config["windowHwnd"] = serde_json::json!(
                source
                    .get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("0")
            );
            config["windowWidth"] = serde_json::json!(
                source.get("width").and_then(|v| v.as_i64()).unwrap_or(1920)
            );
            config["windowHeight"] = serde_json::json!(
                source.get("height").and_then(|v| v.as_i64()).unwrap_or(1080)
            );
        }

        state.camera_mic_config = Some(config);
    }

    // Minimize main window
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.minimize().ok();
    }

// Create recorder overlay window (small window at bottom-left)
    let monitor = app
        .get_webview_window("main")
        .and_then(|w| w.current_monitor().ok().flatten());

    let overlay_w = 200.0;
    let overlay_h = 20.0;
    let margin = 16.0;

    let (win_y, _screen_h) = if let Some(m) = &monitor {
        let size = m.size();
        let scale = m.scale_factor();
        let h = size.height as f64 / scale;
        (h - overlay_h - margin, h)
    } else {
        (800.0, 900.0)
    };

    let recorder_window = WebviewWindowBuilder::new(
        &app,
        "recorder",
        WebviewUrl::App("src/renderer/recorder/index.html".into()),
    )
    .title("Recording - Flowtake")
    .inner_size(overlay_w, overlay_h)
    .min_inner_size(overlay_w, overlay_h)
    .position(16.0, win_y)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .closable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .content_protected(true)
    .build();

    match recorder_window {
        Ok(_) => {
            log::info!("Recorder window created successfully");
        }
        Err(e) => {
            log::error!("Failed to create recorder window: {}", e);
            if let Some(main_win) = app.get_webview_window("main") {
                main_win.unminimize().ok();
            }
            return Err(AppError::General(format!(
                "Failed to create recorder window: {}",
                e
            )));
        }
    }

    // Emit recording-init event
    app.emit("recording-init", &source).ok();

    Ok(())
}

#[tauri::command]
pub async fn start_recording(app: AppHandle) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();

    // Get config from stored state
    let (ffmpeg_args, is_window_capture, window_hwnd, window_width, window_height) = {
        let state = state.lock().unwrap();
        let config = state.camera_mic_config.as_ref();
        let args = config
            .and_then(|c| c.get("ffmpegArgs"))
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<_>>()
            });
        let is_win = config
            .and_then(|c| c.get("isWindowCapture"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let hwnd = config
            .and_then(|c| c.get("windowHwnd"))
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<isize>().ok())
            .unwrap_or(0);
        let ww = config
            .and_then(|c| c.get("windowWidth"))
            .and_then(|v| v.as_i64())
            .unwrap_or(1920) as i32;
        let wh = config
            .and_then(|c| c.get("windowHeight"))
            .and_then(|v| v.as_i64())
            .unwrap_or(1080) as i32;
        (args, is_win, hwnd, ww, wh)
    };

    if let Some(args) = ffmpeg_args {
        if is_window_capture {
            // Window capture: spawn FFmpeg via std::process::Command for stdin pipe access
            #[cfg(target_os = "windows")]
            {
                let ffmpeg_path = find_ffmpeg_path().ok_or_else(|| {
                    AppError::General("FFmpeg binary not found".to_string())
                })?;

                log::info!(
                    "[start_recording] Window capture mode, FFmpeg: {:?}",
                    ffmpeg_path
                );

                use std::os::windows::process::CommandExt;
                use std::process::{Command, Stdio};

                let mut process = Command::new(&ffmpeg_path)
                    .args(&args)
                    .stdin(Stdio::piped())
                    .stdout(Stdio::null())
                    .stderr(Stdio::piped())
                    .creation_flags(0x08000000) // CREATE_NO_WINDOW
                    .spawn()
                    .map_err(|e| AppError::General(format!("Failed to spawn FFmpeg: {}", e)))?;

                let pid = process.id();
                let stdin = process.stdin.take().unwrap();

                // Reset stop flag and start capture thread
                let stop_flag = {
                    let mut state = state.lock().unwrap();
                    state.window_capture_stop.store(false, Ordering::Relaxed);
                    state.ffmpeg_child_id = Some(pid);
                    state.ffmpeg_process = Some(process);
                    state.window_capture_stop.clone()
                };

                // Make dimensions even
                let w = (window_width - (window_width % 2)).max(2);
                let h = (window_height - (window_height % 2)).max(2);

                let capture_thread = std::thread::spawn(move || {
                    window_capture_loop(window_hwnd, w, h, stdin, stop_flag);
                });

                {
                    let mut state = state.lock().unwrap();
                    state.window_capture_thread = Some(capture_thread);
                }

                log::info!("[start_recording] Window capture started, FFmpeg PID: {}", pid);
            }

            #[cfg(not(target_os = "windows"))]
            {
                log::error!("[start_recording] Window capture not supported on this platform");
                app.emit("recording-error", "CaptureError").ok();
            }
        } else {
            // Screen/Area capture: use Tauri sidecar (existing approach)
            let shell = app.shell();
            let sidecar_result = shell.sidecar("ffmpeg");

            match sidecar_result {
                Ok(cmd) => {
                    let cmd = cmd.args(&args);
                    match cmd.spawn() {
                        Ok((mut rx, child)) => {
                            let pid = child.pid();
                            {
                                let mut state = state.lock().unwrap();
                                state.ffmpeg_child_id = Some(pid);
                                state.ffmpeg_child = Some(child);
                            }

                            let app_clone = app.clone();
                            tauri::async_runtime::spawn(async move {
                                while let Some(event) = rx.recv().await {
                                    match event {
                                        CommandEvent::Stderr(line) => {
                                            log::info!(
                                                "[FFmpeg] {}",
                                                String::from_utf8_lossy(&line)
                                            );
                                        }
                                        CommandEvent::Stdout(line) => {
                                            log::info!(
                                                "[FFmpeg stdout] {}",
                                                String::from_utf8_lossy(&line)
                                            );
                                        }
                                        CommandEvent::Error(err) => {
                                            log::error!("[FFmpeg error] {}", err);
                                            app_clone
                                                .emit("recording-error", "CaptureError")
                                                .ok();
                                        }
                                        CommandEvent::Terminated(status) => {
                                            log::info!(
                                                "[FFmpeg] Terminated with: {:?}",
                                                status
                                            );
                                            break;
                                        }
                                        _ => {}
                                    }
                                }
                            });

                            log::info!("FFmpeg started with PID: {}", pid);
                        }
                        Err(e) => {
                            log::error!("Failed to spawn FFmpeg: {}", e);
                            app.emit("recording-error", "CaptureError").ok();
                        }
                    }
                }
                Err(e) => {
                    log::error!("Failed to create FFmpeg sidecar: {}", e);
                    app.emit("recording-error", "CaptureError").ok();
                }
            }
        }
    }

    // Start mouse tracking with recording area offset
    {
        let mut state = state.lock().unwrap();
        let (offset_x, offset_y) = state
            .camera_mic_config
            .as_ref()
            .map(|c| {
                let x = c
                    .get("recordingOffsetX")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as i32;
                let y = c
                    .get("recordingOffsetY")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as i32;
                (x, y)
            })
            .unwrap_or((0, 0));
        state.mouse_tracker.set_offset(offset_x, offset_y);
        state.mouse_tracker.start();
        state.recording_start_timestamp = Some(chrono::Utc::now().timestamp_millis());
    }

    // Emit recording-started to the recorder window
    app.emit("recording-started", true).ok();
    Ok(())
}

#[tauri::command]
pub async fn pause_recording(app: AppHandle, pause: bool) -> AppResult<()> {
    app.emit("recording-paused", pause).ok();
    Ok(())
}

#[tauri::command]
pub async fn stop_recording(app: AppHandle) -> AppResult<()> {
    use tauri_plugin_store::StoreExt;

    let state = app.state::<Mutex<AppState>>();

    let stop_timestamp = chrono::Utc::now().timestamp_millis();

    // Check if this is a window capture
    let is_window_capture = {
        let s = state.lock().unwrap();
        s.camera_mic_config
            .as_ref()
            .and_then(|c| c.get("isWindowCapture"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    };

    if is_window_capture {
        // Window capture: signal stop, join thread, wait for FFmpeg
        log::info!("[stop_recording] Stopping window capture pipeline");

        // Signal capture thread to stop
        {
            let s = state.lock().unwrap();
            s.window_capture_stop.store(true, Ordering::Relaxed);
        }

        // Join capture thread (this drops stdin → FFmpeg gets EOF → finalizes)
        let thread = {
            let mut s = state.lock().unwrap();
            s.window_capture_thread.take()
        };
        if let Some(thread) = thread {
            thread.join().ok();
            log::info!("[stop_recording] Capture thread joined");
        }

        // Wait for FFmpeg process to finish (it should finalize after EOF)
        let process = {
            let mut s = state.lock().unwrap();
            s.ffmpeg_process.take()
        };
        if let Some(mut process) = process {
            // Give FFmpeg up to 10 seconds to finalize
            match tokio::time::timeout(
                std::time::Duration::from_secs(10),
                tokio::task::spawn_blocking(move || process.wait()),
            )
            .await
            {
                Ok(Ok(Ok(status))) => {
                    log::info!("[stop_recording] FFmpeg exited with: {:?}", status);
                }
                _ => {
                    log::warn!("[stop_recording] FFmpeg finalization timed out or failed");
                }
            }
        }
    } else {
        // Screen/Area capture: graceful gdigrab shutdown
        kill_ffmpeg(&app);
        tokio::time::sleep(std::time::Duration::from_millis(3000)).await;
    }

    let (project_id, recording_id, mouse_events, recording_start_ts) = {
        let mut state = state.lock().unwrap();
        state.is_recording = false;

        state.mouse_tracker.stop();
        let start_ts = state.recording_start_timestamp.unwrap_or(stop_timestamp);
        let events = state.mouse_tracker.get_events(start_ts);

        let pid = state.project_id.clone();
        let rid = state.recording_id.clone();
        state.ffmpeg_child_id = None;
        state.ffmpeg_child = None;
        state.recording_start_timestamp = None;
        (pid, rid, events, start_ts)
    };

    log::info!(
        "[stop_recording] project_id={:?}, recording_id={:?}",
        project_id,
        recording_id
    );

    // Close recorder window
    if let Some(recorder_win) = app.get_webview_window("recorder") {
        recorder_win.close().ok();
    }

    // Restore main window
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.unminimize().ok();
        main_win.show().ok();
        main_win.set_focus().ok();
    }

    app.emit_to("main", "load", "Creating project...").ok();

    // Check if we have a valid recording
    let recording_video_path = if let Some(ref rid) = recording_id {
        let state_lock = state.lock().unwrap();
        let path = state_lock.project_temp_dir(rid).join("screen.mp4");
        drop(state_lock);
        Some(path)
    } else {
        None
    };

    let has_video = recording_video_path
        .as_ref()
        .map(|p| {
            let exists = p.exists();
            let size = p.metadata().map(|m| m.len()).unwrap_or(0);
            log::info!(
                "[stop_recording] Video file: {:?}, exists={}, size={}",
                p,
                exists,
                size
            );
            exists && size > 0
        })
        .unwrap_or(false);

    if has_video {
        if let (Some(ref rid), Some(ref pid)) = (&recording_id, &project_id) {
            let (recording_video, project_temp, projects_dir) = {
                let state_lock = state.lock().unwrap();
                (
                    state_lock.project_temp_dir(rid).join("screen.mp4"),
                    state_lock.project_temp_dir(pid),
                    state_lock.projects_dir.clone(),
                )
            };

            if let Err(e) = std::fs::create_dir_all(&project_temp) {
                log::error!("[stop_recording] Failed to create project temp dir: {}", e);
            }
            let dest_video = project_temp.join("screen.mp4");

            if std::fs::rename(&recording_video, &dest_video).is_err() {
                log::warn!("[stop_recording] rename failed, trying copy");
                if let Err(e) = std::fs::copy(&recording_video, &dest_video) {
                    log::error!("[stop_recording] copy also failed: {}", e);
                } else {
                    std::fs::remove_file(&recording_video).ok();
                }
            }

            log::info!(
                "[stop_recording] dest_video exists={}, size={}",
                dest_video.exists(),
                dest_video.metadata().map(|m| m.len()).unwrap_or(0)
            );

            let (source_name, left_trim, right_trim, top_trim, bottom_trim) = {
                let s = state.lock().unwrap();
                let config = s.camera_mic_config.as_ref();
                let name = config
                    .and_then(|c| c.get("sourceName"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Recording")
                    .to_string();
                (name, 0, 0, 0, 0)
            };

            let duration_ms = get_video_duration_ms(&app, &dest_video)
                .await
                .unwrap_or_else(|_| (stop_timestamp - recording_start_ts).max(1000));
            log::info!("[stop_recording] Video duration: {}ms", duration_ms);

            let project_json = serde_json::json!({
                "version": 1,
                "project": {
                    "id": pid,
                    "name": source_name,
                    "hasCameraVideo": false,
                    "hasMicrophoneAudio": false,
                    "hasSystemAudio": false,
                    "cameraVideoDimensions": null,
                    "padding": 1,
                    "borderRadius": 0,
                    "mouseEvents": mouse_events,
                    "leftTrim": left_trim,
                    "rightTrim": right_trim,
                    "topTrim": top_trim,
                    "bottomTrim": bottom_trim,
                    "videoDetails": {
                        "start": 0,
                        "end": duration_ms
                    }
                },
                "clipAnims": {
                    "entities": [{
                        "start": 0,
                        "end": duration_ms,
                        "layout": {
                            "mode": "screen-fullscreen"
                        }
                    }]
                }
            });

            let project_json_path = project_temp.join("project.json");
            if let Err(e) = std::fs::write(
                &project_json_path,
                serde_json::to_string_pretty(&project_json).unwrap_or_default(),
            ) {
                log::error!("[stop_recording] Failed to write project.json: {}", e);
            }

            let zip_path = projects_dir.join(format!("{}.zip", pid));
            std::fs::create_dir_all(&projects_dir).ok();

            log::info!("[stop_recording] Creating zip at: {:?}", zip_path);

            let zip_ok = if let Ok(zip_file) = std::fs::File::create(&zip_path) {
                let mut zip = zip::ZipWriter::new(zip_file);
                let options = zip::write::SimpleFileOptions::default()
                    .compression_method(zip::CompressionMethod::Stored);

                if let Ok(pj_data) = std::fs::read(&project_json_path) {
                    zip.start_file("project.json", options).ok();
                    std::io::Write::write_all(&mut zip, &pj_data).ok();
                }

                if let Ok(video_meta) = dest_video.metadata() {
                    let video_size = video_meta.len();
                    log::info!(
                        "[stop_recording] Adding video to zip, size={}",
                        video_size
                    );
                    if let Ok(mut video_file) = std::fs::File::open(&dest_video) {
                        zip.start_file("screen.mp4", options).ok();
                        std::io::copy(&mut video_file, &mut zip).ok();
                    }
                }

                zip.finish().ok();
                true
            } else {
                log::error!("[stop_recording] Failed to create zip file");
                false
            };

            if zip_ok {
                if let Ok(store) = app.store("store.json") {
                    let zip_str = zip_path.to_string_lossy().to_string();

                    let mut projects = store
                        .get("projects")
                        .and_then(|v| {
                            if let Value::Object(map) = v {
                                Some(map)
                            } else {
                                None
                            }
                        })
                        .unwrap_or_default();

                    projects.insert(
                        pid.clone(),
                        serde_json::json!({
                            "id": pid,
                            "lastSaved": chrono::Utc::now().timestamp_millis(),
                            "name": source_name,
                            "path": zip_str,
                        }),
                    );

                    store.set("projects", Value::Object(projects));
                    store.set(
                        format!("projects.{}.path", pid),
                        serde_json::json!(zip_str),
                    );
                    store.save().ok();
                    log::info!("[stop_recording] Project stored: {}", pid);
                } else {
                    log::error!("[stop_recording] Failed to open store");
                }
            }

            {
                let mut state = state.lock().unwrap();
                state.project_id = None;
                state.file_handles.clear();
            }

            log::info!("[stop_recording] Emitting project-created: {}", pid);
            app.emit_to("main", "project-created", pid.as_str()).ok();
            app.emit_to("main", "load", "").ok();
        }
    } else {
        log::warn!(
            "[stop_recording] No video file found at: {:?}",
            recording_video_path
        );
        app.emit_to("main", "recording-canceled", "").ok();
        app.emit_to("main", "load", serde_json::Value::Null).ok();
    }

    app.emit("recording-stopped", true).ok();

    if let Some(ref rid) = recording_id {
        let state_lock = state.lock().unwrap();
        let rec_temp = state_lock.project_temp_dir(rid);
        drop(state_lock);
        if rec_temp.exists() {
            std::fs::remove_dir_all(&rec_temp).ok();
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn reset_recording(app: AppHandle) -> AppResult<()> {
    kill_ffmpeg(&app);

    let state = app.state::<Mutex<AppState>>();
    let recording_id = {
        let mut state = state.lock().unwrap();
        state.ffmpeg_child_id = None;
        state.ffmpeg_child = None;
        state.ffmpeg_process = None;
        state.recording_id.clone()
    };

    if let Some(rid) = recording_id {
        let state_lock = state.lock().unwrap();
        let temp_dir = state_lock.project_temp_dir(&rid);
        drop(state_lock);

        if temp_dir.exists() {
            std::fs::remove_dir_all(&temp_dir).ok();
            std::fs::create_dir_all(&temp_dir).ok();
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn cancel_recording(app: AppHandle, error: Option<String>) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();

    kill_ffmpeg(&app);

    let recording_id = {
        let mut state = state.lock().unwrap();
        state.is_recording = false;
        state.ffmpeg_child_id = None;
        state.ffmpeg_child = None;
        state.ffmpeg_process = None;
        state.mouse_tracker.stop();
        state.recording_start_timestamp = None;
        state.recording_id.take()
    };

    if let Some(rid) = recording_id {
        let state_lock = state.lock().unwrap();
        let temp_dir = state_lock.project_temp_dir(&rid);
        drop(state_lock);

        if temp_dir.exists() {
            std::fs::remove_dir_all(&temp_dir).ok();
        }
    }

    if let Some(recorder_win) = app.get_webview_window("recorder") {
        recorder_win.close().ok();
    }

    if let Some(main_win) = app.get_webview_window("main") {
        main_win.unminimize().ok();
        main_win.show().ok();
        main_win.set_focus().ok();
    }

    let err_str = error.unwrap_or_default();
    app.emit_to("main", "recording-canceled", &err_str).ok();

    if !err_str.is_empty() {
        app.emit_to("main", "recording-error", &err_str).ok();
    }

    Ok(())
}

/// Get video duration in milliseconds using FFmpeg
async fn get_video_duration_ms(
    app: &AppHandle,
    video_path: &std::path::Path,
) -> Result<i64, String> {
    use tauri_plugin_shell::ShellExt;

    let path_str = video_path.to_string_lossy().to_string();
    let shell = app.shell();
    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| format!("FFmpeg sidecar error: {}", e))?
        .args(["-i", &path_str, "-f", "null", "-"])
        .output()
        .await
        .map_err(|e| format!("FFmpeg error: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if let Some(pos) = stderr.find("Duration: ") {
        let duration_str = &stderr[pos + 10..];
        if let Some(end) = duration_str.find(',') {
            let time_str = &duration_str[..end];
            let parts: Vec<&str> = time_str.split(':').collect();
            if parts.len() == 3 {
                let hours: f64 = parts[0].parse().unwrap_or(0.0);
                let minutes: f64 = parts[1].parse().unwrap_or(0.0);
                let seconds: f64 = parts[2].parse().unwrap_or(0.0);
                let total_ms = ((hours * 3600.0 + minutes * 60.0 + seconds) * 1000.0) as i64;
                if total_ms > 0 {
                    return Ok(total_ms);
                }
            }
        }
    }

    Err("Could not parse duration".to_string())
}

/// Stop the FFmpeg process gracefully.
/// For sidecar (gdigrab): writes "q\n" to stdin.
/// For window capture: signals capture thread to stop (which drops stdin → EOF).
fn kill_ffmpeg(app: &AppHandle) {
    let state = app.state::<Mutex<AppState>>();

    // Handle window capture pipeline
    {
        let s = state.lock().unwrap();
        let is_window_capture = s
            .camera_mic_config
            .as_ref()
            .and_then(|c| c.get("isWindowCapture"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if is_window_capture {
            // Signal the capture thread to stop
            s.window_capture_stop.store(true, Ordering::Relaxed);
            drop(s);

            // Join the capture thread (drops stdin → FFmpeg gets EOF)
            let thread = {
                let mut s = state.lock().unwrap();
                s.window_capture_thread.take()
            };
            if let Some(thread) = thread {
                thread.join().ok();
            }

            // Wait briefly for FFmpeg to finalize, then force kill if needed
            let process = {
                let mut s = state.lock().unwrap();
                s.ffmpeg_process.take()
            };
            if let Some(mut process) = process {
                // Give it 5 seconds to finish
                std::thread::sleep(std::time::Duration::from_secs(3));
                process.kill().ok();
                process.wait().ok();
            }

            return;
        }
    }

    // Handle Tauri sidecar (gdigrab) pipeline
    let (pid, child) = {
        let mut state = state.lock().unwrap();
        (state.ffmpeg_child_id, state.ffmpeg_child.take())
    };

    if let Some(mut child) = child {
        let pid = pid.unwrap_or(0);
        log::info!("[kill_ffmpeg] Sending 'q' to FFmpeg PID: {}", pid);

        match child.write(b"q\n") {
            Ok(_) => {
                log::info!("[kill_ffmpeg] Sent 'q' command to FFmpeg stdin");
            }
            Err(e) => {
                log::warn!(
                    "[kill_ffmpeg] Failed to write to stdin: {}, using force kill",
                    e
                );
                force_kill_ffmpeg(pid);
            }
        }
    } else if let Some(pid) = pid {
        log::warn!("[kill_ffmpeg] No child handle, force killing PID: {}", pid);
        force_kill_ffmpeg(pid);
    }
}

/// Force kill FFmpeg process by PID as a last resort
fn force_kill_ffmpeg(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()
            .ok();
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output()
            .ok();
    }
}

#[tauri::command]
pub async fn get_source_screenshot(app: AppHandle, source: Value) -> AppResult<String> {
    use base64::Engine;

    let state = app.state::<Mutex<AppState>>();
    let temp_dir = {
        let s = state.lock().unwrap();
        s.temp_dir.clone()
    };
    std::fs::create_dir_all(&temp_dir).ok();
    let screenshot_path = temp_dir.join("preview_screenshot.png");
    let screenshot_str = screenshot_path.to_string_lossy().to_string();

    // Use logical pixels for gdigrab compatibility (DPI-unaware coordinate space)
    let (screen_w, screen_h) = if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = main_win.current_monitor() {
            let size = monitor.size();
            let scale = monitor.scale_factor();
            (size.width as f64 / scale, size.height as f64 / scale)
        } else {
            (1920.0, 1080.0)
        }
    } else {
        (1920.0, 1080.0)
    };

    let source_type = source
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("screen");

    // For window screenshots, use PrintWindow API directly (no FFmpeg needed)
    if source_type == "window" {
        #[cfg(target_os = "windows")]
        {
            let hwnd: isize = source
                .get("id")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0);
            let w = source.get("width").and_then(|v| v.as_i64()).unwrap_or(1920) as i32;
            let h = source.get("height").and_then(|v| v.as_i64()).unwrap_or(1080) as i32;

            if hwnd != 0 {
                if let Some(bmp_data) = screenshot_window_printwindow(hwnd, w, h) {
                    // Write BMP to temp file, convert to PNG via FFmpeg
                    let bmp_path = temp_dir.join("preview_window.bmp");
                    let bmp_str = bmp_path.to_string_lossy().to_string();
                    std::fs::write(&bmp_path, &bmp_data)?;

                    let shell = app.shell();
                    let output = shell
                        .sidecar("ffmpeg")
                        .map_err(|e| {
                            AppError::General(format!("FFmpeg sidecar error: {}", e))
                        })?
                        .args(["-y", "-i", &bmp_str, &screenshot_str])
                        .output()
                        .await
                        .map_err(|e| {
                            AppError::General(format!("FFmpeg error: {}", e))
                        })?;

                    std::fs::remove_file(&bmp_path).ok();

                    if !output.status.success() {
                        log::warn!(
                            "[screenshot] FFmpeg BMP->PNG stderr: {}",
                            String::from_utf8_lossy(&output.stderr)
                        );
                    }

                    if screenshot_path.exists() {
                        let data = std::fs::read(&screenshot_path)?;
                        std::fs::remove_file(&screenshot_path).ok();
                        if !data.is_empty() {
                            let b64 =
                                base64::engine::general_purpose::STANDARD.encode(&data);
                            return Ok(format!("data:image/png;base64,{}", b64));
                        }
                    }
                }
            }

            // Fallback: use gdigrab offset-based capture
            let x = source.get("x").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
            let y = source.get("y").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
            let w64 = source.get("width").and_then(|v| v.as_i64()).unwrap_or(1920);
            let h64 = source.get("height").and_then(|v| v.as_i64()).unwrap_or(1080);
            let w64 = w64.min(screen_w as i64 - x);
            let h64 = h64.min(screen_h as i64 - y);
            let w64 = (w64 - (w64 % 2)).max(2);
            let h64 = (h64 - (h64 % 2)).max(2);

            if let Some(main_win) = app.get_webview_window("main") {
                main_win.set_content_protected(true).ok();
            }

            let x_str = x.to_string();
            let y_str = y.to_string();
            let vs_str = format!("{}x{}", w64, h64);
            let args = vec![
                "-y", "-f", "gdigrab", "-framerate", "1", "-draw_mouse", "0",
                "-offset_x", &x_str, "-offset_y", &y_str,
                "-video_size", &vs_str,
                "-i", "desktop", "-frames:v", "1", "-update", "true", &screenshot_str,
            ];

            let shell = app.shell();
            let _output = shell
                .sidecar("ffmpeg")
                .map_err(|e| AppError::General(format!("FFmpeg sidecar error: {}", e)))?
                .args(&args)
                .output()
                .await
                .map_err(|e| AppError::General(format!("FFmpeg error: {}", e)))?;

            if screenshot_path.exists() {
                let data = std::fs::read(&screenshot_path)?;
                std::fs::remove_file(&screenshot_path).ok();
                if !data.is_empty() {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                    return Ok(format!("data:image/png;base64,{}", b64));
                }
            }

            return Err(AppError::General("Window screenshot failed".to_string()));
        }

        #[cfg(not(target_os = "windows"))]
        {
            return Err(AppError::General(
                "Window capture not supported on this platform".to_string(),
            ));
        }
    }

    // Screen/Area: use gdigrab as before
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.set_content_protected(true).ok();
    }

    let args: Vec<String> = match source_type {
        "area" => {
            let x_pct = source.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let y_pct = source.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let w_pct = source
                .get("width")
                .and_then(|v| v.as_f64())
                .unwrap_or(100.0);
            let h_pct = source
                .get("height")
                .and_then(|v| v.as_f64())
                .unwrap_or(100.0);

            let x = (x_pct / 100.0 * screen_w) as i64;
            let y = (y_pct / 100.0 * screen_h) as i64;
            let w = ((w_pct / 100.0 * screen_w) as i64).max(2);
            let h = ((h_pct / 100.0 * screen_h) as i64).max(2);
            let w = w - (w % 2);
            let h = h - (h % 2);
            vec![
                "-y".into(),
                "-f".into(),
                "gdigrab".into(),
                "-framerate".into(),
                "1".into(),
                "-draw_mouse".into(),
                "0".into(),
                "-offset_x".into(),
                x.to_string(),
                "-offset_y".into(),
                y.to_string(),
                "-video_size".into(),
                format!("{}x{}", w, h),
                "-i".into(),
                "desktop".into(),
                "-frames:v".into(),
                "1".into(),
                "-update".into(),
                "true".into(),
                screenshot_str.clone(),
            ]
        }
        _ => {
            let monitor_x = source
                .get("monitorX")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let monitor_y = source
                .get("monitorY")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let monitor_w = source.get("monitorWidth").and_then(|v| v.as_i64());
            let monitor_h = source.get("monitorHeight").and_then(|v| v.as_i64());

            let mut a: Vec<String> = vec![
                "-y".into(),
                "-f".into(),
                "gdigrab".into(),
                "-framerate".into(),
                "1".into(),
                "-draw_mouse".into(),
                "0".into(),
            ];

            if let (Some(w), Some(h)) = (monitor_w, monitor_h) {
                let w = (w - (w % 2)).max(2);
                let h = (h - (h % 2)).max(2);
                a.extend([
                    "-offset_x".into(),
                    monitor_x.to_string(),
                    "-offset_y".into(),
                    monitor_y.to_string(),
                    "-video_size".into(),
                    format!("{}x{}", w, h),
                ]);
            }

            a.extend([
                "-i".into(),
                "desktop".into(),
                "-frames:v".into(),
                "1".into(),
                "-update".into(),
                "true".into(),
                screenshot_str.clone(),
            ]);
            a
        }
    };

    let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let shell = app.shell();
    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| AppError::General(format!("FFmpeg sidecar error: {}", e)))?
        .args(&args_refs)
        .output()
        .await
        .map_err(|e| AppError::General(format!("FFmpeg execution error: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        log::warn!("[FFmpeg screenshot] stderr: {}", stderr);
    }

    if screenshot_path.exists() {
        let data = std::fs::read(&screenshot_path)?;
        std::fs::remove_file(&screenshot_path).ok();
        if data.is_empty() {
            return Err(AppError::General("Screenshot file is empty".to_string()));
        }
        let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
        Ok(format!("data:image/png;base64,{}", b64))
    } else {
        Err(AppError::General("Screenshot capture failed".to_string()))
    }
}

#[tauri::command]
pub async fn init_camera_file(app: AppHandle) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    state.camera_chunks.clear();
    Ok(())
}

#[tauri::command]
pub async fn enqueue_camera_chunk(app: AppHandle, chunk: Vec<u8>) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    state.camera_chunks.push(chunk);
    Ok(())
}

#[tauri::command]
pub async fn finalize_camera_file(app: AppHandle) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let (chunks, camera_path) = {
        let mut state = state.lock().unwrap();
        let recording_id = state
            .recording_id
            .clone()
            .or_else(|| state.project_id.clone())
            .ok_or(AppError::NoProjectOpen)?;
        let path = state.camera_video_file(&recording_id);
        let chunks = std::mem::take(&mut state.camera_chunks);
        (chunks, path)
    };

    let mut file = std::fs::File::create(&camera_path)?;
    for chunk in chunks {
        std::io::Write::write_all(&mut file, &chunk)?;
    }

    Ok(())
}
