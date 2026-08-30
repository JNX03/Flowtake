# Flowtake roadmap

This roadmap communicates direction, not release promises. Items can move as
testing, maintainer capacity, operating-system changes, or security findings
change. The [latest release notes](https://github.com/JNX03/Flowtake/releases)
remain the source of truth for shipped behavior.

## Product principles

- Keep ordinary recording, project editing, and export local-first.
- Prefer recoverable projects, clear errors, and reproducible diagnostics over
  silent failure.
- Describe platform and export limits precisely.
- Keep experimental work behind safe fallbacks until real-device evidence is
  strong enough to change support status.
- Do not trade user privacy or system stability for a launch claim.

## Now

- Improve recording start, stop, cancellation, and recovery behavior on the
  Windows primary platform.
- Reduce memory, CPU, and frame-pacing regressions with repeatable diagnostics
  and long-session tests.
- Prototype and validate a Swift-based native macOS capture helper behind a
  reversible fallback. Test permission handling, display changes, shutdown,
  frame pacing, and memory use on real Apple Silicon and Intel Macs.
- Keep macOS labelled as a preview while that native path is experimental,
  ad-hoc signed, and not notarized.
- Keep release metadata, platform tables, installation guidance, and export
  descriptions aligned with tested behavior.
- Produce privacy-reviewed screenshots and a short demo from an isolated test
  environment.

## Next

- Establish a repeatable macOS regression matrix for install, permission
  prompts, display/window capture, editing, export, sleep/wake, and uninstall.
- Add Developer ID signing and Apple notarization to the macOS release process.
- Add Windows code signing when a sustainable certificate and release process
  are available.
- Mux supported microphone, system, and timeline audio into edited exports,
  with synchronization and interrupted-export tests, before advertising audio
  in the final MP4.
- Validate installer upgrade and uninstall behavior before expanding package
  manager distribution.
- Submit accurate package metadata to suitable Windows package managers and
  keep checksums and version detection automated.
- Improve keyboard navigation, screen-reader labels, reduced-motion behavior,
  and contrast across the recorder and editor.

## Later

- Evaluate a portal/PipeWire-based pure Wayland capture path. This is research,
  not a compatibility promise.
- Revisit broader Linux distribution channels after capture, dependency, and
  upgrade behavior is stable on documented environments.
- Expand multi-app scene workflows only after the basic record-edit-export path
  has strong recovery and regression coverage.
- Explore localization and community-maintained translations.
- Evaluate additional export formats or acceleration only with deterministic
  fallback behavior and reproducible quality tests.

## Platform promotion gates

### macOS preview to supported

macOS remains a preview until maintainers can show all of the following:

1. A published, repeatable real-device test matrix covering supported Apple
   Silicon and Intel configurations.
2. Reliable screen-recording, camera, and microphone permission flows.
3. Stable capture and shutdown behavior across displays, sleep/wake, and
   interrupted recordings.
4. Successful project reopen and edited export without known data-loss
   blockers.
5. Developer ID signing, notarization, and a documented install/update path.
6. Release notes and screenshots that match the tested build.

Passing an automated build alone does not promote macOS out of preview.

### Linux preview to supported

Linux remains a preview until supported desktop/session combinations,
dependencies, install/upgrade paths, and capture limitations are documented and
covered by repeatable tests. Pure Wayland must remain explicitly unsupported
unless a tested native path ships.

## How to influence priorities

- Use [GitHub Issues](https://github.com/JNX03/Flowtake/issues) for reproducible
  bugs and scoped feature proposals.
- Use [GitHub Discussions](https://github.com/JNX03/Flowtake/discussions) for
  questions, workflows, and broader product ideas.
- Include the Flowtake version, operating system, capture type, display/scaling
  details, minimal reproduction steps, and sanitized logs where relevant.

