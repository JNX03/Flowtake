# October launch copy

Status: prepared, not posted. Reviewed against the published v1.7.2 release
notes and `main` on October 2, 2026. Use the channel-specific text below; do not
publish a source-only improvement as a feature of the download. These are text
posts and do not imply a finished demo video exists.

## X: project introduction

```text
Flowtake is a free, open-source screen recorder for developer demos: editable cursor zoom, a timeline, and local MP4/WebM export.

Windows primary; macOS/Linux previews. Install FFmpeg separately.

Try it; star it if useful:
https://github.com/JNX03/Flowtake
```

## X: source development update

```text
On Flowtake's main branch: recorder setup checks, clearer preview states, and a packaged local caption runtime.

These are source improvements; the published download is still v1.7.2.

Source and platform limits:
https://github.com/JNX03/Flowtake
```

## Reddit: community discussion

Suggested title: **Flowtake: a free screen recorder with editable cursor zoom
and a timeline**

```text
I maintain Flowtake, a free desktop screen recorder and timeline editor with MIT-licensed application code.

The workflow is to capture a display, window, or area, then refine the cursor zoom and trims on a timeline and export MP4 or WebM locally. Ordinary projects and exports stay on your machine; release checks and explicitly networked features can use the network.

Windows 10/11 x64 is the primary validated target. macOS and Linux downloads are previews, Linux capture needs X11 or XWayland, and system FFmpeg is a separate dependency. Please check the release notes and checksums before installing.

The current download is v1.7.2. Recent recorder readiness and caption runtime fixes are in the source checkout and have not been released as a new download yet.

Source and downloads: https://github.com/JNX03/Flowtake

Which part of making a short developer demo takes you the most time: choosing the frame, tuning zoom, trimming, or export? Reproducible installation feedback is also welcome—include your OS, release, and steps.
```

Use only a community that permits this post from the selected account, with the
required flair or promotion thread. Avoid repeated copies across communities.

## GitHub announcement

Title: **Make your next developer demo with Flowtake — October project update**

Flowtake is a free, local-first screen recorder and timeline editor with
MIT-licensed application code. Capture a display, window, or area; adjust
cursor-driven zoom and trims on a timeline; export MP4 or WebM locally.

[Try the published v1.7.2 release](https://github.com/JNX03/Flowtake/releases/tag/v1.7.2)
or [explore the project website](https://jnx03.github.io/Flowtake/).

Windows 10/11 x64 is the primary validated target. macOS and Linux builds are
previews; Linux capture requires X11 or XWayland. Install compatible system
FFmpeg separately and check the published checksums. Review signing and
platform limits in the release notes before installing.

Recent source work adds **Check recorder**, clearer capture preview states,
and a packaged caption runtime that works under the app's strict script
policy. These changes are **in development on `main`**, not included in the
v1.7.2 download. Dependency and runtime work is covered by [#223](https://github.com/JNX03/Flowtake/pull/223)
and [#224](https://github.com/JNX03/Flowtake/pull/224).

This month, the project is looking for useful feedback on one small workflow:
record a developer demo, tune its zoom and trims, and export it. If setup fails,
please [report the OS, app release, and reproduction steps](https://github.com/JNX03/Flowtake/issues/new/choose).
Use synthetic or public examples and remove private data from shared reports.

If Flowtake is useful to you, star the repository to bookmark it and help
others discover it. Contributions and workflow suggestions are welcome.
