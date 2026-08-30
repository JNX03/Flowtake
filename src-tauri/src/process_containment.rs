//! Crash-path containment for long-lived child processes owned by Flowtake.
//!
//! On Windows, recorder FFmpeg processes are assigned to a process-lifetime
//! Job Object configured with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`. Windows
//! closes the job handle when Flowtake exits, including abrupt termination,
//! and terminates every assigned child that is still running.

/// Assign a Flowtake-owned child to the process-lifetime containment group.
///
/// Containment is deliberately best-effort. A restrictive parent Job Object
/// or endpoint policy can reject nested job assignment; that must not make a
/// recording fail after FFmpeg has already started.
pub(crate) fn contain_owned_child(child: &std::process::Child, purpose: &str) {
    #[cfg(target_os = "windows")]
    if let Err(error) = windows_job::assign(child) {
        log::warn!(
            "[process_containment] Could not contain {} (pid {}): {}. \
             Graceful shutdown remains available, but abrupt app termination \
             may leave this child running.",
            purpose,
            child.id(),
            error
        );
    }

    #[cfg(not(target_os = "windows"))]
    let _ = (child, purpose);
}

/// Synchronously terminate and reap a child during application shutdown.
/// Windows Job Objects cover abrupt process death; this explicit path also
/// gives macOS/Linux normal exits deterministic cleanup and prevents zombies.
pub(crate) fn terminate_owned_child(
    mut child: std::process::Child,
    purpose: &str,
) -> Result<std::process::ExitStatus, String> {
    match child.try_wait() {
        Ok(Some(status)) => return Ok(status),
        Ok(None) => {}
        Err(error) => log::warn!(
            "[process_containment] Could not query {} (pid {}): {}",
            purpose,
            child.id(),
            error
        ),
    }

    if let Err(error) = child.kill() {
        // The child can exit between try_wait and kill. Always attempt wait so
        // that case is reaped before deciding cleanup failed.
        log::debug!(
            "[process_containment] Kill for {} (pid {}) returned: {}",
            purpose,
            child.id(),
            error
        );
    }
    child
        .wait()
        .map_err(|error| format!("could not reap {} (pid {}): {}", purpose, child.id(), error))
}

pub(crate) fn terminate_owned_children(
    children: Vec<std::process::Child>,
    purpose: &str,
) {
    for child in children {
        if let Err(error) = terminate_owned_child(child, purpose) {
            log::warn!("[process_containment] {}", error);
        }
    }
}

#[cfg(test)]
mod lifecycle_tests {
    use super::*;
    use std::process::{Command, Stdio};

    #[test]
    fn explicit_shutdown_terminates_and_reaps_a_running_child() {
        #[cfg(target_os = "windows")]
        let child = Command::new("ping.exe")
            .args(["-n", "30", "127.0.0.1"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn Windows sleeper");

        #[cfg(not(target_os = "windows"))]
        let child = Command::new("sh")
            .args(["-c", "sleep 30"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn Unix sleeper");

        let status = terminate_owned_child(child, "test child").expect("terminate child");
        assert!(!status.success());
    }
}

#[cfg(target_os = "windows")]
mod windows_job {
    use std::ffi::c_void;
    use std::mem::size_of;
    use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
    use std::process::Child;
    use std::sync::OnceLock;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    static FLOWTAKE_CHILD_JOB: OnceLock<Result<OwnedHandle, String>> = OnceLock::new();

    fn kill_on_close_limits() -> JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        limits
    }

    fn as_windows_handle(handle: &OwnedHandle) -> HANDLE {
        HANDLE(handle.as_raw_handle())
    }

    fn create_kill_on_close_job() -> Result<OwnedHandle, String> {
        // SAFETY: null security attributes and an unnamed job are valid. The
        // returned raw handle is transferred exactly once into OwnedHandle.
        let raw_job = unsafe { CreateJobObjectW(None, PCWSTR::null()) }
            .map_err(|error| format!("CreateJobObjectW failed: {error}"))?;
        let job = unsafe { OwnedHandle::from_raw_handle(raw_job.0) };

        let limits = kill_on_close_limits();
        // SAFETY: the information pointer and byte count describe a live,
        // correctly aligned JOBOBJECT_EXTENDED_LIMIT_INFORMATION value.
        unsafe {
            SetInformationJobObject(
                as_windows_handle(&job),
                JobObjectExtendedLimitInformation,
                &limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION as *const c_void,
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        }
        .map_err(|error| format!("SetInformationJobObject failed: {error}"))?;

        Ok(job)
    }

    fn process_lifetime_job() -> Result<&'static OwnedHandle, &'static str> {
        match FLOWTAKE_CHILD_JOB.get_or_init(create_kill_on_close_job) {
            Ok(job) => Ok(job),
            Err(error) => Err(error.as_str()),
        }
    }

    fn assign_to_job(job: &OwnedHandle, child: &Child) -> Result<(), String> {
        let child_handle = HANDLE(child.as_raw_handle());
        // SAFETY: both handles are valid for the duration of the call. The
        // Child owns its process handle and the static job owns its job handle.
        unsafe { AssignProcessToJobObject(as_windows_handle(job), child_handle) }
            .map_err(|error| format!("AssignProcessToJobObject failed: {error}"))
    }

    pub(super) fn assign(child: &Child) -> Result<(), String> {
        let job = process_lifetime_job().map_err(str::to_owned)?;
        assign_to_job(job, child)
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::process::{Command, Stdio};
        use std::thread;
        use std::time::{Duration, Instant};

        #[test]
        fn job_limits_enable_kill_on_close() {
            let limits = kill_on_close_limits();
            assert_eq!(
                limits.BasicLimitInformation.LimitFlags,
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            );
        }

        /// Manual Windows integration check:
        /// `cargo test closing_a_job_terminates_its_child -- --ignored`
        ///
        /// It is ignored in regular CI because some hosted runners put tests
        /// in a restrictive Job Object that rejects nested job assignment.
        #[test]
        #[ignore = "requires Windows job-assignment privileges"]
        fn closing_a_job_terminates_its_child() {
            let job = create_kill_on_close_job().expect("create kill-on-close job");
            let mut child = Command::new("ping.exe")
                .args(["-n", "30", "127.0.0.1"])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .expect("spawn test child");
            assign_to_job(&job, &child).expect("assign test child to job");

            drop(job);

            let deadline = Instant::now() + Duration::from_secs(3);
            loop {
                match child.try_wait().expect("query test child") {
                    Some(_) => break,
                    None if Instant::now() < deadline => {
                        thread::sleep(Duration::from_millis(25));
                    }
                    None => {
                        let _ = child.kill();
                        panic!("child survived after its kill-on-close job was closed");
                    }
                }
            }
        }
    }
}
