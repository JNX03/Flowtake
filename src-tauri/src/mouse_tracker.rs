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
    /// Recording area offset (top-left corner of the recorded region in screen coords)
    offset_x: i32,
    offset_y: i32,
    /// Scale factor for Retina displays (macOS: CGEvent reports logical points, video is physical pixels)
    scale_factor: f64,
}

impl MouseTracker {
    pub fn new() -> Self {
        Self {
            events: Arc::new(Mutex::new(Vec::new())),
            is_running: Arc::new(Mutex::new(false)),
            hook_thread: None,
            offset_x: 0,
            offset_y: 0,
            scale_factor: 1.0,
        }
    }

    /// Set the recording area offset so mouse coordinates are relative to the recorded region
    pub fn set_offset(&mut self, x: i32, y: i32) {
        self.offset_x = x;
        self.offset_y = y;
    }

    /// Set the display scale factor (for Retina displays)
    pub fn set_scale_factor(&mut self, scale: f64) {
        self.scale_factor = scale;
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
        let offset_x = self.offset_x;
        let offset_y = self.offset_y;
        let scale_factor = self.scale_factor;

        self.hook_thread = Some(thread::spawn(move || {
            #[cfg(target_os = "windows")]
            {
                let _ = scale_factor; // Windows uses physical coords already
                Self::run_hook_loop(events, is_running, offset_x, offset_y);
            }
            #[cfg(target_os = "macos")]
            {
                Self::run_macos_loop(events, is_running, offset_x, offset_y, scale_factor);
            }
            #[cfg(target_os = "linux")]
            {
                let _ = scale_factor;
                Self::run_linux_loop(events, is_running, offset_x, offset_y);
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
                use windows::Win32::Foundation::{WPARAM, LPARAM};
                use windows::Win32::UI::WindowsAndMessaging::PostThreadMessageW;
                use windows::Win32::UI::WindowsAndMessaging::WM_QUIT;

                if let Some(ref _handle) = self.hook_thread {
                    let tid = HOOK_THREAD_ID.load(std::sync::atomic::Ordering::Relaxed);
                    if tid != 0 {
                        let _ = PostThreadMessageW(tid, WM_QUIT, WPARAM(0), LPARAM(0));
                    }
                }
            }
        }

        if let Some(handle) = self.hook_thread.take() {
            let _ = handle.join();
        }

        let count = self.events.lock().unwrap().len();
        log::info!("[MouseTracker] Stopped. Total events captured: {}", count);
    }

    /// Get captured events normalized relative to a start timestamp
    pub fn get_events(&self, start_timestamp: i64) -> Vec<Value> {
        let events = self.events.lock().unwrap();
        let mut id_counter = 0;

        let result: Vec<Value> = events
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
            .collect();

        log::info!(
            "[MouseTracker] get_events: {} total, {} after filtering (start_ts={})",
            events.len(),
            result.len(),
            start_timestamp
        );

        result
    }
}

// Windows-specific hook implementation
// Use atomics for values accessed in the time-critical hook callback to avoid mutex overhead.
// Windows LL hooks have a ~300ms timeout; exceeding it causes the hook to be silently removed.

#[cfg(target_os = "windows")]
#[allow(clippy::type_complexity)]
static HOOK_EVENTS: std::sync::LazyLock<Mutex<Option<Arc<Mutex<Vec<MouseEvent>>>>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

#[cfg(target_os = "windows")]
static HOOK_RUNNING: std::sync::LazyLock<Mutex<Option<Arc<Mutex<bool>>>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

#[cfg(target_os = "windows")]
static HOOK_THREAD_ID: std::sync::atomic::AtomicU32 =
    std::sync::atomic::AtomicU32::new(0);

#[cfg(target_os = "windows")]
static LAST_MOUSEMOVE_TIME: std::sync::atomic::AtomicI64 =
    std::sync::atomic::AtomicI64::new(0);

#[cfg(target_os = "windows")]
static HOOK_OFFSET_X: std::sync::atomic::AtomicI32 =
    std::sync::atomic::AtomicI32::new(0);

#[cfg(target_os = "windows")]
static HOOK_OFFSET_Y: std::sync::atomic::AtomicI32 =
    std::sync::atomic::AtomicI32::new(0);

/// Cached cursor handles for type detection
#[cfg(target_os = "windows")]
static CURSOR_HANDLES: std::sync::LazyLock<Mutex<Option<CursorHandles>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

#[cfg(target_os = "windows")]
// SAFETY: HCURSOR handles are process-wide resources that are safe to share across threads.
// They are loaded once via LoadCursorW and never freed (system-managed).
unsafe impl Send for CursorHandles {}

#[cfg(target_os = "windows")]
struct CursorHandles {
    #[allow(dead_code)]
    default: windows::Win32::UI::WindowsAndMessaging::HCURSOR,
    text: windows::Win32::UI::WindowsAndMessaging::HCURSOR,
    wait: windows::Win32::UI::WindowsAndMessaging::HCURSOR,
    crosshair: windows::Win32::UI::WindowsAndMessaging::HCURSOR,
    nwse_resize: windows::Win32::UI::WindowsAndMessaging::HCURSOR,
    nesw_resize: windows::Win32::UI::WindowsAndMessaging::HCURSOR,
    ew_resize: windows::Win32::UI::WindowsAndMessaging::HCURSOR,
    ns_resize: windows::Win32::UI::WindowsAndMessaging::HCURSOR,
    move_cursor: windows::Win32::UI::WindowsAndMessaging::HCURSOR,
    not_allowed: windows::Win32::UI::WindowsAndMessaging::HCURSOR,
    pointer: windows::Win32::UI::WindowsAndMessaging::HCURSOR,
    progress: windows::Win32::UI::WindowsAndMessaging::HCURSOR,
}

#[cfg(target_os = "windows")]
impl CursorHandles {
    fn init() -> Option<Self> {
        use windows::Win32::UI::WindowsAndMessaging::*;

        unsafe {
            Some(Self {
                default: LoadCursorW(None, IDC_ARROW).ok()?,
                text: LoadCursorW(None, IDC_IBEAM).ok()?,
                wait: LoadCursorW(None, IDC_WAIT).ok()?,
                crosshair: LoadCursorW(None, IDC_CROSS).ok()?,
                nwse_resize: LoadCursorW(None, IDC_SIZENWSE).ok()?,
                nesw_resize: LoadCursorW(None, IDC_SIZENESW).ok()?,
                ew_resize: LoadCursorW(None, IDC_SIZEWE).ok()?,
                ns_resize: LoadCursorW(None, IDC_SIZENS).ok()?,
                move_cursor: LoadCursorW(None, IDC_SIZEALL).ok()?,
                not_allowed: LoadCursorW(None, IDC_NO).ok()?,
                pointer: LoadCursorW(None, IDC_HAND).ok()?,
                progress: LoadCursorW(None, IDC_APPSTARTING).ok()?,
            })
        }
    }

    fn identify(&self, cursor: windows::Win32::UI::WindowsAndMessaging::HCURSOR) -> &'static str {
        if cursor == self.text {
            "text"
        } else if cursor == self.wait {
            "wait"
        } else if cursor == self.crosshair {
            "crosshair"
        } else if cursor == self.nwse_resize {
            "nwse-resize"
        } else if cursor == self.nesw_resize {
            "nesw-resize"
        } else if cursor == self.ew_resize {
            "ew-resize"
        } else if cursor == self.ns_resize {
            "ns-resize"
        } else if cursor == self.move_cursor {
            "move"
        } else if cursor == self.not_allowed {
            "not-allowed"
        } else if cursor == self.pointer {
            "pointer"
        } else if cursor == self.progress {
            "progress"
        } else {
            "default"
        }
    }
}

#[cfg(target_os = "windows")]
impl MouseTracker {
    fn run_hook_loop(
        events: Arc<Mutex<Vec<MouseEvent>>>,
        is_running: Arc<Mutex<bool>>,
        offset_x: i32,
        offset_y: i32,
    ) {
        use std::sync::atomic::Ordering::Relaxed;
        use windows::Win32::UI::WindowsAndMessaging::*;

        // Store references in statics so the hook callback can access them
        *HOOK_EVENTS.lock().unwrap() = Some(events);
        *HOOK_RUNNING.lock().unwrap() = Some(is_running);
        HOOK_OFFSET_X.store(offset_x, Relaxed);
        HOOK_OFFSET_Y.store(offset_y, Relaxed);
        LAST_MOUSEMOVE_TIME.store(0, Relaxed);

        // Initialize cursor handles for type detection
        match CursorHandles::init() {
            Some(handles) => {
                *CURSOR_HANDLES.lock().unwrap() = Some(handles);
                log::info!("[MouseTracker] Cursor handles initialized");
            }
            None => {
                log::warn!("[MouseTracker] Failed to initialize cursor handles, falling back to 'default'");
            }
        }

        // Store thread ID so we can post WM_QUIT to break the loop
        unsafe {
            HOOK_THREAD_ID.store(
                windows::Win32::System::Threading::GetCurrentThreadId(),
                Relaxed,
            );
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

        log::info!(
            "[MouseTracker] Mouse hook installed (offset: {}, {})",
            offset_x,
            offset_y
        );

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
        HOOK_THREAD_ID.store(0, Relaxed);
        LAST_MOUSEMOVE_TIME.store(0, Relaxed);
        *CURSOR_HANDLES.lock().unwrap() = None;

        log::info!("[MouseTracker] Mouse hook removed");
    }

    unsafe extern "system" fn mouse_hook_proc(
        n_code: i32,
        w_param: windows::Win32::Foundation::WPARAM,
        l_param: windows::Win32::Foundation::LPARAM,
    ) -> windows::Win32::Foundation::LRESULT {
        use std::sync::atomic::Ordering::Relaxed;
        use windows::Win32::UI::WindowsAndMessaging::*;

        if n_code >= 0 {
            let mouse_struct = &*(l_param.0 as *const MSLLHOOKSTRUCT);
            let now = chrono::Utc::now().timestamp_millis();

            let msg = w_param.0 as u32;

            let (event_type, button) = match msg {
                WM_LBUTTONDOWN => (Some("mousedown"), "left"),
                WM_LBUTTONUP => (Some("mouseup"), "left"),
                WM_RBUTTONDOWN => (Some("mousedown"), "right"),
                WM_RBUTTONUP => (Some("mouseup"), "right"),
                WM_MBUTTONDOWN => (Some("mousedown"), "middle"),
                WM_MBUTTONUP => (Some("mouseup"), "middle"),
                WM_MOUSEMOVE => (Some("mousemove"), ""),
                _ => (None, ""),
            };

            if let Some(event_type) = event_type {
                // For mousemove, sample at ~10ms intervals (~100Hz) for smooth tracking
                if event_type == "mousemove" {
                    let last_time = LAST_MOUSEMOVE_TIME.load(Relaxed);
                    if now - last_time < 10 {
                        return CallNextHookEx(None, n_code, w_param, l_param);
                    }
                    LAST_MOUSEMOVE_TIME.store(now, Relaxed);
                }

                // Detect cursor type using GetCursorInfo (like the original C++ implementation)
                let cursor_name = {
                    let mut cur_info = CURSORINFO {
                        cbSize: std::mem::size_of::<CURSORINFO>() as u32,
                        ..Default::default()
                    };
                    if GetCursorInfo(&mut cur_info).is_ok() {
                        // Use try_lock to avoid blocking the hook callback if the mutex is held
                        if let Ok(handles) = CURSOR_HANDLES.try_lock() {
                            if let Some(ref h) = *handles {
                                h.identify(cur_info.hCursor)
                            } else {
                                "default"
                            }
                        } else {
                            "default"
                        }
                    } else {
                        "default"
                    }
                };

                // Apply recording area offset (atomics - no lock needed)
                let offset_x = HOOK_OFFSET_X.load(Relaxed);
                let offset_y = HOOK_OFFSET_Y.load(Relaxed);

                let event = MouseEvent {
                    x: mouse_struct.pt.x - offset_x,
                    y: mouse_struct.pt.y - offset_y,
                    timestamp: now,
                    event_type: event_type.to_string(),
                    button: button.to_string(),
                    cursor: cursor_name.to_string(),
                };

                if let Ok(hook_events) = HOOK_EVENTS.try_lock() {
                    if let Some(ref events) = *hook_events {
                        if let Ok(mut events) = events.try_lock() {
                            events.push(event);
                        }
                    }
                }
            }
        }

        unsafe { CallNextHookEx(None, n_code, w_param, l_param) }
    }
}

// macOS: hide/show system cursor during recording so screencapture doesn't bake it into the video
#[cfg(target_os = "macos")]
extern "C" {
    fn CGMainDisplayID() -> u32;
    fn CGDisplayHideCursor(display: u32) -> i32;
    fn CGDisplayShowCursor(display: u32) -> i32;
}

#[cfg(target_os = "macos")]
struct CursorHider {
    hidden: bool,
}

#[cfg(target_os = "macos")]
impl CursorHider {
    fn hide() -> Self {
        unsafe { CGDisplayHideCursor(CGMainDisplayID()); }
        log::info!("[CursorHider] System cursor hidden");
        Self { hidden: true }
    }
}

#[cfg(target_os = "macos")]
impl Drop for CursorHider {
    fn drop(&mut self) {
        if self.hidden {
            unsafe { CGDisplayShowCursor(CGMainDisplayID()); }
            log::info!("[CursorHider] System cursor restored");
        }
    }
}

/// Restore the system cursor (defensive call for error paths)
#[cfg(target_os = "macos")]
pub fn restore_macos_cursor() {
    unsafe { CGDisplayShowCursor(CGMainDisplayID()); }
}

/// Detect the current macOS cursor type via NSCursor
#[cfg(target_os = "macos")]
fn detect_macos_cursor_type() -> &'static str {
    unsafe {
        let cls = match objc::runtime::Class::get("NSCursor") {
            Some(c) => c as *const _ as *const objc::runtime::Object,
            None => return "default",
        };

        let current: *const objc::runtime::Object = objc::msg_send![cls, currentSystemCursor];
        if current.is_null() {
            return "default";
        }

        let ibeam: *const objc::runtime::Object = objc::msg_send![cls, IBeamCursor];
        if current == ibeam { return "text"; }

        let pointing: *const objc::runtime::Object = objc::msg_send![cls, pointingHandCursor];
        if current == pointing { return "pointer"; }

        let crosshair: *const objc::runtime::Object = objc::msg_send![cls, crosshairCursor];
        if current == crosshair { return "crosshair"; }

        let resize_lr: *const objc::runtime::Object = objc::msg_send![cls, resizeLeftRightCursor];
        if current == resize_lr { return "ew-resize"; }

        let resize_ud: *const objc::runtime::Object = objc::msg_send![cls, resizeUpDownCursor];
        if current == resize_ud { return "ns-resize"; }

        let open_hand: *const objc::runtime::Object = objc::msg_send![cls, openHandCursor];
        if current == open_hand { return "move"; }

        let not_allowed: *const objc::runtime::Object = objc::msg_send![cls, operationNotAllowedCursor];
        if current == not_allowed { return "not-allowed"; }

        "default"
    }
}

// macOS mouse tracking implementation using polling (CGEvent-based)
#[cfg(target_os = "macos")]
impl MouseTracker {
    fn run_macos_loop(
        events: Arc<Mutex<Vec<MouseEvent>>>,
        is_running: Arc<Mutex<bool>>,
        offset_x: i32,
        offset_y: i32,
        scale_factor: f64,
    ) {
        use core_graphics::event::CGEvent;
        use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

        log::info!(
            "[MouseTracker] macOS mouse tracking started (offset: {}, {}, scale: {})",
            offset_x, offset_y, scale_factor
        );

        // Hide system cursor so screencapture records without it.
        // The Drop impl restores cursor when this loop exits (including panics).
        let _cursor_hider = CursorHider::hide();

        let poll_interval = std::time::Duration::from_millis(16); // ~60Hz polling
        let mut last_x: i32 = -1;
        let mut last_y: i32 = -1;
        let mut last_buttons: u32 = 0;

        while *is_running.lock().unwrap() {
            let start = std::time::Instant::now();

            // Get mouse location from CGEvent
            if let Ok(source) = CGEventSource::new(CGEventSourceStateID::CombinedSessionState) {
                if let Ok(event) = CGEvent::new(source) {
                    let location = event.location();
                    // CGEvent reports logical points; scale to physical pixels to match video resolution
                    let x = ((location.x - offset_x as f64) * scale_factor) as i32;
                    let y = ((location.y - offset_y as f64) * scale_factor) as i32;
                    let now = chrono::Utc::now().timestamp_millis();

                    // Check button state via NSEvent
                    let buttons = unsafe {
                        // NSEvent.pressedMouseButtons
                        let cls: *const objc::runtime::Object =
                            objc::runtime::Class::get("NSEvent")
                                .map(|c| c as *const _ as *const objc::runtime::Object)
                                .unwrap_or(std::ptr::null());
                        if !cls.is_null() {
                            let result: u64 = objc::msg_send![cls, pressedMouseButtons];
                            result as u32
                        } else {
                            0u32
                        }
                    };

                    let cursor = detect_macos_cursor_type().to_string();

                    // Detect button press/release changes
                    let left_now = buttons & 1 != 0;
                    let left_was = last_buttons & 1 != 0;
                    let right_now = buttons & 2 != 0;
                    let right_was = last_buttons & 2 != 0;

                    if left_now && !left_was {
                        events.lock().unwrap().push(MouseEvent {
                            x, y, timestamp: now,
                            event_type: "mousedown".to_string(),
                            button: "left".to_string(),
                            cursor: cursor.clone(),
                        });
                    } else if !left_now && left_was {
                        events.lock().unwrap().push(MouseEvent {
                            x, y, timestamp: now,
                            event_type: "mouseup".to_string(),
                            button: "left".to_string(),
                            cursor: cursor.clone(),
                        });
                    }
                    if right_now && !right_was {
                        events.lock().unwrap().push(MouseEvent {
                            x, y, timestamp: now,
                            event_type: "mousedown".to_string(),
                            button: "right".to_string(),
                            cursor: cursor.clone(),
                        });
                    } else if !right_now && right_was {
                        events.lock().unwrap().push(MouseEvent {
                            x, y, timestamp: now,
                            event_type: "mouseup".to_string(),
                            button: "right".to_string(),
                            cursor: cursor.clone(),
                        });
                    }

                    // Track movement
                    if x != last_x || y != last_y {
                        events.lock().unwrap().push(MouseEvent {
                            x, y, timestamp: now,
                            event_type: "mousemove".to_string(),
                            button: "".to_string(),
                            cursor,
                        });
                        last_x = x;
                        last_y = y;
                    }

                    last_buttons = buttons;
                }
            }

            let elapsed = start.elapsed();
            if elapsed < poll_interval {
                std::thread::sleep(poll_interval - elapsed);
            }
        }

        log::info!("[MouseTracker] macOS mouse tracking stopped");
        // _cursor_hider drops here, restoring system cursor
    }
}

// Linux mouse tracking implementation using polling /dev/input or xdotool
#[cfg(target_os = "linux")]
impl MouseTracker {
    fn run_linux_loop(
        events: Arc<Mutex<Vec<MouseEvent>>>,
        is_running: Arc<Mutex<bool>>,
        offset_x: i32,
        offset_y: i32,
    ) {
        log::info!(
            "[MouseTracker] Linux mouse tracking started (offset: {}, {})",
            offset_x, offset_y
        );

        let poll_interval = std::time::Duration::from_millis(16); // ~60Hz polling
        let mut last_x: i32 = -1;
        let mut last_y: i32 = -1;

        while *is_running.lock().unwrap() {
            let start = std::time::Instant::now();

            // Get mouse location via xdotool getmouselocation
            if let Ok(output) = std::process::Command::new("xdotool")
                .args(["getmouselocation", "--shell"])
                .output()
            {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let mut x: i32 = 0;
                let mut y: i32 = 0;

                for line in stdout.lines() {
                    if let Some(val) = line.strip_prefix("X=") {
                        x = val.parse().unwrap_or(0) - offset_x;
                    } else if let Some(val) = line.strip_prefix("Y=") {
                        y = val.parse().unwrap_or(0) - offset_y;
                    }
                }

                let now = chrono::Utc::now().timestamp_millis();

                if x != last_x || y != last_y {
                    events.lock().unwrap().push(MouseEvent {
                        x,
                        y,
                        timestamp: now,
                        event_type: "mousemove".to_string(),
                        button: "".to_string(),
                        cursor: "default".to_string(),
                    });
                    last_x = x;
                    last_y = y;
                }
            }

            let elapsed = start.elapsed();
            if elapsed < poll_interval {
                std::thread::sleep(poll_interval - elapsed);
            }
        }

        log::info!("[MouseTracker] Linux mouse tracking stopped");
    }
}
