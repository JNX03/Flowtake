#[cfg(not(target_os = "windows"))]
use crate::error::AppError;
use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize, Deserialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub latest_version: String,
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

#[derive(Serialize, Deserialize)]
pub struct SystemInfo {
    pub version: String,
    pub os: String,
    pub os_version: String,
    pub arch: String,
    pub ram_gb: f64,
}

#[tauri::command]
pub async fn get_system_info(app: AppHandle) -> AppResult<SystemInfo> {
    use sysinfo::System;

    let version = app
        .config()
        .version
        .clone()
        .unwrap_or_else(|| "0.0.0".to_string());
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();
    let os_version = System::os_version().unwrap_or_else(|| "unknown".to_string());
    let ram_gb = System::new_all().total_memory() as f64 / 1_073_741_824.0;

    Ok(SystemInfo {
        version,
        os,
        os_version,
        arch,
        ram_gb,
    })
}

#[tauri::command]
pub async fn get_is_sentry_enabled() -> AppResult<bool> {
    // Sentry is disabled in Tauri version for now
    // Can be re-enabled with tauri-plugin-sentry
    Ok(false)
}

#[cfg(target_os = "macos")]
pub fn macos_has_screen_recording_permission() -> bool {
    core_graphics::access::ScreenCaptureAccess::default().preflight()
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
        // Returns false when screen recording permission is denied.
        let screen_capture_ok = macos_has_screen_recording_permission();

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

const GITHUB_LATEST_RELEASE_API: &str =
    "https://api.github.com/repos/JNX03/Flowtake/releases/latest";
const GITHUB_RELEASES_URL: &str = "https://github.com/JNX03/Flowtake/releases/latest";

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    #[serde(default)]
    body: String,
    #[serde(default)]
    published_at: String,
}

fn update_error(message: impl Into<String>) -> crate::error::AppError {
    crate::error::AppError::General(message.into())
}

/// Compare two semver version strings (e.g. "1.2.3" > "1.2.1").
fn is_newer_version(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u64> {
        v.trim_start_matches('v')
            .split('.')
            .filter_map(|part| part.parse().ok())
            .collect()
    };
    let latest = parse(latest);
    let current = parse(current);
    for index in 0..latest.len().max(current.len()) {
        let latest_part = latest.get(index).copied().unwrap_or(0);
        let current_part = current.get(index).copied().unwrap_or(0);
        if latest_part > current_part {
            return true;
        }
        if latest_part < current_part {
            return false;
        }
    }
    false
}

fn normalized_version(version: &str) -> Option<&str> {
    let normalized = version.strip_prefix('v').unwrap_or(version);
    let parts: Vec<_> = normalized.split('.').collect();
    if normalized.is_empty()
        || normalized.len() > 32
        || parts.is_empty()
        || parts.len() > 4
        || parts
            .iter()
            .any(|part| part.is_empty() || !part.bytes().all(|byte| byte.is_ascii_digit()))
    {
        return None;
    }
    Some(normalized)
}

fn trusted_release_api_url(url: &reqwest::Url) -> bool {
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.host_str() == Some("api.github.com")
        && url.port().is_none()
        && url.path() == "/repos/JNX03/Flowtake/releases/latest"
        && url.query().is_none()
        && url.fragment().is_none()
}

fn update_http_client() -> AppResult<reqwest::Client> {
    let redirect_policy = reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= 5 || !trusted_release_api_url(attempt.url()) {
            attempt.stop()
        } else {
            attempt.follow()
        }
    });
    reqwest::Client::builder()
        .redirect(redirect_policy)
        .build()
        .map_err(Into::into)
}

async fn fetch_latest_release(client: &reqwest::Client) -> AppResult<GithubRelease> {
    let response = client
        .get(GITHUB_LATEST_RELEASE_API)
        .header("User-Agent", "Flowtake")
        .send()
        .await?;
    if !response.status().is_success() {
        return Err(update_error(format!(
            "GitHub release lookup returned HTTP {}",
            response.status()
        )));
    }
    if !trusted_release_api_url(response.url()) {
        return Err(update_error(
            "GitHub release lookup left the exact trusted API endpoint",
        ));
    }
    response.json::<GithubRelease>().await.map_err(Into::into)
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> AppResult<Value> {
    let current_version = app
        .config()
        .version
        .clone()
        .unwrap_or_else(|| "0.0.0".to_string());
    let unavailable = || UpdateInfo {
        has_update: false,
        latest_version: current_version.clone(),
        release_notes: String::new(),
        published_at: String::new(),
        current_version: current_version.clone(),
    };

    let client = match update_http_client() {
        Ok(client) => client,
        Err(_) => return Ok(serde_json::to_value(unavailable())?),
    };
    let release = match fetch_latest_release(&client).await {
        Ok(release) => release,
        Err(_) => return Ok(serde_json::to_value(unavailable())?),
    };
    let latest_version = match normalized_version(&release.tag_name) {
        Some(version) => version.to_string(),
        None => return Ok(serde_json::to_value(unavailable())?),
    };
    let has_update = is_newer_version(&latest_version, &current_version);

    Ok(serde_json::to_value(UpdateInfo {
        has_update,
        latest_version,
        release_notes: release.body,
        published_at: release.published_at,
        current_version,
    })?)
}

/// Open the exact official release page. Native installer download and launch are disabled.
#[tauri::command]
pub async fn install_update() -> AppResult<()> {
    open::that(GITHUB_RELEASES_URL).map_err(|error| {
        log::error!(
            "[install_update] Failed to open official release page: {}",
            error
        );
        update_error(format!(
            "Failed to open official Flowtake release page: {}",
            error
        ))
    })?;
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

    let entries: Vec<ChangelogEntry> = json
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|release| ChangelogEntry {
            version: release
                .get("tag_name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            release_notes: release
                .get("body")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            published_at: release
                .get("published_at")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
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
    let mut deps = vec![serde_json::json!({
        "name": "FFmpeg",
        "command": "ffmpeg",
        "installed": has_ffmpeg,
        "required": true,
        "description": "Required for screen recording and video processing"
    })];

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
    let missing: Vec<&str> = deps
        .iter()
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
        format!("brew install {}", _packages)
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
    let all_installed = deps
        .get("allInstalled")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    if all_installed {
        return Ok(serde_json::json!({
            "success": true,
            "message": "All dependencies are already installed"
        }));
    }

    let install_cmd = deps
        .get("installCommand")
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

        Ok(serde_json::json!({
            "success": output.status.success(),
            "message": if output.status.success() {
                "Dependencies installed successfully. Please restart Flowtake."
            } else {
                "Installation failed. Please install manually."
            },
            "stdout": stdout,
            "stderr": stderr,
            "command": install_cmd
        }))
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

#[cfg(test)]
mod updater_security_tests {
    use super::*;

    #[test]
    fn only_strict_numeric_versions_are_accepted_for_release_lookup() {
        assert_eq!(normalized_version("v1.5.0"), Some("1.5.0"));
        assert_eq!(normalized_version("2.0"), Some("2.0"));
        assert_eq!(normalized_version("../../latest"), None);
        assert_eq!(normalized_version("1.5.0-beta"), None);
        assert_eq!(normalized_version("1..5"), None);
    }

    #[test]
    fn version_comparison_rejects_downgrades() {
        assert!(is_newer_version("1.5.1", "1.5.0"));
        assert!(!is_newer_version("1.5.0", "1.5.0"));
        assert!(!is_newer_version("1.4.9", "1.5.0"));
    }

    #[test]
    fn update_endpoints_are_exact_official_https_urls() {
        assert_eq!(
            GITHUB_LATEST_RELEASE_API,
            "https://api.github.com/repos/JNX03/Flowtake/releases/latest"
        );
        assert_eq!(
            GITHUB_RELEASES_URL,
            "https://github.com/JNX03/Flowtake/releases/latest"
        );

        let trusted = reqwest::Url::parse(GITHUB_LATEST_RELEASE_API).unwrap();
        assert!(trusted_release_api_url(&trusted));
        for hostile in [
            "http://api.github.com/repos/JNX03/Flowtake/releases/latest",
            "https://api.github.com.evil.example/repos/JNX03/Flowtake/releases/latest",
            "https://api.github.com/repos/attacker/Flowtake/releases/latest",
            "https://api.github.com/repos/JNX03/Flowtake/releases/latest?redirect=evil",
            "https://api.github.com/repos/JNX03/Flowtake/releases/tags/v9.9.9",
        ] {
            let url = reqwest::Url::parse(hostile).unwrap();
            assert!(!trusted_release_api_url(&url));
        }
    }
}
