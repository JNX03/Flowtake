# Architecture

Flowtake is a professional screen recorder with auto-zoom animations built with **Tauri v2** (Rust backend) and **React 18** (frontend).

## Directory Structure

```
flowtake/
  app/                    # Frontend (React)
    shared/               # Code shared across all windows
      assets/             # Fonts, SVGs, images, ML models
      redux/              # Redux Toolkit store and slices
      scene/              # Pixi.js animation/rendering engine
      workers/            # Web Workers for preview and render
      helpers.js          # Shared utility functions
      constants.js        # App-wide constants (video types, modes)
      tauriBridge.js      # IPC compatibility layer (Electron -> Tauri)
    components/           # Shared React UI components
    windows/              # Per-window entry points
      main/               # Main editor window
      recorder/           # Recording overlay
      exporter/           # Export/render queue
      areaPicker/         # Screen area selection
      windowPicker/       # Window selection
      note/               # Annotation overlay
  src-tauri/              # Backend (Rust, Tauri v2)
    src/
      commands/           # Tauri command handlers
      lib.rs              # App initialization, plugins, protocols
      state.rs            # Global application state
      mouse_tracker.rs    # System-wide mouse tracking
  resources/              # Bundled binaries (FFmpeg, AutoHotkey)
  scripts/                # Build and setup scripts
  docs/                   # Documentation
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri v2 |
| Backend | Rust (tokio, serde) |
| Frontend | React 18 |
| State management | Redux Toolkit |
| Animation engine | Pixi.js 8 |
| Styling | TailwindCSS 4 + DaisyUI 5 |
| Build tool | Vite 7 |
| Video encoding | FFmpeg (sidecar binary) |

## Multi-Window Architecture

Flowtake uses 6 separate Tauri windows, each with its own HTML entry point and React root. Windows share code through `app/shared/` (Redux store, scene engine, helpers).

| Window | Purpose |
|--------|---------|
| `main` | Editor with timeline, preview, and properties panel |
| `recorder` | Floating recording controls overlay |
| `exporter` | Export queue and render progress |
| `areaPicker` | Custom screen region selection |
| `windowPicker` | Application window selection |
| `note` | Annotation/drawing overlay |

The main window entry point is `index.html` at the project root. Other windows use `app/windows/<name>/index.html`.

## Key Integration Points

- **`app/shared/tauriBridge.js`** - Maps `window.electron.ipcRenderer` calls to Tauri `invoke()` and `listen()`. This allows the React code to use the same IPC API regardless of backend.
- **`src-tauri/src/lib.rs`** - Initializes the Tauri app, registers plugins, sets up the `video://` custom protocol for streaming video frames.
- **`src-tauri/src/commands/`** - Each file exposes Rust functions as Tauri commands callable from the frontend.
- **`app/shared/redux/store.js`** - Central Redux store shared by the main window.
- **`app/shared/scene/Animator.js`** - Orchestrates Pixi.js animations for preview and render.

## Video Pipeline

1. **Recording**: Rust backend captures screen/camera via platform APIs, writes raw frames
2. **Preview**: Web Workers decode frames via `mediabunny`, Pixi.js renders with animations
3. **Export**: Render Workers process frames, FFmpeg (sidecar) encodes to MP4
