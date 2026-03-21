# Development Setup

## Prerequisites

- **Node.js** 20+
- **Rust** (latest stable) via [rustup](https://rustup.rs/)
- **FFmpeg** binary (see below)
- Platform-specific dependencies (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

## Getting Started

```bash
# Clone the repository
git clone https://github.com/JNX03/Flowtake.git
cd Flowtake

# Install Node dependencies
npm install

# Download FFmpeg sidecar binary
# Windows:
powershell -ExecutionPolicy Bypass -File scripts/download-ffmpeg.ps1
# macOS/Linux:
./scripts/download-ffmpeg.sh

# Start development
npm run dev
```

This launches both the Vite dev server (frontend) and the Tauri dev process (Rust backend).

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Tauri + Vite in development mode |
| `npm run build` | Build the full application for distribution |
| `npm run dev:frontend` | Start only the Vite frontend dev server |
| `npm run build:frontend` | Build only the frontend |
| `npm run lint` | Run ESLint |

## Project Layout

- **Frontend code** lives in `app/`. Edit React components, Redux slices, and Pixi.js scenes here.
- **Backend code** lives in `src-tauri/src/`. Edit Rust command handlers and native integrations here.
- **Build config** is in `vite.config.mjs` (frontend) and `src-tauri/tauri.conf.json` (Tauri).

## Vite Aliases

The `@shared` alias resolves to `app/shared/`, so you can import shared code from any window:

```js
import { toMs } from '@shared/helpers'
import store from '@shared/redux/store'
```

## Adding a New Tauri Command

1. Create or edit a file in `src-tauri/src/commands/`
2. Add the `#[tauri::command]` attribute to your function
3. Register it in `src-tauri/src/lib.rs` via `.invoke_handler()`
4. Call it from the frontend: `await window.electron.ipcRenderer.invoke("your-command", args)`

## Platform-Specific Notes

### Windows
- Uses NSIS installer for distribution
- AutoHotkey scripts in `resources/` handle window enumeration

### macOS
- Requires Xcode command line tools
- Code signing configured via `src-tauri/Entitlements.plist`

### Linux
- Requires: `libx11-dev`, `libxcb1-dev`, `libxrandr-dev`, `libpulse-dev`, `xdotool`, `wmctrl`
- Post-install script: `src-tauri/scripts/linux-postinstall.sh`
