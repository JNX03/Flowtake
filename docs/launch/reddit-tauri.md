# r/tauri post draft

**Subreddit**: r/tauri
**Audience**: Tauri developers, Rust + frontend crossover devs
**Important**: This is the SHOWCASE audience — they want to see real Tauri v2 apps in the wild. Lean into the technical story.

---

## Title
```
[Showcase] Flowtake — screen recorder with auto-zoom animations, built with Tauri v2 + React + Pixi.js
```

## URL
```
https://github.com/JNX03/Flowtake
```

## Body

```
Sharing a Tauri v2 app I've been grinding on for ~2 years: Flowtake, an open-source screen recorder that automatically adds Screen Studio–style zoom and pan animations to your recordings.

**Why I think this might be interesting for this sub**:

- It's a non-trivial Tauri v2 app (367 commits, 100+ React components, 6 windows, full IPC layer, bundled FFmpeg sidecar). Good reference for anyone building something beyond "hello world" in Tauri.
- Multi-window architecture: main editor, recorder overlay, exporter, window/area pickers, note window. Each window has its own Vite entry and shared Redux state via Tauri commands.
- Mouse tracking lives on the Rust side (`src-tauri/src/mouse_tracker.rs`) and streams to the frontend via events — separate thread to avoid blocking the webview.
- Custom `video://` asset protocol for streaming recording frames into Pixi.js in the preview window (bypasses the webview's fetch limits for large media).
- FFmpeg is bundled as a Tauri sidecar, cross-compiled for all 3 platforms in GitHub Actions. `externalBin` in `tauri.conf.json`.
- Migrated from Electron mid-project. Not fun but absolutely worth it. Binary went from ~280 MB to ~80 MB, startup time dropped significantly, and the recording layer is way easier to write natively in Rust than via Node.js bindings.

**Tauri gotchas I hit**:
- `dragDropEnabled: true` conflicts with some HTML5 drag/drop interactions — had to handle it carefully in the timeline.
- macOS `macOSPrivateApi: true` was needed for window transparency + camera overlay; watch for this if you submit to the Mac App Store (you probably can't).
- The Wayland screen capture story via `xdg-desktop-portal` is still rough — if anyone's shipped a clean implementation I'd love notes.
- CSP for `media-src` needs `asset: http://asset.localhost http://video.localhost blob: data: stream:` to get video streams working in preview. Not obvious from the docs.

**Stack details**:
- Tauri v2.10.1, Rust stable
- React 19.2, Redux Toolkit, Pixi.js 8.17
- Vite 7, TailwindCSS 4, DaisyUI 5
- FFmpeg sidecar, MediaPipe + HuggingFace Transformers for on-device speech recognition (teleprompter + subtitles)

**Status**: Windows is stable (daily-driver), macOS + Linux are dev preview, v2.0 targets full stable for all three.

MIT licensed. Happy to answer any Tauri-specific questions — if you're building something similar, feel free to lift patterns.

Download: https://github.com/JNX03/Flowtake/releases/latest
Source: https://github.com/JNX03/Flowtake
```

---

## Response templates

**"How did you do the multi-window IPC?"**
> Shared Redux store in the main window, child windows invoke commands via `tauriBridge.js` (a thin compatibility layer). Events flow back via Tauri event bus. See `app/shared/tauriBridge.js`.

**"FFmpeg sidecar pattern in v2?"**
> `"externalBin": ["binaries/ffmpeg"]` in tauri.conf.json, then `tauri.sidecar("ffmpeg")` on the Rust side with per-target binary names (`ffmpeg-x86_64-pc-windows-msvc.exe`, `ffmpeg-aarch64-apple-darwin`, etc). The CI builds download the right binary per target.

**"Why Pixi.js for preview instead of canvas 2D?"**
> Pixi gives you GPU-accelerated compositing, which matters when you have 5+ layers (video + overlays + cursor + click effects + masks) at 60fps. Canvas 2D chokes.
