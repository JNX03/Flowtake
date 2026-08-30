# r/opensource post draft

**Subreddit**: r/opensource
**Flair**: "Showcase" or "Project Release"
**Rules check**: Must be FOSS. Must include source link, not just binary. MIT qualifies. Post must describe the project, not just link.

---

## Title
```
Flowtake — a free, MIT-licensed screen recorder with auto-zoom animations (Tauri + Rust + React)
```

## URL
```
https://github.com/JNX03/Flowtake
```

## Body (required for this sub)

```
Hi r/opensource — releasing Flowtake, a desktop screen recorder I've been building and maintaining as an open-source side project for the last two years.

**The problem**: Polished screen recordings (the kind you see in product demos) usually require manual keyframing in Final Cut or Premiere, or a paid tool like Screen Studio ($229, macOS only). I wanted the same result for free, on any OS, and without vendor lock-in.

**What Flowtake does**:
- Records your screen + camera + audio
- Automatically adds smooth zoom and pan animations around your cursor (deterministic, not ML — focus-score algorithm over cursor position, velocity, click events, and dwell)
- Velocity-based cursor inertia with motion blur scaled by speed
- Full timeline editor: clips, overlays, audio tracks, subtitles (with speech recognition), masks + blur, custom backgrounds, intro/outro transitions
- Built-in teleprompter with speech-sync
- Exports via bundled FFmpeg — configurable quality, format, encoder
- Saves everything as local projects, no cloud

**License**: MIT — fork it, commercialize it, do whatever. No telemetry, no analytics, no network calls unless you opt in.

**Stack**:
- Tauri v2 (Rust) for the native shell and recording layer
- React 19 + Redux Toolkit for the UI
- Pixi.js 8 (WebGL) for the timeline preview renderer
- FFmpeg (bundled sidecar) for encode
- HuggingFace Transformers + MediaPipe for local speech recognition (teleprompter, subtitles)

**Status**:
- Windows x64: stable, daily-driver quality, 367 commits, v1.4.2 out now
- macOS (Universal): developer preview — works but has bugs
- Linux x64: developer preview — Wayland is the main pain point
- Stable support for all three is targeted for v2.0

**Why I'm posting here**: It's open source and needs contributors and users more than anything else. Issues, PRs, bug reports, translation help, and platform-specific fixes for macOS and Linux are all welcome. The Wayland cursor tracking edge cases in particular are beyond what I can test alone.

Download: https://github.com/JNX03/Flowtake/releases/latest
Source + issues: https://github.com/JNX03/Flowtake

Ask me anything.
```

---

## Pitfalls
- DO include the MIT license label prominently — the sub cares
- DO explain the architecture honestly — they'll ask
- DON'T pitch it as "alternative to X" without explaining why OSS matters
- DON'T hide the dev-preview status of mac/linux — transparency earns goodwill here
