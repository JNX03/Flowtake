use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde_json::Value;
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

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

    // Platform-specific sidecar names that Tauri generates
    let sidecar_names = platform_ffmpeg_sidecar_names();

    for name in &sidecar_names {
        let sidecar = dir.join(name);
        if sidecar.exists() {
            return Some(sidecar);
        }
        // Try binaries subdirectory (dev mode)
        let binaries = dir.join("binaries").join(name);
        if binaries.exists() {
            return Some(binaries);
        }
    }

    // Try plain name (with extension on Windows)
    let plain_name = if cfg!(target_os = "windows") { "ffmpeg.exe" } else { "ffmpeg" };
    let plain = dir.join(plain_name);
    if plain.exists() {
        return Some(plain);
    }

    // Fallback: check well-known install locations (needed for macOS .app bundles
    // where PATH doesn't include Homebrew paths)
    #[cfg(target_os = "macos")]
    {
        for path in [
            "/opt/homebrew/bin/ffmpeg",    // Apple Silicon Homebrew
            "/usr/local/bin/ffmpeg",       // Intel Homebrew
        ] {
            let p = std::path::PathBuf::from(path);
            if p.exists() {
                return Some(p);
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        for path in [
            "/usr/bin/ffmpeg",
            "/usr/local/bin/ffmpeg",
            "/snap/bin/ffmpeg",
        ] {
            let p = std::path::PathBuf::from(path);
            if p.exists() {
                return Some(p);
            }
        }
    }

    // Fallback: check if ffmpeg is on PATH
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = std::process::Command::new("which").arg("ffmpeg").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Some(std::path::PathBuf::from(path));
                }
            }
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = std::process::Command::new("where").arg("ffmpeg").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                // `where` may return multiple lines; take the first
                if let Some(first) = path.lines().next() {
                    if !first.is_empty() {
                        return Some(std::path::PathBuf::from(first));
                    }
                }
            }
        }
    }

    None
}

/// Get platform-specific FFmpeg sidecar binary names
fn platform_ffmpeg_sidecar_names() -> Vec<String> {
    let mut names = Vec::new();

    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        names.push("ffmpeg-x86_64-pc-windows-msvc.exe".to_string());
    }
    #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
    {
        names.push("ffmpeg-aarch64-pc-windows-msvc.exe".to_string());
    }

    // macOS universal binary (produced by CI via lipo) must be checked first
    #[cfg(target_os = "macos")]
    {
        names.push("ffmpeg-universal-apple-darwin".to_string());
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        names.push("ffmpeg-x86_64-apple-darwin".to_string());
    }
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        names.push("ffmpeg-aarch64-apple-darwin".to_string());
    }

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        names.push("ffmpeg-x86_64-unknown-linux-gnu".to_string());
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        names.push("ffmpeg-aarch64-unknown-linux-gnu".to_string());
    }

    // Universal fallback name
    if cfg!(target_os = "windows") {
        names.push("ffmpeg.exe".to_string());
    } else {
        names.push("ffmpeg".to_string());
    }

    names
}

/// Detect the avfoundation device index for screen capture on macOS.
/// Camera devices come first (e.g. [0] FaceTime HD Camera), then screens (e.g. [1] Capture screen 0).
/// Returns the device index for the requested monitor, falling back to first screen device.
#[cfg(target_os = "macos")]
fn macos_screen_device_index(monitor_index: i64) -> i64 {
    if let Some(ffmpeg) = find_ffmpeg_path() {
        if let Ok(output) = std::process::Command::new(&ffmpeg)
            .args(["-f", "avfoundation", "-list_devices", "true", "-i", ""])
            .stderr(std::process::Stdio::piped())
            .stdout(std::process::Stdio::null())
            .output()
        {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Find "Capture screen" devices
            // Lines: [AVFoundation indev @ 0x...] [1] Capture screen 0
            let mut screen_devices: Vec<i64> = Vec::new();
            for line in stderr.lines() {
                if line.contains("Capture screen") {
                    // Extract device index: find "] [N] Capture" pattern
                    if let Some(cap_pos) = line.find("] Capture screen") {
                        // Look backwards for the opening bracket of the device index
                        let before = &line[..cap_pos];
                        if let Some(bracket_pos) = before.rfind('[') {
                            let idx_str = &before[bracket_pos + 1..];
                            if let Ok(idx) = idx_str.trim().parse::<i64>() {
                                screen_devices.push(idx);
                            }
                        }
                    }
                }
            }
            if !screen_devices.is_empty() {
                let idx = if (monitor_index as usize) < screen_devices.len() {
                    screen_devices[monitor_index as usize]
                } else {
                    screen_devices[0]
                };
                log::info!("[avfoundation] Screen device index {} for monitor {} (found {} screens)", idx, monitor_index, screen_devices.len());
                return idx;
            }
        }
    }
    log::warn!("[avfoundation] Could not detect screen device index, defaulting to 0");
    0
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
        let hdc_window = GetDC(Some(hwnd));
        if hdc_window.is_invalid() {
            return None;
        }

        let hdc_mem = CreateCompatibleDC(Some(hdc_window));
        let hbmp = CreateCompatibleBitmap(hdc_window, width, height);
        let old_obj = SelectObject(hdc_mem, hbmp.into());

        // PW_RENDERFULLCONTENT = 2 - captures full content including DirectX/Aero effects
        let success = PrintWindow(hwnd, hdc_mem, PRINT_WINDOW_FLAGS(2));

        if !success.as_bool() {
            // Fallback to BitBlt from window DC (works for most GDI windows)
            let _ = BitBlt(hdc_mem, 0, 0, width, height, Some(hdc_window), 0, 0, SRCCOPY);
        }

        // Extract bitmap data as BGRA (top-down)
        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height, // negative = top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
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
        let _ = DeleteObject(hbmp.into());
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(Some(hwnd), hdc_window);

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
        let hdc_window = GetDC(Some(hwnd));
        if hdc_window.is_invalid() {
            return None;
        }

        let hdc_mem = CreateCompatibleDC(Some(hdc_window));
        let hbmp = CreateCompatibleBitmap(hdc_window, width, height);
        let old_obj = SelectObject(hdc_mem, hbmp.into());

        let success = PrintWindow(hwnd, hdc_mem, PRINT_WINDOW_FLAGS(2));
        if !success.as_bool() {
            let _ = BitBlt(hdc_mem, 0, 0, width, height, Some(hdc_window), 0, 0, SRCCOPY);
        }

        // Extract as BMP-style BGRA data (top-down)
        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
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
        let _ = DeleteObject(hbmp.into());
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(Some(hwnd), hdc_window);

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
        bmp.extend_from_slice(&width.to_le_bytes());
        bmp.extend_from_slice(&(-height).to_le_bytes()); // top-down
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

    // Detect pure Wayland (no XWayland) on Linux — x11grab won't work
    #[cfg(target_os = "linux")]
    {
        let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
        if session_type == "wayland" && std::env::var("DISPLAY").is_err() {
            return Err(AppError::General(
                "Screen recording requires X11 or XWayland. Pure Wayland is not yet supported.".into(),
            ));
        }
    }

    let mut ffmpeg_args: Vec<String> = Vec::new();
    let (recording_offset_x, recording_offset_y): (i64, i64);

    if is_window_capture {
        let x = source.get("x").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
        let y = source.get("y").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
        let w = source.get("width").and_then(|v| v.as_i64()).unwrap_or(1920);
        let h = source.get("height").and_then(|v| v.as_i64()).unwrap_or(1080);
        let w = (w - (w % 2)).max(2);
        let h = (h - (h % 2)).max(2);

        #[cfg(target_os = "windows")]
        {
            let hwnd_str = source
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("0")
                .to_string();

            log::info!(
                "[recording] window PrintWindow capture: hwnd={} x={} y={} w={} h={}",
                hwnd_str, x, y, w, h
            );

            // FFmpeg reads raw BGRA frames from stdin pipe (Windows PrintWindow API)
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
        }

        #[cfg(target_os = "macos")]
        {
            log::info!(
                "[recording] window capture via avfoundation+crop: x={} y={} w={} h={}",
                x, y, w, h
            );

            // Use avfoundation screen capture + crop to window region
            let screen_dev = macos_screen_device_index(0);
            ffmpeg_args = vec![
                "-y".to_string(),
                "-f".to_string(),
                "avfoundation".to_string(),
                "-framerate".to_string(),
                "30".to_string(),
                "-capture_cursor".to_string(),
                "0".to_string(),
                "-i".to_string(),
                format!("{}:none", screen_dev),
                "-vf".to_string(),
                format!("crop={}:{}:{}:{}", w, h, x, y),
            ];
        }

        #[cfg(target_os = "linux")]
        {
            let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());

            log::info!(
                "[recording] window capture via x11grab: x={} y={} w={} h={}",
                x, y, w, h
            );

            // Use x11grab with offset+video_size to capture window region
            ffmpeg_args = vec![
                "-y".to_string(),
                "-f".to_string(),
                "x11grab".to_string(),
                "-framerate".to_string(),
                "30".to_string(),
                "-draw_mouse".to_string(),
                "0".to_string(),
                "-video_size".to_string(),
                format!("{}x{}", w, h),
                "-i".to_string(),
                format!("{}+{},{}", display, x, y),
            ];
        }

        recording_offset_x = x;
        recording_offset_y = y;
    } else {
        // Screen/Area: use platform-specific capture
        let capture_format = platform_capture_format();
        ffmpeg_args.extend([
            "-y".to_string(),
            "-f".to_string(),
            capture_format.to_string(),
            "-framerate".to_string(),
            "30".to_string(),
        ]);

        // Get screen dimensions for area percentage conversion
        // On Windows, gdigrab operates in physical pixel space
        let (screen_w, screen_h) = if let Some(main_win) = app.get_webview_window("main") {
            if let Ok(Some(monitor)) = main_win.current_monitor() {
                let size = monitor.size();
                #[cfg(target_os = "windows")]
                {
                    (size.width as f64, size.height as f64)
                }
                #[cfg(not(target_os = "windows"))]
                {
                    let scale = monitor.scale_factor();
                    (size.width as f64 / scale, size.height as f64 / scale)
                }
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

                #[cfg(target_os = "windows")]
                {
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
                }
                #[cfg(target_os = "macos")]
                {
                    // avfoundation: capture screen device, then crop
                    let screen_dev = macos_screen_device_index(0);
                    ffmpeg_args.extend([
                        "-capture_cursor".to_string(),
                        "0".to_string(),
                        "-i".to_string(),
                        format!("{}:none", screen_dev),
                        "-vf".to_string(),
                        format!("crop={}:{}:{}:{}", width, height, x, y),
                    ]);
                }
                #[cfg(target_os = "linux")]
                {
                    // x11grab uses :DISPLAY+x,y with video_size
                    let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());
                    ffmpeg_args.extend([
                        "-draw_mouse".to_string(),
                        "0".to_string(),
                        "-video_size".to_string(),
                        format!("{}x{}", width, height),
                        "-i".to_string(),
                        format!("{}+{},{}", display, x, y),
                    ]);
                }
                (x, y)
            }
            _ => {
                // Screen capture - supports specific monitor selection
                // On Windows, use physical pixels for gdigrab; on other platforms use logical
                #[cfg(target_os = "windows")]
                let (monitor_x, monitor_y, monitor_w, monitor_h) = {
                    let mx = source.get("physicalX").or_else(|| source.get("monitorX"))
                        .and_then(|v| v.as_i64()).unwrap_or(0);
                    let my = source.get("physicalY").or_else(|| source.get("monitorY"))
                        .and_then(|v| v.as_i64()).unwrap_or(0);
                    let mw = source.get("physicalWidth").or_else(|| source.get("monitorWidth"))
                        .and_then(|v| v.as_i64());
                    let mh = source.get("physicalHeight").or_else(|| source.get("monitorHeight"))
                        .and_then(|v| v.as_i64());
                    (mx, my, mw, mh)
                };
                #[cfg(not(target_os = "windows"))]
                let (monitor_x, monitor_y, monitor_w, monitor_h) = {
                    let mx = source.get("monitorX").and_then(|v| v.as_i64()).unwrap_or(0);
                    let my = source.get("monitorY").and_then(|v| v.as_i64()).unwrap_or(0);
                    let mw = source.get("monitorWidth").and_then(|v| v.as_i64());
                    let mh = source.get("monitorHeight").and_then(|v| v.as_i64());
                    (mx, my, mw, mh)
                };

                #[cfg(target_os = "windows")]
                {
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
                }
                #[cfg(target_os = "macos")]
                {
                    // avfoundation: map monitor index to actual device index
                    // (cameras come before screens in the device list)
                    let monitor_idx = source
                        .get("monitorIndex")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    let screen_dev = macos_screen_device_index(monitor_idx);
                    ffmpeg_args.extend([
                        "-capture_cursor".to_string(),
                        "0".to_string(),
                        "-i".to_string(),
                        format!("{}:none", screen_dev),
                    ]);
                    // Crop if specific monitor region
                    if let (Some(w), Some(h)) = (monitor_w, monitor_h) {
                        let w = (w - (w % 2)).max(2);
                        let h = (h - (h % 2)).max(2);
                        if monitor_x != 0 || monitor_y != 0 {
                            ffmpeg_args.extend([
                                "-vf".to_string(),
                                format!("crop={}:{}:{}:{}", w, h, monitor_x, monitor_y),
                            ]);
                        }
                    }
                }
                #[cfg(target_os = "linux")]
                {
                    let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());
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
                            "-video_size".to_string(),
                            format!("{}x{}", w, h),
                        ]);
                    }

                    ffmpeg_args.extend([
                        "-i".to_string(),
                        format!("{}+{},{}", display, monitor_x, monitor_y),
                    ]);
                }
                (monitor_x, monitor_y)
            }
        };

        recording_offset_x = ox;
        recording_offset_y = oy;
    }

    // Add system audio capture if requested (screen/area capture only)
    if !is_window_capture {
        let has_system_audio = match &system_audio {
            Value::String(s) if !s.is_empty() => true,
            Value::Bool(b) => *b,
            _ => false,
        };
        if has_system_audio {
            let audio_device = match &system_audio {
                Value::String(s) => s.clone(),
                _ => platform_default_audio_device(),
            };
            let (audio_format, audio_input) = platform_audio_capture_args(&audio_device);
            ffmpeg_args.extend([
                "-f".to_string(),
                audio_format,
                "-i".to_string(),
                audio_input,
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
            "sourceType": source_type,
            "source": source,
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

// Create recorder overlay window (centered at top of screen)
    let monitor = app
        .get_webview_window("main")
        .and_then(|w| w.current_monitor().ok().flatten());

    let overlay_w = 460.0;
    let overlay_h = 72.0;
    let margin = 10.0;

    let win_x = if let Some(m) = &monitor {
        let size = m.size();
        let scale = m.scale_factor();
        let w = size.width as f64 / scale;
        (w - overlay_w) / 2.0
    } else {
        400.0
    };

    let recorder_window = WebviewWindowBuilder::new(
        &app,
        "recorder",
        WebviewUrl::App("app/windows/recorder/index.html".into()),
    )
    .title("Recording - Flowtake")
    .inner_size(overlay_w, overlay_h)
    .min_inner_size(overlay_w, overlay_h)
    .position(win_x, margin)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .closable(false)
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .content_protected(true)
    .build();

    match recorder_window {
        Ok(ref win) => {
            // Explicitly set always-on-top after creation to ensure it sticks on Windows
            if let Err(e) = win.set_always_on_top(true) {
                log::warn!("Failed to set recorder always-on-top: {}", e);
            }
            log::info!("Recorder window created successfully (always-on-top)");
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
    #[allow(unused_variables)]
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
        // Only use stdin pipe capture on Windows (PrintWindow API);
        // macOS/Linux window capture uses screen capture with crop via sidecar path
        #[cfg(target_os = "windows")]
        let use_stdin_pipe = is_window_capture;
        #[cfg(not(target_os = "windows"))]
        let use_stdin_pipe = false;

        if use_stdin_pipe {
            // Window capture: spawn FFmpeg via std::process::Command for stdin pipe access
            let ffmpeg_path = find_ffmpeg_path().ok_or_else(|| {
                AppError::General("FFmpeg binary not found".to_string())
            })?;

            log::info!(
                "[start_recording] Window capture mode, FFmpeg: {:?}",
                ffmpeg_path
            );

            use std::process::{Command, Stdio};

            let mut cmd = Command::new(&ffmpeg_path);
            cmd.args(&args)
                .stdin(Stdio::piped())
                .stdout(Stdio::null())
                .stderr(Stdio::piped());

            // Hide console window on Windows
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }

            let mut process = cmd.spawn()
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
            #[allow(unused_variables)]
            let w = (window_width - (window_width % 2)).max(2);
            #[allow(unused_variables)]
            let h = (window_height - (window_height % 2)).max(2);

            #[cfg(target_os = "windows")]
            let capture_thread = std::thread::spawn(move || {
                window_capture_loop(window_hwnd, w, h, stdin, stop_flag);
            });

            // On macOS/Linux, window capture via stdin pipe is not yet supported;
            // fall back to closing stdin immediately (FFmpeg will use the screen capture input)
            #[cfg(not(target_os = "windows"))]
            let capture_thread = std::thread::spawn(move || {
                log::warn!("[start_recording] Window-specific PrintWindow capture not available on this platform, using screen-level capture");
                // Drop stdin to signal EOF - FFmpeg will finalize when stopped
                let _ = stop_flag;
                drop(stdin);
            });

            {
                let mut state = state.lock().unwrap();
                state.window_capture_thread = Some(capture_thread);
            }

            log::info!("[start_recording] Window capture started, FFmpeg PID: {}", pid);
        } else {
            // Screen/Area capture
            use std::process::{Command, Stdio};

            #[cfg(target_os = "macos")]
            {
                // On macOS, use native `screencapture -v` which has system-level
                // entitlements and works without screen recording permission.
                // Records to MOV; we convert to MP4 after stopping.
                let screen_video_path = args.last().cloned().unwrap_or_default();
                let mov_path = screen_video_path.replace(".mp4", ".mov");

                // Build region from the stored source config
                let config = {
                    let s = state.lock().unwrap();
                    s.camera_mic_config.clone()
                };
                let mut sc_args = vec!["-v".to_string(), "-x".to_string()];

                if let Some(ref cfg) = config {
                    let source_type = cfg.get("sourceType").and_then(|v| v.as_str()).unwrap_or("screen");
                    let (sw, sh) = if let Some(main_win) = app.get_webview_window("main") {
                        if let Ok(Some(monitor)) = main_win.current_monitor() {
                            let size = monitor.size();
                            let scale = monitor.scale_factor();
                            (size.width as f64 / scale, size.height as f64 / scale)
                        } else { (1920.0, 1080.0) }
                    } else { (1920.0, 1080.0) };
                    let src = cfg.get("source");

                    if source_type == "area" {
                        if let Some(src) = src {
                            let x_pct = src.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
                            let y_pct = src.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
                            let w_pct = src.get("width").and_then(|v| v.as_f64()).unwrap_or(100.0);
                            let h_pct = src.get("height").and_then(|v| v.as_f64()).unwrap_or(100.0);
                            let x = (x_pct / 100.0 * sw) as i64;
                            let y = (y_pct / 100.0 * sh) as i64;
                            let w = ((w_pct / 100.0 * sw) as i64).max(2);
                            let h = ((h_pct / 100.0 * sh) as i64).max(2);
                            sc_args.extend(["-R".to_string(), format!("{},{},{},{}", x, y, w, h)]);
                        }
                    } else if source_type == "window" {
                        if let Some(src) = src {
                            let x = src.get("x").and_then(|v| v.as_i64()).unwrap_or(0);
                            let y = src.get("y").and_then(|v| v.as_i64()).unwrap_or(0);
                            let w = src.get("width").and_then(|v| v.as_i64()).unwrap_or(1920);
                            let h = src.get("height").and_then(|v| v.as_i64()).unwrap_or(1080);
                            sc_args.extend(["-R".to_string(), format!("{},{},{},{}", x, y, w, h)]);
                        }
                    }
                    // For "screen" type, no -R needed (captures full screen)
                }

                sc_args.push(mov_path.clone());

                log::info!("[start_recording] macOS screencapture args: {:?}", sc_args);

                let mut cmd = Command::new("screencapture");
                cmd.args(&sc_args)
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::piped());

                match cmd.spawn() {
                    Ok(process) => {
                        let pid = process.id();
                        {
                            let mut state = state.lock().unwrap();
                            state.ffmpeg_child_id = Some(pid);
                            state.ffmpeg_process = Some(process);
                        }
                        log::info!("[start_recording] screencapture started with PID: {}", pid);
                    }
                    Err(e) => {
                        log::error!("Failed to spawn screencapture: {}", e);
                        // Restore system cursor since recording failed to start
                        crate::mouse_tracker::restore_macos_cursor();
                        app.emit("recording-error", "CaptureError").ok();
                        if let Some(win) = app.get_webview_window("recorder") {
                            win.close().ok();
                        }
                        if let Some(main_win) = app.get_webview_window("main") {
                            main_win.unminimize().ok();
                        }
                        return Err(AppError::General(format!("Failed to start recording: {}", e)));
                    }
                }
            }

            #[cfg(not(target_os = "macos"))]
            {
                let ffmpeg_path = find_ffmpeg_path().ok_or_else(|| {
                    AppError::General("FFmpeg binary not found. Please install FFmpeg.".to_string())
                })?;

                log::info!(
                    "[start_recording] Screen/area capture, FFmpeg: {:?}, args: {:?}",
                    ffmpeg_path, args
                );

                let mut cmd = Command::new(&ffmpeg_path);
                cmd.args(&args)
                    .stdin(Stdio::piped())
                    .stdout(Stdio::null())
                    .stderr(Stdio::piped());

                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    cmd.creation_flags(0x08000000);
                }

                match cmd.spawn() {
                    Ok(mut process) => {
                        let pid = process.id();
                        let stderr = process.stderr.take();
                        let app_clone = app.clone();
                        if let Some(stderr) = stderr {
                            std::thread::spawn(move || {
                                use std::io::BufRead;
                                let reader = std::io::BufReader::new(stderr);
                                for line in reader.lines() {
                                    match line {
                                        Ok(msg) => {
                                            log::info!("[FFmpeg] {}", msg);
                                            if msg.contains("Could not find video device")
                                                || msg.contains("Permission denied")
                                                || msg.contains("not granted")
                                                || msg.contains("No screens found")
                                                || msg.contains("unable to open device")
                                                || msg.contains("Input/output error")
                                            {
                                                app_clone.emit("recording-error", "ScreenPermissionDenied").ok();
                                            }
                                        }
                                        Err(_) => break,
                                    }
                                }
                            });
                        }
                        {
                            let mut state = state.lock().unwrap();
                            state.ffmpeg_child_id = Some(pid);
                            state.ffmpeg_process = Some(process);
                        }
                        log::info!("[start_recording] FFmpeg started with PID: {}", pid);
                    }
                    Err(e) => {
                        log::error!("Failed to spawn FFmpeg: {}", e);
                        app.emit("recording-error", "CaptureError").ok();
                        if let Some(win) = app.get_webview_window("recorder") {
                            win.close().ok();
                        }
                        if let Some(main_win) = app.get_webview_window("main") {
                            main_win.unminimize().ok();
                        }
                        return Err(AppError::General(format!("Failed to start recording: {}", e)));
                    }
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
        // On macOS, CGEvent reports logical points but screencapture records physical pixels.
        // Scale mouse coordinates to match video resolution on Retina displays.
        #[cfg(target_os = "macos")]
        {
            let scale = app.get_webview_window("main")
                .and_then(|w| w.current_monitor().ok().flatten())
                .map(|m| m.scale_factor())
                .unwrap_or(1.0);
            state.mouse_tracker.set_scale_factor(scale);
        }
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

    // Gracefully stop FFmpeg (handles both window capture and screen/area capture)
    log::info!("[stop_recording] Stopping FFmpeg");
    tokio::task::spawn_blocking({
        let app = app.clone();
        move || kill_ffmpeg(&app)
    }).await.ok();

    // Restore any muted audio sessions
    crate::commands::audio::unmute_all_sessions(&app);

    let (project_id, recording_id, mouse_events, recording_start_ts) = {
        let mut state = state.lock().unwrap();
        state.is_recording = false;

        state.mouse_tracker.stop();

        // Defensive: ensure macOS system cursor is restored even if the Drop guard didn't fire
        #[cfg(target_os = "macos")]
        crate::mouse_tracker::restore_macos_cursor();

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

    // On macOS, screencapture produces MOV; convert to MP4 using FFmpeg
    #[cfg(target_os = "macos")]
    if let Some(ref rid) = recording_id {
        let (mov_path, mp4_path) = {
            let s = state.lock().unwrap();
            (s.project_temp_dir(rid).join("screen.mov"), s.project_temp_dir(rid).join("screen.mp4"))
        };

        if mov_path.exists() && mov_path.metadata().map(|m| m.len() > 0).unwrap_or(false) {
            log::info!("[stop_recording] Converting MOV to MP4: {:?}", mov_path);
            let mov_str = mov_path.to_string_lossy().to_string();
            let mp4_str = mp4_path.to_string_lossy().to_string();
            let mov_path_clone = mov_path.clone();
            let mp4_path_clone = mp4_path.clone();
            // Fast remux without re-encoding (run in blocking thread)
            let convert_result = tokio::task::spawn_blocking(move || {
                if let Some(ffmpeg) = find_ffmpeg_path() {
                    let output = std::process::Command::new(&ffmpeg)
                        .args(["-y", "-i", &mov_str, "-c", "copy", &mp4_str])
                        .stdin(std::process::Stdio::null())
                        .stdout(std::process::Stdio::piped())
                        .stderr(std::process::Stdio::piped())
                        .output();
                    match output {
                        Ok(o) if o.status.success() => {
                            log::info!("[stop_recording] MOV→MP4 conversion done");
                            std::fs::remove_file(&mov_path_clone).ok();
                        }
                        _ => {
                            log::warn!("[stop_recording] MOV→MP4 failed, falling back to rename");
                            std::fs::rename(&mov_path_clone, &mp4_path_clone).ok();
                        }
                    }
                } else {
                    log::warn!("[stop_recording] FFmpeg not found for conversion, renaming MOV→MP4");
                    std::fs::rename(&mov_path_clone, &mp4_path_clone).ok();
                }
            }).await;
            if let Err(e) = convert_result {
                log::warn!("[stop_recording] MOV→MP4 task error: {}", e);
                std::fs::rename(&mov_path, &mp4_path).ok();
            }
        }
    }

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
        // Emit specific error so the UI can show a helpful message
        #[cfg(target_os = "macos")]
        {
            app.emit("recording-error", "ScreenPermissionDenied").ok();
            log::error!("[stop_recording] No frames captured. Screen recording permission may not be granted. Go to System Settings > Privacy & Security > Screen Recording.");
        }
        #[cfg(not(target_os = "macos"))]
        {
            app.emit("recording-error", "CaptureError").ok();
        }
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
    tokio::task::spawn_blocking({
        let app = app.clone();
        move || kill_ffmpeg(&app)
    }).await.ok();

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

    tokio::task::spawn_blocking({
        let app = app.clone();
        move || kill_ffmpeg(&app)
    }).await.ok();

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
    _app: &AppHandle,
    video_path: &std::path::Path,
) -> Result<i64, String> {
    let path_str = video_path.to_string_lossy().to_string();
    let output = run_ffmpeg(&["-i", &path_str, "-f", "null", "-"])
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

/// Stop the FFmpeg process gracefully by writing "q" to stdin and waiting for exit.
/// For window capture: signals capture thread to stop (which drops stdin → EOF).
/// For screen/area capture: writes "q\n" to stdin of std::process::Child.
fn kill_ffmpeg(app: &AppHandle) {
    use std::io::Write;

    let state = app.state::<Mutex<AppState>>();

    let is_window_capture = {
        let s = state.lock().unwrap();
        s.camera_mic_config
            .as_ref()
            .and_then(|c| c.get("isWindowCapture"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    };

    if is_window_capture {
        // Signal the capture thread to stop
        {
            let s = state.lock().unwrap();
            s.window_capture_stop.store(true, Ordering::Relaxed);
        }

        // Join the capture thread (drops stdin → FFmpeg gets EOF)
        let thread = {
            let mut s = state.lock().unwrap();
            s.window_capture_thread.take()
        };
        if let Some(thread) = thread {
            thread.join().ok();
            log::info!("[kill_ffmpeg] Window capture thread joined");
        }
    }

    // Take the FFmpeg process (used by both window and screen/area capture now)
    let (pid, mut process) = {
        let mut s = state.lock().unwrap();
        (s.ffmpeg_child_id.take(), s.ffmpeg_process.take())
    };

    if let Some(ref mut process) = process {
        let pid_val = pid.unwrap_or(0);

        if !is_window_capture {
            // Screen/area capture: graceful shutdown
            #[cfg(target_os = "macos")]
            {
                // Restore system cursor before stopping screencapture
                crate::mouse_tracker::restore_macos_cursor();
                // On macOS with screencapture, send SIGINT for graceful stop
                std::process::Command::new("kill")
                    .args(["-INT", &pid_val.to_string()])
                    .output()
                    .ok();
                log::info!("[kill_ffmpeg] Sent SIGINT to screencapture PID: {}", pid_val);
            }
            #[cfg(not(target_os = "macos"))]
            {
                // Send "q\n" to FFmpeg stdin for graceful shutdown
                if let Some(ref mut stdin) = process.stdin.take() {
                    match stdin.write_all(b"q\n").and_then(|_| stdin.flush()) {
                        Ok(_) => {
                            log::info!("[kill_ffmpeg] Sent 'q' to FFmpeg PID: {}", pid_val);
                        }
                        Err(e) => {
                            log::warn!("[kill_ffmpeg] Failed to write to stdin: {}", e);
                        }
                    }
                }
            }
        }

        // Wait for FFmpeg to finalize (up to 8 seconds)
        let start = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(8);
        loop {
            match process.try_wait() {
                Ok(Some(status)) => {
                    log::info!("[kill_ffmpeg] FFmpeg exited with: {:?}", status);
                    return;
                }
                Ok(None) => {
                    if start.elapsed() > timeout {
                        log::warn!("[kill_ffmpeg] FFmpeg didn't exit in time, force killing");
                        process.kill().ok();
                        process.wait().ok();
                        return;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                Err(e) => {
                    log::error!("[kill_ffmpeg] Error waiting for FFmpeg: {}", e);
                    process.kill().ok();
                    return;
                }
            }
        }
    } else if let Some(pid) = pid {
        log::warn!("[kill_ffmpeg] No process handle, force killing PID: {}", pid);
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

    // On Windows, gdigrab operates in physical pixel space
    let (screen_w, screen_h) = if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = main_win.current_monitor() {
            let size = monitor.size();
            #[cfg(target_os = "windows")]
            {
                (size.width as f64, size.height as f64)
            }
            #[cfg(not(target_os = "windows"))]
            {
                let scale = monitor.scale_factor();
                (size.width as f64 / scale, size.height as f64 / scale)
            }
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

                    let output = run_ffmpeg(&["-y", "-i", &bmp_str, &screenshot_str]).await?;

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

            // Fallback: use platform-specific offset-based capture
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

            let args = build_screenshot_args(x, y, w64, h64, &screenshot_str);
            let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

            let _output = run_ffmpeg(&args_refs).await?;

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
            // On macOS, check screen recording permission before screencapture
            let x = source.get("x").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
            let y = source.get("y").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
            let w64 = source.get("width").and_then(|v| v.as_i64()).unwrap_or(1920);
            let h64 = source.get("height").and_then(|v| v.as_i64()).unwrap_or(1080);

            #[cfg(target_os = "macos")]
            {
                use core_graphics::display::{CGDisplay, CGPoint, CGRect, CGSize};
                use core_graphics::window::{
                    kCGNullWindowID, kCGWindowImageDefault, kCGWindowListOptionOnScreenOnly,
                };
                let rect = CGRect::new(&CGPoint::new(0.0, 0.0), &CGSize::new(1.0, 1.0));
                let image = CGDisplay::screenshot(
                    rect,
                    kCGWindowListOptionOnScreenOnly,
                    kCGNullWindowID,
                    kCGWindowImageDefault,
                );
                if image.is_none() {
                    return Err(AppError::General("ScreenPermissionDenied".to_string()));
                }
                let region = format!("{},{},{},{}", x, y, w64, h64);
                let screenshot_str_clone = screenshot_str.clone();
                let _output = tokio::task::spawn_blocking(move || {
                    std::process::Command::new("screencapture")
                        .args(["-x", "-R", &region, &screenshot_str_clone])
                        .output()
                })
                .await
                .map_err(|e| AppError::General(format!("Screenshot task error: {}", e)))?
                .map_err(|e| AppError::General(format!("Screenshot error: {}", e)))?;
            }
            #[cfg(not(target_os = "macos"))]
            {
                let w64 = (w64 - (w64 % 2)).max(2);
                let h64 = (h64 - (h64 % 2)).max(2);
                let args = build_screenshot_args(x, y, w64, h64, &screenshot_str);
                let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
                let _output = run_ffmpeg(&args_refs).await?;
            }

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
    }

    // Screen/Area screenshot using platform-specific capture
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.set_content_protected(true).ok();
    }

    // On macOS, check screen recording permission before calling screencapture
    // to avoid spamming the permission dialog on macOS Sequoia+
    #[cfg(target_os = "macos")]
    {
        use core_graphics::display::{CGDisplay, CGPoint, CGRect, CGSize};
        use core_graphics::window::{
            kCGNullWindowID, kCGWindowImageDefault, kCGWindowListOptionOnScreenOnly,
        };
        let rect = CGRect::new(&CGPoint::new(0.0, 0.0), &CGSize::new(1.0, 1.0));
        let image = CGDisplay::screenshot(
            rect,
            kCGWindowListOptionOnScreenOnly,
            kCGNullWindowID,
            kCGWindowImageDefault,
        );
        if image.is_none() {
            return Err(AppError::General("ScreenPermissionDenied".to_string()));
        }
        let (x, y, w, h) = match source_type {
            "area" => {
                let x_pct = source.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let y_pct = source.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let w_pct = source.get("width").and_then(|v| v.as_f64()).unwrap_or(100.0);
                let h_pct = source.get("height").and_then(|v| v.as_f64()).unwrap_or(100.0);
                let x = (x_pct / 100.0 * screen_w) as i64;
                let y = (y_pct / 100.0 * screen_h) as i64;
                let w = ((w_pct / 100.0 * screen_w) as i64).max(2);
                let h = ((h_pct / 100.0 * screen_h) as i64).max(2);
                (x, y, w, h)
            }
            _ => {
                let mx = source.get("monitorX").and_then(|v| v.as_i64()).unwrap_or(0);
                let my = source.get("monitorY").and_then(|v| v.as_i64()).unwrap_or(0);
                let mw = source.get("monitorWidth").and_then(|v| v.as_i64());
                let mh = source.get("monitorHeight").and_then(|v| v.as_i64());
                if let (Some(w), Some(h)) = (mw, mh) {
                    (mx, my, w, h)
                } else {
                    (0, 0, screen_w as i64, screen_h as i64)
                }
            }
        };

        let region = format!("{},{},{},{}", x, y, w, h);
        let screenshot_str_clone = screenshot_str.clone();
        let output = tokio::task::spawn_blocking(move || {
            std::process::Command::new("screencapture")
                .args(["-x", "-R", &region, &screenshot_str_clone])
                .output()
        })
        .await
        .map_err(|e| AppError::General(format!("Screenshot task error: {}", e)))?
        .map_err(|e| AppError::General(format!("Screenshot error: {}", e)))?;

        if !output.status.success() {
            log::warn!("[screenshot] screencapture stderr: {}", String::from_utf8_lossy(&output.stderr));
        }

        if screenshot_path.exists() {
            let data = std::fs::read(&screenshot_path)?;
            std::fs::remove_file(&screenshot_path).ok();
            if !data.is_empty() {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                return Ok(format!("data:image/png;base64,{}", b64));
            }
        }
        return Err(AppError::General("Screenshot capture failed".to_string()));
    }

    // Windows/Linux: use FFmpeg for screenshots
    #[cfg(not(target_os = "macos"))]
    {
        let args: Vec<String> = match source_type {
            "area" => {
                let x_pct = source.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let y_pct = source.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let w_pct = source.get("width").and_then(|v| v.as_f64()).unwrap_or(100.0);
                let h_pct = source.get("height").and_then(|v| v.as_f64()).unwrap_or(100.0);
                let x = (x_pct / 100.0 * screen_w) as i64;
                let y = (y_pct / 100.0 * screen_h) as i64;
                let w = ((w_pct / 100.0 * screen_w) as i64).max(2);
                let h = ((h_pct / 100.0 * screen_h) as i64).max(2);
                let w = w - (w % 2);
                let h = h - (h % 2);
                build_screenshot_args(x, y, w, h, &screenshot_str)
            }
            _ => {
                #[cfg(target_os = "windows")]
                let (monitor_x, monitor_y, monitor_w, monitor_h) = {
                    let mx = source.get("physicalX").or_else(|| source.get("monitorX"))
                        .and_then(|v| v.as_i64()).unwrap_or(0);
                    let my = source.get("physicalY").or_else(|| source.get("monitorY"))
                        .and_then(|v| v.as_i64()).unwrap_or(0);
                    let mw = source.get("physicalWidth").or_else(|| source.get("monitorWidth"))
                        .and_then(|v| v.as_i64());
                    let mh = source.get("physicalHeight").or_else(|| source.get("monitorHeight"))
                        .and_then(|v| v.as_i64());
                    (mx, my, mw, mh)
                };
                #[cfg(not(target_os = "windows"))]
                let (monitor_x, monitor_y, monitor_w, monitor_h) = {
                    let mx = source.get("monitorX").and_then(|v| v.as_i64()).unwrap_or(0);
                    let my = source.get("monitorY").and_then(|v| v.as_i64()).unwrap_or(0);
                    let mw = source.get("monitorWidth").and_then(|v| v.as_i64());
                    let mh = source.get("monitorHeight").and_then(|v| v.as_i64());
                    (mx, my, mw, mh)
                };

                if let (Some(w), Some(h)) = (monitor_w, monitor_h) {
                    let w = (w - (w % 2)).max(2);
                    let h = (h - (h % 2)).max(2);
                    build_screenshot_args(monitor_x, monitor_y, w, h, &screenshot_str)
                } else {
                    build_screenshot_args(0, 0, screen_w as i64, screen_h as i64, &screenshot_str)
                }
            }
        };

        let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        let output = run_ffmpeg(&args_refs).await?;

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
}

#[tauri::command]
pub async fn take_recording_screenshot(app: AppHandle) -> AppResult<String> {
    let state = app.state::<Mutex<AppState>>();
    let temp_dir = {
        let s = state.lock().unwrap();
        s.temp_dir.clone()
    };

    let screenshots_dir = temp_dir.join("screenshots");
    std::fs::create_dir_all(&screenshots_dir).ok();

    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let screenshot_path = screenshots_dir.join(format!("screenshot_{}.png", timestamp));
    let screenshot_str = screenshot_path.to_string_lossy().to_string();

    // Get screen dimensions
    let (screen_w, screen_h) = if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = main_win.current_monitor() {
            let size = monitor.size();
            #[cfg(target_os = "windows")]
            { (size.width as i64, size.height as i64) }
            #[cfg(not(target_os = "windows"))]
            {
                let scale = monitor.scale_factor();
                ((size.width as f64 / scale) as i64, (size.height as f64 / scale) as i64)
            }
        } else {
            (1920i64, 1080i64)
        }
    } else {
        (1920i64, 1080i64)
    };

    let args = build_screenshot_args(0, 0, screen_w, screen_h, &screenshot_str);
    let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let _output = run_ffmpeg(&args_refs).await?;

    if screenshot_path.exists() {
        // Open the screenshots folder in the file explorer
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("explorer")
                .arg("/select,")
                .arg(&screenshot_str)
                .spawn();
        }
        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("open")
                .arg("-R")
                .arg(&screenshot_str)
                .spawn();
        }
        #[cfg(target_os = "linux")]
        {
            let _ = std::process::Command::new("xdg-open")
                .arg(screenshots_dir.to_string_lossy().to_string())
                .spawn();
        }
        Ok(screenshot_str)
    } else {
        Err(AppError::General("Screenshot capture failed".to_string()))
    }
}

/// Get the platform-specific FFmpeg capture format for screen recording
fn platform_capture_format() -> &'static str {
    #[cfg(target_os = "windows")]
    { "gdigrab" }
    #[cfg(target_os = "macos")]
    { "avfoundation" }
    #[cfg(target_os = "linux")]
    { "x11grab" }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    { "x11grab" }
}

/// Get the platform default audio capture device name
fn platform_default_audio_device() -> String {
    #[cfg(target_os = "windows")]
    { "virtual-audio-capturer".to_string() }
    #[cfg(target_os = "macos")]
    {
        // Try to detect available virtual audio devices via FFmpeg
        // Common options: BlackHole 2ch, Soundflower (2ch), Background Music
        if let Some(ffmpeg) = find_ffmpeg_path() {
            if let Ok(output) = std::process::Command::new(&ffmpeg)
                .args(["-f", "avfoundation", "-list_devices", "true", "-i", ""])
                .stderr(std::process::Stdio::piped())
                .stdout(std::process::Stdio::null())
                .output()
            {
                let stderr = String::from_utf8_lossy(&output.stderr);
                for name in ["BlackHole 2ch", "BlackHole 16ch", "Soundflower (2ch)", "Background Music"] {
                    if stderr.contains(name) {
                        log::info!("[audio] Found macOS virtual audio device: {}", name);
                        return name.to_string();
                    }
                }
            }
        }
        log::warn!("[audio] No virtual audio device found on macOS. System audio recording requires BlackHole or similar.");
        "BlackHole 2ch".to_string()
    }
    #[cfg(target_os = "linux")]
    { "default".to_string() }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    { "default".to_string() }
}

/// Get platform-specific audio capture FFmpeg args (format, input)
fn platform_audio_capture_args(device: &str) -> (String, String) {
    #[cfg(target_os = "windows")]
    {
        ("dshow".to_string(), format!("audio={}", device))
    }
    #[cfg(target_os = "macos")]
    {
        // avfoundation audio: "none:<audio_device_index_or_name>"
        ("avfoundation".to_string(), format!("none:{}", device))
    }
    #[cfg(target_os = "linux")]
    {
        ("pulse".to_string(), device.to_string())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        ("pulse".to_string(), device.to_string())
    }
}

/// Run FFmpeg with the given arguments and return the output.
/// Uses std::process::Command for consistent cross-platform behavior.
async fn run_ffmpeg(args: &[&str]) -> AppResult<std::process::Output> {
    let ffmpeg_path = find_ffmpeg_path().ok_or_else(|| {
        AppError::General("FFmpeg binary not found. Please install FFmpeg.".to_string())
    })?;
    let path = ffmpeg_path.clone();
    let args_owned: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    tokio::task::spawn_blocking(move || {
        let mut cmd = std::process::Command::new(&path);
        cmd.args(&args_owned)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        cmd.output().map_err(|e| AppError::General(format!("FFmpeg error: {}", e)))
    })
    .await
    .map_err(|e| AppError::General(format!("FFmpeg task error: {}", e)))?
}

/// Build platform-specific FFmpeg args for taking a single screenshot
fn build_screenshot_args(x: i64, y: i64, w: i64, h: i64, output_path: &str) -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        vec![
            "-y".into(), "-f".into(), "gdigrab".into(),
            "-framerate".into(), "1".into(), "-draw_mouse".into(), "0".into(),
            "-offset_x".into(), x.to_string(), "-offset_y".into(), y.to_string(),
            "-video_size".into(), format!("{}x{}", w, h),
            "-i".into(), "desktop".into(),
            "-frames:v".into(), "1".into(), "-update".into(), "true".into(),
            output_path.into(),
        ]
    }
    #[cfg(target_os = "macos")]
    {
        let screen_dev = macos_screen_device_index(0);
        let mut args: Vec<String> = vec![
            "-y".into(), "-f".into(), "avfoundation".into(),
            "-framerate".into(), "30".into(), "-capture_cursor".into(), "0".into(),
            "-i".into(), format!("{}:none", screen_dev),
            "-frames:v".into(), "1".into(),
        ];
        // Crop to the requested region (works for all cases including x=0,y=0)
        args.extend(["-vf".into(), format!("crop={}:{}:{}:{}", w, h, x, y)]);
        args.push(output_path.into());
        args
    }
    #[cfg(target_os = "linux")]
    {
        let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());
        vec![
            "-y".into(), "-f".into(), "x11grab".into(),
            "-framerate".into(), "1".into(), "-draw_mouse".into(), "0".into(),
            "-video_size".into(), format!("{}x{}", w, h),
            "-i".into(), format!("{}+{},{}", display, x, y),
            "-frames:v".into(), "1".into(), "-update".into(), "true".into(),
            output_path.into(),
        ]
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        vec![
            "-y".into(), "-f".into(), "x11grab".into(),
            "-framerate".into(), "1".into(),
            "-video_size".into(), format!("{}x{}", w, h),
            "-i".into(), format!(":0+{},{}", x, y),
            "-frames:v".into(), "1".into(),
            output_path.into(),
        ]
    }
}

#[tauri::command]
pub async fn init_camera_file(app: AppHandle) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    // Open the camera file for writing so chunks can be streamed directly to disk
    let recording_id = state
        .recording_id
        .clone()
        .or_else(|| state.project_id.clone())
        .ok_or(AppError::NoProjectOpen)?;
    let path = state.camera_video_file(&recording_id);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let file = std::fs::File::create(&path)?;
    state.camera_file_handle = Some(file);
    Ok(())
}

#[tauri::command]
pub async fn enqueue_camera_chunk(app: AppHandle, chunk: Vec<u8>) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    // Write chunk directly to disk instead of accumulating in memory
    if let Some(ref mut file) = state.camera_file_handle {
        std::io::Write::write_all(file, &chunk)?;
    } else {
        return Err(AppError::General("Camera file not initialized".to_string()));
    }
    Ok(())
}

#[tauri::command]
pub async fn finalize_camera_file(app: AppHandle) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    // Flush and close the file handle
    if let Some(mut file) = state.camera_file_handle.take() {
        std::io::Write::flush(&mut file)?;
    }
    Ok(())
}
