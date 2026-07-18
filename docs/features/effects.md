# Effects & Overlays

Add visual polish to your recordings with overlays, subtitles, masks, and background effects.

## Overlay Tracks

Place images, shapes, and custom elements on top of your video. Each overlay:

- Has its own timeline track with start/end points
- Supports enter/exit animations (fade, slide, zoom)
- Can be positioned, scaled, and rotated in the preview
- Layers above or below other overlays via track order

## Audio Tracks (Current Export Boundary)

Flowtake includes audio-related capture and timeline UI, but the final edited MP4 in v1.6.0 is video-only. Microphone, system-audio, and external-audio tracks are not currently muxed into that export.

Do not rely on the edited MP4 export to preserve or mix audio.

## Subtitles & Captions

- Built-in subtitle editor with frame-accurate timing
- Speech recognition integration for auto-generated captions
- Font, size, color, and position are fully configurable
- Render subtitles into the video frames

Flowtake v1.6.0 does not provide a separate `.srt` export.

## Edited MP4 Pipeline

PixiJS composites the visual timeline in the render worker, and Mediabunny encodes and muxes the final AVC MP4. FFmpeg remains available for recording capture and native media utilities; it does not render the final edited MP4.

## Masks & Blur

Redact or hide sensitive content:

| Effect | Use Case |
|--------|----------|
| **Blur Mask** | Blur a rectangular region (passwords, faces, private info) |
| **Solid Mask** | Cover a region with a solid color block |

Masks can be animated to follow a moving region over time.

## Backgrounds

Customize the background behind your recording canvas:

- **Wallpaper** — Set a solid color or image as the background
- **Blur Background** — Apply a blurred, scaled version of the recording as a background (great for non-standard aspect ratios)

## Intro / Outro

Configurable zoom transitions at the start and end of the video:

- Zoom-in intro: video starts zoomed out and pushes in
- Zoom-out outro: video zooms out at the end
- Duration and easing are adjustable
