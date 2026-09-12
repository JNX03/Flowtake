# r/SideProject post draft

> **Draft only — not posted.** This copy targets v1.7.2. Publish only after the
> exact v1.7.2 artifacts, privacy-reviewed demo, and live links are verified;
> recheck all three immediately before posting.

## Title

```text
I built Flowtake, a free open-source screen recorder with an editable timeline
```

## Body

```text
Flowtake is a free desktop recorder and editor with MIT-licensed application code for making product and technical demos.

Choose a display, window, or custom area, record, and Flowtake turns cursor activity into editable zoom and pan motion. The timeline also supports trims, splits, cursor and click effects, masks, backgrounds, overlays, audio, and subtitles.

The release linked here adds adaptive preview and camera-capture profiles for constrained hardware while leaving the selected export dimensions unchanged. It exports locally as MP4 or WebM and can include recorded/timeline audio when it is present and enabled.

There is also an optional developer MCP for AI-assisted timeline metadata edits. It runs over local stdio from a source checkout, uses revisions, dry runs, backups, and closed-app write checks, and supports split, trim, delete, and caption changes. It does not watch or listen to the recording, render, export, upload, or control the app. The configured MCP host/model may receive requested tool results.

Flowtake is local-first, not network-free. Ordinary capture, editing, and export do not require cloud project sync; update checks and explicitly selected upload, streaming, or model-backed features can use the network.

Windows is the primary development target. macOS and Linux builds are previews, and pure Wayland capture is not supported.

There is one open-source product: no paid Studio mode, app tier, or export paywall. Flowtake packages do not include an FFmpeg executable; install a compatible system FFmpeg separately before recording or exporting.

Source and verified downloads: https://github.com/JNX03/Flowtake

I would value feedback on the source-selection flow, timeline clarity, and how the adaptive preview behaves on your hardware. Reproducible issue reports are especially useful.
```

## Demo plan

Show a clean profile capturing a neutral synthetic document and a public map of
a well-known landmark. Keep camera and microphone off unless synthetic input is
intentional. Inspect every frame for notifications, names, accounts, tokens,
private URLs, local paths, and personal location before posting.
