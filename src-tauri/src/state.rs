use std::collections::HashMap;
use std::fs::File;
use std::path::PathBuf;
use serde_json::Value;

/// Global application state managed by Tauri
pub struct AppState {
    pub app_data_dir: PathBuf,
    pub projects_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub project_id: Option<String>,
    pub recording_id: Option<String>,
    pub file_handles: HashMap<String, File>,
    pub is_recording: bool,
    pub is_closing: bool,
    pub camera_chunks: Vec<Vec<u8>>,
    pub renders: HashMap<String, RenderState>,
    pub camera_mic_config: Option<Value>,
    pub ffmpeg_child_id: Option<u32>,
}

pub struct RenderState {
    pub id: String,
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
            camera_chunks: Vec::new(),
            renders: HashMap::new(),
            camera_mic_config: None,
            ffmpeg_child_id: None,
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
