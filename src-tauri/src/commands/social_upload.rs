use crate::error::{AppError, AppResult};
use crate::state::{AppState, YoutubeOAuthCredentials, YoutubeOAuthSession, YoutubeOAuthTokens};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

const YOUTUBE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const YOUTUBE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const YOUTUBE_UPLOAD_URL: &str = "https://www.googleapis.com/upload/youtube/v3/videos";
const YOUTUBE_REVOKE_URL: &str = "https://oauth2.googleapis.com/revoke";

const REDIRECT_PORT: u16 = 48721;
const REDIRECT_URI: &str = "http://127.0.0.1:48721";
const REDIRECT_HOST: &str = "127.0.0.1:48721";
const REDIRECT_PATH: &str = "/";
const CALLBACK_TIMEOUT_SECS: u64 = 300;
const CALLBACK_READ_TIMEOUT_SECS: u64 = 5;
const MAX_CALLBACK_REQUEST_BYTES: usize = 16 * 1024;
const MAX_INVALID_CALLBACKS: usize = 16;
const MAX_OAUTH_CREDENTIAL_BYTES: usize = 2 * 1024;

const STORE_FILE: &str = "social_auth.json";
const YOUTUBE_TOKENS_KEY: &str = "youtube_tokens";
const YOUTUBE_CREDENTIALS_KEY: &str = "youtube_credentials";

const SCOPES: &str =
    "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";

const UPLOAD_CHUNK_SIZE: usize = 2 * 1024 * 1024; // 2MB

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

fn random_urlsafe_token() -> String {
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}

fn pkce_challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

fn decode_query_component(s: &str) -> Result<String, &'static str> {
    let mut result = Vec::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            if i + 2 >= bytes.len() {
                return Err("Malformed percent encoding");
            }
            let encoded = std::str::from_utf8(&bytes[i + 1..i + 3])
                .map_err(|_| "Malformed percent encoding")?;
            let byte = u8::from_str_radix(encoded, 16).map_err(|_| "Malformed percent encoding")?;
            result.push(byte);
            i += 3;
            continue;
        }
        if bytes[i] == b'+' {
            result.push(b' ');
        } else {
            result.push(bytes[i]);
        }
        i += 1;
    }
    String::from_utf8(result).map_err(|_| "Callback query is not valid UTF-8")
}

#[derive(Debug, PartialEq, Eq)]
enum OAuthCallback {
    AuthorizationCode(String),
    AuthorizationDenied,
}

fn parse_oauth_callback(
    request: &str,
    expected_state: &str,
) -> Result<OAuthCallback, &'static str> {
    let mut lines = request.lines();
    let request_line = lines.next().ok_or("Missing request line")?;
    let mut request_parts = request_line.split_whitespace();
    let method = request_parts.next().ok_or("Missing request method")?;
    let target = request_parts.next().ok_or("Missing request target")?;
    let version = request_parts.next().ok_or("Missing HTTP version")?;

    if request_parts.next().is_some() || method != "GET" || version != "HTTP/1.1" {
        return Err("Invalid callback request line");
    }

    let (path, query) = target.split_once('?').ok_or("Missing callback query")?;
    if path != REDIRECT_PATH {
        return Err("Invalid callback path");
    }

    let mut host: Option<&str> = None;
    for line in lines {
        let line = line.trim_end_matches('\r');
        if line.is_empty() {
            break;
        }
        let (name, value) = line.split_once(':').ok_or("Malformed callback header")?;
        if name.eq_ignore_ascii_case("host") {
            if host.is_some() {
                return Err("Duplicate Host header");
            }
            host = Some(value.trim());
        }
    }
    if host != Some(REDIRECT_HOST) {
        return Err("Invalid callback Host header");
    }

    let mut states = Vec::new();
    let mut codes = Vec::new();
    let mut errors = Vec::new();
    for pair in query.split('&').filter(|pair| !pair.is_empty()) {
        let (raw_key, raw_value) = pair.split_once('=').unwrap_or((pair, ""));
        let key = decode_query_component(raw_key)?;
        let value = decode_query_component(raw_value)?;
        match key.as_str() {
            "state" => states.push(value),
            "code" => codes.push(value),
            "error" => errors.push(value),
            _ => {}
        }
    }

    if states.len() != 1 || states[0] != expected_state {
        return Err("Invalid OAuth state");
    }
    if codes.len() + errors.len() != 1 {
        return Err("Invalid OAuth callback parameters");
    }

    if let Some(code) = codes.pop() {
        if code.is_empty() {
            return Err("Missing authorization code");
        }
        Ok(OAuthCallback::AuthorizationCode(code))
    } else if errors.pop().is_some_and(|error| !error.is_empty()) {
        Ok(OAuthCallback::AuthorizationDenied)
    } else {
        Err("Invalid OAuth error response")
    }
}

async fn read_callback_request(stream: &mut tokio::net::TcpStream) -> AppResult<String> {
    use tokio::io::AsyncReadExt;

    let mut request = Vec::new();
    let mut chunk = [0u8; 2048];
    loop {
        let bytes_read = stream
            .read(&mut chunk)
            .await
            .map_err(|e| AppError::General(format!("Failed to read OAuth callback: {}", e)))?;
        if bytes_read == 0 {
            break;
        }
        request.extend_from_slice(&chunk[..bytes_read]);
        if request.len() > MAX_CALLBACK_REQUEST_BYTES {
            return Err(AppError::General(
                "OAuth callback request was too large".to_string(),
            ));
        }
        if request.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
    }

    String::from_utf8(request)
        .map_err(|_| AppError::General("OAuth callback request was not valid UTF-8".to_string()))
}

async fn send_callback_response(stream: &mut tokio::net::TcpStream, status: &str, html: &str) {
    use tokio::io::AsyncWriteExt;

    let response = format!(
        "HTTP/1.1 {}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nContent-Security-Policy: default-src 'none'; style-src 'unsafe-inline'\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n{}",
        status,
        html.len(),
        html
    );
    stream.write_all(response.as_bytes()).await.ok();
}

fn with_youtube_session<T>(
    app: &AppHandle,
    action: impl FnOnce(&mut YoutubeOAuthSession) -> T,
) -> AppResult<T> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state
        .lock()
        .map_err(|_| AppError::General("YouTube session state is unavailable".to_string()))?;
    Ok(action(&mut state.youtube_oauth))
}

fn get_credentials(app: &AppHandle) -> AppResult<(u64, YoutubeOAuthCredentials)> {
    with_youtube_session(app, |session| session.credentials())?.ok_or_else(|| {
        AppError::General("YouTube API credentials are not configured for this session".to_string())
    })
}

fn get_session_snapshot(
    app: &AppHandle,
) -> AppResult<(u64, YoutubeOAuthCredentials, YoutubeOAuthTokens)> {
    with_youtube_session(app, |session| session.snapshot())?
        .ok_or_else(|| AppError::General("Not connected to YouTube in this session".to_string()))
}

fn commit_session_tokens(
    app: &AppHandle,
    expected_generation: u64,
    tokens: YoutubeOAuthTokens,
) -> AppResult<Result<(), YoutubeOAuthTokens>> {
    with_youtube_session(app, |session| {
        session.commit_tokens(expected_generation, tokens)
    })
}

async fn revoke_tokens(tokens: &YoutubeOAuthTokens) {
    let token = tokens
        .refresh_token
        .as_deref()
        .unwrap_or(tokens.access_token.as_str());
    reqwest::Client::new()
        .post(YOUTUBE_REVOKE_URL)
        .form(&[("token", token)])
        .send()
        .await
        .ok();
}

/// Removes credentials and tokens written by versions that used the ordinary
/// JSON store. Startup treats failure as fatal so no renderer is shown while a
/// known reusable token may remain in that legacy location.
pub fn migrate_legacy_youtube_auth(app: &AppHandle) -> AppResult<bool> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::General(e.to_string()))?;
    let removed =
        store.get(YOUTUBE_TOKENS_KEY).is_some() || store.get(YOUTUBE_CREDENTIALS_KEY).is_some();
    if removed {
        store.delete(YOUTUBE_TOKENS_KEY);
        store.delete(YOUTUBE_CREDENTIALS_KEY);
        store.save().map_err(|e| AppError::General(e.to_string()))?;
    }
    Ok(removed)
}

pub fn clear_youtube_oauth_session(app: &AppHandle) -> AppResult<()> {
    let _ = with_youtube_session(app, YoutubeOAuthSession::clear)?;
    Ok(())
}

fn normalize_credentials(
    client_id: String,
    client_secret: String,
) -> AppResult<YoutubeOAuthCredentials> {
    let client_id = client_id.trim().to_string();
    let client_secret = client_secret.trim().to_string();
    if client_id.is_empty()
        || client_secret.is_empty()
        || client_id.len() > MAX_OAUTH_CREDENTIAL_BYTES
        || client_secret.len() > MAX_OAUTH_CREDENTIAL_BYTES
        || client_id.chars().any(char::is_control)
        || client_secret.chars().any(char::is_control)
    {
        return Err(AppError::General(
            "Invalid YouTube API credentials".to_string(),
        ));
    }
    Ok(YoutubeOAuthCredentials {
        client_id,
        client_secret,
    })
}

async fn get_valid_token(app: &AppHandle) -> AppResult<String> {
    let (generation, credentials, tokens) = get_session_snapshot(app)?;

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
        .await
        .map_err(|_| {
            AppError::General("Could not contact YouTube to refresh authorization".to_string())
        })?;

    if !resp.status().is_success() {
        return Err(AppError::General(
            "YouTube authorization refresh was rejected".to_string(),
        ));
    }

    let token_resp: TokenResponse = resp.json().await?;
    let new_tokens = YoutubeOAuthTokens {
        access_token: token_resp.access_token.clone(),
        refresh_token: token_resp.refresh_token.or(Some(refresh_token)),
        expires_at: chrono::Utc::now().timestamp() + token_resp.expires_in,
    };
    match commit_session_tokens(app, generation, new_tokens)? {
        Ok(()) => Ok(token_resp.access_token),
        Err(stale_tokens) => {
            revoke_tokens(&stale_tokens).await;
            Err(AppError::General(
                "YouTube authorization changed while the token was refreshing; reconnect"
                    .to_string(),
            ))
        }
    }
}

async fn run_oauth_flow(credentials: YoutubeOAuthCredentials) -> AppResult<YoutubeOAuthTokens> {
    let oauth_state = random_urlsafe_token();
    let code_verifier = random_urlsafe_token();
    let code_challenge = pkce_challenge(&code_verifier);
    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent&state={}&code_challenge={}&code_challenge_method=S256",
        YOUTUBE_AUTH_URL,
        encode_uri_component(&credentials.client_id),
        encode_uri_component(REDIRECT_URI),
        encode_uri_component(SCOPES),
        encode_uri_component(&oauth_state),
        encode_uri_component(&code_challenge),
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

    let deadline =
        tokio::time::Instant::now() + std::time::Duration::from_secs(CALLBACK_TIMEOUT_SECS);
    let mut invalid_callbacks = 0;
    let code = loop {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            return Err(AppError::General("Authentication timed out".to_string()));
        }

        let (mut stream, peer) = tokio::time::timeout(remaining, listener.accept())
            .await
            .map_err(|_| AppError::General("Authentication timed out".to_string()))?
            .map_err(|e| AppError::General(format!("Connection error: {}", e)))?;

        if !peer.ip().is_loopback() {
            send_callback_response(&mut stream, "403 Forbidden", "Invalid OAuth callback.").await;
            continue;
        }

        let request = match tokio::time::timeout(
            std::time::Duration::from_secs(CALLBACK_READ_TIMEOUT_SECS),
            read_callback_request(&mut stream),
        )
        .await
        {
            Ok(Ok(request)) => request,
            _ => {
                send_callback_response(&mut stream, "400 Bad Request", "Invalid OAuth callback.")
                    .await;
                invalid_callbacks += 1;
                if invalid_callbacks >= MAX_INVALID_CALLBACKS {
                    return Err(AppError::General(
                        "Too many invalid OAuth callbacks".to_string(),
                    ));
                }
                continue;
            }
        };

        match parse_oauth_callback(&request, &oauth_state) {
            Ok(OAuthCallback::AuthorizationCode(code)) => {
                let html = "<html><body style=\"font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a2e;color:#fff\"><div style=\"text-align:center\"><h2>Connected to YouTube!</h2><p style=\"opacity:0.6\">You can close this tab and return to Flowtake.</p></div></body></html>";
                send_callback_response(&mut stream, "200 OK", html).await;
                break code;
            }
            Ok(OAuthCallback::AuthorizationDenied) => {
                let html = "<html><body style=\"font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a2e;color:#fff\"><div style=\"text-align:center\"><h2>Authorization failed</h2><p style=\"opacity:0.6\">You can close this tab and return to Flowtake.</p></div></body></html>";
                send_callback_response(&mut stream, "200 OK", html).await;
                return Err(AppError::General(
                    "Authorization denied by provider".to_string(),
                ));
            }
            Err(_) => {
                send_callback_response(&mut stream, "400 Bad Request", "Invalid OAuth callback.")
                    .await;
                invalid_callbacks += 1;
                if invalid_callbacks >= MAX_INVALID_CALLBACKS {
                    return Err(AppError::General(
                        "Too many invalid OAuth callbacks".to_string(),
                    ));
                }
            }
        }
    };

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
            ("code_verifier", code_verifier.as_str()),
        ])
        .send()
        .await
        .map_err(|_| {
            AppError::General("Could not contact YouTube to finish authorization".to_string())
        })?;

    if !resp.status().is_success() {
        return Err(AppError::General(
            "YouTube authorization was rejected".to_string(),
        ));
    }

    let token_resp: TokenResponse = resp.json().await?;
    Ok(YoutubeOAuthTokens {
        access_token: token_resp.access_token,
        refresh_token: token_resp.refresh_token,
        expires_at: chrono::Utc::now().timestamp() + token_resp.expires_in,
    })
}

// --- Tauri Commands ---

#[tauri::command]
pub async fn youtube_set_credentials(
    app: AppHandle,
    client_id: String,
    client_secret: String,
) -> AppResult<()> {
    migrate_legacy_youtube_auth(&app)?;
    let credentials = normalize_credentials(client_id, client_secret)?;
    let previous_tokens = with_youtube_session(&app, |session| {
        let previous_tokens = session.clear();
        session.set_credentials(credentials);
        previous_tokens
    })?;
    if let Some(tokens) = previous_tokens {
        revoke_tokens(&tokens).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn youtube_auth_start(app: AppHandle) -> AppResult<()> {
    let (generation, credentials) = get_credentials(&app)?;

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        match run_oauth_flow(credentials).await {
            Ok(tokens) => match commit_session_tokens(&app_clone, generation, tokens) {
                Ok(Ok(())) => {
                    app_clone
                        .emit_to("exporter", "youtube-auth-success", true)
                        .ok();
                }
                Ok(Err(stale_tokens)) => {
                    revoke_tokens(&stale_tokens).await;
                    app_clone
                        .emit_to(
                            "exporter",
                            "youtube-auth-error",
                            "YouTube authorization changed; start sign-in again",
                        )
                        .ok();
                }
                Err(error) => {
                    app_clone
                        .emit_to("exporter", "youtube-auth-error", error.to_string())
                        .ok();
                }
            },
            Err(error) => {
                app_clone
                    .emit_to("exporter", "youtube-auth-error", error.to_string())
                    .ok();
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn youtube_auth_status(app: AppHandle) -> AppResult<Value> {
    let (status_generation, _, connected) =
        with_youtube_session(&app, |session| session.status_snapshot())?;

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

    // A disconnect or credential replacement may complete while the channel lookup is
    // in flight. Re-read the native session and discard any result tied to the stale
    // generation instead of returning pre-disconnect booleans or channel metadata.
    let (current_generation, has_credentials, connected) =
        with_youtube_session(&app, |session| session.status_snapshot())?;
    if current_generation != status_generation {
        channel_name = None;
    }

    Ok(serde_json::json!({
        "hasCredentials": has_credentials,
        "connected": connected,
        "channelName": channel_name,
    }))
}

#[tauri::command]
pub async fn youtube_auth_disconnect(app: AppHandle) -> AppResult<()> {
    let tokens = with_youtube_session(&app, YoutubeOAuthSession::clear)?;
    let migration_result = migrate_legacy_youtube_auth(&app);
    if let Some(tokens) = tokens {
        revoke_tokens(&tokens).await;
    }
    migration_result?;

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
        .await
        .map_err(|_| AppError::General("Could not start the YouTube upload".to_string()))?;

    if !init_resp.status().is_success() {
        return Err(AppError::General(
            "YouTube rejected the upload request".to_string(),
        ));
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
            .await
            // The resumable Location is a bearer capability. reqwest errors can include
            // request URLs, so never let the underlying error cross the native boundary.
            .map_err(|_| AppError::General("YouTube upload request failed".to_string()))?;

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
                app.emit_to(
                    "exporter",
                    "youtube-upload-progress",
                    serde_json::json!({
                        "renderId": render_id,
                        "progress": progress,
                        "status": "error",
                        "error": "YouTube rejected an upload chunk",
                    }),
                )
                .ok();
                return Err(AppError::General(
                    "YouTube rejected an upload chunk".to_string(),
                ));
            }
        }
    }

    Err(AppError::General("Upload ended unexpectedly".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn callback_request(target: &str) -> String {
        format!(
            "GET {} HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
            target, REDIRECT_HOST
        )
    }

    #[test]
    fn pkce_challenge_matches_rfc_7636_vector() {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        assert_eq!(
            pkce_challenge(verifier),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn random_token_is_pkce_compatible_and_not_reused() {
        let first = random_urlsafe_token();
        let second = random_urlsafe_token();
        assert_eq!(first.len(), 64);
        assert!(first
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~')));
        assert_ne!(first, second);
    }

    #[test]
    fn accepts_expected_callback_and_decodes_code() {
        let request = callback_request("/?code=abc%2F123&state=expected");
        assert_eq!(
            parse_oauth_callback(&request, "expected"),
            Ok(OAuthCallback::AuthorizationCode("abc/123".to_string()))
        );
    }

    #[test]
    fn accepts_provider_denial_only_with_expected_state() {
        let request = callback_request("/?error=access_denied&state=expected");
        assert_eq!(
            parse_oauth_callback(&request, "expected"),
            Ok(OAuthCallback::AuthorizationDenied)
        );
    }

    #[test]
    fn rejects_wrong_method_path_host_or_state() {
        let post = format!(
            "POST /?code=abc&state=expected HTTP/1.1\r\nHost: {}\r\n\r\n",
            REDIRECT_HOST
        );
        assert!(parse_oauth_callback(&post, "expected").is_err());

        let wrong_path = callback_request("/other?code=abc&state=expected");
        assert!(parse_oauth_callback(&wrong_path, "expected").is_err());

        let wrong_host = "GET /?code=abc&state=expected HTTP/1.1\r\nHost: localhost:48721\r\n\r\n";
        assert!(parse_oauth_callback(wrong_host, "expected").is_err());

        let wrong_state = callback_request("/?code=abc&state=unexpected");
        assert!(parse_oauth_callback(&wrong_state, "expected").is_err());
    }

    #[test]
    fn rejects_missing_or_ambiguous_security_parameters() {
        let missing_state = callback_request("/?code=abc");
        assert!(parse_oauth_callback(&missing_state, "expected").is_err());

        let duplicate_state = callback_request("/?code=abc&state=expected&state=expected");
        assert!(parse_oauth_callback(&duplicate_state, "expected").is_err());

        let duplicate_code = callback_request("/?code=abc&code=def&state=expected");
        assert!(parse_oauth_callback(&duplicate_code, "expected").is_err());

        let code_and_error = callback_request("/?code=abc&error=access_denied&state=expected");
        assert!(parse_oauth_callback(&code_and_error, "expected").is_err());

        let malformed_encoding = callback_request("/?code=%ZZ&state=expected");
        assert!(parse_oauth_callback(&malformed_encoding, "expected").is_err());
    }
}
