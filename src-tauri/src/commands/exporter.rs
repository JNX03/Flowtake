use crate::error::{AppError, AppResult};
use crate::identifiers::{validate_project_id, validate_render_id};
use crate::state::{AppState, RenderFormat, RenderState};
use serde::Deserialize;
use serde_json::Value;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportAudioPlan {
    has_system_audio: bool,
    has_microphone_audio: bool,
    timeline_start: f64,
    timeline_end: f64,
    clips: Vec<ExportAudioClip>,
    #[serde(default)]
    custom_clips: Vec<ExportCustomAudioClip>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportAudioClip {
    start: f64,
    end: f64,
    source_start: f64,
    source_end: f64,
    playback_rate: f64,
    system_audio_volume: f64,
    microphone_audio_volume: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportCustomAudioClip {
    relative_path: String,
    start: f64,
    end: f64,
    source_start: f64,
    source_end: f64,
    playback_rate: f64,
    volume: f64,
}

fn render_format_from_value(render: &Value) -> AppResult<RenderFormat> {
    match render.pointer("/config/format") {
        None | Some(Value::Null) => Ok(RenderFormat::Mp4),
        Some(Value::String(value)) => RenderFormat::parse(value).ok_or_else(|| {
            AppError::General("Unsupported export format. Choose MP4 or WebM.".to_string())
        }),
        Some(_) => Err(AppError::General(
            "Export format must be either mp4 or webm".to_string(),
        )),
    }
}

#[tauri::command]
pub async fn open_export_window(
    app: AppHandle,
    state_data: Option<Value>,
    section: Option<String>,
) -> AppResult<()> {
    // Store state data and section so the exporter can fetch them after loading
    {
        let state = app.state::<Mutex<AppState>>();
        let mut state = state.lock().unwrap();
        state.export_state_data = state_data.clone();
        state.export_section = section.clone();
    }

    // If the exporter window already exists, reuse it: bring it forward and push the new
    // project state + section to its listeners. (Closing then immediately rebuilding raced
    // with Tauri's async close() and threw "a webview with label `exporter` already exists".)
    if let Some(existing) = app.get_webview_window("exporter") {
        existing.show().ok();
        existing.unminimize().ok();
        existing.set_focus().ok();
        if let Some(state_data) = state_data {
            app.emit_to("exporter", "project-state", &state_data).ok();
        }
        if let Some(section) = section {
            app.emit_to("exporter", "open-section", &section).ok();
        }
        return Ok(());
    }

    let _window = WebviewWindowBuilder::new(
        &app,
        "exporter",
        WebviewUrl::App("app/windows/exporter/index.html".into()),
    )
    .title("Export - Flowtake")
    .inner_size(520.0, 580.0)
    .center()
    .resizable(true)
    .min_inner_size(400.0, 400.0)
    .decorations(false)
    .build()
    .map_err(AppError::Tauri)?;

    // Also emit events for already-open windows that have listeners registered
    if let Some(state_data) = state_data {
        app.emit_to("exporter", "project-state", &state_data).ok();
    }
    if let Some(section) = section {
        app.emit_to("exporter", "open-section", &section).ok();
    }

    Ok(())
}

#[tauri::command]
pub async fn close_export_window(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("exporter") {
        window.close().map_err(AppError::Tauri)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn close_exporter_window(app: AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("exporter") {
        window.close().map_err(AppError::Tauri)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_project_for_export(app: AppHandle) -> AppResult<Value> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    let project_id = state.project_id.clone().ok_or(AppError::NoProjectOpen)?;
    let json_path = state.project_json_file(&project_id);
    drop(state);

    if json_path.exists() {
        let content = std::fs::read_to_string(&json_path)?;
        let json: Value = serde_json::from_str(&content)?;
        Ok(json)
    } else {
        Ok(Value::Null)
    }
}

#[tauri::command]
pub async fn get_project_state(app: AppHandle) -> AppResult<Value> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    Ok(state.export_state_data.clone().unwrap_or(Value::Null))
}

#[tauri::command]
pub async fn get_open_section(app: AppHandle) -> AppResult<Value> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    Ok(state
        .export_section
        .clone()
        .map(Value::String)
        .unwrap_or(Value::Null))
}

#[tauri::command]
pub async fn queue_render(app: AppHandle, render: Value) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let render_id = render
        .get("id")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::General("Render is missing an id".to_string()))?
        .to_string();
    validate_render_id(&render_id)?;
    let render_format = render_format_from_value(&render)?;

    // Require an open project. Falling back to "" copied the whole temp root and produced
    // an empty render dir, which later failed cryptically with "Render failed".
    let project_id = {
        let state = state.lock().unwrap();
        state.project_id.clone().ok_or(AppError::NoProjectOpen)?
    };
    validate_project_id(&project_id)?;

    let mut state = state.lock().unwrap();
    if state.renders.contains_key(&render_id) {
        return Err(AppError::General("Render id is already in use".to_string()));
    }
    let render_temp = state.render_temp_dir(&render_id);
    if render_temp.exists() {
        return Err(AppError::General(
            "Render workspace already exists".to_string(),
        ));
    }
    std::fs::create_dir_all(&render_temp)?;

    // Copy project files (screen.mp4, camera.webm, project.json, ...) into the render temp dir.
    let project_temp = state.project_temp_dir(&project_id);
    if project_temp.exists() {
        copy_dir_contents(&project_temp, &render_temp)?;
    }

    // The renderer always reads screen.mp4 first; if it's missing or empty the project was
    // never fully saved to temp. Fail fast here with a clear message instead of letting the
    // worker throw a cryptic decode/read error later.
    let screen_video = render_temp.join("screen.mp4");
    let screen_ok = std::fs::metadata(&screen_video)
        .map(|m| m.len() > 0)
        .unwrap_or(false);
    if !screen_ok {
        std::fs::remove_dir_all(&render_temp).ok();
        return Err(AppError::General(
            "Screen recording not found — open and save the project before exporting".to_string(),
        ));
    }

    let export_dir = state.export_dir();
    std::fs::create_dir_all(&export_dir)?;

    // Name the output after the project (sanitized for the filesystem) and avoid overwriting
    // earlier exports by suffixing " (n)". Previously every export overwrote "export.mp4"
    // because the render object never carried a "name" field.
    let raw_name = render
        .get("projectName")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("Flowtake Recording");
    let safe_name: String = raw_name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || matches!(c, ' ' | '-' | '_' | '.') {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim()
        .to_string();
    let safe_name = if safe_name.is_empty() {
        "Flowtake Recording".to_string()
    } else {
        safe_name
    };
    let output_path = unique_output_path(&export_dir, &safe_name, render_format);

    state.renders.insert(
        render_id.clone(),
        RenderState {
            id: render_id,
            project_id,
            output_path,
            temp_dir: render_temp,
            format: render_format,
            is_cancelled: false,
        },
    );

    Ok(())
}

/// Returns a format-safe output path, suffixing ` (n)` if needed so exports are not overwritten.
fn unique_output_path(
    dir: &std::path::Path,
    stem: &str,
    render_format: RenderFormat,
) -> std::path::PathBuf {
    let extension = render_format.extension();
    let mut candidate = dir.join(format!("{stem}.{extension}"));
    let mut n = 1;
    while candidate.exists() {
        candidate = dir.join(format!("{stem} ({n}).{extension}"));
        n += 1;
    }
    candidate
}

fn validate_audio_plan(plan: &ExportAudioPlan) -> AppResult<()> {
    let has_recorded_audio = plan.has_system_audio || plan.has_microphone_audio;
    if !has_recorded_audio && plan.custom_clips.is_empty() {
        return Err(AppError::General(
            "Audio export requested without an available source".to_string(),
        ));
    }
    if has_recorded_audio && plan.clips.is_empty() {
        return Err(AppError::General(
            "Audio export requires at least one timeline clip".to_string(),
        ));
    }
    if plan.clips.len() > 10_000 || plan.custom_clips.len() > 10_000 {
        return Err(AppError::General(
            "Audio export has too many timeline clips".to_string(),
        ));
    }

    if !plan.timeline_start.is_finite()
        || !plan.timeline_end.is_finite()
        || plan.timeline_start < 0.0
        || plan.timeline_end <= plan.timeline_start
    {
        return Err(AppError::General(
            "Audio export contains an invalid timeline range".to_string(),
        ));
    }

    let mut previous_end = plan.timeline_start;
    for clip in &plan.clips {
        let values = [
            clip.start,
            clip.end,
            clip.source_start,
            clip.source_end,
            clip.playback_rate,
            clip.system_audio_volume,
            clip.microphone_audio_volume,
        ];
        if values.iter().any(|value| !value.is_finite()) {
            return Err(AppError::General(
                "Audio export contains a non-finite clip value".to_string(),
            ));
        }
        if clip.start < plan.timeline_start
            || clip.end > plan.timeline_end
            || clip.end <= clip.start
            || clip.start < previous_end
            || clip.source_start < 0.0
            || clip.source_end <= clip.source_start
        {
            return Err(AppError::General(
                "Audio export contains invalid, overlapping, or unordered clips".to_string(),
            ));
        }
        if clip.playback_rate != 0.0 && !(0.05..=100.0).contains(&clip.playback_rate) {
            return Err(AppError::General(
                "Audio export clip speed is outside the supported range".to_string(),
            ));
        }
        if !(0.0..=4.0).contains(&clip.system_audio_volume)
            || !(0.0..=4.0).contains(&clip.microphone_audio_volume)
        {
            return Err(AppError::General(
                "Audio export clip volume is outside the supported range".to_string(),
            ));
        }
        previous_end = clip.end;
    }

    for clip in &plan.custom_clips {
        let values = [
            clip.start,
            clip.end,
            clip.source_start,
            clip.source_end,
            clip.playback_rate,
            clip.volume,
        ];
        if values.iter().any(|value| !value.is_finite())
            || clip.start < plan.timeline_start
            || clip.end > plan.timeline_end
            || clip.end <= clip.start
            || clip.source_start < 0.0
            || clip.source_end <= clip.source_start
        {
            return Err(AppError::General(
                "Custom audio export contains an invalid clip range".to_string(),
            ));
        }
        if !(0.05..=100.0).contains(&clip.playback_rate) {
            return Err(AppError::General(
                "Custom audio export clip speed is outside the supported range".to_string(),
            ));
        }
        if !(0.0..=4.0).contains(&clip.volume) {
            return Err(AppError::General(
                "Custom audio export clip volume is outside the supported range".to_string(),
            ));
        }
        if !is_safe_project_audio_relative_path(&clip.relative_path) {
            return Err(AppError::General(
                "Custom audio export path must stay inside the project assets directory"
                    .to_string(),
            ));
        }
    }
    Ok(())
}

fn is_safe_project_audio_relative_path(value: &str) -> bool {
    if value.is_empty() || value.contains('\\') {
        return false;
    }
    let path = Path::new(value);
    if path.is_absolute() {
        return false;
    }

    let components = path.components().collect::<Vec<_>>();
    components.len() >= 2
        && matches!(components.first(), Some(Component::Normal(value)) if *value == std::ffi::OsStr::new("assets"))
        && components
            .iter()
            .all(|component| matches!(component, Component::Normal(_)))
}

fn atempo_chain(playback_rate: f64) -> String {
    let mut remaining = playback_rate;
    let mut factors = Vec::new();
    while remaining > 2.0 {
        factors.push(2.0);
        remaining /= 2.0;
    }
    while remaining < 0.5 {
        factors.push(0.5);
        remaining /= 0.5;
    }
    if (remaining - 1.0).abs() > 0.000_001 {
        factors.push(remaining);
    }
    factors
        .into_iter()
        .map(|factor| format!(",atempo={factor:.6}"))
        .collect()
}

fn audio_segment_filter(
    input_index: usize,
    clip: &ExportAudioClip,
    volume: f64,
    label: &str,
) -> String {
    format!(
        "[{input_index}:a]atrim=start={:.6}:end={:.6},asetpts=PTS-STARTPTS{},volume={volume:.6},aresample=async=1:first_pts=0[{label}]",
        clip.source_start / 1000.0,
        clip.source_end / 1000.0,
        atempo_chain(clip.playback_rate),
    )
}

fn audio_silence_filter(duration_ms: f64, label: &str) -> String {
    format!(
        "anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration={:.6},asetpts=PTS-STARTPTS[{label}]",
        duration_ms / 1000.0
    )
}

fn build_recorded_audio_filter(
    plan: &ExportAudioPlan,
    filters: &mut Vec<String>,
) -> Option<String> {
    if !plan.has_system_audio && !plan.has_microphone_audio {
        return None;
    }

    let system_input = plan.has_system_audio.then_some(0);
    let microphone_input = plan
        .has_microphone_audio
        .then_some(usize::from(plan.has_system_audio));
    let mut timeline_labels = Vec::new();
    let mut timeline_cursor = plan.timeline_start;

    for (index, clip) in plan.clips.iter().enumerate() {
        if clip.start > timeline_cursor {
            let label = format!("recorded-gap-{index}");
            filters.push(audio_silence_filter(clip.start - timeline_cursor, &label));
            timeline_labels.push(label);
        }

        if clip.playback_rate == 0.0 {
            let label = format!("recorded-freeze-{index}");
            filters.push(audio_silence_filter(clip.end - clip.start, &label));
            timeline_labels.push(label);
            timeline_cursor = clip.end;
            continue;
        }

        let mut sources = Vec::new();
        if let Some(input) = system_input {
            let label = format!("recorded-system-{index}");
            filters.push(audio_segment_filter(
                input,
                clip,
                clip.system_audio_volume,
                &label,
            ));
            sources.push(label);
        }
        if let Some(input) = microphone_input {
            let label = format!("recorded-microphone-{index}");
            filters.push(audio_segment_filter(
                input,
                clip,
                clip.microphone_audio_volume,
                &label,
            ));
            sources.push(label);
        }

        let clip_label = format!("recorded-clip-{index}");
        if sources.len() == 2 {
            filters.push(format!(
                "[{}][{}]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[{clip_label}]",
                sources[0], sources[1]
            ));
        } else {
            filters.push(format!("[{}]anull[{clip_label}]", sources[0]));
        }
        timeline_labels.push(clip_label);
        timeline_cursor = clip.end;
    }

    if timeline_cursor < plan.timeline_end {
        let label = "recorded-gap-tail".to_string();
        filters.push(audio_silence_filter(
            plan.timeline_end - timeline_cursor,
            &label,
        ));
        timeline_labels.push(label);
    }

    let output_label = "recorded-timeline".to_string();
    if timeline_labels.len() == 1 {
        filters.push(format!("[{}]anull[{output_label}]", timeline_labels[0]));
    } else {
        let inputs = timeline_labels
            .iter()
            .map(|label| format!("[{label}]"))
            .collect::<String>();
        filters.push(format!(
            "{inputs}concat=n={}:v=0:a=1[{output_label}]",
            timeline_labels.len()
        ));
    }
    Some(output_label)
}

fn custom_audio_segment_filter(
    input_index: usize,
    clip: &ExportCustomAudioClip,
    timeline_start: f64,
    label: &str,
) -> String {
    let duration_seconds = (clip.end - clip.start) / 1000.0;
    let delay_ms = clip.start - timeline_start;
    format!(
        "[{input_index}:a]atrim=start={:.6}:end={:.6},asetpts=PTS-STARTPTS{},volume={:.6},aresample=async=1:first_pts=0,apad,atrim=duration={duration_seconds:.6},adelay={delay_ms:.3}:all=1[{label}]",
        clip.source_start / 1000.0,
        clip.source_end / 1000.0,
        atempo_chain(clip.playback_rate),
        clip.volume,
    )
}

fn build_audio_filter(plan: &ExportAudioPlan) -> AppResult<String> {
    validate_audio_plan(plan)?;
    let mut filters = Vec::new();
    let mut mix_labels = Vec::new();

    filters.push(audio_silence_filter(
        plan.timeline_end - plan.timeline_start,
        "timeline-silence",
    ));
    mix_labels.push("timeline-silence".to_string());

    if let Some(label) = build_recorded_audio_filter(plan, &mut filters) {
        mix_labels.push(label);
    }

    let first_custom_input =
        usize::from(plan.has_system_audio) + usize::from(plan.has_microphone_audio);
    for (index, clip) in plan.custom_clips.iter().enumerate() {
        let label = format!("custom-{index}");
        filters.push(custom_audio_segment_filter(
            first_custom_input + index,
            clip,
            plan.timeline_start,
            &label,
        ));
        mix_labels.push(label);
    }

    let inputs = mix_labels
        .iter()
        .map(|label| format!("[{label}]"))
        .collect::<String>();
    filters.push(format!(
        "{inputs}amix=inputs={}:duration=longest:dropout_transition=0:normalize=0[outa]",
        mix_labels.len()
    ));
    Ok(filters.join(";"))
}

fn resolve_render_audio_asset(render_temp: &Path, relative_path: &str) -> AppResult<PathBuf> {
    if !is_safe_project_audio_relative_path(relative_path) {
        return Err(AppError::General(
            "Custom audio export path must stay inside the project assets directory".to_string(),
        ));
    }

    let assets_dir = render_temp
        .join("assets")
        .canonicalize()
        .map_err(|_| AppError::General("Project assets directory is unavailable".to_string()))?;
    let candidate = render_temp
        .join(relative_path)
        .canonicalize()
        .map_err(|_| AppError::General("A timeline audio file is missing".to_string()))?;

    if !candidate.starts_with(&assets_dir)
        || !candidate
            .metadata()
            .map(|metadata| metadata.is_file())
            .unwrap_or(false)
    {
        return Err(AppError::General(
            "Timeline audio resolved outside the project assets directory".to_string(),
        ));
    }
    Ok(candidate)
}

fn run_export_ffmpeg(ffmpeg: &Path, args: &[String], operation: &str) -> AppResult<()> {
    let mut command = Command::new(ffmpeg);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let output = command.output().map_err(|error| {
        AppError::General(format!("Could not start FFmpeg for {operation}: {error}"))
    })?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr)
        .trim()
        .chars()
        .take(2_000)
        .collect::<String>();
    Err(AppError::General(format!(
        "FFmpeg {operation} failed: {}",
        if stderr.is_empty() {
            "unknown FFmpeg error"
        } else {
            &stderr
        }
    )))
}

fn ensure_nonempty_file(path: &Path, description: &str) -> AppResult<()> {
    let size = std::fs::metadata(path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    if size == 0 {
        return Err(AppError::General(format!(
            "{description} is missing or empty"
        )));
    }
    Ok(())
}

#[tauri::command]
pub async fn process_audio(
    app: AppHandle,
    render_id: String,
    audio_plan: ExportAudioPlan,
) -> AppResult<()> {
    let (render_temp, render_format) = {
        let state = app.state::<Mutex<AppState>>();
        let state = state.lock().unwrap();
        let render = state
            .renders
            .get(&render_id)
            .ok_or_else(|| AppError::General(format!("Render not found: {render_id}")))?;
        if render.is_cancelled {
            return Err(AppError::General("Render was canceled".to_string()));
        }
        (render.temp_dir.clone(), render.format)
    };
    let ffmpeg = super::recording::find_ffmpeg_path()
        .ok_or_else(|| AppError::General("FFmpeg is required to export audio".to_string()))?;
    let custom_audio_sources = audio_plan
        .custom_clips
        .iter()
        .map(|clip| resolve_render_audio_asset(&render_temp, &clip.relative_path))
        .collect::<AppResult<Vec<_>>>()?;
    let filter = build_audio_filter(&audio_plan)?;
    let processed_audio = render_temp.join(render_format.processed_audio_file_name());
    let mut args = vec![
        "-hide_banner".to_string(),
        "-loglevel".to_string(),
        "error".to_string(),
        "-y".to_string(),
    ];

    if audio_plan.has_system_audio {
        let source = render_temp.join("screen.mp4");
        ensure_nonempty_file(&source, "System audio source")?;
        args.push("-i".to_string());
        args.push(source.to_string_lossy().to_string());
    }
    if audio_plan.has_microphone_audio {
        let source = render_temp.join("camera.webm");
        ensure_nonempty_file(&source, "Microphone audio source")?;
        args.push("-i".to_string());
        args.push(source.to_string_lossy().to_string());
    }
    for source in custom_audio_sources {
        ensure_nonempty_file(&source, "Timeline audio source")?;
        args.push("-i".to_string());
        args.push(source.to_string_lossy().to_string());
    }
    args.extend([
        "-filter_complex".to_string(),
        filter,
        "-map".to_string(),
        "[outa]".to_string(),
        "-vn".to_string(),
        "-c:a".to_string(),
        render_format.audio_encoder().to_string(),
        "-b:a".to_string(),
        "192k".to_string(),
        processed_audio.to_string_lossy().to_string(),
    ]);

    tauri::async_runtime::spawn_blocking(move || {
        run_export_ffmpeg(&ffmpeg, &args, "audio processing")?;
        ensure_nonempty_file(&processed_audio, "Processed export audio")
    })
    .await
    .map_err(|error| AppError::General(format!("Audio processing task failed: {error}")))?
}

#[tauri::command]
pub async fn add_audio(app: AppHandle, render_id: String) -> AppResult<()> {
    let (render_temp, render_format) = {
        let state = app.state::<Mutex<AppState>>();
        let state = state.lock().unwrap();
        let render = state
            .renders
            .get(&render_id)
            .ok_or_else(|| AppError::General(format!("Render not found: {render_id}")))?;
        if render.is_cancelled {
            return Err(AppError::General("Render was canceled".to_string()));
        }
        (render.temp_dir.clone(), render.format)
    };
    let ffmpeg = super::recording::find_ffmpeg_path()
        .ok_or_else(|| AppError::General("FFmpeg is required to mux export audio".to_string()))?;
    let video = render_temp.join(render_format.output_file_name());
    let audio = render_temp.join(render_format.processed_audio_file_name());
    let muxed = render_temp.join(render_format.muxed_file_name());
    let backup = render_temp.join(render_format.backup_file_name());
    ensure_nonempty_file(&video, "Rendered video")?;
    ensure_nonempty_file(&audio, "Processed export audio")?;

    let mut args = vec![
        "-hide_banner".to_string(),
        "-loglevel".to_string(),
        "error".to_string(),
        "-y".to_string(),
        "-i".to_string(),
        video.to_string_lossy().to_string(),
        "-i".to_string(),
        audio.to_string_lossy().to_string(),
        "-map".to_string(),
        "0:v:0".to_string(),
        "-map".to_string(),
        "1:a:0".to_string(),
        "-c:v".to_string(),
        "copy".to_string(),
        "-c:a".to_string(),
        "copy".to_string(),
    ];
    if render_format == RenderFormat::Mp4 {
        args.extend(["-movflags".to_string(), "+faststart".to_string()]);
    }
    args.push(muxed.to_string_lossy().to_string());

    tauri::async_runtime::spawn_blocking(move || {
        run_export_ffmpeg(&ffmpeg, &args, "audio muxing")?;
        ensure_nonempty_file(&muxed, "Muxed export video")?;
        std::fs::remove_file(&backup).ok();
        std::fs::rename(&video, &backup)?;
        if let Err(error) = std::fs::rename(&muxed, &video) {
            std::fs::rename(&backup, &video).ok();
            return Err(AppError::Io(error));
        }
        std::fs::remove_file(&backup).ok();
        Ok(())
    })
    .await
    .map_err(|error| AppError::General(format!("Audio muxing task failed: {error}")))?
}

#[tauri::command]
pub async fn set_progress_bar(app: AppHandle, progress: f64) -> AppResult<()> {
    if let Some(window) = app.get_webview_window("main") {
        if progress < 0.0 {
            window
                .set_progress_bar(tauri::window::ProgressBarState {
                    status: Some(tauri::window::ProgressBarStatus::None),
                    progress: None,
                })
                .ok();
        } else {
            window
                .set_progress_bar(tauri::window::ProgressBarState {
                    status: Some(tauri::window::ProgressBarStatus::Normal),
                    progress: Some((progress * 100.0) as u64),
                })
                .ok();
        }
    }
    app.emit_to("main", "render-queue-progress", progress).ok();
    Ok(())
}

#[tauri::command]
pub async fn set_close_mode(_app: AppHandle, _mode: String) -> AppResult<()> {
    Ok(())
}

#[tauri::command]
pub async fn set_has_rendering_or_completed_renders(
    app: AppHandle,
    has_renders: bool,
) -> AppResult<()> {
    app.emit_to("main", "has-exports", has_renders).ok();
    Ok(())
}

#[tauri::command]
pub async fn clean_up_temp_folder(app: AppHandle, render_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    if let Some(render) = state.renders.get(&render_id) {
        std::fs::remove_dir_all(&render.temp_dir).ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn copy_to_videos_folder(app: AppHandle, render_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let (source, dest) = {
        let state = state.lock().unwrap();
        if let Some(render) = state.renders.get(&render_id) {
            (
                render.temp_dir.join(render.format.output_file_name()),
                render.output_path.clone(),
            )
        } else {
            log::error!("[copy_to_videos] Render not found: {}", render_id);
            return Err(AppError::General(format!(
                "Render not found: {}",
                render_id
            )));
        }
    };

    log::info!(
        "[copy_to_videos] source={:?} exists={} dest={:?}",
        source,
        source.exists(),
        dest
    );

    if source.exists() {
        let source_size = source.metadata().map(|m| m.len()).unwrap_or(0);
        log::info!("[copy_to_videos] source size: {} bytes", source_size);
        if source_size == 0 {
            return Err(AppError::General("Output video is empty".to_string()));
        }
        // Ensure export directory exists
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::copy(&source, &dest)?;
        log::info!("[copy_to_videos] Copied to {:?}", dest);
    } else {
        log::error!("[copy_to_videos] Output file not found at {:?}", source);
        return Err(AppError::General(format!(
            "Output video not found: {:?}",
            source
        )));
    }
    Ok(())
}

#[tauri::command]
pub async fn reveal_video_in_file_explorer(app: AppHandle, render_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    if let Some(render) = state.renders.get(&render_id) {
        if let Some(parent) = render.output_path.parent() {
            open::that(parent).ok();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn play_video(app: AppHandle, render_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    if let Some(render) = state.renders.get(&render_id) {
        open::that(&render.output_path).ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn cancel_render(app: AppHandle, render_id: String) -> AppResult<()> {
    let state = app.state::<Mutex<AppState>>();
    let mut state = state.lock().unwrap();
    if let Some(render) = state.renders.get_mut(&render_id) {
        render.is_cancelled = true;
    }
    Ok(())
}

#[tauri::command]
pub async fn send_notification(app: AppHandle, render_id: String) -> AppResult<()> {
    app.emit(
        "export-completed",
        serde_json::json!({ "renderId": render_id }),
    )
    .ok();
    Ok(())
}

#[tauri::command]
pub async fn get_shareable_url(_app: AppHandle, _title: Option<String>) -> AppResult<Value> {
    Ok(serde_json::json!({
        "id": null,
        "presignedUrl": null
    }))
}

#[tauri::command]
pub async fn upload(app: AppHandle, _render_id: String) -> AppResult<()> {
    app.emit_to("exporter", "upload-progress", 100).ok();
    Ok(())
}

#[tauri::command]
pub async fn clear_pending_renders(app: AppHandle) -> AppResult<()> {
    app.emit_to("exporter", "clear-pending-renders", ()).ok();
    Ok(())
}

#[tauri::command]
pub async fn cancel_running_render(app: AppHandle) -> AppResult<()> {
    app.emit_to("exporter", "cancel-running-render", ()).ok();
    Ok(())
}

#[tauri::command]
pub async fn get_render_video_path(app: AppHandle, render_id: String) -> AppResult<String> {
    let state = app.state::<Mutex<AppState>>();
    let state = state.lock().unwrap();
    if let Some(render) = state.renders.get(&render_id) {
        Ok(render.output_path.to_string_lossy().to_string())
    } else {
        Err(AppError::General(format!(
            "Render not found: {}",
            render_id
        )))
    }
}

fn validated_external_url(url: &str) -> AppResult<String> {
    #[cfg(target_os = "macos")]
    if url == "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture" {
        return Ok(url.to_string());
    }

    let parsed = reqwest::Url::parse(url)
        .map_err(|_| AppError::General("Invalid external URL".to_string()))?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err(AppError::General(
            "Only credential-free HTTPS URLs may be opened".to_string(),
        ));
    }
    Ok(parsed.to_string())
}

#[tauri::command]
pub async fn open_url_in_browser(_app: AppHandle, url: String) -> AppResult<()> {
    let url = validated_external_url(&url)?;
    open::that(&url).map_err(|e| AppError::General(format!("Failed to open URL: {}", e)))?;
    Ok(())
}

fn copy_dir_contents(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_contents(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_format_defaults_to_mp4_and_rejects_untrusted_values() {
        let legacy = serde_json::json!({ "config": {} });
        assert_eq!(
            render_format_from_value(&legacy).expect("legacy default"),
            RenderFormat::Mp4
        );

        let webm = serde_json::json!({ "config": { "format": "webm" } });
        assert_eq!(
            render_format_from_value(&webm).expect("valid WebM"),
            RenderFormat::WebM
        );

        for value in [
            serde_json::json!({ "config": { "format": "mkv" } }),
            serde_json::json!({ "config": { "format": "../webm" } }),
            serde_json::json!({ "config": { "format": 1 } }),
        ] {
            assert!(render_format_from_value(&value).is_err());
        }
    }

    #[test]
    fn render_ids_and_output_extensions_are_bounded() {
        // Render ids are `render-` plus a canonical UUID; anything looser is
        // rejected by the shared identifier validator.
        assert!(validate_render_id("render-123e4567-e89b-42d3-a456-426614174000").is_ok());
        assert!(validate_render_id("render-1234_abcd").is_err());
        assert!(validate_render_id("../render").is_err());
        assert!(validate_render_id("").is_err());

        let root = std::env::temp_dir();
        assert_eq!(
            unique_output_path(&root, "Example", RenderFormat::Mp4)
                .extension()
                .and_then(|value| value.to_str()),
            Some("mp4")
        );
        assert_eq!(
            unique_output_path(&root, "Example", RenderFormat::WebM)
                .extension()
                .and_then(|value| value.to_str()),
            Some("webm")
        );
    }

    #[test]
    fn audio_artifacts_and_codecs_match_the_container() {
        assert_eq!(
            RenderFormat::Mp4.processed_audio_file_name(),
            "processed-audio.m4a"
        );
        assert_eq!(RenderFormat::Mp4.audio_encoder(), "aac");
        assert_eq!(
            RenderFormat::WebM.processed_audio_file_name(),
            "processed-audio.webm"
        );
        assert_eq!(RenderFormat::WebM.audio_encoder(), "libopus");
        assert_eq!(RenderFormat::WebM.mime_type(), "video/webm");
    }

    fn audio_plan() -> ExportAudioPlan {
        ExportAudioPlan {
            has_system_audio: true,
            has_microphone_audio: true,
            timeline_start: 0.0,
            timeline_end: 6_000.0,
            clips: vec![
                ExportAudioClip {
                    start: 1_000.0,
                    end: 3_000.0,
                    source_start: 1_000.0,
                    source_end: 3_000.0,
                    playback_rate: 2.0,
                    system_audio_volume: 0.75,
                    microphone_audio_volume: 0.5,
                },
                ExportAudioClip {
                    start: 4_000.0,
                    end: 5_000.0,
                    source_start: 4_000.0,
                    source_end: 5_000.0,
                    playback_rate: 1.0,
                    system_audio_volume: 1.0,
                    microphone_audio_volume: 0.0,
                },
            ],
            custom_clips: vec![],
        }
    }

    #[test]
    fn decomposes_fast_audio_tempo_into_supported_factors() {
        assert_eq!(
            atempo_chain(8.0),
            ",atempo=2.000000,atempo=2.000000,atempo=2.000000"
        );
        assert_eq!(atempo_chain(1.0), "");
    }

    #[test]
    fn builds_timeline_audio_filter_with_trim_mix_speed_volume_and_concat() {
        let filter = build_audio_filter(&audio_plan()).expect("valid audio filter");
        assert!(filter.contains("atrim=start=1.000000:end=3.000000"));
        assert!(filter.contains("atempo=2.000000"));
        assert!(filter.contains("volume=0.750000"));
        assert!(filter.contains("volume=0.500000"));
        assert!(filter.contains("amix=inputs=2"));
        assert!(filter.contains("anullsrc=channel_layout=stereo:sample_rate=48000"));
        assert!(filter.contains("atrim=duration=1.000000"));
        // The recorded lane is concatenated into its own label; the final
        // [outa] comes from the amix that also folds in silence and custom clips.
        assert!(filter.contains("concat=n=5:v=0:a=1[recorded-timeline]"));
        assert!(filter.contains(":normalize=0[outa]"));
    }

    #[test]
    fn freeze_audio_is_silence_without_invalid_atempo() {
        let mut plan = audio_plan();
        plan.clips[0].playback_rate = 0.0;
        let filter = build_audio_filter(&plan).expect("valid freeze audio filter");
        assert!(filter.contains("[recorded-freeze-0]"));
        assert!(!filter.contains("atempo=0"));
    }

    #[test]
    fn rejects_overlapping_or_unsafe_audio_plan_values() {
        let mut plan = audio_plan();
        plan.clips[1].start = 2_000.0;
        assert!(validate_audio_plan(&plan).is_err());

        let mut plan = audio_plan();
        plan.clips[0].playback_rate = f64::NAN;
        assert!(validate_audio_plan(&plan).is_err());
    }

    #[test]
    fn mixes_overlapping_custom_audio_with_offsets_trims_and_volume() {
        let mut plan = audio_plan();
        plan.custom_clips = vec![
            ExportCustomAudioClip {
                relative_path: "assets/music.wav".to_string(),
                start: 500.0,
                end: 2_500.0,
                source_start: 1_000.0,
                source_end: 3_000.0,
                playback_rate: 1.0,
                volume: 0.75,
            },
            ExportCustomAudioClip {
                relative_path: "assets/voice.wav".to_string(),
                start: 1_000.0,
                end: 2_000.0,
                source_start: 250.0,
                source_end: 1_250.0,
                playback_rate: 1.0,
                volume: 0.5,
            },
        ];

        let filter = build_audio_filter(&plan).expect("valid custom audio filter");
        assert!(filter.contains("[2:a]atrim=start=1.000000:end=3.000000"));
        assert!(filter.contains("adelay=500.000:all=1[custom-0]"));
        assert!(filter.contains("[3:a]atrim=start=0.250000:end=1.250000"));
        assert!(filter.contains("adelay=1000.000:all=1[custom-1]"));
        assert!(filter.contains("volume=0.750000"));
        assert!(filter.contains("amix=inputs=4:duration=longest"));
    }

    #[test]
    fn custom_audio_paths_are_project_relative_and_contained() {
        for safe in ["assets/music.wav", "assets/nested/voice.ogg"] {
            assert!(is_safe_project_audio_relative_path(safe));
        }
        for unsafe_path in [
            "",
            "assets",
            "../music.wav",
            "assets/../project.json",
            "/assets/music.wav",
            r"assets\music.wav",
        ] {
            assert!(!is_safe_project_audio_relative_path(unsafe_path));
        }
    }
}
