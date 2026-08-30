import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const comparisonUrl = "https://jnx03.github.io/Flowtake/screen-studio-alternative-windows/";
const guideUrl = "https://jnx03.github.io/Flowtake/developer-tool-demo-storyboard/";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

function occurrences(value, needle) {
  return value.split(needle).length - 1;
}

test("the Windows comparison is a physical Vite MPA route", async () => {
  const [config, page] = await Promise.all([
    source("../vite.config.mjs"),
    source("../screen-studio-alternative-windows/index.html"),
  ]);

  assert.equal(config.includes('appType: "mpa"'), true);
  assert.equal(config.includes('"screen-studio-alternative-windows/index.html"'), true);
  assert.equal(page.includes('<h1>\n              A Screen Studio'), true);
  assert.equal(page.includes("Flowtake is not a feature-for-feature Screen Studio clone."), true);
  assert.equal(page.includes('<div id="root"></div>'), false);
});

test("comparison metadata is unique, self-canonical, and conservative", async () => {
  const page = await source("../screen-studio-alternative-windows/index.html");

  assert.equal(occurrences(page, "<title>"), 1);
  assert.equal(occurrences(page, 'name="description"'), 1);
  assert.equal(occurrences(page, 'rel="canonical"'), 1);
  assert.equal(occurrences(page, 'property="og:url"'), 1);
  assert.equal(page.includes(`<link rel="canonical" href="${comparisonUrl}" />`), true);
  assert.equal(page.includes(`<meta property="og:url" content="${comparisonUrl}" />`), true);
  assert.equal(page.includes("Screen Studio Alternative for Windows: Flowtake"), true);
  assert.equal(page.includes('"@type": "Review"'), false);
  assert.equal(page.includes("AggregateRating"), false);

  const blocks = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)];
  assert.equal(blocks.length, 1);
  assert.doesNotThrow(() => JSON.parse(blocks[0][1]));
});

test("comparison copy preserves the product and security boundaries", async () => {
  const page = await source("../screen-studio-alternative-windows/index.html");

  const normalizedPage = page.toLowerCase();
  for (const required of [
    "Windows 10/11",
    "free, MIT-licensed",
    "unsigned",
    "SmartScreen",
    "SHA256SUMS.txt",
    "ordinary recordings, projects, and exports stay local",
    "not affiliated with or endorsed by Screen Studio",
    "observed July 16, 2026",
    "macOS and Linux builds are previews",
  ]) {
    assert.equal(normalizedPage.includes(required.toLowerCase()), true, `missing comparison boundary: ${required}`);
  }

  for (const prohibited of ["best Screen Studio", "drop-in replacement", "completely offline", "feature parity"] ) {
    assert.equal(page.toLowerCase().includes(prohibited.toLowerCase()), false, `unsafe claim: ${prohibited}`);
  }
});

test("the comparison route is discoverable and uses root privacy for the shared form", async () => {
  const [home, dialog, enhancements, sitemap] = await Promise.all([
    source("./HomePage.jsx"),
    source("./BriefDialog.jsx"),
    source("./screenStudioAlternative.main.jsx"),
    source("../public/sitemap.xml"),
  ]);
  const app = `${home}\n${dialog}`;

  assert.equal(app.includes("screen-studio-alternative-windows/"), true);
  assert.equal(app.includes('privacyHref = "#privacy"'), true);
  assert.equal(enhancements.includes('privacyHref={`${BASE_URL}#privacy`}'), true);
  assert.equal(occurrences(sitemap, `<loc>${comparisonUrl}</loc>`), 1);
});

test("the developer-tool storyboard guide is a physical Vite MPA route", async () => {
  const [config, page] = await Promise.all([
    source("../vite.config.mjs"),
    source("../developer-tool-demo-storyboard/index.html"),
  ]);

  assert.equal(config.includes('appType: "mpa"'), true);
  assert.equal(config.includes('"developer-tool-demo-storyboard/index.html"'), true);
  assert.equal(page.includes("Plan a 45-second"), true);
  assert.equal(page.includes("developer-tool demo <em>in six beats.</em>"), true);
  assert.equal(page.includes('<div id="root"></div>'), false);
  assert.equal(page.includes('/src/developerToolDemoStoryboard.main.js'), true);
});

test("storyboard guide metadata is unique, self-canonical, and WebPage-only", async () => {
  const page = await source("../developer-tool-demo-storyboard/index.html");

  assert.equal(occurrences(page, "<title>"), 1);
  assert.equal(occurrences(page, 'name="description"'), 1);
  assert.equal(occurrences(page, 'rel="canonical"'), 1);
  assert.equal(occurrences(page, 'property="og:url"'), 1);
  assert.equal(page.includes(`<link rel="canonical" href="${guideUrl}" />`), true);
  assert.equal(page.includes(`<meta property="og:url" content="${guideUrl}" />`), true);
  assert.equal(page.includes("Developer Tool Demo Video: 6-Beat Storyboard Template | Flowtake"), true);

  const blocks = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)];
  assert.equal(blocks.length, 1);
  const structuredData = JSON.parse(blocks[0][1]);
  assert.equal(structuredData["@type"], "WebPage");
  assert.equal(page.includes("VideoObject"), false);
  assert.equal(page.includes("SoftwareApplication"), false);
  assert.equal(page.includes("AggregateRating"), false);
});

test("storyboard guide includes six copyable beats and truthful boundaries", async () => {
  const page = await source("../developer-tool-demo-storyboard/index.html");
  const template = page.slice(page.indexOf('<section class="section comparison-section guide-section" id="template">'), page.indexOf('<section class="section comparison-section comparison-section-bordered guide-brief-section"'));
  const rows = template.slice(template.indexOf("<tbody>"), template.indexOf("</tbody>"));
  const plainTextMatch = template.match(/<textarea id="six-beat-template"[^>]*>([\s\S]*?)<\/textarea>/u);

  assert.equal(occurrences(rows, "<tr>"), 6);
  assert.ok(plainTextMatch, "missing serialized plain-text storyboard");
  const plainTextTemplate = plainTextMatch[1];
  for (const timing of ["0–4s", "4–10s", "10–22s", "22–31s", "31–39s", "39–45s"]) {
    assert.equal(plainTextTemplate.includes(timing), true, `copy payload missing timing: ${timing}`);
  }
  for (const label of ["Screen action:", "Narration prompt:", "Visible proof:", "Exclude from capture:"]) {
    assert.equal(occurrences(plainTextTemplate, label), 6, `copy payload must include ${label} for every beat`);
  }
  assert.equal(page.includes("data-copy-template>Copy the six-beat template</button>"), true);
  assert.equal(page.includes("The storyboard text is not uploaded when you copy it. Flowtake records only a cookie-free aggregate copy count."), true);
  assert.equal(page.includes("The brief text is not uploaded when you copy it. Flowtake records only a cookie-free aggregate copy count."), true);
  for (const required of [
    "0–4s",
    "4–10s",
    "10–22s",
    "22–31s",
    "31–39s",
    "39–45s",
    "Public project URL:",
    "Safe public or synthetic sources:",
    "Never capture:",
    "Single call to action:",
    "Pre-production example—not customer work or a finished video.",
    "not a performance benchmark",
    "Windows 10/11 x64 is the primary development and validation target",
    "macOS and Linux builds are previews",
    "Current Windows files are not Authenticode-signed",
  ]) {
    assert.equal(page.includes(required), true, `missing guide boundary: ${required}`);
  }

  for (const prohibited of [
    "proven to convert",
    "guaranteed",
    "completely offline",
    "customer testimonial",
    "customer logo",
  ]) {
    assert.equal(page.toLowerCase().includes(prohibited), false, `unsafe guide claim: ${prohibited}`);
  }

  assert.equal(page.includes("<video"), false);
  assert.equal(page.includes("<canvas"), false);
});

test("storyboard guide is linked, copy-enabled, and listed once in the sitemap", async () => {
  const [app, comparison, readme, enhancements, sitemap] = await Promise.all([
    source("./HomePage.jsx"),
    source("../screen-studio-alternative-windows/index.html"),
    source("../../README.md"),
    source("./developerToolDemoStoryboard.main.js"),
    source("../public/sitemap.xml"),
  ]);

  assert.equal(app.includes("developer-tool-demo-storyboard/"), true);
  assert.equal(comparison.includes("developer-tool-demo-storyboard/"), true);
  assert.equal(readme.includes("developer-tool-demo-storyboard/"), true);
  assert.equal(enhancements.includes('track("brief_copied")'), true);
  assert.equal(enhancements.includes("navigator.clipboard.writeText"), true);
  assert.equal(enhancements.includes('document.execCommand("copy") === true'), true);
  assert.equal(enhancements.includes("manualCopyMessage"), true);
  assert.equal(enhancements.includes('menuButton?.getAttribute("aria-expanded") !== "true"'), true);
  assert.equal(enhancements.includes("menuButton.focus()"), true);
  assert.equal(occurrences(sitemap, `<loc>${guideUrl}</loc>`), 1);
});
