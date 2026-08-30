use serde_json::Value;
use std::sync::{Arc, Mutex};
use std::thread;

/// Keyboard event captured during recording.
#[derive(Clone, Debug)]
pub struct KeyEvent {
    pub vk_code: u32,
    pub key_name: String,
    /// Bit flags: 1=Ctrl, 2=Shift, 4=Alt, 8=Meta(Win/Cmd)
    pub modifiers: u8,
    pub event_type: &'static str, // "keydown" | "keyup"
    pub timestamp: i64,
}

pub const FT_MOD_CTRL: u8 = 1;
pub const FT_MOD_SHIFT: u8 = 2;
pub const FT_MOD_ALT: u8 = 4;
pub const FT_MOD_META: u8 = 8;

/// Cross-platform keyboard tracker. Currently implements a Windows low-level
/// hook; macOS/Linux stubs return no events but keep the API stable so the
/// crate compiles on every platform.
pub struct KeyboardTracker {
    events: Arc<Mutex<Vec<KeyEvent>>>,
    is_running: Arc<Mutex<bool>>,
    hook_thread: Option<thread::JoinHandle<()>>,
}

impl KeyboardTracker {
    pub fn new() -> Self {
        Self {
            events: Arc::new(Mutex::new(Vec::new())),
            is_running: Arc::new(Mutex::new(false)),
            hook_thread: None,
        }
    }

    pub fn start(&mut self) -> Result<(), String> {
        {
            let mut running = self.is_running.lock().unwrap();
            if *running {
                log::warn!("[KeyboardTracker] start() called while already running; ignored");
                return Ok(());
            }
            *running = true;
        }
        log::info!("[KeyboardTracker] start() — installing low-level keyboard hook");
        self.events.lock().unwrap().clear();

        let events = self.events.clone();
        let is_running = self.is_running.clone();
        #[cfg(target_os = "windows")]
        let (ready_tx, ready_rx) = std::sync::mpsc::sync_channel(1);

        self.hook_thread = Some(thread::spawn(move || {
            #[cfg(target_os = "windows")]
            {
                Self::run_hook_loop(events, is_running, ready_tx);
            }
            #[cfg(not(target_os = "windows"))]
            {
                // Stub: hold the running flag until stop() flips it.
                while *is_running.lock().unwrap() {
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
                let _ = events;
            }
        }));

        #[cfg(target_os = "windows")]
        {
            match ready_rx.recv() {
                Ok(Ok(())) => {}
                Ok(Err(error)) => {
                    if let Some(handle) = self.hook_thread.take() {
                        let _ = handle.join();
                    }
                    *self.is_running.lock().unwrap() = false;
                    return Err(error);
                }
                Err(error) => {
                    if let Some(handle) = self.hook_thread.take() {
                        let _ = handle.join();
                    }
                    *self.is_running.lock().unwrap() = false;
                    return Err(format!(
                        "Keyboard hook stopped before initialization completed: {}",
                        error
                    ));
                }
            }
        }

        Ok(())
    }

    pub fn stop(&mut self) {
        // Idempotent: bail silently if already stopped (and never started).
        // Avoids the duplicate "[KeyboardTracker] Stopped" log when both the
        // recorder JS and stop_recording defensively call us.
        {
            let running = self.is_running.lock().unwrap();
            if !*running && self.hook_thread.is_none() {
                return;
            }
        }
        {
            let mut running = self.is_running.lock().unwrap();
            *running = false;
        }

        #[cfg(target_os = "windows")]
        unsafe {
            use windows::Win32::Foundation::{LPARAM, WPARAM};
            use windows::Win32::UI::WindowsAndMessaging::{PostThreadMessageW, WM_QUIT};
            if self.hook_thread.is_some() {
                let tid = KB_HOOK_THREAD_ID.load(std::sync::atomic::Ordering::Relaxed);
                if tid != 0 {
                    if let Err(e) = PostThreadMessageW(tid, WM_QUIT, WPARAM(0), LPARAM(0)) {
                        log::warn!("[KeyboardTracker] PostThreadMessageW failed: {}", e);
                    }
                }
            }
        }

        if let Some(h) = self.hook_thread.take() {
            let _ = h.join();
        }
        let n = self.events.lock().unwrap().len();
        log::info!("[KeyboardTracker] Stopped. {} key events captured", n);
    }

    pub fn get_events(&self, start_timestamp: i64) -> Vec<Value> {
        let events = self.events.lock().unwrap();
        events
            .iter()
            .filter_map(|e| {
                let rel = e.timestamp - start_timestamp;
                if rel < 0 {
                    return None;
                }
                Some(serde_json::json!({
                    "vkCode": e.vk_code,
                    "keyName": e.key_name,
                    "modifiers": e.modifiers,
                    "type": e.event_type,
                    "timestamp": rel,
                }))
            })
            .collect()
    }
}

// ── Windows implementation ──────────────────────────────────────────────────
#[cfg(target_os = "windows")]
type SharedKeyEvents = Arc<Mutex<Vec<KeyEvent>>>;

#[cfg(target_os = "windows")]
static KB_EVENTS: std::sync::LazyLock<Mutex<Option<SharedKeyEvents>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

#[cfg(target_os = "windows")]
static KB_RUNNING: std::sync::LazyLock<Mutex<Option<Arc<Mutex<bool>>>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

#[cfg(target_os = "windows")]
static KB_HOOK_THREAD_ID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

#[cfg(target_os = "windows")]
impl KeyboardTracker {
    fn run_hook_loop(
        events: Arc<Mutex<Vec<KeyEvent>>>,
        is_running: Arc<Mutex<bool>>,
        ready: std::sync::mpsc::SyncSender<Result<(), String>>,
    ) {
        use std::sync::atomic::Ordering::Relaxed;
        use windows::Win32::Foundation::HINSTANCE;
        use windows::Win32::System::LibraryLoader::GetModuleHandleW;
        use windows::Win32::UI::WindowsAndMessaging::*;

        *KB_EVENTS.lock().unwrap() = Some(events);
        *KB_RUNNING.lock().unwrap() = Some(is_running);

        unsafe {
            let tid = windows::Win32::System::Threading::GetCurrentThreadId();
            KB_HOOK_THREAD_ID.store(tid, Relaxed);

            let module = match GetModuleHandleW(None) {
                Ok(module) => HINSTANCE(module.0),
                Err(error) => {
                    let message = format!(
                        "Could not resolve the Flowtake module for the keyboard hook: {}",
                        error
                    );
                    log::error!("[KeyboardTracker] {}", message);
                    let _ = ready.send(Err(message));
                    KB_HOOK_THREAD_ID.store(0, Relaxed);
                    *KB_EVENTS.lock().unwrap() = None;
                    *KB_RUNNING.lock().unwrap() = None;
                    return;
                }
            };

            let hook = match SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(low_level_keyboard_proc),
                Some(module),
                0,
            ) {
                Ok(hook) => hook,
                Err(error) => {
                    let message = format!("Could not install the Windows keyboard hook: {}", error);
                    log::error!("[KeyboardTracker] {}", message);
                    let _ = ready.send(Err(message));
                    KB_HOOK_THREAD_ID.store(0, Relaxed);
                    *KB_EVENTS.lock().unwrap() = None;
                    *KB_RUNNING.lock().unwrap() = None;
                    return;
                }
            };
            log::info!("[KeyboardTracker] WH_KEYBOARD_LL installed (tid={})", tid);
            if ready.send(Ok(())).is_err() {
                UnhookWindowsHookEx(hook).ok();
                KB_HOOK_THREAD_ID.store(0, Relaxed);
                *KB_EVENTS.lock().unwrap() = None;
                *KB_RUNNING.lock().unwrap() = None;
                return;
            }

            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).into() {
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            UnhookWindowsHookEx(hook).ok();
            KB_HOOK_THREAD_ID.store(0, Relaxed);
            *KB_EVENTS.lock().unwrap() = None;
            *KB_RUNNING.lock().unwrap() = None;
        }
    }
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn low_level_keyboard_proc(
    n_code: i32,
    w_param: windows::Win32::Foundation::WPARAM,
    l_param: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::UI::Input::KeyboardAndMouse::*;
    use windows::Win32::UI::WindowsAndMessaging::*;

    if n_code >= 0 {
        let kb = &*(l_param.0 as *const KBDLLHOOKSTRUCT);
        let vk = kb.vkCode;
        let event_type: &'static str = match w_param.0 as u32 {
            WM_KEYDOWN | WM_SYSKEYDOWN => "keydown",
            WM_KEYUP | WM_SYSKEYUP => "keyup",
            _ => "keydown",
        };

        // Build modifier bitmap from current key state (high bit set = down).
        let mut modifiers: u8 = 0;
        if (GetAsyncKeyState(VK_CONTROL.0 as i32) as u16 & 0x8000) != 0 {
            modifiers |= FT_MOD_CTRL;
        }
        if (GetAsyncKeyState(VK_SHIFT.0 as i32) as u16 & 0x8000) != 0 {
            modifiers |= FT_MOD_SHIFT;
        }
        if (GetAsyncKeyState(VK_MENU.0 as i32) as u16 & 0x8000) != 0 {
            modifiers |= FT_MOD_ALT;
        }
        if (GetAsyncKeyState(VK_LWIN.0 as i32) as u16 & 0x8000) != 0
            || (GetAsyncKeyState(VK_RWIN.0 as i32) as u16 & 0x8000) != 0
        {
            modifiers |= FT_MOD_META;
        }

        let key_name = vk_to_name(vk);
        let timestamp = chrono::Utc::now().timestamp_millis();

        if let Some(buf) = KB_EVENTS.lock().unwrap().as_ref() {
            let mut events = buf.lock().unwrap();
            // First captured event — log so we can confirm the hook is alive.
            if events.is_empty() {
                log::info!(
                    "[KeyboardTracker] first event captured: type={} vk={} key={}",
                    event_type,
                    vk,
                    key_name
                );
            }
            // Cap at 50k to avoid runaway memory if the recorder is left on for hours
            if events.len() < 50_000 {
                events.push(KeyEvent {
                    vk_code: vk,
                    key_name,
                    modifiers,
                    event_type,
                    timestamp,
                });
            }
        }
    }

    CallNextHookEx(None, n_code, w_param, l_param)
}

#[cfg(target_os = "windows")]
fn vk_to_name(vk: u32) -> String {
    use windows::Win32::UI::Input::KeyboardAndMouse::*;
    let v = vk as u16;

    // F1..F24
    if (VK_F1.0..=VK_F24.0).contains(&v) {
        return format!("F{}", v - VK_F1.0 + 1);
    }
    // 0..9 top row
    if (0x30..=0x39).contains(&v) {
        return ((v as u8) as char).to_string();
    }
    // A..Z
    if (0x41..=0x5A).contains(&v) {
        return ((v as u8) as char).to_string();
    }
    // Numpad 0..9
    if (VK_NUMPAD0.0..=VK_NUMPAD9.0).contains(&v) {
        return format!("Num{}", v - VK_NUMPAD0.0);
    }

    match VIRTUAL_KEY(v) {
        VK_CONTROL | VK_LCONTROL | VK_RCONTROL => "Ctrl".into(),
        VK_SHIFT | VK_LSHIFT | VK_RSHIFT => "Shift".into(),
        VK_MENU | VK_LMENU | VK_RMENU => "Alt".into(),
        VK_LWIN | VK_RWIN => "Win".into(),
        VK_BACK => "Backspace".into(),
        VK_TAB => "Tab".into(),
        VK_RETURN => "Enter".into(),
        VK_ESCAPE => "Esc".into(),
        VK_SPACE => "Space".into(),
        VK_DELETE => "Delete".into(),
        VK_INSERT => "Insert".into(),
        VK_HOME => "Home".into(),
        VK_END => "End".into(),
        VK_PRIOR => "PageUp".into(),
        VK_NEXT => "PageDown".into(),
        VK_LEFT => "←".into(),
        VK_RIGHT => "→".into(),
        VK_UP => "↑".into(),
        VK_DOWN => "↓".into(),
        VK_CAPITAL => "Caps".into(),
        VK_SNAPSHOT => "PrtSc".into(),
        VK_PAUSE => "Pause".into(),
        VK_OEM_COMMA => ",".into(),
        VK_OEM_PERIOD => ".".into(),
        VK_OEM_MINUS => "-".into(),
        VK_OEM_PLUS => "+".into(),
        VK_OEM_1 => ";".into(),
        VK_OEM_2 => "/".into(),
        VK_OEM_3 => "`".into(),
        VK_OEM_4 => "[".into(),
        VK_OEM_5 => "\\".into(),
        VK_OEM_6 => "]".into(),
        VK_OEM_7 => "'".into(),
        _ => format!("VK{}", v),
    }
}

#[cfg(not(target_os = "windows"))]
fn _unused() {
    // Keeps the file compiling on non-Windows targets without dead-code warnings.
}
