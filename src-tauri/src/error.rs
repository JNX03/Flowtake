use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Zip error: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("Request error: {0}")]
    Request(#[from] reqwest::Error),

    #[error("File handle not found: {0}")]
    FileHandleNotFound(String),

    #[allow(dead_code)]
    #[error("Project not found: {0}")]
    ProjectNotFound(String),

    #[error("No project open")]
    NoProjectOpen,

    #[allow(dead_code)]
    #[error("License error: {0}")]
    LicenseError(String),

    #[error("{0}")]
    General(String),

    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
