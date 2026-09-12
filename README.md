<p align="center">
  <img src="website/public/assets/logo.png" alt="Flowtake app icon" width="160">
</p>

<h3 align="center">Record locally. Turn the capture into a polished product demo.</h3>

<p align="center">
  Flowtake v1.7.2 is a free desktop screen recorder and editor with automatic zoom and pan, cursor effects, a timeline, and local H.264/MP4 or VP9/WebM export with audio when present and enabled. Flowtake application code is MIT-licensed. Install FFmpeg separately before using the desktop app.
</p>

<p align="center">
  <a href="https://github.com/JNX03/Flowtake/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/JNX03/Flowtake?label=download&color=4C1D95"></a>
  <a href="https://github.com/JNX03/Flowtake/releases"><img alt="Total downloads" src="https://img.shields.io/github/downloads/JNX03/Flowtake/total?color=4C1D95"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="Windows is the primary platform; macOS and Linux are previews" src="https://img.shields.io/badge/platform-Windows%20primary%20%7C%20macOS%2FLinux%20preview-lightgrey.svg">
</p>

<p align="center">
  <a href="#60-second-quickstart">Quickstart</a> &bull;
  <a href="#download-and-platform-status">Downloads</a> &bull;
  <a href="#privacy-and-open-source-boundary">Privacy</a> &bull;
  <a href="#development">Development</a> &bull;
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

## What Flowtake does

Flowtake keeps the recording workflow in one desktop app:

- Capture a full display, one window, or a custom area.
- Add camera, microphone, and supported system-audio sources.
- Generate zoom and pan motion from cursor activity, then tune it on the timeline.
- Trim and split clips; style cursor and click feedback; add masks, backgrounds, overlays, audio, and subtitles.
- Save projects locally and export H.264/MP4 or VP9/WebM, with recorded and timeline audio included when present and enabled.
- Experiment with separate app layers and scene layouts for multi-app technical demos.

The desktop recorder and editor are free. Flowtake application code is available
under the [MIT License](LICENSE). Flowtake release packages do not include an
FFmpeg executable. Install a compatible system FFmpeg separately and keep the
`ffmpeg` command available on `PATH`.

## 60-second quickstart

1. Install FFmpeg using the platform command below.
2. Install with `winget install --id JNX03.Flowtake --exact` on Windows, download a build from the [release page](https://github.com/JNX03/Flowtake/releases), or follow [Development](#development) to run from source.
3. Open Flowtake, choose **Record**, then select **Screen**, **Window**, or **Area**. Add a camera, microphone, or system-audio source if needed.
4. Start recording and use the compact recorder controls to pause or stop.
5. Open the saved project from **Library**, adjust the timeline and effects, then choose **Export**. Flowtake v1.7.2 renders H.264/MP4 or VP9/WebM and can include recorded or timeline audio when present and enabled.

Your OS may ask for screen-recording, camera, or microphone permission on first use. Current platform-signing limitations can also produce a Windows SmartScreen or macOS Gatekeeper warning; see the status note below before proceeding.

## Download and platform status

All published artifacts are on the official [GitHub Releases page](https://github.com/JNX03/Flowtake/releases).

| Platform | Published artifacts | Current support boundary |
|---|---|---|
| **Windows 10/11 x64** | `.exe`, `.msi`, portable `.zip` | Primary development and validation target. Install FFmpeg separately. |
| **macOS 10.15+ Universal** | `.dmg`, portable `.zip` | Preview. Apple Silicon and Intel builds are published; install FFmpeg separately. |
| **Linux x64** | `.AppImage`, `.deb`, `.rpm`, portable `.tar.gz` | Preview. Install the distribution's FFmpeg package. Screen capture requires X11 or XWayland; pure Wayland capture is not supported. |

### FFmpeg prerequisite

Flowtake packages do not redistribute an FFmpeg executable. Install FFmpeg
separately, then confirm that `ffmpeg -version` works in a new terminal.

```powershell
# Windows
winget install --id Gyan.FFmpeg --exact --source winget
```

```bash
# macOS
brew install ffmpeg

# Debian or Ubuntu
sudo apt update
sudo apt install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```

For another Linux distribution, install its full FFmpeg package and ensure the
`ffmpeg` command is on `PATH` before opening Flowtake.

### WinGet (Windows)

Flowtake is published in the [Microsoft WinGet community repository](https://github.com/microsoft/winget-pkgs/tree/master/manifests/j/JNX03/Flowtake/1.6.0):

```powershell
winget install --id JNX03.Flowtake --exact
```

The WinGet package installs the same unsigned MSI published on the official release page, so the signing boundary below still applies.

> **Platform signing:** the current Windows artifacts are not Authenticode-signed. The macOS artifacts are ad-hoc signed, not signed with an Apple Developer ID, and not notarized. SmartScreen or Gatekeeper may warn. Download Flowtake only from this repository's release page, and do not bypass a warning for a copy obtained elsewhere.

## Product highlights

### Capture

- Full display, selected window, and custom-area recording
- Explicit source confirmation before capture preview or recording starts
- Optional camera and microphone capture
- System-audio selection where the operating system exposes a compatible source
- Multi-monitor selection and recording quality controls
- Experimental separate app-layer capture for technical workflows

### Edit

- Automatic cursor-driven zoom and pan
- Timeline controls for clips, zooms, cursor styling, click effects, and drawn cursor paths
- Masks and blur for redaction
- Backgrounds, image/shape overlays, audio tracks, and subtitles
- Camera layout and background-blur controls
- Auto, Efficiency, Balanced, and Quality performance profiles that adapt
  preview and camera-capture work without changing the selected export dimensions
- Local project library with revision-aware saves, durable archive replacement,
  and recoverable close handling

### Export

Flowtake v1.7.2 renders H.264/MP4 or VP9/WebM locally and provides:

- VP9/WebM rendering through Mediabunny
- Resolution, 30/60 fps, output-format, output-quality, and optional-audio controls
- Recorded microphone/system audio and timeline audio mixed to the edit and muxed when present and enabled

## Privacy and open-source boundary

- Recordings, project files, and ordinary exports are stored locally. Flowtake does not include cloud project sync.
- The current Tauri build has Sentry disabled and no active product-analytics integration.
- Flowtake can make network requests for GitHub release checks. Explicit network features include YouTube upload and RTMP live streaming; some camera effects fetch model assets when used.
- Choosing a network feature sends data to the service you configure. Review that service's terms before connecting an account or stream destination.
- Flowtake application code remains MIT licensed. Release packages do not include an FFmpeg executable; users install that system dependency separately under its own terms. Flowtake has no paid app tier, paid studio mode, or export paywall.

For vulnerability reporting, follow the private process in [SECURITY.md](SECURITY.md).

## Optional local MCP for AI-assisted edits

Flowtake v1.7.2 includes a local stdio MCP developer integration.
From a source checkout with Node.js 20+, an MCP host can list projects, read
bounded timeline metadata, and request revision-checked, dry-run and
backup-backed split, trim, delete, and caption edits. Flowtake must be closed
for durable archive writes.

The MCP edits supported metadata only. It does not inspect video pixels or
listen to audio. It cannot transcribe media, render footage, create output
files, upload data, or control the desktop UI. Project names and caption text
are omitted unless requested, but the MCP host and model may receive the tool
results you ask for. See [the MCP guide](mcp/README.md).

## Free community demo kit

Maintainers can use the free [six-beat developer-tool demo kit](https://jnx03.github.io/Flowtake/developer-tool-demo-storyboard/) before recording. It includes a copyable storyboard, a maintainer brief, safe-capture exclusions, and a clearly labelled planning example. Copying the templates happens in your browser; the website does not submit the text to Flowtake.

Improvements to the recorder, editor, documentation, and demo kit are welcome through [CONTRIBUTING.md](CONTRIBUTING.md). GitHub issues, pull requests, and discussions are public, so use public or synthetic examples and remove credentials, customer data, private repository details, filenames, notifications, and production access before sharing.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/tools/install) stable
- The [Tauri v2 system prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS
- A compatible system FFmpeg available as `ffmpeg` on `PATH`

### Run locally

```bash
git clone https://github.com/JNX03/Flowtake.git
cd Flowtake
npm ci
```

Install FFmpeg separately before running the native app:

```powershell
# Windows
winget install --id Gyan.FFmpeg --exact --source winget
```

```bash
# macOS
brew install ffmpeg

# Debian or Ubuntu
sudo apt install ffmpeg
```

On macOS, build the native ScreenCaptureKit helper as well:

```bash
npm run test:macos-capture
npm run build:macos-capture
```

Then start the native app and frontend:

```bash
npm run dev
```

Useful checks:

```bash
npm test
npm run lint
npm run build:frontend
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

### Architecture

Flowtake combines a [Tauri v2](https://v2.tauri.app/) Rust backend with a React 19 interface. Redux Toolkit manages editor state, PixiJS composites preview and export frames, and Mediabunny encodes the edited H.264/MP4 or VP9/WebM video stream. When an edit includes enabled recorded or timeline audio, the separately installed system FFmpeg builds the timeline-aware mix and muxes it without re-encoding the video. Rust then copies the completed file into the local export folder. On macOS 12.3+, a Swift ScreenCaptureKit helper writes fixed-cadence H.264 through the native media stack and cleanly falls back to system FFmpeg/AVFoundation when unavailable. The editor bounds Retina preview textures while exports retain source resolution.

The native app uses separate windows for the launcher/editor, recorder controls, exporter, source pickers, and annotations. Start with the [architecture docs](docs/architecture/README.md) or the [development guide](docs/getting-started/development.md) for a deeper tour.

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before submitting a change.

The most useful reports include the operating system, Flowtake version, capture source, exact reproduction steps, and relevant logs. Linux reports should also say whether the session is X11, XWayland, or pure Wayland.

## License

Flowtake application code is licensed under the [MIT License](LICENSE).
Flowtake packages do not redistribute FFmpeg. Installations use a separately
installed system FFmpeg under the terms supplied by its distributor.

---

<p align="center">
  Made with Rust, React, and a lot of screen recordings.
  <br>
  <sub>If Flowtake helps, a GitHub star or a reproducible bug report both move the project forward.</sub>
</p>
