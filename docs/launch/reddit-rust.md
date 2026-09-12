# r/rust post draft

> **Draft only — not posted.** This copy targets v1.7.2. Publish only after the
> exact v1.7.2 artifacts, privacy-reviewed demo, and live links are verified;
> recheck all three immediately before posting.

## Title

```text
Flowtake: a free screen recorder with MIT-licensed Tauri and Rust app code
```

## Body

```text
I've been working on Flowtake, a free desktop screen recorder and timeline editor built with Tauri, Rust, React, PixiJS, and Mediabunny. It uses a separately installed system FFmpeg for capture and audio processing.

The native side handles operating-system capture and local project/export integration, while the frontend provides the recorder and timeline UI. Flowtake can capture a display, window, or custom area, derive editable zoom and pan motion from cursor activity, and edit trims, splits, effects, masks, backgrounds, overlays, audio, and subtitles.

The release linked here includes adaptive preview/camera-capture profiles and local H.264/MP4 or VP9/WebM export. Recorded and timeline audio can be mixed into the export when it is present and enabled. The selected export dimensions stay independent of a lighter preview profile.

The repository also has a local stdio MCP for guarded AI-assisted timeline metadata edits. It reuses Flowtake's edit planner and adds dry-run, revision, closed-app, serialized-write, backup, and verification guards. It is a Node.js 20+ developer integration, not a Rust-native or bundled desktop service. It cannot inspect video or audio, render, export, upload, or operate the UI.

Windows is the primary validation target. macOS and Linux builds are previews; Linux capture requires X11 or XWayland rather than pure Wayland.

Flowtake application code is MIT licensed, with no paid Studio mode, app tier, or export paywall. Flowtake packages do not include an FFmpeg executable; install a compatible system FFmpeg separately before recording or exporting.

Source and verified downloads: https://github.com/JNX03/Flowtake
Architecture feedback and reproducible platform reports are welcome.
```

## Claims intentionally omitted

Do not add binary-size, startup-time, memory, benchmark, exact component-count,
commit-count, API-superiority, or cross-platform parity claims without current
reproducible evidence.
