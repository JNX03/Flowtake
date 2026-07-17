# Export

Flowtake's render worker composites edited frames with Pixi.js, then Mediabunny encodes and muxes them into a local AVC/H.264 MP4. Rust writes the backend-owned `output.mp4` and copies it into the Flowtake export folder.

<!-- <img src="../screenshots/exporter.png" alt="Flowtake Exporter" width="600"> -->

## Starting an Export

1. Click **Export** in the main editor toolbar
2. The **Exporter** window opens with encoding settings
3. Choose the aspect ratio, resolution, 30 or 60 fps, and output quality, then click **Export**
4. A progress bar shows render status in real time

## Current Output

The edited-video exporter currently writes one format: **MP4 with AVC/H.264 video**. The export window does not expose a format or encoder selector.

## Quality Settings

| Setting | Options |
|---------|---------|
| **Resolution** | Presets derived from the project aspect ratio |
| **Frame Rate** | 30 or 60 fps |
| **Quality** | Very low, low, medium, high, or very high |

## Current Audio Boundary

The v1.6.0 edited MP4 is video-only. Microphone, system, and timeline audio are not muxed into the final edited export; the existing `process_audio` and `add_audio` backend commands are placeholders.

## Export Queue

Multiple projects can be queued for sequential rendering. The exporter window shows:
- Current render progress
- Per-render status and progress
- The local output action after completion
