# r/tauri post draft

> **Draft only — not posted.** This copy targets v1.7.2. Publish only after the
> exact v1.7.2 artifacts, privacy-reviewed demo, and live links are verified;
> recheck all three immediately before posting.

## Title

```text
[Showcase] Flowtake — a free screen recorder with MIT-licensed Tauri app code
```

## Body

```text
Sharing Flowtake, a free desktop screen recorder and timeline editor built with Tauri, Rust, React, PixiJS, and Mediabunny. It uses a separately installed system FFmpeg for capture and audio processing.

Flowtake uses separate native windows for recording and editing workflows. It can capture a display, window, or custom area, derive editable zoom and pan motion from cursor activity, and provide timeline controls for trims, splits, cursor effects, masks, backgrounds, overlays, audio, and subtitles.

The release linked here includes adaptive preview and camera-capture profiles, plus local H.264/MP4 and VP9/WebM export. When recorded or timeline audio is present and enabled, it is mixed and muxed into the result. A lighter editor preview does not change the selected export dimensions.

The repository also contains a local stdio MCP for AI-assisted timeline metadata edits. This first version is a source-checkout/Node.js 20+ developer integration rather than a bundled desktop component. It reuses the editor's command planner and adds dry-run, revision, backup, closed-app, and post-write verification guards. It cannot inspect pixels/audio, render, export, upload, or drive the app UI.

Windows is the primary development and validation target. macOS and Linux builds are previews. Linux capture currently requires X11 or XWayland; pure Wayland capture is not supported.

Flowtake is one free product with MIT-licensed app code and no paid Studio mode, app tier, or export paywall. Flowtake packages do not include an FFmpeg executable; install a compatible system FFmpeg separately before recording or exporting.

Source and verified downloads: https://github.com/JNX03/Flowtake
Tauri architecture feedback and reproducible platform reports are welcome.
```

## Publication checks

- Reconfirm the exact Tauri/frontend/media stack from the release lockfiles.
- Do not add component counts, commit counts, binary sizes, startup-time gains,
  or cross-platform parity claims without current evidence.
- Demo only public or synthetic content from a clean profile; remove names,
  notifications, accounts, tokens, private URLs, local paths, and personal
  location.
