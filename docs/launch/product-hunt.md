# Product Hunt launch draft

> **Draft only — not posted.** This copy targets v1.7.1. Use it only after the
> exact v1.7.1 artifacts, privacy-reviewed demo, and live links are verified;
> recheck all three immediately before posting.

## Name

```text
Flowtake
```

## Tagline

```text
Free, open-source screen recording with an editable timeline
```

## Description

```text
Flowtake records a display, window, or custom area and turns cursor activity into editable zoom and pan motion. Trim and split clips, tune cursor effects, add masks, backgrounds, overlays, audio, and subtitles, then export locally.

Windows is the primary development target. macOS and Linux builds are previews; pure Wayland capture is not supported. Flowtake is one free product with MIT-licensed app code and no paid Studio mode, app tier, or export paywall. Flowtake packages do not include an FFmpeg executable; install a compatible system FFmpeg separately before recording or exporting.
```

## Maker comment

```text
I built Flowtake to make polished technical demos easier to create in one desktop app.

The release linked here includes adaptive preview and camera-capture profiles, while leaving screen-capture source and selected export dimensions unchanged, plus local H.264/MP4 and VP9/WebM export and optional audio mixing when sources are present and enabled. Ordinary capture, editing, and export do not require cloud project sync. Flowtake is local-first, not network-free: update checks and explicitly chosen upload, streaming, or model-backed features can use the network.

Developers can also run an optional local stdio MCP from a source checkout. It makes revision-checked, backup-backed timeline metadata edits such as split, trim, delete, and caption changes. It does not analyze footage or audio, render, export, upload, or control the app. Flowtake must be closed for durable MCP writes, and the configured MCP host or model may receive requested tool results.

I would especially value reproducible feedback about capture sources, timeline usability, and preview performance. Please include your OS and release version in bug reports.
```

## Media plan

- Hero clip: a clean profile recording a neutral synthetic document and a
  public map of a well-known landmark.
- Show source selection, a short capture, one timeline trim, one caption, and a
  local export.
- Keep camera and microphone off unless they use deliberate synthetic input.
- Inspect the final asset frame by frame for notifications, accounts, names,
  tokens, private URLs, local paths, and personal location.

## Before publishing

- Verify the exact release artifacts on every platform named in the post.
- Confirm the demo was exported by that release, not an unlabelled source build.
- Do not add old version numbers, commit counts, binary sizes, commercial prices,
  or unsupported speed/memory comparisons.
