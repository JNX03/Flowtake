# Flowtake press kit — v1.7.2

Last factual review: September 12, 2026, against Flowtake v1.7.2.

This page contains approved factual language for articles, directories,
package descriptions, and community posts. Verify the exact build on the
[release page](https://github.com/JNX03/Flowtake/releases) before reusing
version-specific details.

## One-line description

Flowtake is a free, local-first desktop screen recorder with MIT-licensed application code and a
timeline editor for creating developer demos with cursor-driven zoom and local
H.264/MP4 or VP9/WebM export.

## Short boilerplate

Flowtake records a display, window, or custom area and lets people shape the
capture on a timeline with automatic cursor-driven zoom and pan, trimming,
cursor effects, masks, backgrounds, overlays, and subtitles. Ordinary capture,
project editing, and export stay on the user's device. Capture preview begins
only after the user explicitly selects a display, window, or area. Windows is
the primary platform; macOS and Linux builds are previews.

## Full boilerplate

Flowtake is a free and open-source desktop screen recorder and timeline editor
built with Tauri, Rust, React, PixiJS, and Mediabunny. It uses a separately
installed system FFmpeg for capture and audio processing. It can capture a
display, selected window, or custom area, then turn cursor activity into
editable zoom and pan motion. Projects and ordinary exports are stored locally,
without requiring cloud project sync. Windows 10/11 x64 is the primary
development and validation target. macOS Universal and Linux x64 builds are
available as previews. Flowtake v1.7.2 includes adaptive preview and
camera-capture profiles, durable project archive replacement and close handling,
and local H.264/MP4 or VP9/WebM export. Recorded and timeline audio can be mixed
and muxed when it is present and enabled.

## Fact sheet

| Item | Current fact |
|---|---|
| Application-code license | [MIT](LICENSE) |
| Source | [github.com/JNX03/Flowtake](https://github.com/JNX03/Flowtake) |
| Releases | [GitHub Releases](https://github.com/JNX03/Flowtake/releases) |
| Website | [jnx03.github.io/Flowtake](https://jnx03.github.io/Flowtake/) |
| Reviewed version | v1.7.2, dated September 12, 2026 |
| Historical v1.6.0 boundary | Released July 16, 2026; edited export was video-only AVC/H.264 MP4 |
| Primary platform | Windows 10/11 x64 |
| Preview platforms | macOS 10.15+ Universal and Linux x64 |
| Edited export in v1.7.2 | H.264/MP4 or VP9/WebM; recorded and timeline audio when present and enabled |
| Windows signing | Not Authenticode-signed |
| FFmpeg dependency | Not included in release packages; install a compatible system FFmpeg separately on every platform |
| macOS signing | Ad-hoc signed; not Developer ID signed or notarized |
| Linux capture boundary | X11 or XWayland; pure Wayland capture is not supported |
| Support and questions | [GitHub Discussions](https://github.com/JNX03/Flowtake/discussions) |
| Bugs | [GitHub Issues](https://github.com/JNX03/Flowtake/issues) |
| Security reports | Follow the private process in [SECURITY.md](SECURITY.md) |

## Safe feature claims

- Full-display, selected-window, and custom-area capture
- Explicit source selection before capture preview or recording begins
- Optional camera and microphone capture
- System-audio selection where the operating system exposes a compatible source
- Automatic cursor-driven zoom and pan that can be adjusted on a timeline
- Trimming, splitting, cursor styling, click effects, masks, backgrounds,
  overlays, audio tracks, and subtitles
- Adaptive Auto, Efficiency, Balanced, and Quality profiles; lighter preview or
  camera capture does not change the selected export dimensions
- Durable, backup-backed project archive replacement and close handling
- Local H.264/MP4 or VP9/WebM export, with audio when present and enabled
- Optional local stdio MCP for guarded split, trim, delete, and caption metadata
  edits; it does not inspect media, render, export, upload, or control the app
- Free desktop recorder and editor with application code under the MIT License

## Privacy and network boundary

Flowtake is local-first, not network-free. It has no cloud project-sync
requirement for ordinary capture, editing, or export. It can make network
requests for GitHub release checks. YouTube upload, RTMP live streaming, and
some model-backed camera effects are explicit network features and can send
data to the service the user selects.

## Claims not approved

Do not describe Flowtake as:

- stable or production-ready on every platform;
- notarized, Developer ID signed, or Mac App Store distributed;
- compatible with pure Wayland capture;
- capable of muxing recorded or timeline audio into the historical v1.6.0
  edited export;
- offline-only, network-free, telemetry-proof, or independently privacy audited;
- faster, smaller, or more reliable than another product without a reproducible
  benchmark and test environment;
- a drop-in replacement with feature parity for a named commercial product.

Do not call experimental or unreleased macOS capture work shipped functionality.
Keep macOS labelled as a preview until the promotion gates in
[ROADMAP.md](ROADMAP.md) are satisfied.

## Media assets

Approved public brand assets currently available in the repository:

- Vector logo: [`app/shared/assets/logo.svg`](app/shared/assets/logo.svg)
- Public application logo: [`website/public/assets/logo.png`](website/public/assets/logo.png)
- Application icons: [`src-tauri/icons/`](src-tauri/icons/)

Real product screenshots or product-demo footage are approved only when they
are explicitly listed in this press kit.

Before publishing a screenshot or demo:

1. Record it in an isolated test account or fixture project.
2. Remove names, notifications, tokens, URLs, local paths, and unrelated apps.
3. Verify that the shown controls and result match the released build.
4. Obtain maintainer approval for the final asset.

Private QA captures and files under local `artifacts/` directories are not press
assets and must not be published.

## Project relationship

The desktop recorder, editor, export tools, and community demo kit in this
repository are MIT licensed. Release packages do not include an FFmpeg
executable; users install that system dependency separately under its own
terms. Flowtake has no paid app tier, paid studio mode, export paywall,
checkout, or private-footage intake service.
