# Dev.to blog post draft

**Publish at**: https://dev.to/new
**Tags** (max 4): `opensource`, `rust`, `tauri`, `showdev`
**Cover image**: Upload `resources/banner.png`
**Canonical URL** (if cross-posting): Set this to the Dev.to URL so Hashnode/Medium don't outrank it.

---

## Title options (pick one)

1. **"I spent 2 years building an open-source Screen Studio alternative. Here's what I learned."** ← recommended
2. "Building a desktop screen recorder with Tauri v2 — 367 commits of lessons"
3. "Why I gave up on Electron mid-project and rewrote everything in Tauri + Rust"

## Subtitle / TL;DR
> Flowtake is now v1.4.2, MIT-licensed, cross-platform, and free forever. This is how it got there — and what I'd do differently.

---

## BODY

```markdown
![Flowtake banner](https://raw.githubusercontent.com/JNX03/Flowtake/main/resources/banner.png)

Two years ago, I was trying to record a product demo and hating how it looked. OBS gave me raw footage that needed hours of editing. Loom was fine but uploaded everything to a cloud I didn't control. Screen Studio did exactly what I wanted — beautiful automatic zooms, smooth cursor motion — but it was $229 and macOS only.

I'm on Windows. I'm cheap. And I like to build things.

So I started building Flowtake: an open-source screen recorder that automatically adds cinematic zoom and pan animations to your recordings, runs locally with no cloud, and works on every major OS.

367 commits later, [Flowtake v1.4.2](https://github.com/JNX03/Flowtake/releases/latest) is out. It's free, MIT licensed, and you can download it right now for Windows, macOS, or Linux.

This post is a mix of project announcement and postmortem — the things that surprised me, the mistakes I made, and the architecture decisions that worked out. If you're building anything in this category, I hope some of it is useful.

## What it actually does

The core idea is simple: you record your screen, and Flowtake automatically adds smooth zoom transitions around your cursor, pan animations that anticipate its movement, and velocity-based cursor smoothing with motion blur scaled by speed.

You can see it in 15 seconds:

![Flowtake auto-zoom demo](https://raw.githubusercontent.com/JNX03/Flowtake/main/docs/demos/demo.gif)

Beyond the auto-animation, there's a full timeline editor: clips, overlays, audio tracks, subtitles with on-device speech recognition, masks and blur for redacting sensitive areas, custom backgrounds, and a teleprompter with speech-sync. Everything exports through a bundled FFmpeg pipeline with configurable quality settings.

Nothing uploads anywhere. There's no account. There's no telemetry.

## The stack

- **Tauri v2** (Rust) for the native shell, recording layer, and FFmpeg sidecar
- **React 19** + **Redux Toolkit** for the UI
- **Pixi.js 8** (WebGL) for the timeline preview renderer
- **FFmpeg** as a bundled sidecar binary, one per target platform
- **MediaPipe** + **HuggingFace Transformers** for on-device speech recognition (teleprompter and subtitles)
- **Vite 7**, **TailwindCSS 4**, **DaisyUI 5** for build + styling

Binary is ~80 MB installed. Startup is near-instant. No Node runtime in production.

## Things I learned (the honest version)

### 1. I picked the wrong framework first

I started Flowtake in **Electron** in late 2023. This was a mistake, and I spent six months writing code I'd eventually throw away.

Electron was fine for the UI. The problem was the recording layer. I was binding to native recording APIs through Node's N-API, which meant every platform-specific quirk became a two-language debugging session (JavaScript-side, then N-API layer, then C++, then back). FFmpeg integration was worse — either I shipped `ffmpeg-static` (300+ MB download) or I asked users to install FFmpeg themselves (bad UX).

Mid-2024, I rewrote the entire app in **Tauri v2**. The Rust side handles all the "real work" (recording, FFmpeg, file IO, window management), and React handles the UI. It was painful — I had to rewrite the mouse tracker, the recorder, and the export pipeline from scratch — but the result speaks for itself. The binary dropped from ~280 MB to ~80 MB. Startup went from "noticeable" to "instant." And I stopped spending debugging time on N-API glue.

**Takeaway**: if your app does serious native work, Tauri v2 is worth the upfront Rust learning curve. If it's pure UI-over-API, Electron is fine.

### 2. The zoom algorithm is not AI

Everyone assumes it is. It's not.

The auto-zoom is a deterministic **focus score** computed from cursor position, velocity, click events, and dwell time. At each frame, Flowtake computes a score representing how "focused" the user is on a particular region of the screen. Peaks in this score become zoom keyframes. Valleys become pan-out moments.

The math is closer to peak detection than machine learning. The whole thing runs in maybe 10ms per minute of video, offline.

I tried using actual ML (a small CNN trained on click positions + saliency maps) early in the project. It was worse. Deterministic + tunable beat "smart + opaque" every time.

**Takeaway**: if you can solve it with math, don't use ML. Users can't tune ML models; they can tune focus scores.

### 3. Cursor smoothing matters more than zooms

I spent weeks on the zoom algorithm before I touched cursor rendering. That was backwards.

The single biggest perceptual improvement in the whole app came from adding velocity-based cursor inertia and motion blur scaled by speed. Slow movements stop looking robotic. Fast movements stop looking like choppy screen captures — the blur hides the low frame rate. It's the kind of polish you don't notice... until you see a recording without it, and then it looks wrong.

If you're building anything in this category, do the cursor layer first, not the camera layer.

### 4. Wayland is the hardest thing I've touched

Windows DXGI and macOS ScreenCaptureKit are clean, modern APIs. You get frames, you get timestamps, you get cursor events separately. Easy.

Linux? Screen recording on Wayland goes through `xdg-desktop-portal`, which forwards your request to a compositor-specific implementation via DBus. On GNOME it works. On KDE there are cursor-tracking edge cases I still haven't fully solved. X11 works but is legacy. There's no stable cross-compositor API that handles cursors reliably yet.

If anyone reading this has shipped a clean Wayland recorder that handles cursor events across compositors, please open an issue — I'll buy you a coffee.

### 5. FFmpeg sidecar, not bindings

I tried `ffmpeg-next` (the libav Rust bindings) early on. The build complexity (linking against system FFmpeg, licensing mess with GPL vs LGPL builds, cross-compilation pain) wasn't worth it for the marginal gain.

Instead, Flowtake ships FFmpeg as a **Tauri sidecar** — a separate binary invoked via stdin/stdout. The CI builds download the right platform-specific FFmpeg binary and Tauri bundles it into the installer. The Rust code just spawns FFmpeg with arguments and parses the progress output.

Downside: parsing FFmpeg's stderr progress lines is fragile. If I rewrote this, I'd use `-progress pipe:2` to get structured output.

### 6. Multi-window Tauri is powerful but tricky

Flowtake has six windows: main editor, recorder overlay, exporter, window picker, area picker, and a note window. Each has its own Vite entry point and its own React tree. Shared state goes through the Rust side via Tauri commands.

The pattern that ended up working:

```rust
// src-tauri/src/commands/state.rs
#[tauri::command]
async fn get_shared_state(state: State<'_, AppState>) -> Result<StateSnapshot, String> {
    Ok(state.snapshot())
}
```

```js
// app/shared/tauriBridge.js
export async function getSharedState() {
  return await invoke("get_shared_state");
}
```

Each window subscribes to events (`listen("state_changed", ...)`) when state updates, and Redux reconciles. It's a little like the "sync store" pattern from CRDTs, but for local IPC.

If you're building a multi-window Tauri app, put your shared state in Rust, not in the frontend. Windows come and go; the state should outlive them.

## What's next

- **Wayland cursor fixes** — the biggest open bug
- **Stable macOS + Linux** — targeted for v2.0
- **Plugin system** — so people can write their own auto-zoom algorithms or export presets
- **AI-powered editing suggestions** — maybe (see point 2 about ML skepticism)
- **Collaborative editing** — unlikely, but people keep asking

## Try it

If you want to try Flowtake:

- **Download**: [github.com/JNX03/Flowtake/releases/latest](https://github.com/JNX03/Flowtake/releases/latest)
- **Source**: [github.com/JNX03/Flowtake](https://github.com/JNX03/Flowtake)
- **Issues / feedback**: [github.com/JNX03/Flowtake/issues](https://github.com/JNX03/Flowtake/issues)

Windows is stable. macOS and Linux are dev preview — expect bugs, PRs very welcome.

If you read this far, thanks. This is the first time I've shown Flowtake to anyone outside my own laptop, so a star on the repo (or just trying it and telling me what's broken) means a lot.
```

---

## Cross-posting targets
1. **Dev.to** — primary (set as canonical)
2. **Hashnode** — cross-post 24h later with canonical URL → Dev.to
3. **Medium** — cross-post 48h later with canonical URL → Dev.to
4. **Reddit r/programming** — link to the Dev.to post (not the GitHub), 24h after Dev.to publishes

## Hashtag notes
- Dev.to limits to 4 tags. Pick the ones that drive traffic: `opensource`, `rust`, `tauri`, `showdev` are the strongest.
- Avoid `webdev` / `javascript` tags even though React is involved — they're noisy and not the target audience.
