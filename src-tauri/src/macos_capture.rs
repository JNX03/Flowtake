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

#[cfg(test)]
mod tests {
    use super::{bundled_helper_names, development_helper_names};

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
}
