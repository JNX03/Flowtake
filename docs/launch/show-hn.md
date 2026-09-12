# Show HN draft

> **Draft only — not posted.** Publish only after the next feature release is
> live, its artifacts are verified, and the linked demo has passed the privacy
> checklist. The latest published release is currently v1.6.0 and does not yet
> include all current-source features below.

## Title

```text
Show HN: Flowtake – A free, open-source screen recorder and timeline editor
```

## URL

```text
https://github.com/JNX03/Flowtake
```

## First comment

```text
Hi HN — I maintain Flowtake, a free MIT-licensed desktop screen recorder and editor.

It can capture a display, window, or custom area, derive editable zoom and pan motion from cursor activity, and provide a timeline for trims, splits, cursor effects, masks, backgrounds, overlays, audio, and subtitles. Windows is the primary target. macOS and Linux builds are previews, and Linux capture currently requires X11 or XWayland rather than pure Wayland.

The release linked here also includes adaptive preview and camera-capture profiles, while leaving screen-capture source and selected export dimensions unchanged, plus local MP4 or WebM export with optional recorded/timeline audio when present and enabled. Ordinary projects and exports stay on the device without cloud project sync. Flowtake is local-first rather than network-free: update checks and explicitly selected features such as YouTube upload, RTMP streaming, or some model-backed effects can use the network.

There is also an optional local stdio MCP for AI-assisted timeline metadata edits. It is a developer integration that currently requires a source checkout and Node.js 20+. It can inspect a bounded timeline and make revision-checked, backup-backed split, trim, delete, and caption edits. It does not inspect video pixels or audio, render, export, upload, or control the app, and Flowtake must be closed for durable writes. An MCP host or model may receive requested tool results.

There is one MIT-licensed product: no paid Studio mode, app tier, or export paywall.

Source and verified downloads: https://github.com/JNX03/Flowtake
Issues and reproducible platform reports are welcome.
```

## Prepared answers

**Does everything stay offline?**

> Ordinary capture, editing, and export do not require cloud sync. Flowtake is
> not network-free: release checks and user-selected upload, streaming, or
> model-backed features can use the network.

**Does the MCP edit the footage itself?**

> No. It edits supported timeline metadata with dry-run, revision, closed-app,
> and backup guards. It cannot analyze pixels or audio, render, export, upload,
> or operate the desktop UI.

**Does it support every platform equally?**

> No. Windows is the primary validation target. macOS and Linux are previews,
> and pure Wayland capture is not supported.

## Publication checklist

- Confirm the exact release contains every feature named above.
- Replace any stale screenshots with an exact-release capture.
- Use only a clean profile and public or synthetic demo content.
- Remove notifications, names, accounts, tokens, private URLs, local paths, and
  personal location from every frame.
- Do not publish performance, size, compatibility, or competitor-parity claims
  without current reproducible evidence.
