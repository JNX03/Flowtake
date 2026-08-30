# Flowtake outreach guide

This document keeps directory submissions, package listings, and launch copy
factual and coordinated. It does not authorize an external pull request,
listing, account action, or social post. A maintainer must approve each external
action, and the destination's current contribution rules must be checked on the
day of submission.

Last review: July 18, 2026, against Flowtake v1.6.0.

## Positioning

**Category:** Local-first screen recorder and timeline editor for developer and
product demos.

**Submission-ready one-liner:**

> Flowtake is an MIT-licensed, local-first screen recorder and timeline editor
> with cursor-driven zoom and local video-only H.264 MP4 export. Windows is
> primary; macOS and Linux are previews.

**Short tagline:**

> Record locally. Shape developer demos on a timeline.

The word “local-first” must not be changed to “offline-only” or “no network
calls.” See the network boundary in [PRESS.md](PRESS.md).

## Submission status

| Destination | Status | Proposed placement | Gate or next action |
|---|---|---|---|
| [thechampagne/awesome-windows](https://github.com/thechampagne/awesome-windows) | Already listed | Video | Verify the existing entry during release reviews; do not submit a duplicate. |
| [tauri-apps/awesome-tauri](https://github.com/tauri-apps/awesome-tauri) | Copy ready | Applications / Audio & Video | Check the current guide, then open a maintainer-approved PR. |
| [Axorax/awesome-free-apps](https://github.com/Axorax/awesome-free-apps) | Copy ready | Video Streaming and Recording | Follow its [contribution guide](https://github.com/Axorax/awesome-free-apps/blob/main/contributing.md) in a maintainer-approved PR. |
| [sitkevij/awesome-video](https://github.com/sitkevij/awesome-video) | Copy ready | Video Capture and Recording | Check sorting and punctuation rules before a maintainer-approved PR. |
| [ad-si/awesome-video-production](https://github.com/ad-si/awesome-video-production) | Copy ready | Video Editing GUI or capture section | Confirm the best section with the list maintainer. |
| [0PandaDEV/awesome-windows](https://github.com/0PandaDEV/awesome-windows) | Secondary | Screen Capture / Video Utilities | Submit only after the higher-fit lists and public evidence are current. |
| [AlternativeTo](https://alternativeto.net/faq/) | Listing copy ready | Screen recorder / video editor | Requires an account and public, privacy-reviewed screenshots. |
| [Product Hunt](https://www.producthunt.com/launch) | Hold for evidence | Developer Tools / Video | Requires an owner-approved launch, real screenshots, a short demo, and current support copy. Do not ask directly for upvotes. |
| Show HN | Hold for evidence | Show HN post | Publish only from an authorized account when a public demo and a technically useful launch story are ready. |
| macOS application lists | Hold | Screen recording / video | Wait for real-device validation, Developer ID signing, notarization, and approved Mac screenshots. |

Directory status can drift. Search for an existing Flowtake entry or open pull
request immediately before submitting.

## Awesome-list entries

Use the destination's exact Markdown style. These lines are intentionally
specific about the current export and platform boundary.

### awesome-tauri

```markdown
- [Flowtake](https://github.com/JNX03/Flowtake) - Local-first screen recorder and timeline editor built with Tauri, with cursor-driven zoom and local video-only H.264 MP4 export. Windows is primary; macOS and Linux are previews.
```

### General free-app and video lists

```markdown
- [Flowtake](https://github.com/JNX03/Flowtake) - MIT-licensed, local-first screen recorder and timeline editor with cursor-driven zoom and local video-only H.264 MP4 export. Windows is primary; macOS and Linux are previews.
```

If a list requires a shorter entry, use:

```markdown
- [Flowtake](https://github.com/JNX03/Flowtake) - Local-first screen recorder and timeline editor for developer demos. Windows primary; macOS/Linux preview.
```

Do not remove the platform qualifier merely to make an entry more promotional.

## Directory listing data

Use this block for AlternativeTo or another factual application directory:

| Field | Value |
|---|---|
| Name | Flowtake |
| Website | https://jnx03.github.io/Flowtake/ |
| Source | https://github.com/JNX03/Flowtake |
| Download | https://github.com/JNX03/Flowtake/releases/latest |
| License | MIT |
| Price | Free for the open-source desktop recorder and editor |
| Platforms | Windows 10/11 x64 primary; macOS 10.15+ Universal preview; Linux x64 preview |
| Category | Screen recorder; timeline video editor; developer demo tool |
| Export boundary | v1.6.0 edited export is a video-only AVC/H.264 MP4 |
| Linux boundary | X11 or XWayland capture; no pure Wayland capture |
| macOS boundary | Ad-hoc signed and not notarized |

Suggested description:

> Flowtake is a free, MIT-licensed desktop screen recorder and timeline editor.
> It captures a display, window, or custom area, generates editable zoom and
> pan from cursor activity, and saves projects and ordinary exports locally.
> Windows is the primary platform; macOS and Linux builds are previews. In
> v1.6.0, edited export produces a video-only H.264 MP4.

## Launch copy

Launch platforms need real product evidence, not concept art or private QA
captures.

### Product Hunt

**Tagline**

> Record locally. Shape developer demos on a timeline.

**Description**

> Flowtake is a free, MIT-licensed desktop screen recorder and editor for
> developer demos. Capture a screen, window, or area; turn cursor activity into
> editable zoom and pan; refine the result on a timeline; and export a local
> video-only H.264 MP4. Windows is primary, while macOS and Linux builds remain
> previews.

### Show HN

**Title**

> Show HN: Flowtake – an MIT-licensed local-first screen recorder and editor

**Opening**

> I built Flowtake to keep the developer-demo workflow in one inspectable
> desktop app: capture a screen, window, or area; generate editable zoom and pan
> from cursor activity; refine it on a timeline; and export locally. The code is
> MIT licensed. Windows is the primary target today; macOS and Linux are
> previews, and v1.6.0 edited export is video-only H.264. I would especially
> value reproducible reports about capture reliability and project recovery.

Rewrite first-person wording if the post is made by someone other than the
maintainer who built the project.

## Package distribution

Package-manager badges must be added only after a listing is accepted and its
install command is verified.

| Channel | Current posture | Required gate |
|---|---|---|
| WinGet | Published as `JNX03.Flowtake` | Keep the accepted [microsoft/winget-pkgs PR #403282](https://github.com/microsoft/winget-pkgs/pull/403282) current and verify install, upgrade, and uninstall on each release. Do not submit a duplicate ID. |
| Scoop Extras | Candidate | Verify the portable archive, persistence behavior, version check, and hash in a local manifest test. |
| Chocolatey Community Repository | Candidate | Confirm package ownership and maintenance; use immutable official release assets and checksums. |
| Flathub | Hold | Linux is preview; first document and test capture dependencies, supported sessions, sandbox permissions, upgrades, and AppStream metadata. |
| AUR | Hold | Linux is preview; establish an owner able to maintain the PKGBUILD and validate releases. |
| Homebrew Cask | Do not submit yet | The current macOS app is not Developer ID signed or notarized. It must pass Gatekeeper and meet [Homebrew's current acceptable-cask rules](https://docs.brew.sh/Acceptable-Casks), including applicable notability rules. |
| Mac App Store | Hold | Requires an Apple developer account plus validated signing, sandbox/entitlement compatibility, privacy metadata, and real-device QA. |

External package repositories require their own maintainer account and review.
Preparing or testing a manifest locally does not authorize publishing it.

## macOS outreach gate

Do not submit Flowtake to macOS-focused application lists—including
[open-source-mac-os-apps](https://github.com/serhii-londar/open-source-mac-os-apps),
[awesome-mac](https://github.com/jaywcjlove/awesome-mac), or
[awesome-macOS](https://github.com/iCHAIT/awesome-macOS)—until:

1. The native capture path is validated on real supported Mac hardware.
2. Install, permissions, capture, stop/recovery, edit, export, and uninstall
   have a published regression result.
3. The release is Developer ID signed and notarized.
4. Privacy-reviewed Mac screenshots and demo footage match the release.
5. The README, release notes, press kit, and listing copy state the same support
   boundary.

Experimental Swift or ScreenCaptureKit work is not a shipped feature claim.

## Evidence checklist

Before a directory listing, launch, or package PR:

- [ ] Confirm the latest public version and release date.
- [ ] Confirm artifact names, URLs, hashes, and supported operating systems.
- [ ] Confirm the edited-export audio boundary for that version.
- [ ] Keep Windows primary and macOS/Linux preview labels unless promotion gates
      have been met and documented.
- [ ] State that macOS is not notarized while that remains true.
- [ ] State that pure Wayland capture is unsupported while that remains true.
- [ ] Use only privacy-reviewed public screenshots and demo footage.
- [ ] Exclude local `artifacts/`, private QA captures, tokens, notifications,
      paths, and user data.
- [ ] Check for an existing listing or open submission.
- [ ] Re-read the destination's rules.
- [ ] Obtain explicit maintainer approval for the external action.
- [ ] Save the final URL and submission date in the status table after
      publication.
