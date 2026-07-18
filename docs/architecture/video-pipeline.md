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
  - Encodes composited frames as AVC
  - Muxes the video into output.mp4
  - Writes through registered Tauri file handles
        │
        ▼
  Rust exporter
  - Resolves the backend-owned render path
  - Copies output.mp4 to the local export folder
        │
        ▼
  Output video file
```

The render worker reuses the Pixi.js scene used by the preview. In v1.6.0 the final edited-video path is an AVC MP4 encoded and muxed by Mediabunny. The Rust backend writes and copies the completed `output.mp4`; FFmpeg remains responsible for recording capture and native media utilities, not final edited-MP4 encoding.

The current edited MP4 is video-only. The `process_audio` and `add_audio` commands are placeholders, so no microphone, system, or timeline audio track is muxed into the final edited export.

## Key Files

| File | Role |
|------|------|
| `src-tauri/src/lib.rs` | `video://` protocol, recording commands |
| `src-tauri/src/mouse_tracker.rs` | Cursor position tracking |
| `app/shared/scene/Animator.js` | Pixi.js animation orchestrator (preview + render) |
| `app/shared/workers/` | Web Workers for frame decode and render |
| `app/shared/workers/WorkerOutputWriter.js` | Mediabunny AVC video track and MP4 output writer |
| `src-tauri/src/commands/exporter.rs` | Registered output path, final file copy, and current audio placeholders |
