use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{HWND, BOOL, LPARAM};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowTextW, GetWindowTextLengthW,
    GetWindowThreadProcessId,
};

#[tauri::command]
pub async fn close_window(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.close().map_err(|e| AppError::Tauri(e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn destroy_window(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.destroy().map_err(|e| AppError::Tauri(e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_window_picker(app: AppHandle) -> AppResult<()> {
    // Hide main window first
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.hide().map_err(|e| AppError::Tauri(e))?;
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

    log::info!("[window_picker] Monitor size: {}x{}", mon_w, mon_h);

    // Transparent fullscreen overlay with window outlines
    let _window = WebviewWindowBuilder::new(
        &app,
        "windowPicker",
        WebviewUrl::App("src/renderer/windowPicker/index.html".into()),
    )
    .title("Select Window - Flowtake")
    .inner_size(mon_w, mon_h)
    .position(0.0, 0.0)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .content_protected(true)
    .build()
    .map_err(|e| AppError::Tauri(e))?;

    Ok(())
}

/// Capture a desktop screenshot and save it to temp dir for the window/area picker background
async fn capture_desktop_screenshot(app: &AppHandle) -> AppResult<()> {
    use tauri_plugin_shell::ShellExt;

    let state = app.state::<std::sync::Mutex<AppState>>();
    let temp_dir = {
        let s = state.lock().unwrap();
        s.temp_dir.clone()
    };
    std::fs::create_dir_all(&temp_dir).ok();
    let screenshot_path = temp_dir.join("picker_bg.png");
    let screenshot_str = screenshot_path.to_string_lossy().to_string();

    let shell = app.shell();
    let output = shell
        .sidecar("ffmpeg")
        .map_err(|e| AppError::General(format!("FFmpeg sidecar error: {}", e)))?
        .args([
            "-y", "-f", "gdigrab", "-framerate", "1", "-draw_mouse", "0",
            "-i", "desktop", "-frames:v", "1", "-update", "true", &screenshot_str,
        ])
        .output()
        .await
        .map_err(|e| AppError::General(format!("FFmpeg error: {}", e)))?;

    if !output.status.success() {
        log::warn!("[FFmpeg picker bg] stderr: {}", String::from_utf8_lossy(&output.stderr));
    }
    Ok(())
}

#[tauri::command]
pub async fn get_picker_screenshot(app: AppHandle) -> AppResult<String> {
    use base64::Engine;

    let state = app.state::<std::sync::Mutex<AppState>>();
    let temp_dir = {
        let s = state.lock().unwrap();
        s.temp_dir.clone()
    };
    let screenshot_path = temp_dir.join("picker_bg.png");

    if screenshot_path.exists() {
        let data = std::fs::read(&screenshot_path)?;
        if !data.is_empty() {
            let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
            return Ok(format!("data:image/png;base64,{}", b64));
        }
    }
    Err(AppError::General("No picker screenshot available".to_string()))
}

#[tauri::command]
pub async fn close_window_picker_window(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("windowPicker") {
        window.close().map_err(|e| AppError::Tauri(e))?;
    }
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.show().map_err(|e| AppError::Tauri(e))?;
        main_win.set_focus().ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn select_window(app: AppHandle, window: Value) -> AppResult<()> {
    if let Some(picker) = app.get_webview_window("windowPicker") {
        picker.close().map_err(|e| AppError::Tauri(e))?;
    }
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.show().map_err(|e| AppError::Tauri(e))?;
        main_win.set_focus().ok();
    }
    app.emit_to("main", "window-selected", &window).ok();
    Ok(())
}

#[tauri::command]
pub async fn get_windows(app: AppHandle) -> AppResult<Value> {
    // Get screen dimensions in logical pixels for coordinate clamping
    // (matching C# DPI-unaware coordinates)
    let (screen_w, screen_h) = if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = main_win.current_monitor() {
            let size = monitor.size();
            let scale = monitor.scale_factor();
            ((size.width as f64 / scale) as i64, (size.height as f64 / scale) as i64)
        } else {
            (1920, 1080)
        }
    } else {
        (1920, 1080)
    };

    // Get our own process ID to filter out our windows
    let our_pid = std::process::id();

    // Use PowerShell to enumerate visible windows with their position and size
    let output = tauri::async_runtime::spawn(async move {
        // Build script with PID injected at the top as a PowerShell variable
        let pid_line = format!("$appPid = [uint32]{}", our_pid);
        let ps_script = format!("{}\n{}", pid_line, r#"
# Collect entire process tree (flowtake.exe + WebView2 child processes)
$allPids = New-Object 'System.Collections.Generic.HashSet[uint32]'
[void]$allPids.Add($appPid)
$procs = Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId 2>$null
if ($procs) {
    # Find children recursively (up to 3 levels for WebView2)
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
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    public static List<Dictionary<string, object>> GetVisibleWindows(uint[] excludePids) {
        // NOTE: No SetProcessDpiAwareness - coordinates stay in logical/virtualized pixels
        // matching FFmpeg gdigrab which is also DPI-unaware
        var pidSet = new HashSet<uint>(excludePids);
        var result = new List<Dictionary<string, object>>();
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            int len = GetWindowTextLength(hWnd);
            if (len == 0) return true;

            // Skip cloaked windows
            int cloaked = 0;
            DwmGetWindowAttribute(hWnd, 14, out cloaked, sizeof(int));
            if (cloaked != 0) return true;

            // Skip any window belonging to Flowtake process tree
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pidSet.Contains(pid)) return true;

            StringBuilder sb = new StringBuilder(len + 1);
            GetWindowText(hWnd, sb, sb.Capacity);
            string title = sb.ToString();

            if (string.IsNullOrEmpty(title)) return true;

            // Skip known system windows
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
"#);

        #[cfg(target_os = "windows")]
        let output = {
            use std::os::windows::process::CommandExt;
            std::process::Command::new("powershell")
                .args(["-NoProfile", "-Command", &ps_script])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output()
        };
        #[cfg(not(target_os = "windows"))]
        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_script])
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
    })
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
        main_win.hide().map_err(|e| AppError::Tauri(e))?;
    }

    // Small delay then capture screenshot of desktop without main window
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
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
        WebviewUrl::App("src/renderer/areaPicker/index.html".into()),
    )
    .title("Select Area")
    .inner_size(mon_w, mon_h)
    .position(0.0, 0.0)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .build()
    .map_err(|e| AppError::Tauri(e))?;

    Ok(())
}

#[tauri::command]
pub async fn close_area_picker_window(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("areaPicker") {
        window.close().map_err(|e| AppError::Tauri(e))?;
    }
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.show().map_err(|e| AppError::Tauri(e))?;
        main_win.set_focus().ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn select_area(app: AppHandle, selected_area: Value) -> AppResult<()> {
    if let Some(picker) = app.get_webview_window("areaPicker") {
        picker.close().map_err(|e| AppError::Tauri(e))?;
    }
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.show().map_err(|e| AppError::Tauri(e))?;
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
        WebviewUrl::App("src/renderer/note/index.html".into()),
    )
    .title("Note")
    .inner_size(300.0, 200.0)
    .resizable(true)
    .decorations(true)
    .always_on_top(true)
    .content_protected(true)
    .build()
    .map_err(|e| AppError::Tauri(e))?;

    Ok(())
}

/// Detect the window at a given screen point by enumerating windows in z-order.
/// No hiding/showing - just finds the topmost non-Flowtake window containing the point.
#[tauri::command]
pub async fn get_window_at_point(_app: AppHandle, x: i32, y: i32) -> AppResult<Value> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            EnumWindows, GetWindowRect, IsWindowVisible as WinIsVisible,
        };
        use std::sync::Mutex as StdMutex;

        let our_pid = std::process::id();
        let flowtake_titles: Vec<String> = vec![
            "flowtake".into(), "select window - flowtake".into(),
            "window picker - flowtake".into(), "recording - flowtake".into(),
            "select area".into(), "select area - flowtake".into(),
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
            x, y, our_pid, flowtake_titles, result: result.clone(),
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
            if len == 0 { return BOOL(1); }
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
            if w <= 0 || h <= 0 { return BOOL(1); }

            // Check if point is inside this window's rect
            if data.x >= rect.left && data.x < rect.right &&
               data.y >= rect.top && data.y < rect.bottom {
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
            let _ = EnumWindows(
                Some(enum_callback),
                LPARAM(data_ptr as isize),
            );
            // Clean up
            drop(Box::from_raw(data_ptr));
        }

        let found = result.lock().unwrap().take();
        Ok(found.unwrap_or(Value::Null))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, x, y);
        Ok(Value::Null)
    }
}
