use crate::error::AppResult;
#[cfg(not(target_os = "windows"))]
use crate::error::AppError;
use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn get_version(app: AppHandle) -> AppResult<String> {
    Ok(app
        .config()
        .version
        .clone()
        .unwrap_or_else(|| "0.0.0".to_string()))
}

#[tauri::command]
pub async fn get_machine_id() -> AppResult<String> {
    // Generate a machine-specific ID using system info
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(hostname.as_bytes());
    let result = hasher.finalize();
    Ok(format!("{:x}", result)[..32].to_string())
}

#[tauri::command]
pub async fn get_is_sentry_enabled() -> AppResult<bool> {
    // Sentry is disabled in Tauri version for now
    // Can be re-enabled with tauri-plugin-sentry
    Ok(false)
}

#[tauri::command]
pub async fn check_permissions() -> AppResult<Value> {
    // Returns array format expected by PermissionsModal.jsx

    #[cfg(target_os = "windows")]
    {
        // On Windows, screen capture permissions are generally available
        Ok(serde_json::json!([
            { "hasPermission": true, "label": "Screen Capture", "permission": "screenCapture", "path": "" },
            { "hasPermission": true, "label": "Camera", "permission": "camera", "path": "" },
            { "hasPermission": true, "label": "Microphone", "permission": "microphone", "path": "" }
        ]))
    }

    #[cfg(target_os = "macos")]
    {
        // On macOS, check screen recording permission by attempting a 1-pixel capture
        let screen_capture_ok = std::process::Command::new("osascript")
            .args(["-e", r#"tell application "System Events" to return true"#])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

        Ok(serde_json::json!([
            {
                "hasPermission": screen_capture_ok,
                "label": "Screen Capture",
                "permission": "screenCapture",
                "path": "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
            },
            {
                "hasPermission": true,
                "label": "Camera",
                "permission": "camera",
                "path": "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera"
            },
            {
                "hasPermission": true,
                "label": "Microphone",
                "permission": "microphone",
                "path": "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
            }
        ]))
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, check if X11 or Wayland session and required tools
        let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_else(|_| "x11".to_string());
        let is_wayland = session_type == "wayland";

        // Check for required screen capture tools
        let has_capture_tool = if is_wayland {
            // Wayland needs pipewire for screen capture
            std::process::Command::new("pw-cli")
                .arg("info")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        } else {
            // X11: check if DISPLAY is set (x11grab works with any X server)
            std::env::var("DISPLAY").is_ok()
        };

        Ok(serde_json::json!([
            {
                "hasPermission": has_capture_tool,
                "label": if is_wayland { "Screen Capture (PipeWire required)" } else { "Screen Capture" },
                "permission": "screenCapture",
                "path": ""
            },
            { "hasPermission": true, "label": "Camera", "permission": "camera", "path": "" },
            { "hasPermission": true, "label": "Microphone", "permission": "microphone", "path": "" }
        ]))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(serde_json::json!([
            { "hasPermission": true, "label": "Screen Capture", "permission": "screenCapture", "path": "" },
            { "hasPermission": true, "label": "Camera", "permission": "camera", "path": "" },
            { "hasPermission": true, "label": "Microphone", "permission": "microphone", "path": "" }
        ]))
    }
}

#[tauri::command]
pub async fn check_for_updates(_app: AppHandle) -> AppResult<()> {
    // Tauri updater plugin handles this
    // For now, no-op - can be integrated with tauri-plugin-updater
    Ok(())
}

#[tauri::command]
pub async fn install_update(_app: AppHandle) -> AppResult<()> {
    // Tauri updater plugin handles this
    Ok(())
}

#[tauri::command]
pub async fn choose_export_directory(app: AppHandle) -> AppResult<Value> {
    let folder = app.dialog().file().blocking_pick_folder();

    match folder {
        Some(path) => Ok(Value::String(path.to_string())),
        None => Ok(Value::Null),
    }
}

/// Check if a command exists on the system
fn command_exists(cmd: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("where")
            .arg(cmd)
            .creation_flags(0x08000000)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("which")
            .arg(cmd)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}

/// Check all runtime dependencies and return their status.
/// The frontend uses this on first launch to show install guidance.
#[tauri::command]
pub async fn check_dependencies(app: AppHandle) -> AppResult<Value> {
    use tauri_plugin_shell::ShellExt;

    // Check FFmpeg: try sidecar first, then system
    let has_ffmpeg = {
        let shell = app.shell();
        let sidecar_ok = shell.sidecar("ffmpeg")
            .and_then(|cmd| {
                // Just check if the sidecar binary exists by trying to get version
                Ok(cmd)
            })
            .is_ok();
        sidecar_ok || command_exists("ffmpeg")
    };

    #[allow(unused_mut)]
    let mut deps = vec![
        serde_json::json!({
            "name": "FFmpeg",
            "command": "ffmpeg",
            "installed": has_ffmpeg,
            "required": true,
            "description": "Required for screen recording and video processing"
        }),
    ];

    #[cfg(target_os = "linux")]
    {
        let has_xdotool = command_exists("xdotool");
        let has_wmctrl = command_exists("wmctrl");

        deps.push(serde_json::json!({
            "name": "xdotool",
            "command": "xdotool",
            "installed": has_xdotool,
            "required": false,
            "description": "Used for mouse tracking and window detection"
        }));
        deps.push(serde_json::json!({
            "name": "wmctrl",
            "command": "wmctrl",
            "installed": has_wmctrl,
            "required": false,
            "description": "Used for window enumeration"
        }));

        // Check for PipeWire on Wayland
        let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
        if session_type == "wayland" {
            let has_pipewire = command_exists("pw-cli");
            deps.push(serde_json::json!({
                "name": "PipeWire",
                "command": "pw-cli",
                "installed": has_pipewire,
                "required": true,
                "description": "Required for screen capture on Wayland"
            }));
        }
    }

    #[cfg(target_os = "macos")]
    {
        // On macOS, check for Homebrew (used for installing FFmpeg if missing)
        let has_brew = command_exists("brew");
        deps.push(serde_json::json!({
            "name": "Homebrew",
            "command": "brew",
            "installed": has_brew,
            "required": false,
            "description": "Package manager (used to install FFmpeg if needed)"
        }));
    }

    // Get the install command for missing deps
    let install_cmd = get_install_command(&deps);

    Ok(serde_json::json!({
        "dependencies": deps,
        "allInstalled": deps.iter().all(|d| {
            let required = d.get("required").and_then(|v| v.as_bool()).unwrap_or(false);
            let installed = d.get("installed").and_then(|v| v.as_bool()).unwrap_or(false);
            !required || installed
        }),
        "installCommand": install_cmd
    }))
}

/// Generate a platform-specific install command for missing dependencies
fn get_install_command(deps: &[Value]) -> String {
    let missing: Vec<&str> = deps.iter()
        .filter(|d| {
            let installed = d.get("installed").and_then(|v| v.as_bool()).unwrap_or(true);
            !installed
        })
        .filter_map(|d| d.get("command").and_then(|v| v.as_str()))
        .collect();

    if missing.is_empty() {
        return String::new();
    }

    let _packages = missing.join(" ");

    #[cfg(target_os = "macos")]
    {
        return format!("brew install {}", _packages);
    }

    #[cfg(target_os = "linux")]
    {
        // Detect package manager
        if command_exists("apt-get") {
            return format!("sudo apt-get install -y {}", _packages);
        } else if command_exists("dnf") {
            return format!("sudo dnf install -y {}", _packages);
        } else if command_exists("pacman") {
            return format!("sudo pacman -S --noconfirm {}", _packages);
        } else if command_exists("zypper") {
            return format!("sudo zypper install -y {}", _packages);
        }
        return format!("Install these packages: {}", _packages);
    }

    #[cfg(target_os = "windows")]
    {
        return String::new(); // Windows bundles everything
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return format!("Install these packages: {}", _packages);
    }
}

/// Attempt to auto-install missing dependencies.
/// On Linux uses the system package manager, on macOS uses Homebrew.
/// Returns the output of the install command.
#[tauri::command]
pub async fn install_dependencies(app: AppHandle) -> AppResult<Value> {
    let deps = check_dependencies(app.clone()).await?;
    let all_installed = deps.get("allInstalled").and_then(|v| v.as_bool()).unwrap_or(true);

    if all_installed {
        return Ok(serde_json::json!({
            "success": true,
            "message": "All dependencies are already installed"
        }));
    }

    let install_cmd = deps.get("installCommand")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if install_cmd.is_empty() {
        return Ok(serde_json::json!({
            "success": false,
            "message": "No auto-install available for this platform"
        }));
    }

    log::info!("[install_dependencies] Running: {}", install_cmd);

    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("bash")
            .args(["-c", &install_cmd])
            .output()
            .map_err(|e| AppError::General(format!("Failed to run install: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        return Ok(serde_json::json!({
            "success": output.status.success(),
            "message": if output.status.success() {
                "Dependencies installed successfully. Please restart Flowtake."
            } else {
                "Installation failed. Please install manually."
            },
            "stdout": stdout,
            "stderr": stderr,
            "command": install_cmd
        }));
    }

    #[cfg(target_os = "linux")]
    {
        // Try pkexec for graphical sudo prompt
        let pkexec_cmd = if command_exists("pkexec") {
            format!("pkexec {}", install_cmd.trim_start_matches("sudo "))
        } else {
            // Fall back to a terminal emulator with sudo
            install_cmd.clone()
        };

        let output = std::process::Command::new("bash")
            .args(["-c", &pkexec_cmd])
            .output()
            .map_err(|e| AppError::General(format!("Failed to run install: {}", e)))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        return Ok(serde_json::json!({
            "success": output.status.success(),
            "message": if output.status.success() {
                "Dependencies installed successfully. Please restart Flowtake."
            } else {
                "Installation failed. You may need to install manually."
            },
            "stdout": stdout,
            "stderr": stderr,
            "command": install_cmd
        }));
    }

    #[cfg(target_os = "windows")]
    {
        return Ok(serde_json::json!({
            "success": true,
            "message": "All dependencies are bundled on Windows"
        }));
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return Ok(serde_json::json!({
            "success": false,
            "message": format!("Please install manually: {}", install_cmd)
        }));
    }
}
