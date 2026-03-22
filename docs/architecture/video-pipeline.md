# Video Pipeline

Flowtake's video pipeline has three stages: **Recording**, **Preview**, and **Export**.

## 1. Recording

```
Screen / Camera / Audio
        │
        ▼
  Rust Backend (Tauri)
  - Platform screen capture APIs
  - Camera via system media APIs
  - Audio: microphone + system loopback
        │
        ▼
  Raw frames written to temp files
  Mouse position events emitted to frontend
```

The Rust backend (`mouse_tracker.rs`) continuously emits cursor position events. These are recorded alongside the video frames and used to generate zoom/pan animations in the editor.

## 2. Preview (Editor)

```
Raw video frames (temp files)
        │
        ▼
  Web Worker (mediabunny decoder)
  - Decodes video frames on demand
        │
        ▼
  Pixi.js Renderer (main thread)
  - Applies zoom/pan/cursor animations
  - Renders overlays, subtitles, masks
  - Driven by Redux timeline state
        │
        ▼
  Canvas element in editor preview
```

The preview is entirely client-side. No FFmpeg is involved — raw frames are decoded by a Web Worker and composited by Pixi.js in real time.

The `video://` custom Tauri protocol streams raw frames from disk to the Web Worker without exposing the file path directly to the renderer.

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
  FFmpeg sidecar (Rust → Shell)
  - Receives frames via pipe
  - Encodes to MP4 / WebM
  - Mixes audio tracks
        │
        ▼
  Output video file
```

The render worker reuses the same `Animator.js` scene engine as the preview, ensuring what you see in the editor matches the exported video exactly.

## Key Files

| File | Role |
|------|------|
| `src-tauri/src/lib.rs` | `video://` protocol, recording commands |
| `src-tauri/src/mouse_tracker.rs` | Cursor position tracking |
| `app/shared/scene/Animator.js` | Pixi.js animation orchestrator (preview + render) |
| `app/shared/workers/` | Web Workers for frame decode and render |
