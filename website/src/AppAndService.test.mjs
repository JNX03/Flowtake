import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("AppAndService separates free local tools, the Pro review, and backend-gated hosting", async () => {
  const [component, styles] = await Promise.all([
    source("./components/AppAndService.jsx"),
    source("./components/app-and-service.css"),
  ]);

  for (const required of [
    "The complete MIT-licensed Flowtake desktop app stays $0.",
    "Screen, window, and selected-area capture",
    "Editable timeline",
    "Zoom, cursor treatment, captions, and redaction",
    "Local, video-only AVC MP4 export",
    "Explicit browser picker for a tab, window, or screen",
    "Local, video-only WebM preview and download",
    "No account, automatic upload, microphone, or audio track",
    "10-minute and 250 MiB local safety limits",
    "Device-local trim and real-time, video-only WebM export",
    "Manual smooth cursor path with no automatic cursor tracking",
    "Manual zoom center and strength controls",
    "Optional screen and camera composition",
    "Private links with optional passcode and explicit expiry",
    "Immediate revoke or delete controls",
    "Timestamp comments and aggregate playback sessions",
    "A separate backend gate before any hosted transfer",
    "What Pro would add",
    "What the $9 hypothesis would add",
    "The local desktop app stays complete.",
    "The complete MIT desktop app stays free.",
    "No account or upload is needed for either local workflow.",
    "Keep the complete desktop app. Add a browser workflow only if it helps.",
    "Pro is a private product-review hypothesis.",
    "nothing on this site creates a Pro entitlement, starts billing, uploads",
    "2 GB active storage, 10 active links",
    "Compare Windows recording workflows",
    'app-and-service__sr-only">Free local tools:',
    'app-and-service__sr-only">Pro private review:',
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
  assert.equal(component.includes("realtime collaborative"), false);
  assert.equal(component.includes("automatic cursor tracking"), true);
  assert.equal(component.includes("automatic cursor detection"), false);
  assert.equal(component.includes("Flowtake Pro is available"), false);
  assert.equal(component.includes("Start free trial"), false);
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
