import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const comparisonUrl = "https://jnx03.github.io/Flowtake/screen-studio-alternative-windows/";

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
  const [app, enhancements, sitemap] = await Promise.all([
    source("./App.jsx"),
    source("./screenStudioAlternative.main.jsx"),
    source("../public/sitemap.xml"),
  ]);

  assert.equal(app.includes("screen-studio-alternative-windows/"), true);
  assert.equal(app.includes('privacyHref = "#privacy"'), true);
  assert.equal(enhancements.includes('privacyHref={`${BASE_URL}#privacy`}'), true);
  assert.equal(occurrences(sitemap, `<loc>${comparisonUrl}</loc>`), 1);
});
