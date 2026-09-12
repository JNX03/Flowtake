import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("the public site, README, and press kit present one free open-source product", async () => {
  const [home, readme, press, comparison, guide, app] = await Promise.all([
    source("./HomePage.jsx"),
    source("../../README.md"),
    source("../../PRESS.md"),
    source("../screen-studio-alternative-windows/index.html"),
    source("../developer-tool-demo-storyboard/index.html"),
    source("./App.jsx"),
  ]);
  const publicCopy = `${home}\n${readme}\n${press}\n${comparison}\n${guide}`;

  for (const required of [
    "Community demo kit",
    "Open the free demo kit",
    "no paid app tier",
    "No checkout, private upload, or lead form",
    "GitHub issues and discussions are public",
  ]) {
    assert.equal(publicCopy.toLowerCase().includes(required.toLowerCase()), true, `missing free-only boundary: ${required}`);
  }

  for (const prohibited of [
    "$99",
    "founding rate",
    "Request a sample storyboard",
    "optional production service",
    "Release Studio",
  ]) {
    assert.equal(publicCopy.includes(prohibited), false, `paid-service copy remains: ${prohibited}`);
  }

  assert.equal(app.includes("BriefDialog"), false);
  assert.equal(app.includes("HomePage"), true);
});

test("the homepage has no lead funnel or Flowtake analytics request", async () => {
  const [home, comparisonRuntime, guideRuntime, deployment] = await Promise.all([
    source("./HomePage.jsx"),
    source("./screenStudioAlternative.main.jsx"),
    source("./developerToolDemoStoryboard.main.js"),
    source("../DEPLOYMENT.md"),
  ]);
  const runtime = `${home}\n${comparisonRuntime}\n${guideRuntime}`;

  for (const prohibited of [
    "sendEvent",
    "submitLead",
    "createLeadPayload",
    "/v1/leads",
    "/v1/events",
    "flowtake.72-62-41-174.sslip.io",
    "data-open-brief",
    "data-track",
  ]) {
    assert.equal(runtime.includes(prohibited), false, `service-funnel runtime remains: ${prohibited}`);
  }

  assert.equal(home.includes("This website has no sales form, checkout, customer-file upload, or Flowtake event-analytics request."), true);
  assert.equal(deployment.includes("no lead form, checkout, customer-file upload, or Flowtake event-analytics endpoint"), true);
});

test("the free homepage keeps its truthful product and platform boundaries", async () => {
  const home = await source("./HomePage.jsx");
  const features = home.slice(home.indexOf("const productFeatures = ["), home.indexOf("const productFacts = ["));

  assert.equal((features.match(/number: "0[1-3]"/gu) || []).length, 3);
  for (const required of [
    "Capture the right window.",
    "Shape the timeline.",
    "Export locally.",
    "Current source builds export H.264/MP4 or VP9/WebM locally.",
    "Recorded and timeline audio are mixed into the exported file when present and enabled.",
    "Windows 10/11 x64 is the primary validation target",
    "macOS and Linux builds are previews",
    "pure Wayland capture is unsupported",
    "not fully offline",
    "Windows artifacts are not Authenticode-signed",
  ]) {
    assert.equal(home.includes(required), true, `missing truth boundary: ${required}`);
  }

  assert.equal(home.includes("Concept frame—not product footage, customer work, or a finished video."), true);
  assert.equal(home.includes("<video"), false);
  assert.equal(home.includes("customer logo"), false);
  assert.equal(home.includes("testimonial"), false);
});
