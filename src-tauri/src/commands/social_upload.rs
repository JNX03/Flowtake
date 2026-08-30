use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

const YOUTUBE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const YOUTUBE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const YOUTUBE_UPLOAD_URL: &str = "https://www.googleapis.com/upload/youtube/v3/videos";
const YOUTUBE_REVOKE_URL: &str = "https://oauth2.googleapis.com/revoke";

const REDIRECT_PORT: u16 = 48721;
const REDIRECT_URI: &str = "http://127.0.0.1:48721";

const STORE_FILE: &str = "social_auth.json";
const YOUTUBE_TOKENS_KEY: &str = "youtube_tokens";
const YOUTUBE_CREDENTIALS_KEY: &str = "youtube_credentials";

const SCOPES: &str =
    "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";

const UPLOAD_CHUNK_SIZE: usize = 2 * 1024 * 1024; // 2MB

#[derive(Serialize, Deserialize, Clone, Debug)]
struct OAuthTokens {
    access_token: String,
    refresh_token: Option<String>,
    expires_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct OAuthCredentials {
    client_id: String,
    client_secret: String,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: i64,
}

fn encode_uri_component(s: &str) -> String {
    let mut result = String::new();
    for b in s.as_bytes() {
        match *b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(*b as char);
            }
            _ => {
                result.push_str(&format!("%{:02X}", b));
            }
        }
    }
    result
}

fn url_decode(s: &str) -> String {
    let mut result = Vec::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(&String::from_utf8_lossy(&bytes[i + 1..i + 3]), 16)
            {
                result.push(byte);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'+' {
            result.push(b' ');
        } else {
            result.push(bytes[i]);
        }
        i += 1;
    }
    String::from_utf8_lossy(&result).to_string()
}

fn extract_query_param(path: &str, key: &str) -> Option<String> {
    let query = path.split('?').nth(1)?;
    query.split('&').find_map(|param| {
        let mut parts = param.splitn(2, '=');
        if parts.next() == Some(key) {
            parts.next().map(|s| s.to_string())
        } else {
            None
        }
    })
}

fn get_credentials(app: &AppHandle) -> AppResult<OAuthCredentials> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::General(e.to_string()))?;
    match store.get(YOUTUBE_CREDENTIALS_KEY) {
        Some(v) => serde_json::from_value(v.clone())
            .map_err(|e| AppError::General(format!("Invalid credentials: {}", e))),
        None => Err(AppError::General(
            "YouTube API credentials not configured".to_string(),
        )),
    }
}

fn get_tokens(app: &AppHandle) -> Option<OAuthTokens> {
    let store = app.store(STORE_FILE).ok()?;
    let value = store.get(YOUTUBE_TOKENS_KEY)?;
    serde_json::from_value(value.clone()).ok()
}

fn save_tokens(app: &AppHandle, tokens: &OAuthTokens) -> AppResult<()> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::General(e.to_string()))?;
    let value = serde_json::to_value(tokens).map_err(|e| AppError::General(e.to_string()))?;
    store.set(YOUTUBE_TOKENS_KEY, value);
    store.save().map_err(|e| AppError::General(e.to_string()))?;
    Ok(())
}

async fn get_valid_token(app: &AppHandle) -> AppResult<String> {
    let credentials = get_credentials(app)?;
    let tokens =
        get_tokens(app).ok_or_else(|| AppError::General("Not connected to YouTube".to_string()))?;

    let now = chrono::Utc::now().timestamp();
    if now < tokens.expires_at - 60 {
        return Ok(tokens.access_token);
    }

    let refresh_token = tokens.refresh_token.ok_or_else(|| {
        AppError::General("No refresh token available. Please reconnect.".to_string())
    })?;

    let client = reqwest::Client::new();
    let resp = client
        .post(YOUTUBE_TOKEN_URL)
        .form(&[
            ("client_id", credentials.client_id.as_str()),
            ("client_secret", credentials.client_secret.as_str()),
            ("refresh_token", refresh_token.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await?;

    if !resp.status().is_success() {
        let err = resp.text().await.unwrap_or_default();
        return Err(AppError::General(format!("Token refresh failed: {}", err)));
    }

    let token_resp: TokenResponse = resp.json().await?;
    let new_tokens = OAuthTokens {
        access_token: token_resp.access_token.clone(),
        refresh_token: token_resp.refresh_token.or(Some(refresh_token)),
        expires_at: chrono::Utc::now().timestamp() + token_resp.expires_in,
    };
    save_tokens(app, &new_tokens)?;
    Ok(new_tokens.access_token)
}

async fn run_oauth_flow(app: AppHandle, credentials: OAuthCredentials) -> AppResult<()> {
    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
        YOUTUBE_AUTH_URL,
        encode_uri_component(&credentials.client_id),
        encode_uri_component(REDIRECT_URI),
        encode_uri_component(SCOPES),
    );

    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", REDIRECT_PORT))
        .await
        .map_err(|e| {
            AppError::General(format!(
                "Failed to start callback server on port {}: {}",
                REDIRECT_PORT, e
            ))
        })?;

    open::that(&auth_url)
        .map_err(|e| AppError::General(format!("Failed to open browser: {}", e)))?;

    let (mut stream, _) =
        tokio::time::timeout(std::time::Duration::from_secs(300), listener.accept())
            .await
            .map_err(|_| AppError::General("Authentication timed out".to_string()))?
            .map_err(|e| AppError::General(format!("Connection error: {}", e)))?;

    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let mut buf = vec![0u8; 8192];
    let n = stream
        .read(&mut buf)
        .await
        .map_err(|e| AppError::General(format!("Read error: {}", e)))?;
    let request = String::from_utf8_lossy(&buf[..n]);

    let first_line = request.lines().next().unwrap_or("");
    let path = first_line.split_whitespace().nth(1).unwrap_or("");

    if let Some(error) = extract_query_param(path, "error") {
        let html = format!(
            "<html><body style=\"font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a2e;color:#fff\"><div style=\"text-align:center\"><h2>Authorization failed</h2><p style=\"opacity:0.6\">{}</p></div></body></html>",
            error
        );
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n{}",
            html
        );
        stream.write_all(response.as_bytes()).await.ok();
        return Err(AppError::General(format!(
            "Authorization denied: {}",
            error
        )));
    }

    let code = extract_query_param(path, "code")
        .ok_or_else(|| AppError::General("No authorization code received".to_string()))?;
    let code = url_decode(&code);

    let html = "<html><body style=\"font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a2e;color:#fff\"><div style=\"text-align:center\"><h2>Connected to YouTube!</h2><p style=\"opacity:0.6\">You can close this tab and return to Flowtake.</p></div></body></html>";
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n{}",
        html
    );
    stream.write_all(response.as_bytes()).await.ok();
    drop(stream);
    drop(listener);

    let client = reqwest::Client::new();
    let resp = client
        .post(YOUTUBE_TOKEN_URL)
        .form(&[
            ("code", code.as_str()),
            ("client_id", credentials.client_id.as_str()),
            ("client_secret", credentials.client_secret.as_str()),
            ("redirect_uri", REDIRECT_URI),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await?;

    if !resp.status().is_success() {
        let err = resp.text().await.unwrap_or_default();
        return Err(AppError::General(format!("Token exchange failed: {}", err)));
    }

    let token_resp: TokenResponse = resp.json().await?;
    let tokens = OAuthTokens {
        access_token: token_resp.access_token,
        refresh_token: token_resp.refresh_token,
        expires_at: chrono::Utc::now().timestamp() + token_resp.expires_in,
    };
    save_tokens(&app, &tokens)?;

    Ok(())
}

// --- Tauri Commands ---

#[tauri::command]
pub async fn youtube_set_credentials(
    app: AppHandle,
    client_id: String,
    client_secret: String,
) -> AppResult<()> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::General(e.to_string()))?;
    let creds = OAuthCredentials {
        client_id,
        client_secret,
    };
    store.set(
        YOUTUBE_CREDENTIALS_KEY,
        serde_json::to_value(&creds).unwrap(),
    );
    store.save().map_err(|e| AppError::General(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn youtube_auth_start(app: AppHandle) -> AppResult<()> {
    let credentials = get_credentials(&app)?;

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        match run_oauth_flow(app_clone.clone(), credentials).await {
            Ok(()) => {
                app_clone
                    .emit_to("exporter", "youtube-auth-success", true)
                    .ok();
            }
            Err(e) => {
                app_clone
                    .emit_to("exporter", "youtube-auth-error", e.to_string())
                    .ok();
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn youtube_auth_status(app: AppHandle) -> AppResult<Value> {
    let has_credentials = get_credentials(&app).is_ok();
    let tokens = get_tokens(&app);
    let connected = tokens.is_some();

    let mut channel_name: Option<String> = None;
    if connected {
        if let Ok(token) = get_valid_token(&app).await {
            let client = reqwest::Client::new();
            let resp = client
                .get("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true")
                .bearer_auth(&token)
                .send()
                .await;

            if let Ok(resp) = resp {
                if let Ok(json) = resp.json::<Value>().await {
                    channel_name = json["items"][0]["snippet"]["title"]
                        .as_str()
                        .map(|s| s.to_string());
                }
            }
        }
    }

    Ok(serde_json::json!({
        "hasCredentials": has_credentials,
        "connected": connected,
        "channelName": channel_name,
    }))
}

#[tauri::command]
pub async fn youtube_auth_disconnect(app: AppHandle) -> AppResult<()> {
    if let Some(tokens) = get_tokens(&app) {
        let client = reqwest::Client::new();
        client
            .post(YOUTUBE_REVOKE_URL)
            .form(&[("token", &tokens.access_token)])
            .send()
            .await
            .ok();
    }

    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::General(e.to_string()))?;
    store.delete(YOUTUBE_TOKENS_KEY);
    store.save().map_err(|e| AppError::General(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub async fn youtube_upload_video(
    app: AppHandle,
    render_id: String,
    title: String,
    description: String,
    privacy: String,
) -> AppResult<Value> {
    let token = get_valid_token(&app).await?;

    let (video_path, video_mime_type) = {
        let state = app.state::<Mutex<AppState>>();
        let state = state.lock().unwrap();
        state
            .renders
            .get(&render_id)
            .map(|render| (render.output_path.clone(), render.format.mime_type()))
            .ok_or_else(|| AppError::General(format!("Render not found: {}", render_id)))?
    };

    if !video_path.exists() {
        return Err(AppError::General("Video file not found".to_string()));
    }

    let file_size = std::fs::metadata(&video_path)?.len();
    if file_size == 0 {
        return Err(AppError::General("Video file is empty".to_string()));
    }

    // Step 1: Initiate resumable upload
    let metadata = serde_json::json!({
        "snippet": {
            "title": title,
            "description": description,
            "categoryId": "22"
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": false
        }
    });

    let client = reqwest::Client::new();
    let init_resp = client
        .post(format!(
            "{}?uploadType=resumable&part=snippet,status",
            YOUTUBE_UPLOAD_URL
        ))
        .bearer_auth(&token)
        .header("Content-Type", "application/json; charset=UTF-8")
        .header("X-Upload-Content-Type", video_mime_type)
        .header("X-Upload-Content-Length", file_size.to_string())
        .json(&metadata)
        .send()
        .await?;

    if !init_resp.status().is_success() {
        let err = init_resp.text().await.unwrap_or_default();
        return Err(AppError::General(format!(
            "Upload initiation failed: {}",
            err
        )));
    }

    let upload_url = init_resp
        .headers()
        .get("location")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::General("No upload URL in response".to_string()))?;

    // Step 2: Upload in chunks with progress
    app.emit_to(
        "exporter",
        "youtube-upload-progress",
        serde_json::json!({
            "renderId": render_id,
            "progress": 0,
            "status": "uploading"
        }),
    )
    .ok();

    let mut file = std::fs::File::open(&video_path)?;
    let mut bytes_sent: u64 = 0;

    loop {
        use std::io::Read;

        let remaining = file_size - bytes_sent;
        if remaining == 0 {
            break;
        }
        let chunk_size = std::cmp::min(UPLOAD_CHUNK_SIZE as u64, remaining) as usize;
        let mut chunk = vec![0u8; chunk_size];
        let bytes_read = file.read(&mut chunk)?;
        if bytes_read == 0 {
            break;
        }
        chunk.truncate(bytes_read);

        let start = bytes_sent;
        let end = bytes_sent + bytes_read as u64 - 1;

        let resp = client
            .put(&upload_url)
            .header("Content-Length", bytes_read.to_string())
            .header(
                "Content-Range",
                format!("bytes {}-{}/{}", start, end, file_size),
            )
            .header("Content-Type", video_mime_type)
            .body(chunk)
            .send()
            .await?;

        bytes_sent += bytes_read as u64;
        let progress = (bytes_sent as f64 / file_size as f64 * 100.0) as u32;

        let status_code = resp.status().as_u16();
        match status_code {
            200 | 201 => {
                let result: Value = resp.json().await.unwrap_or(Value::Null);
                let video_id = result["id"].as_str().unwrap_or("").to_string();
                let video_url = format!("https://www.youtube.com/watch?v={}", video_id);

                app.emit_to(
                    "exporter",
                    "youtube-upload-progress",
                    serde_json::json!({
                        "renderId": render_id,
                        "progress": 100,
                        "status": "completed",
                        "videoId": video_id,
                        "videoUrl": video_url,
                    }),
                )
                .ok();

                return Ok(serde_json::json!({
                    "videoId": video_id,
                    "videoUrl": video_url,
                }));
            }
            308 => {
                app.emit_to(
                    "exporter",
                    "youtube-upload-progress",
                    serde_json::json!({
                        "renderId": render_id,
                        "progress": progress,
                        "status": "uploading"
                    }),
                )
                .ok();
                continue;
            }
            _ => {
                let err = resp.text().await.unwrap_or_default();
                app.emit_to(
                    "exporter",
                    "youtube-upload-progress",
                    serde_json::json!({
                        "renderId": render_id,
                        "progress": progress,
                        "status": "error",
                        "error": format!("Upload failed ({}): {}", status_code, err),
                    }),
                )
                .ok();
                return Err(AppError::General(format!(
                    "Upload failed ({}): {}",
                    status_code, err
                )));
            }
        }
    }

    Err(AppError::General("Upload ended unexpectedly".to_string()))
}
