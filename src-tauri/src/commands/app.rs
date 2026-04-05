use crate::error::AppResult;
#[cfg(not(target_os = "windows"))]
use crate::error::AppError;
use serde::{Serialize, Deserialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_autostart::ManagerExt;

#[derive(Serialize, Deserialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub latest_version: String,
    pub download_url: String,
    pub release_notes: String,
    pub published_at: String,
    pub current_version: String,
}

#[derive(Serialize, Deserialize)]
pub struct ChangelogEntry {
    pub version: String,
    pub release_notes: String,
    pub published_at: String,
}

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
    let hex: String = result.iter().map(|b| format!("{:02x}", b)).collect();
    Ok(hex[..32].to_string())
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
        // On macOS, check screen recording permission using CGWindowListCreateImage
        // Returns None when screen recording permission is denied
        let screen_capture_ok = {
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
            image.is_some()
        };

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

/// Compare two semver version strings (e.g. "1.2.3" > "1.2.1")
fn is_newer_version(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u64> {
        v.trim_start_matches('v')
            .split('.')
            .filter_map(|s| s.parse().ok())
            .collect()
    };
    let l = parse(latest);
    let c = parse(current);
    for i in 0..l.len().max(c.len()) {
        let lv = l.get(i).copied().unwrap_or(0);
        let cv = c.get(i).copied().unwrap_or(0);
        if lv > cv { return true; }
        if lv < cv { return false; }
    }
    false
}

/// Get the platform-specific asset file extension patterns
fn platform_asset_patterns() -> Vec<&'static str> {
    match std::env::consts::OS {
        "windows" => vec![".exe", ".msi"],
        "macos" => vec![".dmg"],
        "linux" => vec![".AppImage", ".deb"],
        _ => vec![],
    }
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> AppResult<Value> {
    let current_version = app.config().version.clone().unwrap_or_else(|| "0.0.0".to_string());

    let client = reqwest::Client::new();
    let response = client
        .get("https://api.github.com/repos/JNX03/Flowtake/releases/latest")
        .header("User-Agent", "Flowtake")
        .send()
        .await;

    let response = match response {
        Ok(r) => r,
        Err(_) => {
            return Ok(serde_json::to_value(UpdateInfo {
                has_update: false,
                latest_version: current_version.clone(),
                download_url: String::new(),
                release_notes: String::new(),
                published_at: String::new(),
                current_version,
            })?);
        }
    };

    let json: Value = match response.json().await {
        Ok(j) => j,
        Err(_) => {
            return Ok(serde_json::to_value(UpdateInfo {
                has_update: false,
                latest_version: current_version.clone(),
                download_url: String::new(),
                release_notes: String::new(),
                published_at: String::new(),
                current_version,
            })?);
        }
    };

    let tag = json.get("tag_name").and_then(|v| v.as_str()).unwrap_or("0.0.0");
    let latest_version = tag.trim_start_matches('v').to_string();
    let release_notes = json.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let published_at = json.get("published_at").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let html_url = json.get("html_url").and_then(|v| v.as_str()).unwrap_or("").to_string();

    // Find platform-specific download asset
    let patterns = platform_asset_patterns();
    let download_url = json.get("assets")
        .and_then(|a| a.as_array())
        .and_then(|assets| {
            assets.iter().find_map(|asset| {
                let name = asset.get("name").and_then(|n| n.as_str()).unwrap_or("");
                let name_lower = name.to_lowercase();
                if patterns.iter().any(|p| name_lower.ends_with(&p.to_lowercase())) {
                    asset.get("browser_download_url").and_then(|u| u.as_str()).map(|s| s.to_string())
                } else {
                    None
                }
            })
        })
        .unwrap_or(html_url);

    let has_update = is_newer_version(&latest_version, &current_version);

    Ok(serde_json::to_value(UpdateInfo {
        has_update,
        latest_version,
        download_url,
        release_notes,
        published_at,
        current_version,
    })?)
}

#[tauri::command]
pub async fn install_update(download_url: String) -> AppResult<()> {
    open::that(&download_url).map_err(|e| {
        log::error!("[install_update] Failed to open URL: {}", e);
        crate::error::AppError::General(format!("Failed to open download URL: {}", e))
    })?;
    Ok(())
}

#[derive(Serialize, Clone)]
pub struct DownloadProgress {
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub percent: f64,
}

#[tauri::command]
pub async fn download_update(app: AppHandle, download_url: String) -> AppResult<Value> {
    use futures_util::StreamExt;
    use std::io::Write;

    log::info!("[download_update] Starting download from: {}", download_url);

    let client = reqwest::Client::new();
    let response = client
        .get(&download_url)
        .header("User-Agent", "Flowtake")
        .send()
        .await
        .map_err(|e| crate::error::AppError::General(format!("Download failed: {}", e)))?;

    if !response.status().is_success() {
        return Err(crate::error::AppError::General(
            format!("Download returned HTTP {}", response.status()),
        ));
    }

    let total_bytes = response.content_length().unwrap_or(0);

    // Determine file extension from URL
    let ext = download_url
        .rsplit('/')
        .next()
        .and_then(|name| {
            if name.to_lowercase().ends_with(".exe") { Some("exe") }
            else if name.to_lowercase().ends_with(".msi") { Some("msi") }
            else if name.to_lowercase().ends_with(".dmg") { Some("dmg") }
            else if name.to_lowercase().ends_with(".appimage") { Some("AppImage") }
            else if name.to_lowercase().ends_with(".deb") { Some("deb") }
            else { None }
        })
        .unwrap_or("bin");

    let temp_path = std::env::temp_dir().join(format!("flowtake-update.{}", ext));

    // Clean up any previous download
    let _ = std::fs::remove_file(&temp_path);

    let mut file = std::fs::File::create(&temp_path).map_err(|e| {
        crate::error::AppError::General(format!("Failed to create temp file: {}", e))
    })?;

    let mut stream = response.bytes_stream();
    let mut bytes_downloaded: u64 = 0;
    let mut last_emitted_percent: f64 = -1.0;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| {
            let _ = std::fs::remove_file(&temp_path);
            crate::error::AppError::General(format!("Download stream error: {}", e))
        })?;

        file.write_all(&chunk).map_err(|e| {
            let _ = std::fs::remove_file(&temp_path);
            crate::error::AppError::General(format!("Failed to write chunk: {}", e))
        })?;

        bytes_downloaded += chunk.len() as u64;
        let percent = if total_bytes > 0 {
            (bytes_downloaded as f64 / total_bytes as f64 * 100.0).min(100.0)
        } else {
            0.0
        };

        // Emit progress every 1% to avoid flooding events
        if (percent - last_emitted_percent) >= 1.0 || bytes_downloaded == total_bytes {
            last_emitted_percent = percent;
            app.emit_to("main", "update-download-progress", DownloadProgress {
                bytes_downloaded,
                total_bytes,
                percent,
            }).ok();
        }
    }

    drop(file);

    let installer_path = temp_path.to_string_lossy().to_string();
    log::info!("[download_update] Download complete: {}", installer_path);

    Ok(serde_json::json!({ "installerPath": installer_path }))
}

#[tauri::command]
pub async fn launch_installer(installer_path: String) -> AppResult<()> {
    use std::path::Path;

    let path = Path::new(&installer_path);
    if !path.exists() {
        return Err(crate::error::AppError::General(
            "Installer file not found".to_string(),
        ));
    }

    log::info!("[launch_installer] Launching: {}", installer_path);

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        #[cfg(target_os = "windows")]
        "exe" => {
            use std::os::windows::process::CommandExt;
            std::process::Command::new(&installer_path)
                .arg("/S")
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .spawn()
                .map_err(|e| crate::error::AppError::General(format!("Failed to launch installer: {}", e)))?;
        }
        #[cfg(target_os = "windows")]
        "msi" => {
            use std::os::windows::process::CommandExt;
            std::process::Command::new("msiexec")
                .args(["/i", &installer_path, "/quiet", "/norestart"])
                .creation_flags(0x08000000)
                .spawn()
                .map_err(|e| crate::error::AppError::General(format!("Failed to launch MSI: {}", e)))?;
        }
        #[cfg(target_os = "macos")]
        "dmg" => {
            open::that(&installer_path).map_err(|e| {
                crate::error::AppError::General(format!("Failed to open DMG: {}", e))
            })?;
        }
        #[cfg(target_os = "linux")]
        "appimage" => {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&installer_path)
                .map_err(|e| crate::error::AppError::General(format!("Failed to get permissions: {}", e)))?
                .permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&installer_path, perms)
                .map_err(|e| crate::error::AppError::General(format!("Failed to set permissions: {}", e)))?;
            std::process::Command::new(&installer_path)
                .spawn()
                .map_err(|e| crate::error::AppError::General(format!("Failed to launch AppImage: {}", e)))?;
        }
        #[cfg(target_os = "linux")]
        "deb" => {
            std::process::Command::new("pkexec")
                .args(["dpkg", "-i", &installer_path])
                .spawn()
                .map_err(|e| crate::error::AppError::General(format!("Failed to install deb: {}", e)))?;
        }
        _ => {
            // Fallback: open with default handler
            open::that(&installer_path).map_err(|e| {
                crate::error::AppError::General(format!("Failed to open installer: {}", e))
            })?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn get_changelog() -> AppResult<Value> {
    let client = reqwest::Client::new();
    let response = client
        .get("https://api.github.com/repos/JNX03/Flowtake/releases?per_page=20")
        .header("User-Agent", "Flowtake")
        .send()
        .await;

    let response = match response {
        Ok(r) => r,
        Err(_) => return Ok(serde_json::json!([])),
    };

    let json: Value = match response.json().await {
        Ok(j) => j,
        Err(_) => return Ok(serde_json::json!([])),
    };

    let entries: Vec<ChangelogEntry> = json.as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|release| {
            ChangelogEntry {
                version: release.get("tag_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                release_notes: release.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                published_at: release.get("published_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            }
        })
        .collect();

    Ok(serde_json::to_value(entries)?)
}

#[tauri::command]
pub async fn choose_export_directory(app: AppHandle) -> AppResult<Value> {
    let folder = app.dialog().file().blocking_pick_folder();

    match folder {
        Some(path) => Ok(Value::String(path.to_string())),
        None => Ok(Value::Null),
    }
}

#[tauri::command]
pub async fn get_autostart(app: AppHandle) -> AppResult<bool> {
    let autostart = app.autolaunch();
    Ok(autostart.is_enabled().unwrap_or(false))
}

#[tauri::command]
pub async fn set_autostart(app: AppHandle, enabled: bool) -> AppResult<bool> {
    let autostart = app.autolaunch();
    if enabled {
        autostart.enable().ok();
    } else {
        autostart.disable().ok();
    }
    Ok(autostart.is_enabled().unwrap_or(false))
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
        let sidecar_ok = shell.sidecar("ffmpeg").is_ok();
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
        String::new() // Windows bundles everything
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
        Ok(serde_json::json!({
            "success": true,
            "message": "All dependencies are bundled on Windows"
        }))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return Ok(serde_json::json!({
            "success": false,
            "message": format!("Please install manually: {}", install_cmd)
        }));
    }
}
