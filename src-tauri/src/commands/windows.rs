use crate::error::{AppError, AppResult};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::ShellExt;

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
    // Hide main window
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.hide().map_err(|e| AppError::Tauri(e))?;
    }

    // Create window picker window
    let _window = WebviewWindowBuilder::new(
        &app,
        "windowPicker",
        WebviewUrl::App("src/renderer/windowPicker/index.html".into()),
    )
    .title("Select Window")
    .inner_size(600.0, 400.0)
    .center()
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .build()
    .map_err(|e| AppError::Tauri(e))?;

    Ok(())
}

#[tauri::command]
pub async fn close_window_picker_window(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("windowPicker") {
        window.close().map_err(|e| AppError::Tauri(e))?;
    }
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.show().map_err(|e| AppError::Tauri(e))?;
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
    }
    app.emit_to("main", "window-selected", &window).ok();
    Ok(())
}

#[tauri::command]
pub async fn get_windows(app: AppHandle) -> AppResult<Value> {
    // Use AutoHotkey or Windows API to enumerate windows
    // For now, return available windows via shell command
    let shell = app.shell();
    let output = tauri::async_runtime::spawn(async move {
        // Use PowerShell to list windows
        let output = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object Id, MainWindowTitle | ConvertTo-Json",
            ])
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

    Ok(output)
}

#[tauri::command]
pub async fn open_area_picker(app: AppHandle) -> AppResult<()> {
    if let Some(main_win) = app.get_webview_window("main") {
        main_win.hide().map_err(|e| AppError::Tauri(e))?;
    }

    let _window = WebviewWindowBuilder::new(
        &app,
        "areaPicker",
        WebviewUrl::App("src/renderer/areaPicker/index.html".into()),
    )
    .title("Select Area")
    .fullscreen(true)
    .decorations(false)
    .transparent(true)
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
