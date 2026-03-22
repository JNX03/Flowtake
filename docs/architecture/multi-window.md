# Multi-Window Design

Flowtake uses 6 separate Tauri windows. Each window has its own HTML entry point and React root. Windows share code through `app/shared/`.

## Windows

| Window | Entry Point | Purpose |
|--------|-------------|---------|
| **main** | `index.html` | Full video editor: timeline, preview, properties panel |
| **recorder** | `app/windows/recorder/index.html` | Floating recording controls overlay |
| **exporter** | `app/windows/exporter/index.html` | Render queue and export progress |
| **windowPicker** | `app/windows/windowPicker/index.html` | Interactive window selection for capture |
| **areaPicker** | `app/windows/areaPicker/index.html` | Custom screen region selection |
| **note** | `app/windows/note/index.html` | Annotation/drawing overlay (excluded from capture) |

## Shared Code

All windows import from `app/shared/` via the `@shared` Vite alias:

- **Redux store** — The main window owns the store. Other windows can read/write state via Tauri events.
- **Scene engine** — `app/shared/scene/` contains the Pixi.js animation orchestrator used in both preview (main window) and render (exporter).
- **tauriBridge.js** — Uniform IPC interface used by all windows.
- **helpers.js / constants.js** — Utility functions and app-wide constants.

## Window Communication

Windows communicate through Tauri events (not direct JS calls, since each window is an isolated renderer process):

```
Main Window  ──── tauri::emit() ────→  Recorder Window
             ←── tauri::listen() ────
```

The `tauriBridge.js` wraps `listen()` and `emit()` in a familiar API so React components don't need to know which backend they're talking to.

## Window Configuration

Window sizes, decorations, and constraints are defined in `src-tauri/tauri.conf.json`. The main window is frameless (no OS title bar) — the app renders its own drag region and window controls.
