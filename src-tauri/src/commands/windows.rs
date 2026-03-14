use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

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
    // Hide main window first so it doesn't appear in the screenshot
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.hide().map_err(|e| AppError::Tauri(e))?;
    }

    // Small delay to let the window actually hide before capturing
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    // Capture a screenshot of the desktop showing all other windows
    capture_desktop_screenshot(&app).await.ok();

    // Get primary monitor size for fullscreen picker
    let (width, height) = if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = main_win.current_monitor() {
            let size = monitor.size();
            let scale = monitor.scale_factor();
            (
                size.width as f64 / scale,
                size.height as f64 / scale,
            )
        } else {
            (1920.0, 1080.0)
        }
    } else {
        (1920.0, 1080.0)
    };

    // Create fullscreen window picker (uses screenshot background instead of transparency)
    let _window = WebviewWindowBuilder::new(
        &app,
        "windowPicker",
        WebviewUrl::App("src/renderer/windowPicker/index.html".into()),
    )
    .title("Select Window")
    .inner_size(width, height)
    .position(0.0, 0.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
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
pub async fn get_windows(_app: AppHandle) -> AppResult<Value> {
    // Use PowerShell to enumerate visible windows with their position and size
    let output = tauri::async_runtime::spawn(async move {
        let ps_script = r#"
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

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    public static List<Dictionary<string, object>> GetVisibleWindows() {
        var result = new List<Dictionary<string, object>>();
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            int len = GetWindowTextLength(hWnd);
            if (len == 0) return true;

            // Skip cloaked windows
            int cloaked = 0;
            DwmGetWindowAttribute(hWnd, 14, out cloaked, sizeof(int));
            if (cloaked != 0) return true;

            StringBuilder sb = new StringBuilder(len + 1);
            GetWindowText(hWnd, sb, sb.Capacity);
            string title = sb.ToString();

            if (string.IsNullOrEmpty(title)) return true;

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

$windows = [WinEnum]::GetVisibleWindows()
$windows | ConvertTo-Json -Depth 3
"#;

        #[cfg(target_os = "windows")]
        let output = {
            use std::os::windows::process::CommandExt;
            std::process::Command::new("powershell")
                .args(["-NoProfile", "-Command", ps_script])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output()
        };
        #[cfg(not(target_os = "windows"))]
        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", ps_script])
            .output();

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                serde_json::from_str::<Value>(&stdout).unwrap_or(Value::Array(vec![]))
            }
            Err(_) => Value::Array(vec![]),
        }
    })
    .await
    .unwrap_or(Value::Array(vec![]));

    // Ensure it's always an array
    match output {
        Value::Array(_) => Ok(output),
        obj @ Value::Object(_) => Ok(Value::Array(vec![obj])),
        _ => Ok(Value::Array(vec![])),
    }
}

#[tauri::command]
pub async fn open_area_picker(app: AppHandle) -> AppResult<()> {
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.hide().map_err(|e| AppError::Tauri(e))?;
    }

    // Small delay then capture screenshot of desktop without main window
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    capture_desktop_screenshot(&app).await.ok();

    let _window = WebviewWindowBuilder::new(
        &app,
        "areaPicker",
        WebviewUrl::App("src/renderer/areaPicker/index.html".into()),
    )
    .title("Select Area")
    .fullscreen(true)
    .decorations(false)
    .always_on_top(true)
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
    .build()
    .map_err(|e| AppError::Tauri(e))?;

    Ok(())
}
