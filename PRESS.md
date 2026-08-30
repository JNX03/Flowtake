# Flowtake press kit

Last factual review: July 18, 2026, against Flowtake v1.6.0.

This page contains approved factual language for articles, directories, package
descriptions, and community posts. Check the
[latest release](https://github.com/JNX03/Flowtake/releases/latest) before
reusing version-specific details.

## One-line description

Flowtake is a free, MIT-licensed, local-first desktop screen recorder and
timeline editor for creating developer demos with cursor-driven zoom and local
MP4 export.

## Short boilerplate

Flowtake records a display, window, or custom area and lets people shape the
capture on a timeline with automatic cursor-driven zoom and pan, trimming,
cursor effects, masks, backgrounds, overlays, and subtitles. Ordinary capture,
project editing, and export stay on the user's device. Windows is the primary
platform; macOS and Linux builds are previews.

## Full boilerplate

Flowtake is a free and open-source desktop screen recorder and timeline editor
built with Tauri, Rust, React, PixiJS, Mediabunny, and FFmpeg. It can capture a
display, selected window, or custom area, then turn cursor activity into
editable zoom and pan motion. Projects and ordinary exports are stored locally,
without requiring cloud project sync. Windows 10/11 x64 is the primary
development and validation target. macOS Universal and Linux x64 builds are
available as previews. In v1.6.0, edited export produces a video-only AVC/H.264
MP4; captured microphone, system, and timeline audio are not muxed into that
final edited file.

## Fact sheet

| Item | Current fact |
|---|---|
| License | [MIT](LICENSE) |
| Source | [github.com/JNX03/Flowtake](https://github.com/JNX03/Flowtake) |
| Releases | [GitHub Releases](https://github.com/JNX03/Flowtake/releases) |
| Website | [jnx03.github.io/Flowtake](https://jnx03.github.io/Flowtake/) |
| Current reviewed release | v1.6.0, released July 16, 2026 |
| Primary platform | Windows 10/11 x64 |
| Preview platforms | macOS 10.15+ Universal and Linux x64 |
| Edited export in v1.6.0 | Video-only AVC/H.264 MP4 |
| Windows signing | Not Authenticode-signed |
| macOS signing | Ad-hoc signed; not Developer ID signed or notarized |
| Linux capture boundary | X11 or XWayland; pure Wayland capture is not supported |
| Support and questions | [GitHub Discussions](https://github.com/JNX03/Flowtake/discussions) |
| Bugs | [GitHub Issues](https://github.com/JNX03/Flowtake/issues) |
| Security reports | Follow the private process in [SECURITY.md](SECURITY.md) |

## Safe feature claims

- Full-display, selected-window, and custom-area capture
- Optional camera and microphone capture
- System-audio selection where the operating system exposes a compatible source
- Automatic cursor-driven zoom and pan that can be adjusted on a timeline
- Trimming, splitting, cursor styling, click effects, masks, backgrounds,
  overlays, audio tracks, and subtitles
- Local projects and local video-only H.264 MP4 export in v1.6.0
- Free and open-source desktop recorder and editor under the MIT License

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
- capable of muxing recorded or timeline audio into the v1.6.0 edited export;
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
- Repository banner: [`resources/banner.png`](resources/banner.png)
- Application icons: [`src-tauri/icons/`](src-tauri/icons/)

There is not yet an approved set of real product screenshots or product-demo
footage in this press kit.

Before publishing a screenshot or demo:

1. Record it in an isolated test account or fixture project.
2. Remove names, notifications, tokens, URLs, local paths, and unrelated apps.
3. Verify that the shown controls and result match the released build.
4. Obtain maintainer approval for the final asset.

Private QA captures and files under local `artifacts/` directories are not press
assets and must not be published.

## Project relationship

The desktop recorder and editor in this repository are MIT licensed. Flowtake
Release Studio, when mentioned on the project website, is a separate optional
service and is not required to use the open-source desktop app.
