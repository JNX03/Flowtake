# Product Hunt launch draft

**Submit at**: https://www.producthunt.com/posts/new
**Launch day**: Monday (any Monday — post at 00:01 PT for a full 24h window)
**Category**: Design Tools / Developer Tools
**Topics**: Screen recording, Video editing, Open source, Developer tools

---

## Name
```
Flowtake
```

## Tagline (60 char max — current: 58)
```
Open-source screen recorder with automatic zoom animations
```

## Description (260 char max — current: 256)
```
Flowtake is a free, open-source desktop screen recorder that automatically animates your recordings with cinematic zoom and pan effects — like Screen Studio, but free, local, and cross-platform. Built with Tauri v2 for a lightweight native experience.
```

## Links
- **Website**: https://github.com/JNX03/Flowtake
- **Download (Windows)**: https://github.com/JNX03/Flowtake/releases/latest
- **Source**: https://github.com/JNX03/Flowtake

## Topics to tag
- Screen Recording
- Video Editing
- Open Source
- Developer Tools
- Design Tools
- Productivity

## Gallery (upload order)
1. `demo.gif` — 15-30s hero GIF showing the full flow: record → auto-zoom kicks in → export (this is THE thumbnail)
2. `screenshot-editor.png` — Full timeline editor with clips + effects
3. `screenshot-recording.png` — Recording overlay with camera + area picker
4. `screenshot-effects.png` — Effects panel showing masks/blur/backgrounds
5. `demo-auto-zoom.gif` — 8s close-up of the auto-zoom moment
6. `screenshot-teleprompter.png` — Unique feature (teleprompter)

## Gallery captions
1. "Record, and Flowtake automatically animates the rest."
2. "Full timeline editor — clips, effects, overlays, subtitles."
3. "Native recorder with area picker, camera overlay, system audio."
4. "Masks, blur, custom backgrounds. Redact anything."
5. "Velocity-based cursor smoothing. Zoom follows your focus."
6. "Built-in teleprompter with speech recognition sync."

---

## First comment (maker intro) — post immediately after going live

```
Hi PH 👋 — Jnx03 here, maker of Flowtake.

I started Flowtake two years ago because I wanted Screen Studio's polish without paying $229 or being locked to macOS. 367 commits later, it's free, MIT-licensed, and runs on Windows / macOS / Linux.

What it does:
• Records your screen, then automatically adds zoom + pan animations that follow your cursor
• Smooths cursor motion with velocity-based inertia and motion blur
• Ships with a full timeline editor: clips, overlays, audio tracks, subtitles, masks
• Has a built-in teleprompter (with speech-sync — I haven't seen this anywhere else)
• Runs 100% locally — no cloud, no account, no upload

Built with Tauri v2 (Rust) + React, so the binary is ~80 MB, not 300 MB like Electron apps. FFmpeg is bundled so there's nothing extra to install.

Windows is the primary stable platform. macOS and Linux builds exist but are still a developer preview — stable support is on the roadmap for v2.0. If you hit bugs on those platforms, issues and PRs are very welcome.

Happy to answer anything — and honestly, if there's a feature you wish Screen Studio / Loom had, please tell me, I want to add it.

Download: https://github.com/JNX03/Flowtake/releases/latest
Source: https://github.com/JNX03/Flowtake
```

---

## Pre-launch warm-up checklist (do 48h before)
- [ ] Tweet a teaser: "Launching on Product Hunt Monday — Flowtake, open-source Screen Studio alternative. [GIF]. Reply / DM to get notified."
- [ ] Post in IndieHackers "Launching soon" thread
- [ ] DM 5-10 friends asking for day-of support (not upvote farming — genuine early traction)
- [ ] Make sure README and landing page are live
- [ ] Make sure v1.4.2 release is downloadable and `releases/latest` works
- [ ] Test download + install on a clean machine

## Launch day checklist (00:01 PT)
- [ ] Submit the post
- [ ] Post first comment immediately
- [ ] Share the PH URL in the Twitter launch thread (see `twitter-launch-thread.md`)
- [ ] Reply to every comment — fast
- [ ] Pin the PH link in your Twitter/GitHub profile for the day
- [ ] If a bug is reported, fix it same-day and comment back

## Response templates

**"How is this different from Screen Studio?"**
> Three things: (1) it's free and open source, (2) it runs on Windows/Linux not just macOS, (3) it has a built-in teleprompter and masks for redaction. Screen Studio is a beautiful product and I used it as inspiration — Flowtake is the cross-platform free alternative.

**"Why Tauri and not Electron?"**
> Smaller binary (~80 MB vs 300 MB+), faster startup, lower memory usage, and native OS integration. Tauri uses the system webview so it ships a lot less.

**"Does it work on macOS / Linux?"**
> Builds exist for both — you can download the .dmg or .AppImage from the releases page — but they're a developer preview. Expect rough edges. Stable support for both is targeted for v2.0.

**"Is the auto-zoom AI?"**
> No, it's deterministic. It analyzes cursor position and velocity, detects focus moments (click events, pauses, UI interactions), and zooms smoothly into them. That means it's fast, local, and predictable — no API calls, no wait.
