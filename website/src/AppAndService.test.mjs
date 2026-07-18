import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("AppAndService keeps the free app complete and the paid human service separate", async () => {
  const [component, styles] = await Promise.all([
    source("./components/AppAndService.jsx"),
    source("./components/app-and-service.css"),
  ]);

  for (const required of [
    "The full MIT-licensed Flowtake app is $0.",
    "Screen, window, and selected-area capture",
    "Editable timeline",
    "Zoom, cursor treatment, captions, and redaction",
    "Local MP4 export",
    "Release Studio is an optional human production service at $99/month during the founding pilot.",
    "4 short demo packages each paid month",
    "A 16:9 master + social cutdown for each demo",
    "Human editing for pacing, captions, cursor treatment, and cleanup",
    "Private review + one focused revision",
    "Release Studio unlocks no Flowtake app features.",
    "Need an editor too?",
    "What you get when you add Studio",
    "The software stays the same. The work and deliverables change.",
    "The complete MIT-licensed app",
    "A human editor works from your approved brief and sanitized capture",
    "first cut within 3 business days after usable inputs",
    "Use Flowtake yourself, or hire an editor.",
    "Release Studio covers human editing and delivery. It does not change the software.",
    "Compare Windows recording workflows",
    'app-and-service__sr-only">Flowtake app:',
    'app-and-service__sr-only">With Release Studio:',
  ]) {
    assert.equal(component.includes(required), true, `missing truthful distinction: ${required}`);
  }

  assert.equal(component.includes("$99"), true);
  assert.equal(component.includes("/ month, founding pilot"), true);
  assert.equal(component.includes("https://github.com/JNX03/Flowtake"), true);
  assert.equal(component.includes("href={downloadUrl}"), true);
  assert.equal(component.includes("onClick={onDownload}"), true);
  assert.equal(component.includes("onClick={onGitHub}"), true);
  assert.equal(component.includes("onClick={onRequestStudio}"), true);
  assert.equal(component.includes("Human polish"), false);
  assert.equal(component.includes("Compare with Screen Studio on Windows"), false);
  assert.equal(component.includes("app-and-service__final-boundary"), false);
  assert.equal(component.includes("<section"), true);
  assert.equal(component.match(/<article/gu)?.length, 2);
  assert.equal(component.indexOf("app-and-service__panel--app") < component.indexOf("app-and-service__panel--service"), true);
  assert.equal(styles.includes("linear-gradient"), false);
  assert.equal(styles.includes("radial-gradient"), false);
  assert.equal(styles.includes("font-family: \"Poppins\""), true);
  assert.equal(styles.includes(".app-and-service__panel--app"), true);
  assert.equal(styles.includes(".app-and-service__mobile-divider"), true);
});
