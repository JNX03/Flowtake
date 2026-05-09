use std::collections::HashMap;
use std::fs::File;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri_plugin_shell::process::CommandChild;
use tokio::sync::mpsc;
use crate::keyboard_tracker::KeyboardTracker;
use crate::mouse_tracker::MouseTracker;

/// Global application state managed by Tauri
pub struct AppState {
    pub app_data_dir: PathBuf,
    pub projects_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub project_id: Option<String>,
    pub recording_id: Option<String>,
    pub file_handles: HashMap<String, File>,
    pub is_recording: bool,
    #[allow(dead_code)]
    pub is_closing: bool,
    pub camera_file_handle: Option<File>,
    pub renders: HashMap<String, RenderState>,
    pub camera_mic_config: Option<Value>,
    pub ffmpeg_child_id: Option<u32>,
    pub ffmpeg_child: Option<CommandChild>,
    pub mouse_tracker: MouseTracker,
    pub keyboard_tracker: KeyboardTracker,
    pub recording_start_timestamp: Option<i64>,
    pub export_state_data: Option<Value>,
    pub export_section: Option<String>,
    /// Stop flag for window capture thread (PrintWindow pipeline)
    pub window_capture_stop: Arc<AtomicBool>,
    /// Window capture thread handle
    pub window_capture_thread: Option<std::thread::JoinHandle<()>>,
    /// FFmpeg process spawned via std::process::Command (for window capture pipeline)
    pub ffmpeg_process: Option<std::process::Child>,
    /// PIDs of audio sessions muted during recording (restored on stop)
    pub muted_audio_pids: Vec<u32>,
    // ── Live streaming ──────────────────────────────────────────────────
    /// FFmpeg process handling the live RTMP+local-file pipeline
    pub live_ffmpeg_process: Option<std::process::Child>,
    /// Channel for pushing webm/mkv chunks from the JS compositor to FFmpeg stdin
    pub live_stdin_tx: Option<mpsc::UnboundedSender<Vec<u8>>>,
    /// Stop flag for the live pipeline pump thread
    pub live_stop_flag: Arc<AtomicBool>,
    /// Latest parsed FFmpeg stats (fps, bitrate, dropped frames, …)
    pub live_stats: Arc<Mutex<LiveStats>>,
    /// Path to the local mp4 produced by the tee muxer (for the summary toast)
    pub live_local_path: Option<PathBuf>,
    /// UTC start timestamp of the current live session (millis)
    pub live_started_at_ms: Option<i64>,
    /// Currently registered live-zoom hotkey (so we can unregister on rebind)
    pub live_zoom_hotkey: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct LiveStats {
    pub fps: f64,
    pub bitrate_kbps: f64,
    pub dropped_frames: u64,
    pub dup_frames: u64,
    pub elapsed_ms: i64,
    pub speed: f64,
    pub connected: bool,
}

pub struct RenderState {
    #[allow(dead_code)]
    pub id: String,
    #[allow(dead_code)]
    pub project_id: String,
    pub output_path: PathBuf,
    pub temp_dir: PathBuf,
    pub is_cancelled: bool,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            app_data_dir: PathBuf::new(),
            projects_dir: PathBuf::new(),
            temp_dir: PathBuf::new(),
            project_id: None,
            recording_id: None,
            file_handles: HashMap::new(),
            is_recording: false,
            is_closing: false,
            camera_file_handle: None,
            renders: HashMap::new(),
            camera_mic_config: None,
            ffmpeg_child_id: None,
            ffmpeg_child: None,
            mouse_tracker: MouseTracker::new(),
            keyboard_tracker: KeyboardTracker::new(),
            recording_start_timestamp: None,
            export_state_data: None,
            export_section: None,
            window_capture_stop: Arc::new(AtomicBool::new(false)),
            window_capture_thread: None,
            ffmpeg_process: None,
            muted_audio_pids: Vec::new(),
            live_ffmpeg_process: None,
            live_stdin_tx: None,
            live_stop_flag: Arc::new(AtomicBool::new(false)),
            live_stats: Arc::new(Mutex::new(LiveStats::default())),
            live_local_path: None,
            live_started_at_ms: None,
            live_zoom_hotkey: None,
        }
    }

    pub fn project_temp_dir(&self, id: &str) -> PathBuf {
        self.temp_dir.join(id)
    }

    pub fn project_zip_path(&self, id: &str) -> PathBuf {
        self.projects_dir.join(format!("{}.zip", id))
    }

    pub fn screen_video_file(&self, id: &str) -> PathBuf {
        self.project_temp_dir(id).join("screen.mp4")
    }

    pub fn camera_video_file(&self, id: &str) -> PathBuf {
        self.project_temp_dir(id).join("camera.webm")
    }

    #[allow(dead_code)]
    pub fn microphone_audio_file(&self, id: &str) -> PathBuf {
        self.project_temp_dir(id).join("camera.webm")
    }

    pub fn background_file(&self, id: &str) -> PathBuf {
        self.project_temp_dir(id).join("background.png")
    }

    pub fn project_json_file(&self, id: &str) -> PathBuf {
        self.project_temp_dir(id).join("project.json")
    }

    pub fn render_temp_dir(&self, render_id: &str) -> PathBuf {
        self.temp_dir.join(format!("render-{}", render_id))
    }

    pub fn export_dir(&self) -> PathBuf {
        dirs::video_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
            .join("Flowtake")
    }
}
