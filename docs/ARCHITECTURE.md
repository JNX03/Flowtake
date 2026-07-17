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
| Edited MP4 encoding | Mediabunny encodes and muxes AVC MP4; FFmpeg remains bundled for capture and native media utilities |

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
- **`src-tauri/src/lib.rs`** - Initializes the Tauri app, registers plugins, and sets up the `video://` custom protocol that serves validated recording byte ranges to the editor.
- **`src-tauri/src/commands/`** - Each file exposes Rust functions as Tauri commands callable from the frontend.
- **`app/shared/redux/store.js`** - Central Redux store shared by the main window.
- **`app/shared/scene/Animator.js`** - Orchestrates Pixi.js animations for preview and render.

## Video Pipeline

1. **Recording**: Rust coordinates capture; FFmpeg records screen, window, and area sources into temporary media, while camera and microphone sources use the device-media path
2. **Preview**: Browser video elements decode recorded media, `PreviewWorkerManager` transfers `VideoFrame` objects, and the Pixi.js preview worker composites animations
3. **Export**: Render Workers composite frames with Pixi.js, Mediabunny encodes and muxes the AVC MP4, and Rust copies `output.mp4` to the export folder
