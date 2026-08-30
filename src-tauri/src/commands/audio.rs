use crate::error::AppResult;
use crate::state::AppState;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Clone)]
pub struct AudioSession {
    pub pid: u32,
    pub name: String,
}

// ── Windows implementation ──────────────────────────────────────────────────

#[cfg(target_os = "windows")]
mod platform {
    use super::*;
    use windows::core::{Interface, GUID, PWSTR};
    use windows::Win32::Media::Audio::{
        eMultimedia, eRender, IAudioSessionControl, IAudioSessionControl2, IAudioSessionEnumerator,
        IAudioSessionManager2, IMMDeviceEnumerator, ISimpleAudioVolume, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };

    fn get_process_name(pid: u32) -> Option<String> {
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
            let mut buf = [0u16; 1024];
            let mut size = buf.len() as u32;
            QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_FORMAT(0),
                PWSTR(buf.as_mut_ptr()),
                &mut size,
            )
            .ok()?;
            let path = String::from_utf16_lossy(&buf[..size as usize]);
            // Extract just the filename without extension
            path.rsplit('\\')
                .next()
                .map(|f| f.trim_end_matches(".exe").to_string())
        }
    }

    pub fn enumerate_audio_sessions() -> AppResult<Vec<AudioSession>> {
        let sessions = tokio::task::block_in_place(|| -> AppResult<Vec<AudioSession>> {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

                let enumerator: IMMDeviceEnumerator =
                    CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;

                let device = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)?;

                let session_manager: IAudioSessionManager2 =
                    device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None)?;

                let session_enum: IAudioSessionEnumerator =
                    session_manager.GetSessionEnumerator()?;

                let count = session_enum.GetCount()?;
                let current_pid = std::process::id();
                let mut result = Vec::new();

                for i in 0..count {
                    let control: IAudioSessionControl = match session_enum.GetSession(i) {
                        Ok(c) => c,
                        Err(_) => continue,
                    };

                    let control2: IAudioSessionControl2 = match control.cast() {
                        Ok(c) => c,
                        Err(_) => continue,
                    };

                    let pid = match control2.GetProcessId() {
                        Ok(p) => p,
                        Err(_) => continue,
                    };

                    // Skip system sounds and our own process
                    if pid == 0 || pid == current_pid {
                        continue;
                    }

                    let name = get_process_name(pid).unwrap_or_else(|| format!("PID {}", pid));

                    // Avoid duplicates (same process name)
                    if !result.iter().any(|s: &AudioSession| s.pid == pid) {
                        result.push(AudioSession { pid, name });
                    }
                }

                Ok(result)
            }
        })?;

        Ok(sessions)
    }

    pub fn mute_sessions_by_pid(pids: &[u32], mute: bool) -> AppResult<Vec<u32>> {
        let pids = pids.to_vec();
        let muted = tokio::task::block_in_place(move || -> AppResult<Vec<u32>> {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

                let enumerator: IMMDeviceEnumerator =
                    CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;

                let device = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)?;

                let session_manager: IAudioSessionManager2 =
                    device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None)?;

                let session_enum: IAudioSessionEnumerator =
                    session_manager.GetSessionEnumerator()?;

                let count = session_enum.GetCount()?;
                let mut actually_muted = Vec::new();

                for i in 0..count {
                    let control: IAudioSessionControl = match session_enum.GetSession(i) {
                        Ok(c) => c,
                        Err(_) => continue,
                    };

                    let control2: IAudioSessionControl2 = match control.cast() {
                        Ok(c) => c,
                        Err(_) => continue,
                    };

                    let pid = match control2.GetProcessId() {
                        Ok(p) => p,
                        Err(_) => continue,
                    };

                    if pids.contains(&pid) {
                        let volume: ISimpleAudioVolume = match control.cast() {
                            Ok(v) => v,
                            Err(_) => continue,
                        };

                        if volume.SetMute(mute, &GUID::zeroed()).is_ok() {
                            actually_muted.push(pid);
                        }
                    }
                }

                Ok(actually_muted)
            }
        })?;

        Ok(muted)
    }
}

// ── Linux implementation ────────────────────────────────────────────────────

#[cfg(target_os = "linux")]
mod platform {
    use super::*;

    pub fn enumerate_audio_sessions() -> AppResult<Vec<AudioSession>> {
        use libpulse_binding::context::Context;
        use libpulse_binding::mainloop::standard::Mainloop;
        use libpulse_binding::proplist::Proplist;
        use std::cell::RefCell;
        use std::rc::Rc;

        let mut mainloop = Mainloop::new().ok_or_else(|| {
            crate::error::AppError::General("Failed to create PulseAudio mainloop".into())
        })?;

        let mut proplist = Proplist::new()
            .ok_or_else(|| crate::error::AppError::General("Failed to create proplist".into()))?;
        proplist
            .set_str(
                libpulse_binding::proplist::properties::APPLICATION_NAME,
                "Flowtake",
            )
            .ok();

        let mut context =
            Context::new_with_proplist(&mainloop, "flowtake", &proplist).ok_or_else(|| {
                crate::error::AppError::General("Failed to create PulseAudio context".into())
            })?;

        context
            .connect(None, libpulse_binding::context::FlagSet::NOFLAGS, None)
            .map_err(|_| {
                crate::error::AppError::General("Failed to connect to PulseAudio".into())
            })?;

        // Wait for context to be ready
        loop {
            mainloop.iterate(true);
            match context.get_state() {
                libpulse_binding::context::State::Ready => break,
                libpulse_binding::context::State::Failed
                | libpulse_binding::context::State::Terminated => {
                    return Err(crate::error::AppError::General(
                        "PulseAudio connection failed".into(),
                    ));
                }
                _ => {}
            }
        }

        let sessions: Rc<RefCell<Vec<AudioSession>>> = Rc::new(RefCell::new(Vec::new()));
        let done = Rc::new(RefCell::new(false));

        let sessions_clone = sessions.clone();
        let done_clone = done.clone();
        let current_pid = std::process::id();

        let introspect = context.introspect();
        let _op = introspect.get_sink_input_info_list(move |list| {
            use libpulse_binding::callbacks::ListResult;
            match list {
                ListResult::Item(info) => {
                    let name = info
                        .proplist
                        .get_str("application.name")
                        .unwrap_or_else(|| format!("Unknown"));
                    let pid_str = info
                        .proplist
                        .get_str("application.process.id")
                        .unwrap_or_default();
                    let pid: u32 = pid_str.parse().unwrap_or(0);

                    if pid != 0 && pid != current_pid {
                        sessions_clone.borrow_mut().push(AudioSession { pid, name });
                    }
                }
                ListResult::End | ListResult::Error => {
                    *done_clone.borrow_mut() = true;
                }
            }
        });

        // Wait for enumeration to complete
        while !*done.borrow() {
            mainloop.iterate(true);
        }

        let result = sessions.borrow().clone();
        Ok(result)
    }

    pub fn mute_sessions_by_pid(pids: &[u32], mute: bool) -> AppResult<Vec<u32>> {
        use libpulse_binding::context::Context;
        use libpulse_binding::mainloop::standard::Mainloop;
        use libpulse_binding::proplist::Proplist;
        use std::cell::RefCell;
        use std::rc::Rc;

        let mut mainloop = Mainloop::new().ok_or_else(|| {
            crate::error::AppError::General("Failed to create PulseAudio mainloop".into())
        })?;

        let mut proplist = Proplist::new()
            .ok_or_else(|| crate::error::AppError::General("Failed to create proplist".into()))?;
        proplist
            .set_str(
                libpulse_binding::proplist::properties::APPLICATION_NAME,
                "Flowtake",
            )
            .ok();

        let mut context =
            Context::new_with_proplist(&mainloop, "flowtake", &proplist).ok_or_else(|| {
                crate::error::AppError::General("Failed to create PulseAudio context".into())
            })?;

        context
            .connect(None, libpulse_binding::context::FlagSet::NOFLAGS, None)
            .map_err(|_| {
                crate::error::AppError::General("Failed to connect to PulseAudio".into())
            })?;

        loop {
            mainloop.iterate(true);
            match context.get_state() {
                libpulse_binding::context::State::Ready => break,
                libpulse_binding::context::State::Failed
                | libpulse_binding::context::State::Terminated => {
                    return Err(crate::error::AppError::General(
                        "PulseAudio connection failed".into(),
                    ));
                }
                _ => {}
            }
        }

        let muted_pids: Rc<RefCell<Vec<u32>>> = Rc::new(RefCell::new(Vec::new()));
        let done = Rc::new(RefCell::new(false));

        let pids = pids.to_vec();
        let muted_clone = muted_pids.clone();
        let done_clone = done.clone();

        let introspect = context.introspect();
        let mut introspect2 = context.introspect();
        let _op = introspect.get_sink_input_info_list(move |list| {
            use libpulse_binding::callbacks::ListResult;
            match list {
                ListResult::Item(info) => {
                    let pid_str = info
                        .proplist
                        .get_str("application.process.id")
                        .unwrap_or_default();
                    let pid: u32 = pid_str.parse().unwrap_or(0);

                    if pids.contains(&pid) {
                        introspect2.set_sink_input_mute(info.index, mute, None);
                        muted_clone.borrow_mut().push(pid);
                    }
                }
                ListResult::End | ListResult::Error => {
                    *done_clone.borrow_mut() = true;
                }
            }
        });

        while !*done.borrow() {
            mainloop.iterate(true);
        }

        let result = muted_pids.borrow().clone();
        Ok(result)
    }
}

// ── macOS implementation (stub) ─────────────────────────────────────────────

#[cfg(target_os = "macos")]
mod platform {
    use super::*;

    pub fn enumerate_audio_sessions() -> AppResult<Vec<AudioSession>> {
        log::info!("[audio] Per-app audio control is not supported on macOS");
        Ok(Vec::new())
    }

    pub fn mute_sessions_by_pid(_pids: &[u32], _mute: bool) -> AppResult<Vec<u32>> {
        Ok(Vec::new())
    }
}

// ── Tauri commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_audio_sessions() -> AppResult<Vec<AudioSession>> {
    platform::enumerate_audio_sessions()
}

#[tauri::command]
pub async fn mute_audio_sessions(app: AppHandle, pids: Vec<u32>) -> AppResult<()> {
    log::info!("[audio] Muting {} audio sessions: {:?}", pids.len(), pids);

    let actually_muted = platform::mute_sessions_by_pid(&pids, true)?;

    // Store muted PIDs in state for restoration
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    state.muted_audio_pids = actually_muted;

    Ok(())
}

#[tauri::command]
pub async fn unmute_audio_sessions(app: AppHandle) -> AppResult<()> {
    unmute_all_sessions(&app);
    Ok(())
}

/// Helper to unmute all previously muted sessions. Called from stop_recording as safety net.
pub fn unmute_all_sessions(app: &AppHandle) {
    let pids = {
        let state = app.state::<Mutex<AppState>>();
        let mut state = state.lock().unwrap();
        std::mem::take(&mut state.muted_audio_pids)
    };

    if pids.is_empty() {
        return;
    }

    log::info!("[audio] Restoring {} muted audio sessions", pids.len());

    if let Err(e) = platform::mute_sessions_by_pid(&pids, false) {
        log::error!("[audio] Failed to unmute sessions: {:?}", e);
    }
}
