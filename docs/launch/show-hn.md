# Show HN draft

**Submit at**: https://news.ycombinator.com/submit
**Best time**: Tuesday-Thursday, 7-10am PT (peak US morning traffic, early enough to ride the front-page wave)
**Important**: Don't cross-post immediately with PH. Space it by 24-48h so both posts breathe.

---

## Title (80 char max — current: 78)
```
Show HN: Flowtake – Open-source screen recorder with auto-zoom animations
```

## URL
```
https://github.com/JNX03/Flowtake
```

## Text (optional, leave BLANK — HN shows the linked README instead for "Show HN" posts; adding text can fragment engagement)

---

## First comment — post IMMEDIATELY after submission

```
Hi HN, Jnx03 here, the author.

Flowtake is a desktop screen recorder I've been building for ~2 years (367 commits) that adds Screen Studio–style zoom and pan animations automatically. Record your screen, stop, and the editor has already placed smooth zoom transitions around your cursor and pan animations that anticipate its movement.

A few things I found interesting while building this that HN might appreciate:

1. The zoom is deterministic, not ML-based. It scores cursor position, velocity, click events, and dwell time, then fits zoom keyframes around local maxima of a "focus score" function. Runs offline, ~instant.

2. Cursor inertia with velocity-based motion blur makes a bigger perceptual difference than the zooms themselves. Slow movements look rigid without it; blur proportional to speed "hides" the low frame rate of most captures and makes the result feel buttery.

3. Tauri v2 was the right call vs Electron for a video app — the preview runs in a Pixi.js (WebGL) canvas and the Rust side handles recording + FFmpeg, so there's a clean split between IO-heavy and GPU-heavy work. Binary is ~80 MB installed vs the 300+ MB I was seeing with Electron prototypes.

4. Cross-platform screen recording on Linux (Wayland specifically) is brutal. I landed on PipeWire via xdg-desktop-portal, and it still has edge cases I'm not happy with. Windows (DXGI) and macOS (CGWindowList / ScreenCaptureKit) are much cleaner APIs.

MIT licensed, Windows build is stable, macOS and Linux builds exist but are a dev preview. FFmpeg is bundled.

Installers for all three platforms: https://github.com/JNX03/Flowtake/releases/latest

Happy to answer anything — especially interested in what's broken for you if you try it.
```

---

## Response templates (prep these so you can reply fast)

**"How does the auto-zoom compare to Screen Studio?"**
> Honest answer: Screen Studio is more polished and has more tuning knobs. Flowtake gets you ~80% of the way there for free and on platforms Screen Studio doesn't support (Windows, Linux). The zoom algorithm is different — Screen Studio's is partly heuristic-based around click events, Flowtake's is a continuous focus score that handles dwell time too.

**"Why not WebRTC getDisplayMedia?"**
> Tried it. Frame timing is too unreliable for animation work — you get uneven gaps between frames and the cursor position doesn't come through. Native APIs (DXGI / ScreenCaptureKit / PipeWire) give you timestamps and separate cursor tracking, which is what the zoom algorithm needs.

**"Electron would have been fine"**
> Maybe, but the Pixi.js preview + Rust FFmpeg pipeline pattern is nice to write. Tauri's IPC is synchronous-feeling from JS, and the command model (`invoke("x", {args})`) composes well with Redux. The binary size is just a nice side effect.

**"Wayland / Linux is terrible for this"**
> Yes. PipeWire + xdg-desktop-portal works but there are still compositor-specific quirks (especially KDE vs GNOME cursor behavior). If anyone's shipped a Wayland recorder that handles cursor events reliably, I'd love to copy notes.

**"Why MIT and not AGPL?"**
> Wanted maximum permissiveness. If someone forks it to build a commercial competitor I honestly don't mind — the goal was to make the Screen Studio pattern accessible, not to build a business around it.

**"Is there a telemetry?"**
> No. No analytics, no crash reporter, no network calls except when you opt in to FFmpeg updates. Everything is local. Verify in `src-tauri/src/commands/` if you're curious.

**"Can I contribute?"**
> Yes, please. Wayland fixes, macOS fixes, and the auto-zoom tuning parameters are the highest-impact areas. CONTRIBUTING.md has the details.

---

## HN hygiene notes
- Don't ask for upvotes anywhere — HN will flag.
- Don't re-submit if the first attempt sinks; wait 24h or pick a different day.
- Reply to every comment genuinely. HN rewards presence.
- Don't link to the PH page in the body — can look cross-promotional.
- If the post starts trending, do NOT post Reddit at the same time; stagger to preserve bandwidth for responding.
