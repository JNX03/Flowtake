# r/selfhosted post draft

**Subreddit**: r/selfhosted
**Important**: r/selfhosted is primarily server/service-focused (Home Assistant, Nextcloud, etc.). A desktop app is a STRETCH for this sub. Post carefully and lean HARD into the "no cloud, 100% local" angle. Expect moderator review.
**Alternative**: If mods remove it, pivot to r/privacytoolsIO or r/degoogle.

---

## Title
```
Flowtake — fully local, open-source screen recorder. No cloud, no account, no telemetry. Replaces Loom for privacy-conscious users.
```

## URL
```
https://github.com/JNX03/Flowtake
```

## Body

```
Sharing Flowtake, a free and open-source desktop screen recorder built specifically for people who don't want their recordings going through someone else's servers.

**The privacy story**:
- 100% local. Your recordings never leave your machine.
- No account required. No sign-up, no login, ever.
- No telemetry. No analytics SDK, no crash reporter, no phone-home.
- No cloud upload. All processing, editing, and export happens on-device.
- FFmpeg is bundled — the only network call is if you explicitly check for an app update.
- MIT licensed. Verify everything in `src-tauri/src/commands/`.

**The feature story** (so it's not just "loom but local"):
- Automatic zoom and pan animations that follow your cursor — gives the recording a polished product-demo feel without manual keyframing
- Full timeline editor: clips, overlays, audio tracks, subtitles, masks + blur (great for redacting sensitive info before sharing), custom backgrounds
- Bundled teleprompter with speech recognition for hands-free narration
- Multi-format export via FFmpeg — MP4, WebM, configurable bitrate/codec
- Cross-platform: Windows (stable), macOS + Linux (dev preview)

**Why post here**: Most screen recorders I looked at either (a) require a cloud account, (b) upload your recordings for "processing", or (c) send telemetry you can't turn off. Flowtake is none of those. Everything stays where you put it. If you're the kind of person who self-hosts Bitwarden and Nextcloud to keep your data off third-party servers, this fits the same philosophy but for screen recordings.

**Install**: binaries for Windows / Mac / Linux (including .AppImage, .deb, .rpm) at https://github.com/JNX03/Flowtake/releases/latest

Source: https://github.com/JNX03/Flowtake

Not technically self-hostable in the classic sense (it's a desktop app, not a server) but the spirit is aligned — happy to answer questions on the architecture, storage, or anything else.
```

---

## Pitfalls specific to this sub
- Be ready for "this isn't really selfhosted, it's just a local app" pushback. Acknowledge it honestly.
- Don't compare to commercial alternatives as a sales pitch — frame it as a privacy choice.
- Mention telemetry status CLEARLY — this sub is allergic to any phone-home.
- If removed, don't re-post. Move to r/privacy, r/privacytoolsIO, r/degoogle instead.
