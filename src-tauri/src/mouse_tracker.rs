use serde_json::Value;
use std::sync::{Arc, Mutex};
use std::thread;

/// Mouse event captured during recording
#[derive(Clone, Debug)]
pub struct MouseEvent {
    pub x: i32,
    pub y: i32,
    pub timestamp: i64,
    pub event_type: String, // "mousedown", "mouseup", "mousemove"
    pub button: String,     // "left", "right", "middle"
    pub cursor: String,     // cursor type
}

/// Global mouse tracker that uses a low-level Windows mouse hook
pub struct MouseTracker {
    events: Arc<Mutex<Vec<MouseEvent>>>,
    is_running: Arc<Mutex<bool>>,
    hook_thread: Option<thread::JoinHandle<()>>,
}

impl MouseTracker {
    pub fn new() -> Self {
        Self {
            events: Arc::new(Mutex::new(Vec::new())),
            is_running: Arc::new(Mutex::new(false)),
            hook_thread: None,
        }
    }

    /// Start capturing mouse events
    pub fn start(&mut self) {
        {
            let mut running = self.is_running.lock().unwrap();
            if *running {
                return;
            }
            *running = true;
        }

        // Clear previous events
        self.events.lock().unwrap().clear();

        let events = self.events.clone();
        let is_running = self.is_running.clone();

        self.hook_thread = Some(thread::spawn(move || {
            #[cfg(target_os = "windows")]
            {
                Self::run_hook_loop(events, is_running);
            }
        }));
    }

    /// Stop capturing mouse events
    pub fn stop(&mut self) {
        {
            let mut running = self.is_running.lock().unwrap();
            *running = false;
        }

        #[cfg(target_os = "windows")]
        {
            // Post a quit message to the hook thread's message loop
            unsafe {
                use windows::Win32::UI::WindowsAndMessaging::PostThreadMessageW;
                use windows::Win32::UI::WindowsAndMessaging::WM_QUIT;

                if let Some(ref _handle) = self.hook_thread {
                    // We stored the thread id in a static - use WM_QUIT to break the message loop
                    let tid = HOOK_THREAD_ID.lock().unwrap();
                    if *tid != 0 {
                        let _ = PostThreadMessageW(*tid, WM_QUIT, None, None);
                    }
                }
            }
        }

        if let Some(handle) = self.hook_thread.take() {
            let _ = handle.join();
        }
    }

    /// Get captured events normalized relative to a start timestamp
    pub fn get_events(&self, start_timestamp: i64) -> Vec<Value> {
        let events = self.events.lock().unwrap();
        let mut id_counter = 0;

        events
            .iter()
            .filter_map(|e| {
                let relative_ts = e.timestamp - start_timestamp;
                if relative_ts < 0 {
                    return None;
                }

                id_counter += 1;
                Some(serde_json::json!({
                    "id": id_counter,
                    "x": e.x,
                    "y": e.y,
                    "timestamp": relative_ts,
                    "type": e.event_type,
                    "button": e.button,
                    "cursor": e.cursor,
                    "isActive": true
                }))
            })
            .collect()
    }
}

// Windows-specific hook implementation
#[cfg(target_os = "windows")]
static HOOK_EVENTS: std::sync::LazyLock<Mutex<Option<Arc<Mutex<Vec<MouseEvent>>>>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

#[cfg(target_os = "windows")]
static HOOK_RUNNING: std::sync::LazyLock<Mutex<Option<Arc<Mutex<bool>>>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

#[cfg(target_os = "windows")]
static HOOK_THREAD_ID: std::sync::LazyLock<Mutex<u32>> =
    std::sync::LazyLock::new(|| Mutex::new(0));

#[cfg(target_os = "windows")]
impl MouseTracker {
    fn run_hook_loop(events: Arc<Mutex<Vec<MouseEvent>>>, is_running: Arc<Mutex<bool>>) {
        use windows::Win32::UI::WindowsAndMessaging::*;

        // Store references in statics so the hook callback can access them
        *HOOK_EVENTS.lock().unwrap() = Some(events);
        *HOOK_RUNNING.lock().unwrap() = Some(is_running);

        // Store thread ID so we can post WM_QUIT to break the loop
        unsafe {
            *HOOK_THREAD_ID.lock().unwrap() =
                windows::Win32::System::Threading::GetCurrentThreadId();
        }

        // Install low-level mouse hook
        let hook = unsafe {
            SetWindowsHookExW(WH_MOUSE_LL, Some(Self::mouse_hook_proc), None, 0)
        };

        let hook = match hook {
            Ok(h) => h,
            Err(e) => {
                log::error!("[MouseTracker] Failed to set mouse hook: {}", e);
                return;
            }
        };

        log::info!("[MouseTracker] Mouse hook installed");

        // Message pump - required for low-level hooks to work
        unsafe {
            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                // Check if we should stop
                let should_stop = HOOK_RUNNING
                    .lock()
                    .unwrap()
                    .as_ref()
                    .map(|r| !*r.lock().unwrap())
                    .unwrap_or(true);

                if should_stop {
                    break;
                }

                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            let _ = UnhookWindowsHookEx(hook);
        }

        // Clear statics
        *HOOK_EVENTS.lock().unwrap() = None;
        *HOOK_RUNNING.lock().unwrap() = None;
        *HOOK_THREAD_ID.lock().unwrap() = 0;

        log::info!("[MouseTracker] Mouse hook removed");
    }

    unsafe extern "system" fn mouse_hook_proc(
        n_code: i32,
        w_param: windows::Win32::Foundation::WPARAM,
        l_param: windows::Win32::Foundation::LPARAM,
    ) -> windows::Win32::Foundation::LRESULT {
        use windows::Win32::UI::WindowsAndMessaging::*;

        if n_code >= 0 {
            let mouse_struct = &*(l_param.0 as *const MSLLHOOKSTRUCT);
            let now = chrono::Utc::now().timestamp_millis();

            let (event_type, button) = match w_param.0 as u32 {
                WM_LBUTTONDOWN => (Some("mousedown"), "left"),
                WM_LBUTTONUP => (Some("mouseup"), "left"),
                WM_RBUTTONDOWN => (Some("mousedown"), "right"),
                WM_RBUTTONUP => (Some("mouseup"), "right"),
                WM_MBUTTONDOWN => (Some("mousedown"), "middle"),
                WM_MBUTTONUP => (Some("mouseup"), "middle"),
                _ => (None, ""),
            };

            if let Some(event_type) = event_type {
                let event = MouseEvent {
                    x: mouse_struct.pt.x,
                    y: mouse_struct.pt.y,
                    timestamp: now,
                    event_type: event_type.to_string(),
                    button: button.to_string(),
                    cursor: "default".to_string(),
                };

                if let Some(events) = HOOK_EVENTS.lock().unwrap().as_ref() {
                    events.lock().unwrap().push(event);
                }
            }
        }

        unsafe { CallNextHookEx(None, n_code, w_param, l_param) }
    }
}
