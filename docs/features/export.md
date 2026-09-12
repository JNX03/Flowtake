# Export

Flowtake's render worker composites edited frames with Pixi.js, then Mediabunny encodes the video as H.264/MP4 or VP9/WebM. When enabled audio is present, the separately installed system FFmpeg builds the timeline-aware mix and muxes it without re-encoding the video. Rust copies the completed file into the Flowtake export folder.

Flowtake packages do not include an FFmpeg executable. Install FFmpeg
separately and keep the `ffmpeg` command on `PATH` before opening Flowtake.

<!-- <img src="../screenshots/exporter.png" alt="Flowtake Exporter" width="600"> -->

## Starting an Export

1. Click **Export** in the main editor toolbar
2. The **Exporter** window opens with encoding settings
3. Choose MP4 or WebM, the aspect ratio, resolution, 30 or 60 fps, output quality, and whether to include available audio, then click **Export**
4. A progress bar shows render status in real time

## Current Output

The edited-video exporter writes **MP4 with H.264/AVC video** or **WebM with VP9 video**. The export window exposes the container choice but does not expose a separate codec, bitrate, or hardware-encoder selector.

## Quality Settings

| Setting | Options |
|---------|---------|
| **Resolution** | Presets derived from the project aspect ratio |
| **Frame Rate** | 30 or 60 fps |
| **Quality** | Very low, low, medium, high, or very high |

## Audio

When the project contains recorded microphone/system audio or audible timeline audio, **Include audio** is enabled by default. The exporter follows timeline cuts, speed changes, gaps, and per-source volume, then mixes the available sources into the selected MP4 or WebM file. Turn **Include audio** off for a silent export.

## Export Queue

Multiple projects can be queued for sequential rendering. The exporter window shows:
- Current render progress
- Per-render status and progress
- The local output action after completion
