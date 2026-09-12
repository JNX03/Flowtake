# Development Setup

## Prerequisites

- **Node.js** 20+
- **Rust** (latest stable) via [rustup](https://rustup.rs/)
- **FFmpeg** available as `ffmpeg` on `PATH` (see below)
- Platform-specific dependencies (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

## Getting Started

```bash
# Clone the repository
git clone https://github.com/JNX03/Flowtake.git
cd Flowtake

# Install Node dependencies
npm install

# Start development
npm run dev
```

This launches both the Vite dev server (frontend) and the Tauri dev process (Rust backend).

Flowtake release packages do not include an FFmpeg executable. Install the
system dependency separately and confirm `ffmpeg -version` works in a new
terminal before starting development:

```powershell
# Windows
winget install --id Gyan.FFmpeg --exact --source winget
```

```bash
# macOS
brew install ffmpeg

# Debian or Ubuntu
sudo apt update
sudo apt install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```

For another Linux distribution, install its full FFmpeg package and keep the
`ffmpeg` command on `PATH`.

For privacy-safe demos or test runs, debug builds can use an isolated app-data directory instead of your normal Flowtake library. Set `FLOWTAKE_DEV_DATA_DIR` to an absolute, disposable directory before `npm run dev`. Release builds ignore this override.

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
- Rust handles current Win32 window enumeration; `resources/` retains legacy
  helper assets and installer artwork

### macOS
- Requires Xcode command line tools
- Code signing configured via `src-tauri/Entitlements.plist`

### Linux
- Requires: `libx11-dev`, `libxcb1-dev`, `libxrandr-dev`, `libpulse-dev`, `xdotool`, `wmctrl`
- Post-install script: `src-tauri/scripts/linux-postinstall.sh`
