# Editing

The Flowtake editor gives you a full timeline with tracks for zoom, pan, cursor effects, overlays, audio, and more.

<!-- <img src="../screenshots/timeline.png" alt="Flowtake Timeline" width="800"> -->

## Timeline

The timeline is the core editing surface. It displays all tracks stacked vertically and lets you scrub through the video with a playhead.

### Navigation

| Action | How |
|--------|-----|
| Zoom in/out | `Ctrl + Mousewheel` |
| Scrub | Click or drag the playhead |
| Scroll horizontally | Mousewheel or scrollbar |

The timeline uses granular grid spacing that adapts to the current zoom level, making it easy to place clips precisely at any scale.

### Playhead

The playhead shows your current position in the video. It has large, easy-to-grab handles and snaps to clip boundaries for precise editing.

## Auto-Zoom Animations

Flowtake automatically generates zoom-and-pan animations that follow cursor movement and focus areas in your recording.

- Zoom events are placed on the **Zoom Track**
- Each zoom event has configurable start/end zoom level and easing curve
- Zoom animations are rendered via Pixi.js for smooth, frame-accurate playback

## Pan Animations

Pan events move the camera across the frame.

- **Velocity-based camera leading** — the camera anticipates cursor direction for a more natural follow
- Pan speed and easing are configurable per event
- Works in combination with zoom for fluid zoom-and-pan moves

## Cursor Inertia & Motion Blur

The cursor rendering system simulates physical weight:

- **Adaptive inertia** — cursor lags slightly behind actual position, with smoothing scaled by velocity
- **Motion blur** — blur strength scales with cursor speed for a cinematic look
- Strength and inertia amount are adjustable in the Cursor properties panel

## Click Indicators

Animated rings appear around the cursor on every mouse click in the recording. Configurable color, size, and animation style.

## Custom Cursors

Replace the system cursor with a custom image, or style it with color/size overrides.

## Clips & Cuts

- **Trim** — Drag clip edges to shorten from start or end
- **Split** — Cut a clip at the playhead position
- **Rearrange** — Drag clips along the timeline
- **Delete** — Remove a clip or event

## Undo / Redo

All editing operations support full undo/redo history (`Ctrl+Z` / `Ctrl+Shift+Z`).

## Properties Panel

Select any clip or event on the timeline to open its properties on the right-hand panel. The panel is responsive and adjusts to window width.
