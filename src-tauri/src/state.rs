use crate::commands::multi_app::CapturedTrack;
use crate::keyboard_tracker::KeyboardTracker;
use crate::mouse_tracker::MouseTracker;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs::File;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::sync::Mutex;
use tauri_plugin_shell::process::CommandChild;
use tokio::sync::mpsc;

#[derive(Clone)]
pub struct LiveStreamCredential {
    pub canonical_rtmp_url: String,
    pub stream_key: String,
}

#[derive(Clone)]
pub(crate) struct YoutubeOAuthCredentials {
    pub(crate) client_id: String,
    pub(crate) client_secret: String,
}

#[derive(Clone)]
pub(crate) struct YoutubeOAuthTokens {
    pub(crate) access_token: String,
    pub(crate) refresh_token: Option<String>,
    pub(crate) expires_at: i64,
}

/// Native-only YouTube authorization state. Credentials and reusable tokens are
/// intentionally never serialized and must be entered again after restart.
#[derive(Default)]
pub(crate) struct YoutubeOAuthSession {
    generation: u64,
    credentials: Option<YoutubeOAuthCredentials>,
    tokens: Option<YoutubeOAuthTokens>,
}

impl YoutubeOAuthSession {
    fn advance_generation(&mut self) {
        self.generation = self.generation.wrapping_add(1);
    }

    pub(crate) fn set_credentials(&mut self, credentials: YoutubeOAuthCredentials) -> u64 {
        self.advance_generation();
        self.credentials = Some(credentials);
        self.tokens = None;
        self.generation
    }

    pub(crate) fn credentials(&self) -> Option<(u64, YoutubeOAuthCredentials)> {
        self.credentials
            .clone()
            .map(|credentials| (self.generation, credentials))
    }

    pub(crate) fn snapshot(&self) -> Option<(u64, YoutubeOAuthCredentials, YoutubeOAuthTokens)> {
        Some((
            self.generation,
            self.credentials.clone()?,
            self.tokens.clone()?,
        ))
    }

    pub(crate) fn status(&self) -> (bool, bool) {
        (self.credentials.is_some(), self.tokens.is_some())
    }

    pub(crate) fn status_snapshot(&self) -> (u64, bool, bool) {
        let (has_credentials, connected) = self.status();
        (self.generation, has_credentials, connected)
    }

    pub(crate) fn commit_tokens(
        &mut self,
        expected_generation: u64,
        tokens: YoutubeOAuthTokens,
    ) -> Result<(), YoutubeOAuthTokens> {
        if self.generation != expected_generation || self.credentials.is_none() {
            return Err(tokens);
        }
        self.tokens = Some(tokens);
        Ok(())
    }

    /// Invalidates in-flight OAuth/refresh work before releasing the secrets.
    pub(crate) fn clear(&mut self) -> Option<YoutubeOAuthTokens> {
        self.advance_generation();
        self.credentials = None;
        self.tokens.take()
    }
}

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
    /// Serializes fallible session setup so double-clicks cannot replace the
    /// active recording ID while the overlay is being created.
    pub recording_init_in_progress: bool,
    /// Guards the transition from the countdown UI to the native capture
    /// process. It stays claimed for the lifetime of a recording so repeated
    /// start commands are idempotent and cannot orphan an overwritten child.
    pub recording_capture_claimed: bool,
    /// Serializes stop/reset/cancel against a capture process that is still
    /// crossing the spawn boundary.
    pub recording_stop_in_progress: bool,
    pub ffmpeg_child_id: Option<u32>,
    pub ffmpeg_child: Option<CommandChild>,
    pub mouse_tracker: MouseTracker,
    pub keyboard_tracker: KeyboardTracker,
    pub multi_app_children: Vec<std::process::Child>,
    pub multi_app_tracks: Vec<CapturedTrack>,
    /// Serializes App-layer startup with an immediate Stop request so children
    /// cannot be published after the recording has already finalized.
    pub multi_app_init_in_progress: bool,
    pub multi_app_stop_requested: bool,
    /// A selected App-layer capture that failed finalization is a durable
    /// session error. Keep it across Stop retries so an empty child list cannot
    /// silently turn a failed required layer into a successful save.
    pub multi_app_finalize_error: Option<String>,
    pub recording_start_timestamp: Option<i64>,
    pub export_state_data: Option<Value>,
    pub export_section: Option<String>,
    /// Stop flag for window capture thread (PrintWindow pipeline)
    pub window_capture_stop: Arc<AtomicBool>,
    /// Window capture thread handle
    pub window_capture_thread: Option<std::thread::JoinHandle<()>>,
    /// FFmpeg process spawned via std::process::Command (for window capture pipeline)
    pub ffmpeg_process: Option<std::process::Child>,
    /// ScreenCaptureKit helper used by the native macOS recording path.
    pub macos_capture_process: Option<std::process::Child>,
    /// PIDs of audio sessions muted during recording (restored on stop)
    pub muted_audio_pids: Vec<u32>,
    // ── Live streaming ──────────────────────────────────────────────────
    /// Serializes the live-stream process check, FFmpeg spawn, and state
    /// publication so concurrent Start commands cannot orphan a second child.
    pub live_stream_start_lock: Arc<tokio::sync::Mutex<()>>,
    /// FFmpeg process handling the live RTMP+local-file pipeline
    pub live_ffmpeg_process: Option<std::process::Child>,
    /// Channel for pushing webm/mkv chunks from the JS compositor to FFmpeg stdin
    pub live_stdin_tx: Option<mpsc::Sender<Vec<u8>>>,
    /// Session-only credential bound to the exact validated RTMP destination selected at entry.
    pub live_stream_credential: Option<LiveStreamCredential>,
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
    /// Session-only YouTube OAuth material. No renderer command exposes these values.
    pub(crate) youtube_oauth: YoutubeOAuthSession,
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
    pub format: RenderFormat,
    pub is_cancelled: bool,
}

/// Container the queued render writes. Every file name the export pipeline
/// touches is derived from here so a render can never mix containers.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum RenderFormat {
    #[default]
    Mp4,
    WebM,
}

impl RenderFormat {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "mp4" => Some(Self::Mp4),
            "webm" => Some(Self::WebM),
            _ => None,
        }
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Mp4 => "mp4",
            Self::WebM => "webm",
        }
    }

    pub const fn extension(self) -> &'static str {
        self.as_str()
    }

    pub const fn output_file_name(self) -> &'static str {
        match self {
            Self::Mp4 => "output.mp4",
            Self::WebM => "output.webm",
        }
    }

    pub const fn processed_audio_file_name(self) -> &'static str {
        match self {
            Self::Mp4 => "processed-audio.m4a",
            Self::WebM => "processed-audio.webm",
        }
    }

    pub const fn muxed_file_name(self) -> &'static str {
        match self {
            Self::Mp4 => "output-with-audio.mp4",
            Self::WebM => "output-with-audio.webm",
        }
    }

    pub const fn backup_file_name(self) -> &'static str {
        match self {
            Self::Mp4 => "output-video-only.mp4",
            Self::WebM => "output-video-only.webm",
        }
    }

    pub const fn audio_encoder(self) -> &'static str {
        match self {
            Self::Mp4 => "aac",
            Self::WebM => "libopus",
        }
    }

    pub const fn mime_type(self) -> &'static str {
        match self {
            Self::Mp4 => "video/mp4",
            Self::WebM => "video/webm",
        }
    }
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
            recording_init_in_progress: false,
            recording_capture_claimed: false,
            recording_stop_in_progress: false,
            ffmpeg_child_id: None,
            ffmpeg_child: None,
            mouse_tracker: MouseTracker::new(),
            keyboard_tracker: KeyboardTracker::new(),
            multi_app_children: Vec::new(),
            multi_app_tracks: Vec::new(),
            multi_app_init_in_progress: false,
            multi_app_stop_requested: false,
            multi_app_finalize_error: None,
            recording_start_timestamp: None,
            export_state_data: None,
            export_section: None,
            window_capture_stop: Arc::new(AtomicBool::new(false)),
            window_capture_thread: None,
            ffmpeg_process: None,
            macos_capture_process: None,
            muted_audio_pids: Vec::new(),
            live_stream_start_lock: Arc::new(tokio::sync::Mutex::new(())),
            live_ffmpeg_process: None,
            live_stdin_tx: None,
            live_stream_credential: None,
            live_stop_flag: Arc::new(AtomicBool::new(false)),
            live_stats: Arc::new(Mutex::new(LiveStats::default())),
            live_local_path: None,
            live_started_at_ms: None,
            live_zoom_hotkey: None,
            youtube_oauth: YoutubeOAuthSession::default(),
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

    pub fn preview_cache_dir(&self, id: &str) -> PathBuf {
        self.app_data_dir.join("previews").join(id)
    }

    pub fn preview_video_file(&self, id: &str) -> PathBuf {
        let source_size = self
            .screen_video_file(id)
            .metadata()
            .map(|metadata| metadata.len())
            .unwrap_or(0);
        self.preview_cache_dir(id)
            .join(format!("screen-{source_size}.mp4"))
    }

    pub fn editor_screen_video_file(&self, id: &str) -> PathBuf {
        let preview = self.preview_video_file(id);
        if preview
            .metadata()
            .is_ok_and(|metadata| metadata.is_file() && metadata.len() > 0)
        {
            preview
        } else {
            self.screen_video_file(id)
        }
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

#[cfg(test)]
mod tests {
    use super::{AppState, YoutubeOAuthCredentials, YoutubeOAuthSession, YoutubeOAuthTokens};

    fn credentials(suffix: &str) -> YoutubeOAuthCredentials {
        YoutubeOAuthCredentials {
            client_id: format!("client-{suffix}"),
            client_secret: format!("secret-{suffix}"),
        }
    }

    fn tokens(suffix: &str) -> YoutubeOAuthTokens {
        YoutubeOAuthTokens {
            access_token: format!("access-{suffix}"),
            refresh_token: Some(format!("refresh-{suffix}")),
            expires_at: 123,
        }
    }

    #[test]
    fn youtube_oauth_session_rejects_stale_results_and_clears_every_secret() {
        let mut session = YoutubeOAuthSession::default();
        let stale_generation = session.set_credentials(credentials("first"));
        let current_generation = session.set_credentials(credentials("second"));

        assert!(session
            .commit_tokens(stale_generation, tokens("stale"))
            .is_err());
        assert!(session
            .commit_tokens(current_generation, tokens("current"))
            .is_ok());
        assert_eq!(session.status(), (true, true));
        assert_eq!(session.status_snapshot(), (current_generation, true, true));

        let removed = session.clear().expect("connected session had tokens");
        assert_eq!(removed.access_token, "access-current");
        assert_eq!(session.status(), (false, false));
        assert_eq!(
            session.status_snapshot(),
            (current_generation + 1, false, false)
        );
        assert!(session
            .commit_tokens(current_generation, tokens("late"))
            .is_err());
    }

    #[test]
    fn editor_screen_path_uses_size_keyed_preview_only_when_complete() {
        let root = std::env::temp_dir().join(format!(
            "flowtake-editor-preview-state-test-{}",
            uuid::Uuid::new_v4()
        ));
        let project_id = uuid::Uuid::new_v4().hyphenated().to_string();
        let mut state = AppState::new();
        state.app_data_dir = root.join("data");
        state.temp_dir = root.join("temp");

        let source = state.screen_video_file(&project_id);
        std::fs::create_dir_all(source.parent().unwrap()).unwrap();
        std::fs::write(&source, b"full-resolution").unwrap();
        assert_eq!(state.editor_screen_video_file(&project_id), source);

        let preview = state.preview_video_file(&project_id);
        assert!(preview.to_string_lossy().contains("screen-15.mp4"));
        std::fs::create_dir_all(preview.parent().unwrap()).unwrap();
        std::fs::write(&preview, []).unwrap();
        assert_eq!(state.editor_screen_video_file(&project_id), source);

        std::fs::write(&preview, b"preview").unwrap();
        assert_eq!(state.editor_screen_video_file(&project_id), preview);
        std::fs::remove_dir_all(root).unwrap();
    }
}
