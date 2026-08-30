# Twitter / X launch thread

**Post timing**: Same day as Product Hunt launch, ~9:00 AM PT
**Hashtags (thread-level, use sparingly)**: #buildinpublic #opensource #tauri #rustlang
**Total tweets**: 10 (1 hook + 8 feature tweets + 1 CTA)

---

## Tweet 1 — HOOK + HERO GIF

```
I just open-sourced Flowtake — a free, cross-platform Screen Studio alternative.

It automatically adds cinematic zoom + pan animations to your screen recordings.

2 years. 367 commits. 100% local, no cloud.

🧵👇
```
📎 Attach: `demo.gif` (the 15-30s hero showing record → auto-zoom → export)

---

## Tweet 2 — THE PROBLEM

```
Screen recordings are usually either:

• Raw and boring (OBS, QuickTime)
• Cloud-locked and paid (Loom)
• Beautiful but $229 and macOS-only (Screen Studio)

I wanted: beautiful, free, local, and on every OS.

So I built it.
```

---

## Tweet 3 — AUTO-ZOOM + GIF

```
The core magic: Flowtake analyzes your cursor position, velocity, click events, and dwell time — then places smooth zoom keyframes around your focus points automatically.

It's deterministic, not AI. Runs instantly, offline.
```
📎 Attach: `demo-auto-zoom.gif` (8s close-up of the auto-zoom moment)

---

## Tweet 4 — CURSOR MOTION

```
Detail that took months: cursor motion.

Velocity-based inertia + motion blur scaled by speed.

Slow movements don't look robotic. Fast movements feel buttery because the blur hides the low frame rate of raw captures.

It's the kind of polish you don't notice — until it's gone.
```
📎 Attach: Side-by-side GIF (before/after cursor smoothing)

---

## Tweet 5 — FULL EDITOR

```
But it's not just a recorder. Flowtake ships with a full timeline editor:

• Clips + trim + split
• Overlays (images, shapes, animations)
• Audio tracks
• Subtitles with local speech recognition
• Masks + blur for redaction
• Custom backgrounds + intro/outro

Everything on-device.
```
📎 Attach: `screenshot-editor.png`

---

## Tweet 6 — UNIQUE FEATURE

```
And one thing I haven't seen anywhere else: a built-in teleprompter with speech sync.

Narrate your demo naturally, Flowtake scrolls the script to match your voice, and auto-generates captions from the same pass.

One feature, three wins.
```
📎 Attach: `screenshot-teleprompter.png`

---

## Tweet 7 — TECH STACK

```
Stack nerds:

• Tauri v2 (Rust) → native shell, recording, FFmpeg sidecar
• React 19 + Redux Toolkit → UI state
• Pixi.js 8 → WebGL-accelerated preview renderer
• MediaPipe + HuggingFace → on-device speech recognition
• FFmpeg (bundled) → export

Binary: ~80 MB. Startup: fast. Electron: gone.
```

---

## Tweet 8 — PRICING

```
How much does it cost?

$0.

Forever. No subscription. No upgrade. No "pro tier." No telemetry. No cloud account. No upload.

MIT licensed. Fork it, commercialize it, do whatever.

The goal was to make this quality of screen recording free for everyone.
```

---

## Tweet 9 — HONESTY

```
Honesty notes:

✅ Windows is stable. 367 commits of iteration.
⚠️ macOS + Linux work but are dev preview — expect rough edges.
🎯 v2.0 target: full stable on all three platforms.

If you hit a bug, issues and PRs are genuinely welcome.

Wayland support specifically needs help 🙏
```

---

## Tweet 10 — CTA

```
Flowtake v1.4.2 is out now.

⬇️ Download: github.com/JNX03/Flowtake/releases/latest
⭐ Source: github.com/JNX03/Flowtake

If this could be useful to you, a star or a retweet would mean a lot — it's the first time I've shown this to anyone outside my laptop.

Thanks for reading 🙏
```

---

## Post-thread actions
- Pin the thread to your profile for 7 days
- Tag @tauri_apps, @rustlang (sparingly — only if relevant to specific tweets)
- DO NOT tag Screen Studio / Loom accounts (looks petty)
- Reply to the first 5-10 replies within 30 min for algorithm boost
- Quote-tweet with a new feature GIF every 24h for the next week to stay on feed

## Variants for single-tweet announcement (non-thread)

**Short**:
```
Flowtake is out — free, open-source Screen Studio alternative.

Runs on Windows, Mac, Linux.
100% local, no cloud.
Built with Tauri + Rust + React.

github.com/JNX03/Flowtake
```

**Ultra-short** (for replies, reposts):
```
Free, open-source Screen Studio alternative.
Auto-zoom, no cloud, cross-platform.
github.com/JNX03/Flowtake
```
