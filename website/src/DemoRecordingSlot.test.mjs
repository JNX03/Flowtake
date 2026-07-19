import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isLoopbackHostname,
  shouldShowDemoRecordingSlot,
  shouldShowDemoRecordingSlotForLocation,
} from "./demoReviewSlot.js";

test("recording review selector is exact, loopback-only, and reviewed media wins", () => {
  for (const hostname of ["localhost", "LOCALHOST", "127.0.0.1", "::1", "[::1]"]) {
    assert.equal(isLoopbackHostname(hostname), true);
    assert.equal(shouldShowDemoRecordingSlot({
      hostname,
      search: "?demo-review=recording",
    }), true);
  }

  for (const hostname of [
    "",
    "0.0.0.0",
    "127.0.0.2",
    "flowtake.local",
    "jnx03.github.io",
  ]) {
    assert.equal(shouldShowDemoRecordingSlot({
      hostname,
      search: "?demo-review=recording",
    }), false);
  }

  for (const search of [
    "",
    "?demo-review",
    "?demo-review=1",
    "?demo-review=Recording",
    "?demo-review=recording-preview",
  ]) {
    assert.equal(shouldShowDemoRecordingSlot({
      hostname: "127.0.0.1",
      search,
    }), false);
  }

  assert.equal(shouldShowDemoRecordingSlot({
    hasReviewedMedia: true,
    hostname: "127.0.0.1",
    search: "?demo-review=recording",
  }), false);
  assert.equal(shouldShowDemoRecordingSlotForLocation({
    hostname: "localhost",
    search: "?demo-review=recording&source=operator",
  }), true);
  assert.equal(shouldShowDemoRecordingSlotForLocation(undefined), false);
});

test("recording review component is a factual 16:9 Windows handoff, not simulated media", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("./components/DemoRecordingSlot.jsx", import.meta.url), "utf8"),
    readFile(new URL("./components/demo-recording-slot.css", import.meta.url), "utf8"),
  ]);

  for (const required of [
    "shouldShowDemoRecordingSlotForLocation",
    "hasReviewedMedia = hasReviewedDemoMedia",
    "if (!isVisible) return fallback;",
    "flowtake-demo-source.mp4",
    "product-media/public/flowtake-v1.6.0-demo.mp4",
    "Exact above-the-fold demo slot · Windows 10/11",
    "The approved 42-second demo will replace this frame.",
    "This exact 16:9 position will load",
    "separate non-admin",
    "1920×1080 at 30 fps",
    "OBS Window Capture",
    "one uninterrupted raw source up to five minutes",
    "keep honest save and render waits",
    "Uninterrupted Windows source capture sequence",
    "Stop immediately for SmartScreen, permission, or administrator prompts",
    "a black, stale, frozen, or wrong window",
    "fall back to Display",
    "unexpected personal content",
    "Codex will remove",
    "exact 42-second master",
    "should not be edited to 42 seconds",
    "Approved-demo edit map",
    "Six shots for the final 42-second cut.",
    "These timings describe the later reviewed edit",
    "Final reviewed demo shot list",
    "0–3 seconds",
    "3–10 seconds",
    "10–18 seconds",
    "18–28 seconds",
    "28–36 seconds",
    "36–42 seconds",
    "Recording - Flowtake",
    "Export - Flowtake",
    "Clean browser",
    "Use synthetic or public content only.",
    "aspect-ratio: 16 / 9",
  ]) {
    assert.equal(`${component}\n${styles}`.includes(required), true, `missing recording-slot requirement: ${required}`);
  }

  for (const forbidden of [
    "<video",
    "<img",
    "<canvas",
    "<svg",
    "<button",
    "linear-gradient",
    "radial-gradient",
    "data:image",
  ]) {
    assert.equal(component.includes(forbidden), false, `recording slot must not simulate media: ${forbidden}`);
  }

  assert.equal(component.includes("42-second Windows capture sequence"), false);
  assert.equal(component.indexOf("The raw source") < component.indexOf("Approved-demo edit map"), true);
});
