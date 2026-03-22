# Export

Flowtake uses FFmpeg as a bundled sidecar binary for professional-grade video encoding.

<!-- <img src="../screenshots/exporter.png" alt="Flowtake Exporter" width="600"> -->

## Starting an Export

1. Click **Export** in the main editor toolbar
2. The **Exporter** window opens with encoding settings
3. Configure format and quality, then click **Render**
4. A progress bar shows render status in real time

## Output Formats

| Format | Notes |
|--------|-------|
| **MP4** (H.264) | Best compatibility, recommended for sharing |
| **MP4** (H.265/HEVC) | Smaller file size, good for high resolution |
| **WebM** (VP9) | Best for web embeds |

## Quality Settings

| Setting | Options |
|---------|---------|
| **Resolution** | Match recording, 1080p, 720p, or custom |
| **Frame Rate** | 24, 30, 60 fps |
| **Bitrate** | CRF-based (quality target) or fixed bitrate |
| **Encoder** | Software (x264/x265) or hardware (NVENC, VideoToolbox) |

## Audio Export

- Microphone and system audio are mixed during render
- Output audio codec: AAC (default) or MP3
- Sample rate and bitrate are configurable

## Export Queue

Multiple projects can be queued for sequential rendering. The exporter window shows:
- Current render progress (percentage + estimated time)
- Per-frame render status
- Final file size after completion
