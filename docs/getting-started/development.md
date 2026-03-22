# Development Setup

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Node.js](https://nodejs.org/) | 20+ | LTS recommended |
| [Rust](https://www.rust-lang.org/tools/install) | stable | Install via rustup |
| [Tauri v2 CLI](https://v2.tauri.app/start/prerequisites/) | 2.x | `cargo install tauri-cli` |
| FFmpeg binary | any | Place in `resources/` |

## Clone and Install

```bash
git clone https://github.com/Jnx03/Flowtake.git
cd Flowtake
npm install
```

## Run in Development

```bash
npm run dev
```

This starts both the Vite dev server (port 5173) and the Tauri native window with hot reload.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Tauri dev server with hot reload |
| `npm run dev:frontend` | Start Vite frontend only (port 5173) |
| `npm run build` | Build production installer (NSIS/MSI/DMG) |
| `npm run build:frontend` | Build frontend assets only |
| `npm run lint` | Run ESLint on the codebase |

## Path Aliases

Vite is configured with the `@shared` alias:

```js
// vite.config.mjs
'@shared': path.resolve(__dirname, 'app/shared')
```

Use `@shared/` imports throughout the frontend instead of relative paths.

## Multi-Window Dev Notes

Each window has its own HTML entry point. The main window uses `index.html` at the project root. Other windows live at `app/windows/<name>/index.html`.

When developing a specific window in isolation, you can open its HTML file directly in the Vite dev server by navigating to its path.

## FFmpeg Sidecar

FFmpeg must be placed in `resources/` before building. The Tauri shell plugin is configured to allow the sidecar binary. In dev mode, FFmpeg is resolved relative to the project root.

## Platform-Specific Notes

**Windows**: Requires Visual Studio Build Tools (C++ workload) for compiling native Rust dependencies.

**macOS**: Requires Xcode Command Line Tools (`xcode-select --install`).
