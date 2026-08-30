# Flowtake support and performance gates

This document states the platforms Flowtake actually targets today and the measurements required before making performance claims. The numbers below are release gates, not achieved results.

## Support matrix

| Platform | Current recorder path | Support status |
| --- | --- | --- |
| Windows 10/11 x64 | Desktop capture through FFmpeg/DXGI (`ddagrab`) | Primary validation target. Release performance gates are not yet certified. |
| Windows ARM64 | No ARM64 release artifact or validated capture path | Not supported. |
| macOS 10.15+ on Intel or Apple Silicon | ScreenCaptureKit + native H.264 writer on macOS 12.3+; AVFoundation/FFmpeg fallback on older or incompatible systems | Developer preview. Native system audio requires macOS 13+. Keyboard visualization is unavailable and the performance matrix must still be validated. |
| Linux x64 with X11 or XWayland | `x11grab`; keyboard input through `xdotool` | Developer preview. Distribution packaging does not imply recorder certification. |
| Linux with pure Wayland | No PipeWire/portal recorder path is wired | Recording is not supported. |
| Linux ARM64 | No release artifact or validated capture path | Not supported. |
| iOS, Android, and ChromeOS | No desktop recorder implementation | Not supported. |

Flowtake is a desktop application. A hardware encoder should only be shown as available after a short encode probe succeeds on that machine. A failed probe must fall back to a tested software encoder and explain the downgrade; the UI setting must select the encoder used by the recorder.

## Measurable release gates

Run each recording case three times on a clean reboot and report the median and worst run. Keep the raw diagnostics, FFmpeg logs, source resolution, display scaling, codec, bitrate, and hardware identifiers.

| Scenario | Required gate before release |
| --- | --- |
| 1080p60, 10 minutes, hardware encode | Dropped/duplicated frames <= 0.1%; A/V drift <= 50 ms; machine CPU <= 8%; Flowtake + FFmpeg working-set growth <= 150 MiB; stop-to-project-ready p95 <= 2 seconds. |
| 4K60, 10 minutes, hardware encode | Dropped/duplicated frames <= 0.1%; A/V drift <= 80 ms; machine CPU <= 12%; working-set growth <= 300 MiB; unsupported hardware must downgrade without losing the recording. |
| Two-hour soak | Memory slope < 5 MiB/hour after warm-up; zero orphan Flowtake FFmpeg processes; zero abandoned temporary recordings; final A/V drift <= 100 ms. |
| Lifecycle stress | 20 pause/resume, cancel, stop, and restart cycles with zero process leaks, zero stuck overlays, and every output playable. |
| Main menu and settings | Cold launch to responsive UI p95 <= 2 seconds; local interaction response p95 <= 100 ms; idle working set <= 120 MiB; every visible setting changes real runtime behavior or is removed. |

GPU utilization varies by encoder and GPU generation, so capture engine-specific `Video Encode` utilization and publish the raw series instead of using a universal GPU percentage gate. The capture path must remain responsive while a hardware encoder is saturated and must surface a controlled quality downgrade rather than silently dropping content.

## Device and layout validation

Validate the recorder menu, settings, source picker, countdown, recording controls, and plugin controls at 760x520, 1000x600, 1366x768, 1920x1080, and 3840x2160. On Windows, also test 100%, 125%, 150%, and 200% display scaling plus mixed-DPI dual monitors. Acceptance requires no overlap, clipped controls, white gaps, focus traps, or keyboard-only dead ends.

The macOS and Linux preview rows require equivalent real-device runs before promotion. Do not infer support from compilation or package generation alone.

The ScreenCaptureKit path waits for a native readiness handshake before the recorder reports that capture started, schedules the latest native frame at the configured fixed 30/60 fps cadence, and asks the helper to finalize the MP4 before project validation. If the helper is missing or cannot start, automatic mode uses the existing AVFoundation/FFmpeg path. This fallback is a reliability guarantee, not evidence that either path has passed the performance gates above.

Editor preview is intentionally separate from export quality. Retina source video is decoded into a preview texture bounded to 1280×720, playback animation timing follows the display refresh loop, and inactive zoom blur is removed from the Pixi filter chain. Export rendering continues to use the source dimensions.

## Read-only Windows diagnostics

While a recording is active, sample Flowtake and FFmpeg CPU, working set, private memory, threads, handles, and possible detached recorder processes:

```powershell
npm run diagnose:recording
npm run diagnose:recording -- --sample-ms 5000 --json
npm run diagnose:recording -- --fail-on-orphan
```

The command only reads Windows process telemetry. It does not launch or stop processes and does not read or change Flowtake settings. `orphanCandidates` are deliberately conservative: only detached FFmpeg commands with Flowtake-like paths or recording names are reported, so the output does not accuse unrelated FFmpeg workloads.

## Comparison claim protocol

Do not claim that Flowtake is faster than Screen Studio until both applications are tested on the same supported Mac, using the same display, source, resolution, frame rate, duration, codec class, and audio inputs. Run at least three trials per application and publish median plus worst-run CPU, memory, dropped frames, A/V drift, start latency, stop latency, and output quality. Cross-operating-system comparisons are not evidence for a product-level superiority claim.

## Required automated checks

Pull requests must pass:

```powershell
npm ci
npm run lint
npm test
npm run build:frontend
cargo check --manifest-path src-tauri/Cargo.toml --locked
cargo clippy --manifest-path src-tauri/Cargo.toml --locked -- -D warnings --allow dead_code
```
