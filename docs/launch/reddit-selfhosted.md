# r/selfhosted post draft

> **Draft only — not posted.** This copy targets v1.7.1. Flowtake is a local
> desktop application, not a self-hosted server, so check the community rules.
> Use this only after the exact v1.7.1 artifacts, privacy-reviewed demo, and
> live links are verified; recheck all three immediately before posting.

## Title

```text
Flowtake — a free local-first screen recorder and editor with MIT app code
```

## Body

```text
Flowtake is not a server you deploy, so it may sit at the edge of this community's scope. It is a free, open-source desktop recorder and timeline editor for people who prefer local project storage and local export.

It can record a display, window, or custom area, generate editable cursor-driven zoom and pan motion, and edit trims, splits, masks, backgrounds, overlays, audio, and subtitles. The release linked below includes local MP4 or WebM export, with recorded/timeline audio included when present and enabled.

The privacy boundary is local-first rather than network-free. Ordinary capture, project editing, and export do not require cloud project sync. The app can check GitHub for releases. YouTube upload, RTMP streaming, and some model-backed effects are explicit network features and can send data to the service the user selects.

Developers can optionally run a local stdio MCP from a source checkout. It makes guarded timeline metadata edits but does not inspect media pixels or audio, render, export, upload, or control the app. The MCP host or model may receive requested project metadata, so users should choose a provider that matches their privacy needs. Durable writes require Flowtake to be closed and create backups first.

Windows is the primary development target. macOS and Linux builds are previews; pure Wayland capture is not supported.

There is one free product with MIT-licensed app code and no paid Studio mode, app tier, or export paywall. Flowtake packages do not include an FFmpeg executable; install a compatible system FFmpeg separately before recording or exporting.

Source and verified downloads: https://github.com/JNX03/Flowtake
```

## Posting boundary

- Do not describe Flowtake as 100% local, offline-only, telemetry-proof, or
  having no network calls.
- Do not imply that the MCP is a hosted service or that it edits/analyzes the
  video itself.
- Use a clean profile and public or synthetic demo material only. Remove
  notifications, names, accounts, tokens, private URLs, local paths, and
  personal location from the asset.
