# r/opensource post draft

> **Draft only — not posted.** This copy targets v1.7.1. Publish only after the
> exact v1.7.1 artifacts, privacy-reviewed demo, and live links are verified;
> recheck all three immediately before posting.

## Title

```text
Flowtake — a free screen recorder and timeline editor with MIT-licensed app code
```

## Body

```text
Hi r/opensource — I maintain Flowtake, a desktop screen recorder and editor whose application code is released under the MIT License.

Flowtake can capture a display, selected window, or custom area and turn cursor activity into editable zoom and pan motion. Its timeline supports trim and split operations, cursor and click effects, masks, backgrounds, overlays, audio, and subtitles. The release linked below includes local H.264/MP4 and VP9/WebM export, with recorded and timeline audio mixed when present and enabled.

The app now has adaptive preview and camera-capture profiles for constrained hardware. The selected export dimensions do not change. This is a resource policy rather than a promise of equal performance on every device.

Flowtake is local-first, not network-free. Ordinary capture, project editing, and export do not require cloud project sync. Release checks and explicitly selected upload, streaming, or model-backed features can use the network.

The repository also includes an optional local stdio MCP for AI-assisted timeline metadata editing. It is currently a developer integration requiring a source checkout and Node.js 20+. It supports revision-checked, backup-backed split, trim, delete, and caption edits. It does not inspect pixels or audio, render, export, upload, or control the desktop app. Flowtake must be closed for durable writes, and the MCP host or model may receive requested tool results.

There is one free product with MIT-licensed app code: no paid app tier, paid Studio mode, export paywall, checkout, or private-footage intake service. Flowtake packages do not include an FFmpeg executable; install a compatible system FFmpeg separately before recording or exporting.

Windows is the primary development target. macOS and Linux builds are previews, and pure Wayland capture is not supported.

Source and verified downloads: https://github.com/JNX03/Flowtake
Issues and focused pull requests are welcome. Please include the OS, Flowtake release, capture source, and exact reproduction steps with bug reports.
```

## Media boundary

If the community allows media, use an exact-release demo recorded in a clean
profile with a neutral synthetic document and a public map of a well-known
landmark. Remove notifications, accounts, names, tokens, private URLs, local
paths, and personal location before posting.
