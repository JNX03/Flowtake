# Video Pipeline

Flowtake's video pipeline has three stages: **Recording**, **Preview**, and **Export**.

## 1. Recording

```
Screen / Window / Area
        │
        ▼
  Rust Backend + FFmpeg Capture
  - Records screen, window, or area into temporary screen.mp4
  - Can include a supported system-audio source
        │
        ▼
  Temporary encoded media
  Mouse position events emitted to frontend

Camera and microphone sources use a separate browser/device-media path and are saved alongside the screen capture.
```

The Rust backend (`mouse_tracker.rs`) continuously emits cursor position events. These are recorded alongside the video frames and used to generate zoom/pan animations in the editor.

## 2. Preview (Editor)

```
Recorded media (temp files)
        │
        ▼
  Browser video elements
  - Decode recorded media
        │
        ▼
  PreviewWorkerManager
  - Creates and transfers VideoFrame objects
        │
        ▼
  Pixi.js Renderer (preview worker)
  - Applies zoom/pan/cursor animations
  - Renders overlays, subtitles, masks
  - Driven by Redux timeline state
        │
        ▼
  Canvas element in editor preview
```

The preview is entirely client-side. No FFmpeg is involved — browser video elements decode recorded media, then `PreviewWorkerManager` transfers `VideoFrame` objects to the Pixi.js preview worker for compositing.

The `video://` protocol serves validated byte ranges from registered recorded media to the editor's browser video elements without exposing filesystem paths.

## 3. Export (Render)

```
Timeline state (Redux)
        │
        ▼
  Render Worker
  - Iterates frames at target FPS
  - Applies all animations (same Pixi.js scene as preview)
  - Outputs composited RGBA frames
        │
        ▼
  Mediabunny output writer (Render Worker)
  - Encodes composited frames as H.264 or VP9
  - Writes a silent intermediate output.mp4 or output.webm
        │
        ▼
  Optional FFmpeg audio stage
  - Builds the recorded/timeline audio mix
  - When audio is present and enabled, muxes it without re-encoding the video
  - Writes through registered Tauri file handles
        │
        ▼
  Rust exporter
  - Resolves the backend-owned render path
  - Copies the completed MP4 or WebM to the local export folder
        │
        ▼
  Output video file
```

The render worker reuses the Pixi.js scene used by the preview. Mediabunny writes the edited video stream as H.264/MP4 or VP9/WebM through registered Tauri file handles. If the user enables audio and the project has an audible recorded or timeline source, the Rust exporter invokes FFmpeg to build a timeline-aware mix and mux it with video stream-copy mode. Rust then copies the completed MP4 or WebM to the selected local export path.

## Key Files

| File | Role |
|------|------|
| `src-tauri/src/lib.rs` | `video://` protocol, recording commands |
| `src-tauri/src/mouse_tracker.rs` | Cursor position tracking |
| `app/shared/scene/Animator.js` | Pixi.js animation orchestrator (preview + render) |
| `app/shared/workers/` | Web Workers for frame decode and render |
| `app/shared/exportFormats.js` | MP4/H.264/AAC and WebM/VP9/Opus format definitions |
| `app/shared/workers/WorkerOutputWriter.js` | Mediabunny video-track writer for the selected container |
| `src-tauri/src/commands/exporter.rs` | Registered output paths, timeline-aware audio processing/muxing, and final file copy |
