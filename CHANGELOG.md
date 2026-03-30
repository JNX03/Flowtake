# Changelog

All notable changes to Flowtake are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [1.3.2] - 2026-03-26

### Added
- Hide macOS system cursor during recording with cursor type detection
- `useVideoSrc` hook for platform-aware video loading
- `isResolved` prop on Media component

### Fixed
- macOS screen recording permission dialog no longer spams on launch
- Video source elements leaking through in preview
- Cursor SVG rendering and anchor points for correct positioning
- System cursor visible on preview controls, hidden only on canvas
- Auto-zoom now generates from mouse pauses when no clicks are captured
- Cursor animation state initialization race condition
- Asset protocol used for macOS video loading in editor
- Native screencapture used for macOS recording and preview

### Performance
- macOS mouse tracking increased to 60 Hz
- Preview rendering throttled to ~30 fps with frame backpressure
- EMA algorithm replaces segment interpolation for cursor smoothing

## [1.3.0] - 2026-03-23

### Added
- Per-app audio control UI in the recording panel (WASAPI)
- Markdown rendering for release notes
- Updates settings tab with changelog viewer and auto-update toggle
- Update check and changelog retrieval via GitHub API
- Autostart toggle in general settings
- Help and feedback section in general settings
- Light themes: Flowtake, Catppuccin, Solarized, Nord, Rose Pine, GitHub, Gruvbox
- License and subscription toast notification types

### Changed
- FlexibleAction drag handlers rewritten with RAF and stable refs
- Themes split into light/dark categories in UI settings

### Fixed
- External links now open via IPC instead of direct browser calls
- Timeline action drag handlers (move, left-resize, right-resize) rewritten with RAF
- macOS recording, Windows compilation, and release changelog generation
- Auto camera/mic permission prompts suppressed on macOS
- System FFmpeg fallback added to shell scope for macOS and Linux
- `audio.rs` compilation errors on Windows and Linux

## [1.2.1] - 2026-03-23

### Added
- Branded installer UI for Windows (NSIS) and macOS (DMG)
- Hue, temperature, and vignette filter support
- High-DPI screen capture using physical pixel dimensions

### Changed
- Timeline ctrl+mousewheel zoom with granular grid spacing
- Playhead smoothed with larger drag handles and better clip feedback
- Finer zoom steps and detailed time scale grid
- Velocity-based camera leading for smoother pan follow
- Adaptive cursor motion blur scaled by speed
- Cursor inertia algorithm rewritten with adaptive velocity smoothing

### Fixed
- Responsive properties panel and preview minimum width
- Bundle identifier renamed to avoid `.app` conflict
- Null checks in exporter, zoom section, and click handlers
- Default cases added for aspect ratio switches

## [1.2.0] - 2026-03-22

### Added
- Clip transitions with 11 effect types
- Video filters with presets and per-clip adjustments
- Per-clip speed ramping controls
- Subtitle entrance and exit animations
- Overlay keyframe easing support
- Audio waveform visualization on timeline clips
- Timeline minimap for project overview navigation
- Magnetic snap indicator and ripple edit mode
- Split and duplicate for all entity types (clips, overlays, audio)
- Drag-and-drop media import from filesystem
- Quick export presets for social platforms
- Click ring ripple effect with color and size controls
- Zoom easing system and zoom presets
- Padding presets
- Auto-transcribe subtitles with multi-source and multi-language support

### Changed
- Project restructured to `app/` layout with `@shared` path alias
- Architecture, development setup, and README documentation updated

### Fixed
- TypeError crash on macOS during recording
- Recording stability across platforms

## [1.1.1] - 2026-03-21

### Added
- FFmpeg binary handling for macOS universal and per-arch builds
- Context menu and devtools shortcut disabling across components
- Exporter preview and queue enhancements
- Social upload modal with backend IPC commands
- Multi-platform Rust checks in CI workflows
- Dependency checks and installation commands for FFmpeg tooling

### Fixed
- Rust dependencies and backend command registration
- Settings component import path

## [1.1.0] - 2026-03-17

### Added
- Overlay system integrated into scene and render pipeline
- Multi-monitor screen selection with DPI-aware coordinates
- Window capture via PrintWindow API
- Appearance settings with 11 theme options
- Custom pointer-based drag-and-drop with ghost preview
- Cross-track drag support in timeline
- Video preview modal with social sharing
- Recorder overlay bar redesigned with compact layout
- Recorder panel redesigned with refined source cards and device selects
- Exporter window redesigned with tab navigation, render cards, and progress bars
- `get-render-video-path` and `open-url-in-browser` IPC commands

### Fixed
- Export rendering black frames due to missing base64 decoding in worker
- Mouse events for drag system, native drag prevented

## [1.0.0] - 2026-03-15

### Added
- Screen recording via FFmpeg sidecar (full screen, window, custom area)
- Auto-zoom and pan animations generated from cursor tracking
- Timeline editor with zoom, pan, and click event tracks
- Camera overlay (picture-in-picture)
- Multi-window Tauri v2 architecture (main, recorder, exporter, windowPicker, areaPicker, note)
- Redux Toolkit state management
- Pixi.js preview and export rendering
- Multi-format export: MP4 H.264, MP4 H.265, WebM VP9
- Hardware encoder support (NVENC, VideoToolbox)

[Unreleased]: https://github.com/JNX03/Flowtake/compare/v1.3.2...HEAD
[1.3.2]: https://github.com/JNX03/Flowtake/compare/v.1.3.0...v1.3.2
[1.3.0]: https://github.com/JNX03/Flowtake/compare/v.1.2.1...v.1.3.0
[1.2.1]: https://github.com/JNX03/Flowtake/compare/1.2.0...v.1.2.1
[1.2.0]: https://github.com/JNX03/Flowtake/compare/v1.1.1...1.2.0
[1.1.1]: https://github.com/JNX03/Flowtake/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/JNX03/Flowtake/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/JNX03/Flowtake/releases/tag/v1.0.0
