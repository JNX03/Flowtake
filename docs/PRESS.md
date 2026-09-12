# Flowtake press kit — v1.7.0

Last factual review: September 12, 2026, against Flowtake v1.7.0.

The repository-root [press kit](../PRESS.md) remains the canonical source for
release facts and publication gates.

## One-line description

Flowtake is a free, MIT-licensed desktop screen recorder and timeline editor
with cursor-driven zoom, local project storage, and local video export.

## Short description

Flowtake records a display, window, or custom area and turns cursor activity
into editable zoom and pan motion. Its timeline supports trimming, splitting,
cursor effects, masks, backgrounds, overlays, audio, and subtitles. Windows is
the primary development target; macOS and Linux builds are previews.

## v1.7.0 highlights

Flowtake v1.7.0 adds:

- adaptive preview and camera-capture profiles for constrained hardware, while
  leaving screen-capture source and selected export dimensions unchanged;
- H.264/MP4 and VP9/WebM export, with recorded and timeline audio mixed when it
  is present and enabled;
- revision-aware saves and durable, staged archive replacement during close;
- clearer source confirmation before capture and a simpler responsive editor
  toolbar; and
- a free local MCP server for guarded, AI-assisted timeline metadata edits.

Recheck these capabilities against the exact release artifact before reusing
this section in external copy.

## Product facts

| Item | Approved wording |
|---|---|
| License and price | One MIT-licensed product; no paid app tier, paid Studio mode, export paywall, checkout, or private-footage intake service |
| Primary platform | Windows 10/11 x64 |
| Preview platforms | macOS 10.15+ Universal and Linux x64 |
| Linux capture boundary | X11 or XWayland; pure Wayland capture is not supported |
| Windows signing | Not Authenticode-signed |
| macOS signing | Ad-hoc signed; not Developer ID signed or notarized |
| Source | https://github.com/JNX03/Flowtake |
| Releases | https://github.com/JNX03/Flowtake/releases |

## Privacy and network boundary

Flowtake is local-first, not network-free. Ordinary capture, project editing,
and export do not require cloud project sync. The app can check GitHub for
releases. YouTube upload, RTMP streaming, and some model-backed camera effects
are explicit network features and can send data to the service the user
chooses.

The local MCP server has no HTTP transport or upload code, but the configured
MCP host and model may receive its tool results. Project names and caption text
are omitted unless requested. The MCP currently requires a source checkout and
Node.js 20+, edits project metadata rather than media pixels or audio, requires
Flowtake to be closed for durable writes, and does not render, export, upload,
or control the desktop UI. See [the MCP guide](../mcp/README.md).

## Claims to avoid

Do not claim that Flowtake:

- is stable, supported, or feature-identical on every operating system;
- supports pure Wayland capture;
- is offline-only, network-free, telemetry-proof, or independently privacy
  audited;
- is smaller, faster, lower-memory, or higher-quality than another product
  without a reproducible benchmark;
- supports every codec, format, source, or workflow; or
- has feature parity with a named commercial editor.

Do not publish a release version, commit count, binary-size claim, performance
number, or platform matrix copied from an older draft.

## Approved demo boundary

Use only a clean Flowtake profile and public or synthetic material: for example,
a neutral local document and a public map of a well-known landmark. Keep camera
and microphone off unless synthetic input is intentional. Before publishing,
inspect every frame for names, notifications, accounts, tokens, private URLs,
local paths, precise personal location, and unrelated applications. Review the
export from the exact released build.

## Assets

- `app/shared/assets/logo.svg`
- `website/public/assets/logo.png`
- `src-tauri/icons/`

No product screenshot or demo video is approved merely because it exists in a
local artifact folder.
