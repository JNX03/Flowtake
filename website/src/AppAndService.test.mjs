import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("AppAndService keeps the free app complete and labels the hosted Cloud beta as planned", async () => {
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
    "The planned founding beta adds private review links for finished videos.",
    "Private review links for uploaded H.264 MP4 exports",
    "Optional passcode plus 1, 7, or 30-day expiry",
    "Revoke or delete an active link at any time",
    "Timestamp comments and aggregate playback sessions",
    "Need private sharing?",
    "What the planned Cloud beta adds",
    "The local app stays complete. Only the optional hosted review workflow changes.",
    "The complete MIT-licensed app",
    "You intentionally upload a finished H.264 MP4 for private review",
    "aggregate playback sessions, not identified viewer counts",
    "Edit locally. Share a finished video when you choose.",
    "Flowtake Cloud is a planned hosted review layer.",
    "2 GB active storage, 10 active links, 250 MB and 10 minutes per",
    "Native desktop upload and realtime collaborative editing are planned",
    "Compare Windows recording workflows",
    'app-and-service__sr-only">Flowtake app:',
    'app-and-service__sr-only">With Flowtake Cloud:',
  ]) {
    assert.equal(component.includes(required), true, `missing truthful distinction: ${required}`);
  }

  assert.equal(component.includes("$9"), true);
  assert.equal(component.includes("/ month hypothesis"), true);
  assert.equal(component.includes("https://github.com/JNX03/Flowtake"), true);
  assert.equal(component.includes("href={downloadUrl}"), true);
  assert.equal(component.includes("onClick={onDownload}"), true);
  assert.equal(component.includes("onClick={onGitHub}"), true);
  assert.equal(component.includes("onClick={onRequestCloud}"), true);
  assert.equal(component.includes("Human polish"), false);
  assert.equal(component.includes("Release Studio"), false);
  assert.equal(component.includes("human production"), false);
  assert.equal(component.includes("hire an editor"), false);
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
