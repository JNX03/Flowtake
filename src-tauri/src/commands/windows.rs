use crate::error::{AppError, AppResult};
use crate::state::AppState;
use base64::Engine as _;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_store::StoreExt;

/// Read the content-protection preference from the store.
/// Returns `true` (protected / hidden from capture) when the key is absent.
pub fn is_content_protection_enabled(app: &AppHandle) -> bool {
    app.store("store.json")
        .ok()
        .and_then(|s| s.get("contentProtectionEnabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(true)
}

#[tauri::command]
pub async fn set_content_protection(app: AppHandle, enabled: bool) -> AppResult<()> {
    // Persist to store
    let store = app
        .store("store.json")
        .map_err(|e| AppError::General(e.to_string()))?;
    store.set("contentProtectionEnabled", Value::Bool(enabled));
    store.save().map_err(|e| AppError::General(e.to_string()))?;

    // Apply to every existing window except drawingOverlay
    for (label, window) in app.webview_windows() {
        if label == "drawingOverlay" {
            continue;
        }
        window.set_content_protected(enabled).ok();
    }

    Ok(())
}

#[cfg(target_os = "windows")]
use windows::core::BOOL;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::RECT;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{HWND, LPARAM};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, SystemParametersInfoW,
    SPI_GETWORKAREA,
};

#[cfg(target_os = "macos")]
use core_foundation::array::{CFArray, CFArrayRef};
#[cfg(target_os = "macos")]
use core_foundation::base::{TCFType, ToVoid};
#[cfg(target_os = "macos")]
use core_foundation::dictionary::{CFDictionaryGetValueIfPresent, CFDictionaryRef};
#[cfg(target_os = "macos")]
use core_foundation::number::{CFNumber, CFNumberRef};
#[cfg(target_os = "macos")]
use core_foundation::string::{CFString, CFStringRef};
#[cfg(target_os = "macos")]
use core_graphics::window::{
    kCGNullWindowID, kCGWindowListExcludeDesktopElements, kCGWindowListOptionOnScreenOnly,
};

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGWindowListCopyWindowInfo(option: u32, relative_to_window: u32) -> CFArrayRef;
}

#[tauri::command]
pub async fn close_window(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.close().map_err(AppError::Tauri)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn destroy_window(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.destroy().map_err(AppError::Tauri)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_window_picker(app: AppHandle) -> AppResult<()> {
    // Hide main window first
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.hide().map_err(AppError::Tauri)?;
    }

    // Get work area dimensions (screen minus taskbar on Windows)
    let (overlay_x, overlay_y, overlay_w, overlay_h) = {
        let monitors = app.available_monitors().unwrap_or_default();
        let scale = monitors.first().map(|m| m.scale_factor()).unwrap_or(1.0);

        #[cfg(target_os = "windows")]
        {
            let mut work_area = RECT::default();
            let result = unsafe {
                SystemParametersInfoW(
                    SPI_GETWORKAREA,
                    0,
                    Some(&mut work_area as *mut RECT as *mut std::ffi::c_void),
                    Default::default(),
                )
            };
            if result.is_ok() {
                (
                    work_area.left as f64 / scale,
                    work_area.top as f64 / scale,
                    (work_area.right - work_area.left) as f64 / scale,
                    (work_area.bottom - work_area.top) as f64 / scale,
                )
            } else {
                if let Some(monitor) = monitors.first() {
                    let size = monitor.size();
                    (
                        0.0,
                        0.0,
                        size.width as f64 / scale,
                        size.height as f64 / scale,
                    )
                } else {
                    (0.0, 0.0, 1920.0, 1080.0)
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            if let Some(monitor) = monitors.first() {
                let size = monitor.size();
                (
                    0.0,
                    0.0,
                    size.width as f64 / scale,
                    size.height as f64 / scale,
                )
            } else {
                (0.0, 0.0, 1920.0, 1080.0)
            }
        }
    };

    // Use the same desktop snapshot as area mode so the picker remains usable on
    // platforms where transparent webview windows render opaque.
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    capture_desktop_screenshot(&app).await.ok();

    log::info!(
        "[window_picker] Overlay area: {}x{} at ({}, {})",
        overlay_w,
        overlay_h,
        overlay_x,
        overlay_y
    );

    // Transparent overlay with window outlines (excludes taskbar)
    let _window = WebviewWindowBuilder::new(
        &app,
        "windowPicker",
        WebviewUrl::App("app/windows/windowPicker/index.html".into()),
    )
    .title("Select Window - Flowtake")
    .inner_size(overlay_w, overlay_h)
    .position(overlay_x, overlay_y)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .build()
    .map_err(AppError::Tauri)?;

    Ok(())
}

#[tauri::command]
pub async fn toggle_drawing_overlay(app: AppHandle) -> AppResult<()> {
    // If drawing window exists, close it
    if let Some(win) = app.get_webview_window("drawingOverlay") {
        win.close().map_err(AppError::Tauri)?;
        return Ok(());
    }

    // Get primary monitor dimensions
    let (mon_w, mon_h) = {
        let monitors = app.available_monitors().unwrap_or_default();
        if let Some(monitor) = monitors.first() {
            let size = monitor.size();
            let scale = monitor.scale_factor();
            ((size.width as f64 / scale), (size.height as f64 / scale))
        } else {
            (1920.0, 1080.0)
        }
    };

    let _window = WebviewWindowBuilder::new(
        &app,
        "drawingOverlay",
        WebviewUrl::App("app/windows/drawing/index.html".into()),
    )
    .title("Drawing - Flowtake")
    .inner_size(mon_w, mon_h)
    .position(0.0, 0.0)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .content_protected(false) // drawings must be visible in the recording
    .build()
    .map_err(AppError::Tauri)?;

    Ok(())
}

/// Capture a desktop screenshot and save it to temp dir for the window/area picker background
/// Capture the desktop to a BMP file using native GDI (Windows only).
/// Much faster than spawning FFmpeg (~20ms vs ~3s).
#[cfg(target_os = "windows")]
fn capture_desktop_to_bmp(screenshot_path: &std::path::Path) -> Result<(), String> {
    use windows::Win32::Graphics::Gdi::*;
    use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};

    unsafe {
        let width = GetSystemMetrics(SM_CXSCREEN);
        let height = GetSystemMetrics(SM_CYSCREEN);

        if width <= 0 || height <= 0 {
            return Err("Invalid screen dimensions".into());
        }

        let hdc_screen = GetDC(None);
        if hdc_screen.is_invalid() {
            return Err("Failed to get screen DC".into());
        }

        let hdc_mem = CreateCompatibleDC(Some(hdc_screen));
        let hbmp = CreateCompatibleBitmap(hdc_screen, width, height);
        let old_obj = SelectObject(hdc_mem, hbmp.into());

        let _ = BitBlt(
            hdc_mem,
            0,
            0,
            width,
            height,
            Some(hdc_screen),
            0,
            0,
            SRCCOPY,
        );

        // Extract 24-bit BGR pixel data in bottom-up order (native BMP layout)
        let row_stride = ((width as usize * 3) + 3) & !3usize;
        let data_size = row_stride * height as usize;
        let mut pixels = vec![0u8; data_size];

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: height,
                biPlanes: 1,
                biBitCount: 24,
                biCompression: BI_RGB.0,
                biSizeImage: data_size as u32,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default()],
        };

        GetDIBits(
            hdc_mem,
            hbmp,
            0,
            height as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        SelectObject(hdc_mem, old_obj);
        let _ = DeleteObject(hbmp.into());
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(None, hdc_screen);

        // Build BMP file: 14-byte file header + 40-byte DIB header + pixel data
        let pixel_offset: u32 = 54;
        let file_size = pixel_offset + data_size as u32;
        let mut bmp = Vec::with_capacity(file_size as usize);

        // BMP file header (14 bytes)
        bmp.extend_from_slice(b"BM");
        bmp.extend_from_slice(&file_size.to_le_bytes());
        bmp.extend_from_slice(&[0u8; 4]);
        bmp.extend_from_slice(&pixel_offset.to_le_bytes());

        // BITMAPINFOHEADER (40 bytes)
        bmp.extend_from_slice(&40u32.to_le_bytes());
        bmp.extend_from_slice(&width.to_le_bytes());
        bmp.extend_from_slice(&height.to_le_bytes());
        bmp.extend_from_slice(&1u16.to_le_bytes());
        bmp.extend_from_slice(&24u16.to_le_bytes());
        bmp.extend_from_slice(&0u32.to_le_bytes());
        bmp.extend_from_slice(&(data_size as u32).to_le_bytes());
        bmp.extend_from_slice(&0i32.to_le_bytes());
        bmp.extend_from_slice(&0i32.to_le_bytes());
        bmp.extend_from_slice(&0u32.to_le_bytes());
        bmp.extend_from_slice(&0u32.to_le_bytes());

        bmp.extend_from_slice(&pixels);

        std::fs::write(screenshot_path, &bmp).map_err(|e| format!("Write BMP failed: {e}"))?;

        Ok(())
    }
}

async fn capture_desktop_screenshot(app: &AppHandle) -> AppResult<()> {
    let state = app.state::<std::sync::Mutex<AppState>>();
    let temp_dir = {
        let s = state.lock().unwrap();
        s.temp_dir.clone()
    };
    std::fs::create_dir_all(&temp_dir).ok();

    // Native GDI capture on Windows - instant, no FFmpeg process overhead
    #[cfg(target_os = "windows")]
    {
        let screenshot_path = temp_dir.join("picker_bg.bmp");
        return tokio::task::spawn_blocking(move || capture_desktop_to_bmp(&screenshot_path))
            .await
            .map_err(|e| AppError::General(format!("Join error: {e}")))?
            .map_err(AppError::General);
    }

    #[cfg(target_os = "macos")]
    {
        let screenshot_path = temp_dir.join("picker_bg.png");
        let screenshot_str = screenshot_path.to_string_lossy().to_string();
        let output = super::run_macos_screencapture(
            &["-x", &screenshot_str],
            std::time::Duration::from_secs(5),
        )
        .await?;

        if !output.status.success() {
            return Err(AppError::General(format!(
                "screencapture failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }

        Ok(())
    }

    // FFmpeg-based capture for Linux
    #[cfg(target_os = "linux")]
    {
        let screenshot_path = temp_dir.join("picker_bg.png");
        let screenshot_str = screenshot_path.to_string_lossy().to_string();

        let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());
        let display_input = format!("{}+0,0", display);
        let args = vec![
            "-y",
            "-f",
            "x11grab",
            "-framerate",
            "1",
            "-draw_mouse",
            "0",
            "-i",
            &display_input,
            "-frames:v",
            "1",
            "-update",
            "true",
            &screenshot_str,
        ];

        let output = super::ffmpeg_from_app(app)?
            .args(&args)
            .output()
            .await
            .map_err(|e| AppError::General(format!("FFmpeg error: {}", e)))?;

        if !output.status.success() {
            log::warn!(
                "[FFmpeg picker bg] stderr: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }
        Ok(())
    }
}

#[tauri::command]
pub async fn get_picker_screenshot(app: AppHandle) -> AppResult<String> {
    let state = app.state::<std::sync::Mutex<AppState>>();
    let temp_dir = {
        let s = state.lock().unwrap();
        s.temp_dir.clone()
    };

    // Return a data URL so picker overlays do not depend on asset-protocol
    // image loading while their custom CSP and transparent windows are active.
    let bmp_path = temp_dir.join("picker_bg.bmp");
    let png_path = temp_dir.join("picker_bg.png");

    let (screenshot_path, mime_type) = if bmp_path.exists() {
        (bmp_path, "image/bmp")
    } else if png_path.exists() {
        (png_path, "image/png")
    } else {
        return Err(AppError::General("No picker screenshot available".into()));
    };

    let bytes = std::fs::read(&screenshot_path)?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{};base64,{}", mime_type, encoded))
}

#[tauri::command]
pub async fn close_window_picker_window(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("windowPicker") {
        window.close().map_err(AppError::Tauri)?;
    }
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.show().map_err(AppError::Tauri)?;
        main_win.set_focus().ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn select_window(app: AppHandle, window: Value) -> AppResult<()> {
    if let Some(picker) = app.get_webview_window("windowPicker") {
        picker.close().map_err(AppError::Tauri)?;
    }
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.show().map_err(AppError::Tauri)?;
        main_win.set_focus().ok();
    }
    app.emit_to("main", "window-selected", &window).ok();
    Ok(())
}

#[tauri::command]
pub async fn get_windows(app: AppHandle) -> AppResult<Value> {
    // Screen dimensions used for clamping enumerated window bounds.
    // - Windows: bounds come from GetWindowRect in physical pixels, but the PowerShell
    //   C# host is DPI-unaware so it reports already-scaled-down pixels; divide by scale.
    // - macOS: enumerate_windows_macos now returns physical pixels (logical points * scale),
    //   so clamp against physical screen dimensions directly.
    let (screen_w, screen_h) = if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = main_win.current_monitor() {
            let size = monitor.size();
            #[cfg(target_os = "macos")]
            let dims = (size.width as i64, size.height as i64);
            #[cfg(not(target_os = "macos"))]
            let dims = {
                let scale = monitor.scale_factor();
                (
                    (size.width as f64 / scale) as i64,
                    (size.height as f64 / scale) as i64,
                )
            };
            dims
        } else {
            (1920, 1080)
        }
    } else {
        (1920, 1080)
    };

    // Get our own process ID to filter out our windows
    let our_pid = std::process::id();

    // Platform-specific window enumeration
    let output = tauri::async_runtime::spawn(async move { enumerate_windows_platform(our_pid) })
        .await
        .unwrap_or(Value::Array(vec![]));

    // Ensure it's always an array
    let windows = match output {
        Value::Array(arr) => arr,
        obj @ Value::Object(_) => vec![obj],
        _ => vec![],
    };

    // Filter out Flowtake windows by exact title match + system windows
    // The PID tree filter may miss windows if WebView2 process isn't registered yet
    let flowtake_titles: Vec<&str> = vec![
        "flowtake",
        "select window - flowtake",
        "window picker - flowtake",
        "recording - flowtake",
        "select area",
        "select area - flowtake",
    ];

    let filtered: Vec<Value> = windows
        .into_iter()
        .filter(|w| {
            let name = w
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            name != "program manager" && !flowtake_titles.contains(&name.as_str())
        })
        .map(|mut w| {
            // Clamp coordinates to screen bounds (like original limitCoordsToScreen)
            if let Value::Object(ref mut obj) = w {
                let x = obj.get("x").and_then(|v| v.as_i64()).unwrap_or(0);
                let y = obj.get("y").and_then(|v| v.as_i64()).unwrap_or(0);
                let width = obj.get("width").and_then(|v| v.as_i64()).unwrap_or(0);
                let height = obj.get("height").and_then(|v| v.as_i64()).unwrap_or(0);

                let clamped_x = x.max(0);
                let clamped_y = y.max(0);
                let clamped_w = (width - (clamped_x - x)).min(screen_w - clamped_x);
                let clamped_h = (height - (clamped_y - y)).min(screen_h - clamped_y);

                if clamped_w <= 0 || clamped_h <= 0 {
                    return Value::Null; // will be filtered
                }

                obj.insert("x".to_string(), serde_json::json!(clamped_x));
                obj.insert("y".to_string(), serde_json::json!(clamped_y));
                obj.insert("width".to_string(), serde_json::json!(clamped_w));
                obj.insert("height".to_string(), serde_json::json!(clamped_h));
            }
            w
        })
        .filter(|w| !w.is_null())
        .collect();

    log::info!("[get_windows] Returning {} windows", filtered.len());
    Ok(Value::Array(filtered))
}

#[tauri::command]
pub async fn open_area_picker(app: AppHandle) -> AppResult<()> {
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.hide().map_err(AppError::Tauri)?;
    }

    // Brief delay for window hide to take effect
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    capture_desktop_screenshot(&app).await.ok();

    // Get primary monitor dimensions
    let (mon_w, mon_h) = {
        let monitors = app.available_monitors().unwrap_or_default();
        if let Some(monitor) = monitors.first() {
            let size = monitor.size();
            let scale = monitor.scale_factor();
            ((size.width as f64 / scale), (size.height as f64 / scale))
        } else {
            (1920.0, 1080.0)
        }
    };

    let _window = WebviewWindowBuilder::new(
        &app,
        "areaPicker",
        WebviewUrl::App("app/windows/areaPicker/index.html".into()),
    )
    .title("Select Area")
    .inner_size(mon_w, mon_h)
    .position(0.0, 0.0)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .transparent(true)
    .build()
    .map_err(AppError::Tauri)?;

    Ok(())
}

#[tauri::command]
pub async fn close_area_picker_window(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("areaPicker") {
        window.close().map_err(AppError::Tauri)?;
    }
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.show().map_err(AppError::Tauri)?;
        main_win.set_focus().ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn select_area(app: AppHandle, selected_area: Value) -> AppResult<()> {
    if let Some(picker) = app.get_webview_window("areaPicker") {
        picker.close().map_err(AppError::Tauri)?;
    }
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.show().map_err(AppError::Tauri)?;
        main_win.set_focus().ok();
    }
    app.emit_to("main", "area-selected", &selected_area).ok();
    Ok(())
}

#[tauri::command]
pub async fn add_note(app: AppHandle) -> AppResult<()> {
    let note_id = format!("note-{}", uuid::Uuid::new_v4());
    let _window = WebviewWindowBuilder::new(
        &app,
        &note_id,
        WebviewUrl::App("app/windows/note/index.html".into()),
    )
    .title("Teleprompter")
    .inner_size(460.0, 580.0)
    .min_inner_size(320.0, 300.0)
    .resizable(true)
    .decorations(false)
    .always_on_top(true)
    .content_protected(is_content_protection_enabled(&app))
    .build()
    .map_err(AppError::Tauri)?;

    Ok(())
}

#[tauri::command]
pub async fn get_monitors(app: AppHandle) -> AppResult<Value> {
    let monitors = app.available_monitors().map_err(AppError::Tauri)?;
    let primary = app.primary_monitor().ok().flatten();

    let mut result = Vec::new();
    for (i, monitor) in monitors.iter().enumerate() {
        let pos = monitor.position();
        let size = monitor.size();
        let scale = monitor.scale_factor();
        let is_primary = primary
            .as_ref()
            .map(|p| p.position() == monitor.position() && p.size() == monitor.size())
            .unwrap_or(i == 0);

        let fallback_name = format!("Monitor {}", i + 1);
        let name = monitor.name().unwrap_or(&fallback_name);

        // Logical pixels for UI layout, physical pixels for FFmpeg capture
        let logical_x = (pos.x as f64 / scale) as i32;
        let logical_y = (pos.y as f64 / scale) as i32;
        let logical_w = (size.width as f64 / scale) as u32;
        let logical_h = (size.height as f64 / scale) as u32;

        result.push(serde_json::json!({
            "id": format!("monitor-{}", i),
            "name": name,
            "index": i,
            "x": logical_x,
            "y": logical_y,
            "width": logical_w,
            "height": logical_h,
            "physicalX": pos.x,
            "physicalY": pos.y,
            "physicalWidth": size.width,
            "physicalHeight": size.height,
            "scaleFactor": scale,
            "isPrimary": is_primary,
        }));
    }

    Ok(Value::Array(result))
}

/// Detect the window at a given screen point by enumerating windows in z-order.
/// No hiding/showing - just finds the topmost non-Flowtake window containing the point.
#[tauri::command]
pub async fn get_window_at_point(_app: AppHandle, x: i32, y: i32) -> AppResult<Value> {
    #[cfg(target_os = "windows")]
    {
        use std::sync::Mutex as StdMutex;
        use windows::Win32::UI::WindowsAndMessaging::{
            EnumWindows, GetWindowRect, IsWindowVisible as WinIsVisible,
        };

        let our_pid = std::process::id();
        let flowtake_titles: Vec<String> = vec![
            "flowtake".into(),
            "select window - flowtake".into(),
            "window picker - flowtake".into(),
            "recording - flowtake".into(),
            "select area".into(),
            "select area - flowtake".into(),
        ];

        // Shared result - first matching window found
        let result: std::sync::Arc<StdMutex<Option<Value>>> =
            std::sync::Arc::new(StdMutex::new(None));

        struct CallbackData {
            x: i32,
            y: i32,
            our_pid: u32,
            flowtake_titles: Vec<String>,
            result: std::sync::Arc<StdMutex<Option<Value>>>,
        }

        let data = Box::new(CallbackData {
            x,
            y,
            our_pid,
            flowtake_titles,
            result: result.clone(),
        });
        let data_ptr = Box::into_raw(data);

        unsafe extern "system" fn enum_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let data = &*(lparam.0 as *const CallbackData);

            // Already found a result? Stop.
            if data.result.lock().unwrap().is_some() {
                return BOOL(0);
            }

            // Skip invisible windows
            if !WinIsVisible(hwnd).as_bool() {
                return BOOL(1);
            }

            // Skip our own process
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid == data.our_pid {
                return BOOL(1);
            }

            // Get title
            let len = GetWindowTextLengthW(hwnd);
            if len == 0 {
                return BOOL(1);
            }
            let mut buf = vec![0u16; (len + 1) as usize];
            GetWindowTextW(hwnd, &mut buf);
            let title = String::from_utf16_lossy(&buf[..len as usize]);
            if title.is_empty() || title == "Program Manager" {
                return BOOL(1);
            }

            // Skip Flowtake windows
            let lower = title.to_lowercase();
            if data.flowtake_titles.iter().any(|t| t == &lower) {
                return BOOL(1);
            }

            // Get window rect
            let mut rect = windows::Win32::Foundation::RECT::default();
            let _ = GetWindowRect(hwnd, &mut rect);
            let w = rect.right - rect.left;
            let h = rect.bottom - rect.top;
            if w <= 0 || h <= 0 {
                return BOOL(1);
            }

            // Check if point is inside this window's rect
            if data.x >= rect.left
                && data.x < rect.right
                && data.y >= rect.top
                && data.y < rect.bottom
            {
                // Clamp to avoid negative coords (invisible window borders)
                let cx = rect.left.max(0);
                let cy = rect.top.max(0);
                let cw = w - (cx - rect.left);
                let ch = h - (cy - rect.top);
                let val = serde_json::json!({
                    "name": title,
                    "id": (hwnd.0 as i64).to_string(),
                    "type": "window",
                    "x": cx,
                    "y": cy,
                    "width": cw,
                    "height": ch
                });
                *data.result.lock().unwrap() = Some(val);
                return BOOL(0); // Stop enumeration
            }

            BOOL(1) // Continue
        }

        unsafe {
            let _ = EnumWindows(Some(enum_callback), LPARAM(data_ptr as isize));
            // Clean up
            drop(Box::from_raw(data_ptr));
        }

        let found = result.lock().unwrap().take();
        Ok(found.unwrap_or(Value::Null))
    }

    #[cfg(target_os = "macos")]
    {
        let _ = (_app, x, y);
        // On macOS, use the window list from enumerate_windows and find by point
        let windows = enumerate_windows_platform(std::process::id());
        if let Value::Array(wins) = windows {
            for w in wins {
                let wx = w.get("x").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                let wy = w.get("y").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                let ww = w.get("width").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                let wh = w.get("height").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                if x >= wx && x < wx + ww && y >= wy && y < wy + wh {
                    return Ok(w);
                }
            }
        }
        Ok(Value::Null)
    }

    #[cfg(target_os = "linux")]
    {
        let _ = (_app, x, y);
        // On Linux, use the window list from enumerate_windows and find by point
        let windows = enumerate_windows_platform(std::process::id());
        if let Value::Array(wins) = windows {
            for w in wins {
                let wx = w.get("x").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                let wy = w.get("y").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                let ww = w.get("width").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                let wh = w.get("height").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                if x >= wx && x < wx + ww && y >= wy && y < wy + wh {
                    return Ok(w);
                }
            }
        }
        Ok(Value::Null)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = (_app, x, y);
        Ok(Value::Null)
    }
}

/// Platform-specific window enumeration
fn enumerate_windows_platform(our_pid: u32) -> Value {
    #[cfg(target_os = "windows")]
    {
        enumerate_windows_windows(our_pid)
    }
    #[cfg(target_os = "macos")]
    {
        enumerate_windows_macos(our_pid)
    }
    #[cfg(target_os = "linux")]
    {
        enumerate_windows_linux(our_pid)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = our_pid;
        Value::Array(vec![])
    }
}

#[cfg(target_os = "windows")]
fn enumerate_windows_windows(our_pid: u32) -> Value {
    let pid_line = format!("$appPid = [uint32]{}", our_pid);
    let ps_script = format!(
        "{}\n{}",
        pid_line,
        r#"
$allPids = New-Object 'System.Collections.Generic.HashSet[uint32]'
[void]$allPids.Add($appPid)
$procs = Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId 2>$null
if ($procs) {
    for ($i = 0; $i -lt 3; $i++) {
        $newPids = @()
        foreach ($p in $procs) {
            if ($allPids.Contains([uint32]$p.ParentProcessId) -and -not $allPids.Contains([uint32]$p.ProcessId)) {
                $newPids += [uint32]$p.ProcessId
            }
        }
        if ($newPids.Count -eq 0) { break }
        foreach ($np in $newPids) { [void]$allPids.Add($np) }
    }
}
$pidArray = [uint32[]]@($allPids)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Text;

public class WinEnum {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }
    public static List<Dictionary<string, object>> GetVisibleWindows(uint[] excludePids) {
        var pidSet = new HashSet<uint>(excludePids);
        var result = new List<Dictionary<string, object>>();
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            int len = GetWindowTextLength(hWnd);
            if (len == 0) return true;
            int cloaked = 0;
            DwmGetWindowAttribute(hWnd, 14, out cloaked, sizeof(int));
            if (cloaked != 0) return true;
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pidSet.Contains(pid)) return true;
            StringBuilder sb = new StringBuilder(len + 1);
            GetWindowText(hWnd, sb, sb.Capacity);
            string title = sb.ToString();
            if (string.IsNullOrEmpty(title)) return true;
            if (title == "Program Manager") return true;
            RECT rect;
            GetWindowRect(hWnd, out rect);
            int w = rect.Right - rect.Left;
            int h = rect.Bottom - rect.Top;
            if (w <= 0 || h <= 0) return true;
            var dict = new Dictionary<string, object>();
            dict["name"] = title;
            dict["id"] = hWnd.ToInt64().ToString();
            dict["type"] = "window";
            dict["x"] = rect.Left;
            dict["y"] = rect.Top;
            dict["width"] = w;
            dict["height"] = h;
            result.Add(dict);
            return true;
        }, IntPtr.Zero);
        return result;
    }
}
"@

$windows = [WinEnum]::GetVisibleWindows($pidArray)
if ($windows -eq $null) { $windows = @() }
ConvertTo-Json -InputObject @($windows) -Depth 3
"#
    );

    use std::os::windows::process::CommandExt;
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &ps_script])
        .creation_flags(0x08000000)
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            log::info!("[get_windows] PowerShell stdout length: {}", stdout.len());
            if stdout.trim().is_empty() {
                return Value::Array(vec![]);
            }
            serde_json::from_str::<Value>(&stdout).unwrap_or_else(|e| {
                log::error!("[get_windows] JSON parse error: {}", e);
                Value::Array(vec![])
            })
        }
        Err(e) => {
            log::error!("[get_windows] PowerShell execution error: {}", e);
            Value::Array(vec![])
        }
    }
}

#[cfg(target_os = "macos")]
fn cf_dict_raw_lookup(
    dict: CFDictionaryRef,
    key: &'static str,
) -> Option<*const core::ffi::c_void> {
    let cf_key = CFString::from_static_string(key);
    let mut value: *const core::ffi::c_void = core::ptr::null();
    let present = unsafe { CFDictionaryGetValueIfPresent(dict, cf_key.to_void(), &mut value) };
    if present == 0 || value.is_null() {
        None
    } else {
        Some(value)
    }
}

#[cfg(target_os = "macos")]
fn cf_dict_get_i32(dict: CFDictionaryRef, key: &'static str) -> Option<i32> {
    let value = cf_dict_raw_lookup(dict, key)?;
    let n = unsafe { CFNumber::wrap_under_get_rule(value as CFNumberRef) };
    n.to_i32()
}

#[cfg(target_os = "macos")]
fn cf_dict_get_i64(dict: CFDictionaryRef, key: &'static str) -> Option<i64> {
    let value = cf_dict_raw_lookup(dict, key)?;
    let n = unsafe { CFNumber::wrap_under_get_rule(value as CFNumberRef) };
    n.to_i64()
}

#[cfg(target_os = "macos")]
fn cf_dict_get_f64(dict: CFDictionaryRef, key: &'static str) -> Option<f64> {
    let value = cf_dict_raw_lookup(dict, key)?;
    let n = unsafe { CFNumber::wrap_under_get_rule(value as CFNumberRef) };
    n.to_f64()
}

#[cfg(target_os = "macos")]
fn cf_dict_get_string(dict: CFDictionaryRef, key: &'static str) -> Option<String> {
    let value = cf_dict_raw_lookup(dict, key)?;
    let s = unsafe { CFString::wrap_under_get_rule(value as CFStringRef) };
    Some(s.to_string())
}

#[cfg(target_os = "macos")]
fn cf_dict_get_dict_ref(dict: CFDictionaryRef, key: &'static str) -> Option<CFDictionaryRef> {
    let value = cf_dict_raw_lookup(dict, key)?;
    Some(value as CFDictionaryRef)
}

#[cfg(target_os = "macos")]
fn macos_main_screen_scale() -> f64 {
    use objc::runtime::{Class, Object};
    use objc::{msg_send, sel, sel_impl};
    unsafe {
        let cls = match Class::get("NSScreen") {
            Some(c) => c,
            None => return 1.0,
        };
        let main_screen: *mut Object = msg_send![cls, mainScreen];
        if main_screen.is_null() {
            return 1.0;
        }
        let scale: f64 = msg_send![main_screen, backingScaleFactor];
        if scale > 0.0 {
            scale
        } else {
            1.0
        }
    }
}

#[cfg(target_os = "macos")]
fn enumerate_windows_macos(our_pid: u32) -> Value {
    // Use CGWindowListCopyWindowInfo — fast (~1ms), returns z-order front-to-back,
    // needs only Screen Recording permission (already required by the app).
    let scale = macos_main_screen_scale();
    let options = kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements;

    let array_ref = unsafe { CGWindowListCopyWindowInfo(options, kCGNullWindowID) };
    if array_ref.is_null() {
        log::warn!(
            "[enumerate_windows_macos] CGWindowListCopyWindowInfo returned null \
             (Screen Recording permission likely missing)"
        );
        return Value::Array(vec![]);
    }

    // Untyped CFArray — elements come out as raw *const c_void and we cast each to CFDictionaryRef.
    let window_list: CFArray = unsafe { CFArray::wrap_under_create_rule(array_ref) };

    let mut result: Vec<Value> = Vec::new();

    for i in 0..window_list.len() {
        let dict_ptr = match window_list.get(i) {
            Some(p) => *p,
            None => continue,
        };
        if dict_ptr.is_null() {
            continue;
        }
        let dict_ref = dict_ptr as CFDictionaryRef;

        // Skip our own process' windows (picker overlay, main window, etc.)
        let pid = match cf_dict_get_i32(dict_ref, "kCGWindowOwnerPID") {
            Some(p) => p,
            None => continue,
        };
        if pid as u32 == our_pid {
            continue;
        }

        // Layer 0 = normal application windows. Non-zero layers are dock, menu bar,
        // status items, wallpaper, screensaver, etc. — not pickable.
        let layer = cf_dict_get_i32(dict_ref, "kCGWindowLayer").unwrap_or(99);
        if layer != 0 {
            continue;
        }

        // Prefer the window's own title; fall back to the owning app's name so that
        // windows with an empty kCGWindowName (common when the accessibility client
        // hasn't been granted extra permission) still show something useful.
        let window_name = cf_dict_get_string(dict_ref, "kCGWindowName").unwrap_or_default();
        let owner_name = cf_dict_get_string(dict_ref, "kCGWindowOwnerName").unwrap_or_default();
        let name = if !window_name.is_empty() {
            window_name
        } else {
            owner_name
        };
        if name.is_empty() {
            continue;
        }

        let win_id = match cf_dict_get_i64(dict_ref, "kCGWindowNumber") {
            Some(n) => n,
            None => continue,
        };

        // kCGWindowBounds is a CFDictionary with X, Y, Width, Height in logical points.
        let bounds_ref = match cf_dict_get_dict_ref(dict_ref, "kCGWindowBounds") {
            Some(b) => b,
            None => continue,
        };
        if bounds_ref.is_null() {
            continue;
        }

        let bx = cf_dict_get_f64(bounds_ref, "X").unwrap_or(0.0);
        let by = cf_dict_get_f64(bounds_ref, "Y").unwrap_or(0.0);
        let bw = cf_dict_get_f64(bounds_ref, "Width").unwrap_or(0.0);
        let bh = cf_dict_get_f64(bounds_ref, "Height").unwrap_or(0.0);

        // Drop tiny popovers/tooltips that the user can't meaningfully hover over.
        if bw < 40.0 || bh < 40.0 {
            continue;
        }

        // Convert logical points -> physical pixels so the frontend's dpr-multiplied
        // cursor coords hit-test against bounds in the same space. WindowOutline then
        // divides back by dpr to render in CSS pixels.
        let px = (bx * scale) as i64;
        let py = (by * scale) as i64;
        let pw = (bw * scale) as i64;
        let ph = (bh * scale) as i64;

        result.push(serde_json::json!({
            "name": name,
            "id": win_id.to_string(),
            "type": "window",
            "x": px,
            "y": py,
            "width": pw,
            "height": ph,
        }));
    }

    log::info!(
        "[enumerate_windows_macos] Returning {} windows (scale={})",
        result.len(),
        scale
    );
    Value::Array(result)
}

#[cfg(target_os = "linux")]
fn enumerate_windows_linux(our_pid: u32) -> Value {
    // Use wmctrl -lGp for window enumeration (widely available on X11)
    // Format: <wid> <desktop> <pid> <x> <y> <w> <h> <hostname> <title>
    let output = std::process::Command::new("wmctrl").args(["-lGp"]).output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let mut windows = Vec::new();

            for line in stdout.lines() {
                let parts: Vec<&str> = line.splitn(9, char::is_whitespace).collect();
                let parts: Vec<&str> = parts.into_iter().filter(|s| !s.is_empty()).collect();
                if parts.len() < 8 {
                    continue;
                }

                let wid = parts[0];
                let pid: u32 = parts[2].parse().unwrap_or(0);
                if pid == our_pid {
                    continue;
                }

                let x: i64 = parts[3].parse().unwrap_or(0);
                let y: i64 = parts[4].parse().unwrap_or(0);
                let w: i64 = parts[5].parse().unwrap_or(0);
                let h: i64 = parts[6].parse().unwrap_or(0);
                // Title is everything after hostname (parts[7..])
                let title = if parts.len() >= 9 {
                    parts[8..].join(" ")
                } else {
                    parts[7].to_string()
                };

                if w <= 0 || h <= 0 || title.is_empty() {
                    continue;
                }

                windows.push(serde_json::json!({
                    "name": title,
                    "id": wid,
                    "type": "window",
                    "x": x,
                    "y": y,
                    "width": w,
                    "height": h
                }));
            }

            Value::Array(windows)
        }
        Err(e) => {
            log::warn!(
                "[get_windows] wmctrl not available: {}. Trying xdotool...",
                e
            );
            // Fallback: try xdotool
            enumerate_windows_linux_xdotool(our_pid)
        }
    }
}

#[cfg(target_os = "linux")]
fn enumerate_windows_linux_xdotool(our_pid: u32) -> Value {
    let output = std::process::Command::new("xdotool")
        .args(["search", "--onlyvisible", "--name", ""])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let mut windows = Vec::new();

            for wid_str in stdout.lines() {
                let wid_str = wid_str.trim();
                if wid_str.is_empty() {
                    continue;
                }

                // Get window PID
                let pid_output = std::process::Command::new("xdotool")
                    .args(["getwindowpid", wid_str])
                    .output();
                if let Ok(pid_out) = pid_output {
                    let pid: u32 = String::from_utf8_lossy(&pid_out.stdout)
                        .trim()
                        .parse()
                        .unwrap_or(0);
                    if pid == our_pid {
                        continue;
                    }
                }

                // Get window name
                let name_output = std::process::Command::new("xdotool")
                    .args(["getwindowname", wid_str])
                    .output();
                let title = if let Ok(name_out) = name_output {
                    String::from_utf8_lossy(&name_out.stdout).trim().to_string()
                } else {
                    continue;
                };

                if title.is_empty() {
                    continue;
                }

                // Get window geometry
                let geom_output = std::process::Command::new("xdotool")
                    .args(["getwindowgeometry", "--shell", wid_str])
                    .output();

                if let Ok(geom_out) = geom_output {
                    let geom_str = String::from_utf8_lossy(&geom_out.stdout).to_string();
                    let mut x: i64 = 0;
                    let mut y: i64 = 0;
                    let mut w: i64 = 0;
                    let mut h: i64 = 0;

                    for line in geom_str.lines() {
                        if let Some(val) = line.strip_prefix("X=") {
                            x = val.parse().unwrap_or(0);
                        } else if let Some(val) = line.strip_prefix("Y=") {
                            y = val.parse().unwrap_or(0);
                        } else if let Some(val) = line.strip_prefix("WIDTH=") {
                            w = val.parse().unwrap_or(0);
                        } else if let Some(val) = line.strip_prefix("HEIGHT=") {
                            h = val.parse().unwrap_or(0);
                        }
                    }

                    if w > 0 && h > 0 {
                        windows.push(serde_json::json!({
                            "name": title,
                            "id": wid_str,
                            "type": "window",
                            "x": x,
                            "y": y,
                            "width": w,
                            "height": h
                        }));
                    }
                }
            }

            Value::Array(windows)
        }
        Err(e) => {
            log::error!("[get_windows] xdotool also not available: {}", e);
            Value::Array(vec![])
        }
    }
}
