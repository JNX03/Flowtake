# X / Twitter launch thread draft

> **Draft only — not posted.** This copy targets v1.7.1. Publish only after the
> exact v1.7.1 artifacts, privacy-reviewed demo, and live links are verified;
> recheck all three immediately before posting.

## Post 1 — introduction

```text
Meet Flowtake: a free desktop screen recorder and timeline editor with MIT-licensed application code.

Capture a display, window, or area, then turn cursor activity into editable zoom and pan motion.

One open-source product. No paid Studio mode or export paywall. 🧵
```

Attach only a privacy-reviewed demo made with the exact released build.

## Post 2 — editing

```text
The editor keeps the core workflow in one place:

• trim and split clips
• tune cursor and click effects
• add masks, backgrounds, overlays, audio, and subtitles
• export locally as MP4 or WebM

Audio is included when it is present and enabled.
```

## Post 3 — adaptive performance

```text
The new Device performance setting can favor efficiency, balance, or quality.

Auto mode chooses lighter preview and camera-capture profiles on constrained hardware. Your selected export dimensions stay unchanged.

It is an adaptive policy, not a promise that every device or workflow will perform the same.
```

## Post 4 — privacy boundary

```text
Flowtake is local-first, not network-free.

Ordinary capture, project editing, and export do not require cloud project sync. Release checks and explicitly selected upload, streaming, or model-backed features can use the network.
```

## Post 5 — local MCP

```text
There is also an optional local stdio MCP for AI-assisted timeline metadata edits.

It supports guarded split, trim, delete, and caption changes with dry runs, revisions, backups, and closed-app write checks.

It does not inspect pixels/audio, render, export, upload, or control the app.
```

Add in a reply if useful:

```text
The MCP is currently a developer integration: clone the source, install dependencies with Node.js 20+, and configure a local projects directory. Your MCP host/model may receive the tool results you request.
```

## Post 6 — platform status and link

```text
Windows is Flowtake's primary development target. macOS and Linux builds are previews; Linux capture requires X11 or XWayland rather than pure Wayland.

Flowtake packages do not include an FFmpeg executable. Install a compatible system FFmpeg separately before recording or exporting.

Download, source, and issue tracker:
github.com/JNX03/Flowtake
```

## Demo checklist

- Use a clean profile, a neutral synthetic document, and a public map of a
  well-known landmark.
- Keep camera and microphone off unless synthetic input is intentional.
- Remove notifications, names, accounts, tokens, private URLs, local paths, and
  personal location from every frame.
- Do not add old version numbers, commit counts, binary sizes, commercial
  prices, or unverified performance comparisons.
