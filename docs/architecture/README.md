# Architecture

Flowtake uses a hybrid desktop architecture: a **Rust backend** (Tauri v2) for system access and a **React frontend** for the UI, communicating over Tauri's IPC bridge.

## High-Level Diagram

```
+------------------------------------------------------------------+
|                        Flowtake Application                       |
+------------------------------------------------------------------+
|                                                                    |
|   +---------------------------+   +----------------------------+   |
|   |      Tauri v2 (Rust)      |   |     React 18 Frontend      |   |
|   |---------------------------|   |----------------------------|   |
|   | - Recording control       |   | - Editor workspace         |   |
|   | - FFmpeg sidecar mgmt     |   | - Timeline (zoom, pan,     |   |
|   | - Window/area picking     |   |   clicks, clips, masks,    |   |
|   | - File I/O & projects     |   |   subtitles, overlays,     |   |
|   | - Mouse tracking          |   |   audio tracks)            |   |
|   | - System integration      |   | - Properties panel         |   |
|   | - Video streaming         |   | - Preview player (Pixi.js) |   |
|   |   (video:// protocol)     |   | - Settings & presets       |   |
|   | - Export pipeline         |   | - Asset library            |   |
|   +---------------------------+   +----------------------------+   |
|                |                               |                   |
|                +---------- IPC Bridge ---------+                   |
|                       (Tauri Commands)                             |
|                                                                    |
+------------------------------------------------------------------+
|  Redux Toolkit (State)  |  Pixi.js (Render)  |  FFmpeg (Encode)  |
+------------------------------------------------------------------+
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Framework** | [Tauri v2](https://v2.tauri.app/) (Rust) |
| **Backend** | Rust (tokio, serde) |
| **Frontend** | [React 18](https://react.dev/) + [Redux Toolkit](https://redux-toolkit.js.org/) |
| **Styling** | [TailwindCSS 4](https://tailwindcss.com/) + [DaisyUI 5](https://daisyui.com/) |
| **Graphics** | [Pixi.js 8](https://pixijs.com/) (2D animation rendering) |
| **Video Encoding** | [FFmpeg](https://ffmpeg.org/) (bundled sidecar) |
| **Build Tool** | [Vite 7](https://vite.dev/) |
| **AI/ML** | [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/guide) + [HuggingFace Transformers](https://huggingface.co/docs/transformers.js) |

## Directory Structure

```
Flowtake/
├── app/                     # React frontend
│   ├── shared/              # Code shared across all windows
│   │   ├── redux/           # Redux Toolkit store and slices
│   │   ├── scene/           # Pixi.js animation/rendering engine
│   │   ├── workers/         # Web Workers for preview and render
│   │   ├── tauriBridge.js   # IPC compatibility layer
│   │   ├── helpers.js       # Shared utility functions
│   │   └── constants.js     # App-wide constants
│   ├── components/          # Shared React UI components
│   └── windows/             # Per-window entry points
│       ├── main/            # Main editor window
│       ├── exporter/        # Export/render queue
│       ├── recorder/        # Recording overlay
│       ├── windowPicker/    # Window selection
│       ├── areaPicker/      # Area selection
│       └── note/            # Annotation window
│
├── src-tauri/               # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── commands/        # IPC command handlers
│   │   ├── lib.rs           # App setup & video:// protocol
│   │   ├── state.rs         # Global application state
│   │   └── mouse_tracker.rs # System-wide mouse tracking
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── resources/               # Bundled binaries (FFmpeg, AHK scripts)
├── docs/                    # This documentation
├── vite.config.mjs
└── package.json
```

## Key Integration Points

- **`app/shared/tauriBridge.js`** — Maps `window.electron.ipcRenderer` calls to Tauri `invoke()` and `listen()`, letting the React code use a stable IPC API
- **`src-tauri/src/lib.rs`** — Initializes the app, registers plugins, and sets up the `video://` protocol for streaming frames to the frontend
- **`src-tauri/src/commands/`** — Rust functions exposed as Tauri commands callable from JavaScript
- **`app/shared/redux/store.js`** — Central Redux store for the main editor window
- **`app/shared/scene/Animator.js`** — Orchestrates Pixi.js animations for preview and render

## Further Reading

- [Multi-Window Design](multi-window.md)
- [Video Pipeline](video-pipeline.md)
