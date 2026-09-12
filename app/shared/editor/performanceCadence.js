// The balanced editor profile targets 30 visual updates per second. Playback
// state publication and worker rendering share this value so neither silently
// drifts back to display-refresh cadence.
export const BALANCED_EDITOR_FPS = 30
// Playback media timestamps are rounded to whole milliseconds. Flooring here
// keeps a 33 ms two-frame step publishable instead of accidentally degrading a
// 60 Hz source to 20 fps (33 < 33.333...).
export const BALANCED_EDITOR_FRAME_INTERVAL_MS = Math.floor(1000 / BALANCED_EDITOR_FPS)
