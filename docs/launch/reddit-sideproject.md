# r/SideProject post draft

**Subreddit**: r/SideProject
**Flair**: "Sharing" or "Feedback Requested"
**Best time**: Weekday mornings (9-11 AM ET)
**Rules check**: r/SideProject is very launch-friendly, no karma min, allows links. Post as LINK to GitHub release, not text post.

---

## Title (300 char max — current: 115)
```
I spent 2 years building a free open-source Screen Studio alternative — Flowtake, runs on Windows/Mac/Linux
```

## URL
```
https://github.com/JNX03/Flowtake
```

## Body (for text-post variant, if required)

```
Hey r/SideProject — wanted to share a thing I've been grinding on for 2 years.

Flowtake is a desktop screen recorder that automatically adds smooth zoom and pan animations to your recordings — basically the thing Screen Studio does, but free, open-source (MIT), and cross-platform. 367 commits, v1.4.2 is out, and it's finally stable enough to share.

How it works:
1. Start a recording (full screen, window, or region)
2. Click around your app, show what you want to show
3. Stop — the editor opens with zoom animations already placed around your cursor, smooth cursor motion, and motion blur scaled by speed
4. Tweak anything in the timeline, add overlays / subtitles / masks, export

Stuff I'm proud of:
- The zoom isn't AI — it's a deterministic focus-score algorithm, runs offline, instant
- Built-in teleprompter with speech-sync (haven't seen this in other recorders)
- Masks + blur for redacting sensitive stuff
- FFmpeg is bundled, nothing to install
- ~80 MB binary because it's Tauri v2 (Rust) not Electron

What's honestly rough:
- Windows is stable. macOS and Linux builds exist but they're a dev preview — expect bugs
- No landing page yet (I'm bad at marketing, this post is literally day 1 of trying)
- Zero stars before this post 😅

It's free forever, no account, no cloud, no subscription. If you try it and hit a bug, issues + PRs are super welcome.

Download: https://github.com/JNX03/Flowtake/releases/latest
Source: https://github.com/JNX03/Flowtake

Happy to answer questions / take feedback — would love to hear what I'm missing vs other tools in this space.
```

---

## Response templates

**"Looks nice, will try later"**
> Thanks! If you do try it, dm me or open an issue for anything weird. Feedback from people who actually run it is 10x more useful than stars.

**"Why Tauri?"**
> Smaller binary than Electron (~80MB vs 300MB+), faster startup, better memory usage. Took a while to figure out the Rust patterns but it's worth it for a desktop app.

**"Can I use this for commercial YouTube content?"**
> Yes — MIT license, use it for whatever. No attribution required but shoutouts are appreciated 🙏

**"How long did 2 years actually feel?"**
> Honestly? Mostly fun. ~50% was figuring out how to make the cursor look natural in animations, which is a deeper rabbit hole than I expected.
```

---

## Pitfalls to avoid
- Don't link-farm (one URL, not five)
- Don't start with "Hey guys" — the sub hates it
- Don't use "epic" / "amazing" / "the BEST" — subreddit tone is humble
- Reply to every comment within the first 2 hours or the post decays
```
