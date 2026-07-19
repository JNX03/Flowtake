use serde::Deserialize;
use std::path::{Path, PathBuf};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

const HELPER_PREFIX: &str = "flowtake-macos-capture";

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MacCaptureCapabilities {
    pub available: bool,
    pub supports_system_audio: bool,
    pub capture_engine: Option<String>,
    pub minimum_system_version: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreviewProxyResult {
    created: bool,
    input_width: u32,
    input_height: u32,
    output_width: u32,
    output_height: u32,
    preserves_audio: bool,
    elapsed_milliseconds: u64,
}

fn bundled_helper_names() -> &'static [&'static str] {
    #[cfg(target_arch = "aarch64")]
    {
        &[
            "flowtake-macos-capture-universal-apple-darwin",
            "flowtake-macos-capture-aarch64-apple-darwin",
            "flowtake-macos-capture",
        ]
    }
    #[cfg(target_arch = "x86_64")]
    {
        &[
            "flowtake-macos-capture-universal-apple-darwin",
            "flowtake-macos-capture-x86_64-apple-darwin",
            "flowtake-macos-capture",
        ]
    }
}

fn development_helper_names() -> &'static [&'static str] {
    #[cfg(target_arch = "aarch64")]
    {
        &[
            "flowtake-macos-capture-aarch64-apple-darwin",
            "flowtake-macos-capture-universal-apple-darwin",
            "flowtake-macos-capture",
        ]
    }
    #[cfg(target_arch = "x86_64")]
    {
        &[
            "flowtake-macos-capture-x86_64-apple-darwin",
            "flowtake-macos-capture-universal-apple-darwin",
            "flowtake-macos-capture",
        ]
    }
}

fn is_executable_file(path: &Path) -> bool {
    let Ok(metadata) = path.metadata() else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

pub(crate) fn find_helper(app: &AppHandle) -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("FLOWTAKE_MACOS_CAPTURE_HELPER") {
        let path = PathBuf::from(path);
        if is_executable_file(&path) {
            return Some(path);
        }
        log::warn!(
            "[macos-capture] Ignoring invalid FLOWTAKE_MACOS_CAPTURE_HELPER path: {:?}",
            path
        );
    }

    let source_binaries = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries");

    // `tauri dev` can retain a previously copied universal resource after the
    // Swift source changes. Prefer the freshly built host-architecture helper
    // from the source tree so local performance tests never exercise stale code.
    #[cfg(debug_assertions)]
    for name in development_helper_names() {
        let path = source_binaries.join(name);
        if is_executable_file(&path) {
            return Some(path);
        }
    }

    for name in bundled_helper_names() {
        if let Ok(path) = app
            .path()
            .resolve(format!("binaries/{name}"), BaseDirectory::Resource)
        {
            if is_executable_file(&path) {
                return Some(path);
            }
        }
    }

    for name in development_helper_names() {
        let path = source_binaries.join(name);
        if is_executable_file(&path) {
            return Some(path);
        }
    }

    log::debug!(
        "[macos-capture] No {} helper found in bundled or development resources",
        HELPER_PREFIX
    );
    None
}

pub(crate) async fn capabilities(app: &AppHandle) -> MacCaptureCapabilities {
    let Some(path) = find_helper(app) else {
        return MacCaptureCapabilities::default();
    };

    let mut command = tokio::process::Command::new(&path);
    command
        .arg("capabilities")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);

    let result = tokio::time::timeout(std::time::Duration::from_secs(2), command.output()).await;

    let output = match result {
        Ok(Ok(output)) if output.status.success() => output,
        Ok(Ok(output)) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            log::warn!(
                "[macos-capture] Capability probe failed with {}: {}",
                output.status,
                stderr.trim()
            );
            return MacCaptureCapabilities::default();
        }
        Ok(Err(error)) => {
            log::warn!(
                "[macos-capture] Could not launch capability probe {:?}: {}",
                path,
                error
            );
            return MacCaptureCapabilities::default();
        }
        Err(_) => {
            log::warn!("[macos-capture] Capability probe timed out for {:?}", path);
            return MacCaptureCapabilities::default();
        }
    };

    match serde_json::from_slice::<MacCaptureCapabilities>(&output.stdout) {
        Ok(capabilities) => {
            log::info!(
                "[macos-capture] {} available={}, system_audio={}, minimum_macos={}",
                capabilities
                    .capture_engine
                    .as_deref()
                    .unwrap_or("native capture"),
                capabilities.available,
                capabilities.supports_system_audio,
                capabilities
                    .minimum_system_version
                    .as_deref()
                    .unwrap_or("unknown")
            );
            capabilities
        }
        Err(error) => {
            log::warn!(
                "[macos-capture] Invalid capability response from {:?}: {}",
                path,
                error
            );
            MacCaptureCapabilities::default()
        }
    }
}

fn is_non_empty_file(path: &Path) -> bool {
    path.metadata()
        .is_ok_and(|metadata| metadata.is_file() && metadata.len() > 0)
}

fn remove_partial_preview_files(output_path: &Path) {
    let Some(parent) = output_path.parent() else {
        return;
    };
    let Ok(entries) = std::fs::read_dir(parent) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let is_partial = path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with('.') && name.ends_with(".partial.mp4"));
        if is_partial {
            std::fs::remove_file(path).ok();
        }
    }
}

pub(crate) async fn ensure_preview_proxy(
    app: &AppHandle,
    input_path: &Path,
    output_path: &Path,
) -> Result<bool, String> {
    if is_non_empty_file(output_path) {
        return Ok(true);
    }
    if !is_non_empty_file(input_path) {
        return Err(format!(
            "preview source is missing or empty: {:?}",
            input_path
        ));
    }

    let Some(helper) = find_helper(app) else {
        return Err("native macOS helper is unavailable".to_string());
    };
    remove_partial_preview_files(output_path);

    let mut command = tokio::process::Command::new(&helper);
    command
        .arg("make-preview-proxy")
        .arg("--input")
        .arg(input_path)
        .arg("--output")
        .arg(output_path)
        .arg("--max-width")
        .arg("1280")
        .arg("--max-height")
        .arg("720")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);

    let result = tokio::time::timeout(std::time::Duration::from_secs(60), command.output()).await;
    let output = match result {
        Ok(Ok(output)) if output.status.success() => output,
        Ok(Ok(output)) => {
            remove_partial_preview_files(output_path);
            return Err(format!(
                "helper exited with {}: {}",
                output.status,
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
        Ok(Err(error)) => {
            remove_partial_preview_files(output_path);
            return Err(format!("could not launch {:?}: {}", helper, error));
        }
        Err(_) => {
            remove_partial_preview_files(output_path);
            return Err("native preview generation timed out after 60 seconds".to_string());
        }
    };

    let result: PreviewProxyResult = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("invalid helper response: {error}"))?;
    if result.created && !is_non_empty_file(output_path) {
        return Err("helper reported success without a usable preview file".to_string());
    }

    log::info!(
        "[macos-preview] created={}, {}x{} -> {}x{}, audio_preserved={}, elapsed={}ms",
        result.created,
        result.input_width,
        result.input_height,
        result.output_width,
        result.output_height,
        result.preserves_audio,
        result.elapsed_milliseconds
    );
    Ok(result.created)
}

#[cfg(test)]
mod tests {
    use super::{
        bundled_helper_names, development_helper_names, is_non_empty_file,
        remove_partial_preview_files,
    };

    #[test]
    fn prefers_universal_helper_before_arch_specific_fallback() {
        assert_eq!(
            bundled_helper_names().first().copied(),
            Some("flowtake-macos-capture-universal-apple-darwin")
        );
    }

    #[test]
    fn development_prefers_fresh_arch_specific_helper() {
        assert!(
            development_helper_names()
                .first()
                .is_some_and(|name| !name.contains("universal"))
        );
    }

    #[test]
    fn preview_cache_accepts_only_non_empty_regular_files() {
        let root = std::env::temp_dir().join(format!(
            "flowtake-preview-file-test-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let empty = root.join("empty.mp4");
        let usable = root.join("usable.mp4");
        std::fs::write(&empty, []).unwrap();
        std::fs::write(&usable, b"preview").unwrap();

        assert!(!is_non_empty_file(&empty));
        assert!(is_non_empty_file(&usable));
        assert!(!is_non_empty_file(&root));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn preview_cleanup_removes_only_partial_mp4_files() {
        let root = std::env::temp_dir().join(format!(
            "flowtake-preview-cleanup-test-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let partial = root.join(".screen-a.partial.mp4");
        let keep = root.join("screen-10.mp4");
        std::fs::write(&partial, b"partial").unwrap();
        std::fs::write(&keep, b"preview").unwrap();

        remove_partial_preview_files(&keep);
        assert!(!partial.exists());
        assert!(keep.exists());
        std::fs::remove_dir_all(root).unwrap();
    }
}
