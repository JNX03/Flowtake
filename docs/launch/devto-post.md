---
title: "Flowtake: a free, open-source recorder and timeline editor"
published: false
description: "How Flowtake turns cursor activity into editable screen-recording motion"
tags: opensource, tauri, rust, react
---

> **Draft only — not posted.** This copy targets v1.7.2. Publish only after the
> exact v1.7.2 artifacts, privacy-reviewed demo, and live links are verified;
> recheck all three immediately before posting.

# Flowtake: a free, open-source recorder and timeline editor

Flowtake is a desktop screen recorder and editor whose application code is released under the MIT License.
It captures a display, window, or custom area, derives editable zoom and pan
motion from cursor activity, and keeps the rest of the workflow on a timeline.

The timeline supports trimming and splitting, cursor and click effects, masks,
backgrounds, overlays, audio, and subtitles. Flowtake v1.7.2 can export
H.264/MP4 or VP9/WebM locally and mix recorded or timeline audio when it is
present and enabled.

## Adaptive without changing the export target

Flowtake v1.7.2 includes a Device performance setting with Auto,
Efficiency, Balanced, and Quality modes. Auto can lower preview and camera
capture profiles on constrained hardware. The selected export dimensions stay
unchanged. This is a resource policy, not a claim that every device will have
identical performance or quality.

## Local-first, with explicit network boundaries

Ordinary capture, project editing, and export do not require cloud project sync.
Flowtake is not network-free: it can check GitHub for releases, and explicitly
selected YouTube upload, RTMP streaming, or model-backed camera effects can send
data to the configured service.

## AI-assisted metadata editing through MCP

The repository also includes an optional local stdio Model Context Protocol
server. It is currently a developer integration that requires a source checkout
and Node.js 20+. It can list projects, read bounded timeline metadata, and make
revision-checked, backup-backed split, trim, delete, and caption edits.

The MCP does not inspect video pixels, listen to audio, generate transcripts,
render, export, upload, or control the desktop app. Flowtake must be closed for
durable writes. Although the server has no HTTP transport or upload code, the
configured MCP host and model may receive the tool results requested from it.

## Platform scope and licensing

Windows 10/11 x64 is the primary development and validation target. macOS
Universal and Linux x64 builds are previews. Linux screen capture requires X11
or XWayland; pure Wayland capture is not supported.

Flowtake is one free product with MIT-licensed app code. There is no paid app
tier, paid Studio mode, export paywall, checkout, or private-footage intake
service. Flowtake packages do not include an FFmpeg executable; install a
compatible system FFmpeg separately before recording or exporting.

Source and verified downloads: https://github.com/JNX03/Flowtake

## Demo note for the final article

Use an exact-release capture from a clean profile with a neutral synthetic
document and a public map of a well-known landmark. Keep camera and microphone
off unless synthetic input is intentional. Inspect the finished media for
notifications, names, accounts, tokens, private URLs, local paths, and personal
location before publishing.
