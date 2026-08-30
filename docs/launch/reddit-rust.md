# r/rust post draft

**Subreddit**: r/rust
**Important**: r/rust is STRICT. Low tolerance for "here's my project that happens to use Rust." You need to frame this around actual Rust content — architecture, learnings, crates, design decisions. Don't post as a pure launch.
**Alternative timing**: Post 24-48h AFTER the initial launch wave — reframe as "things I learned building X" not "announcing X."

---

## Title
```
Things I learned building a screen recorder in Rust + Tauri v2 over 2 years (Flowtake)
```

## URL
```
https://github.com/JNX03/Flowtake
```

## Body — FRAME AS LEARNING POST, not a launch

```
I just shipped v1.4.2 of a screen recorder I've been building in Rust + Tauri v2 for ~2 years (367 commits, MIT, cross-platform). Wanted to share some things I learned along the way that might be useful for anyone building similar native media apps in Rust.

**Architecture**:
- Tauri v2 as the shell and command bus
- `src-tauri/src/commands/` for the IPC boundary (~30 commands: start_recording, get_mouse_position, export_video, etc.)
- `src-tauri/src/mouse_tracker.rs` spawns a dedicated OS thread for polling cursor position — can't do this from the main thread without blocking the webview, and can't do it from an async task without platform-specific issues on Windows
- Recording loop wraps platform-specific APIs behind a trait: DXGI on Windows, ScreenCaptureKit on macOS, PipeWire via xdg-desktop-portal on Linux
- FFmpeg as a sidecar binary, not a crate — tried `ffmpeg-next` (libav bindings) first but the build complexity and licensing mess weren't worth it. Sidecar + IPC over stdin/stdout is cleaner.

**Things that surprised me**:
1. **Thread-affine state is hard to avoid**. Windows DXGI has COM apartment requirements; macOS CGWindowList wants main thread. I ended up with platform-specific runners that own the recording loop and communicate via `crossbeam` channels.
2. **`Arc<Mutex<T>>` was the right answer 90% of the time**. I kept trying to be clever with `RwLock` and channels; `Mutex` was almost always the simpler path for shared recorder state.
3. **Tauri event bus + Redux was magic**. Emitting events from Rust to `"record_frame_captured"` and letting Redux dispatch them as actions made the state layer feel cohesive across Rust and JS.
4. **`serde` + typed commands** saved me so many hours. The Tauri command macro `#[tauri::command]` auto-generates the TS types via `tauri-specta`, so refactoring an argument name is an atomic change across both sides.
5. **FFmpeg sidecar output parsing is the worst**. Parsing `ffmpeg`'s stderr progress lines is fragile. I regret not shipping my own progress protocol (e.g., `-progress pipe:2`).

**Crates I lean on**:
- `tauri` v2 + `tauri-plugin-*` (store, fs, dialog, shell, process, notification, updater)
- `serde` + `serde_json` (obviously)
- `crossbeam` for inter-thread channels in the recording loop
- Platform-specific: `windows` crate for DXGI, `core-graphics` + `cocoa` for macOS, `zbus` for Linux DBus portal calls

**What's next**:
- Wayland still has edge cases on KDE that I can't reproduce on GNOME. If anyone has a clean reference implementation, PRs welcome.
- I want to rewrite the FFmpeg layer to use `gstreamer` for lower latency — still evaluating.

Full source (MIT): https://github.com/JNX03/Flowtake

Happy to answer specific Rust / Tauri questions — especially if you're building something similar.
```

---

## Pitfalls
- DON'T frame this as "check out my project" — r/rust removes those
- DO include 3+ concrete technical observations, not marketing
- DON'T use screenshots or product copy in the body
- DO link to specific files in the repo when discussing architecture
- Expect skeptical comments about Tauri vs native Rust GUI (egui, iced, slint) — be ready to explain
