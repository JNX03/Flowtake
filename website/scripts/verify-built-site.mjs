import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import {
  extractExportCopyLiterals,
  findExportTruthViolations,
} from "./export-truth-guard.mjs";

const comparisonUrl = "https://jnx03.github.io/Flowtake/screen-studio-alternative-windows/";
const guideUrl = "https://jnx03.github.io/Flowtake/developer-tool-demo-storyboard/";
const distUrl = new URL("../dist/", import.meta.url);

const [home, comparison, guide, sitemap] = await Promise.all([
  readFile(new URL("index.html", distUrl), "utf8"),
  readFile(new URL("screen-studio-alternative-windows/index.html", distUrl), "utf8"),
  readFile(new URL("developer-tool-demo-storyboard/index.html", distUrl), "utf8"),
  readFile(new URL("sitemap.xml", distUrl), "utf8"),
]);
const assetNames = await readdir(new URL("assets/", distUrl));
const runtimeSource = (await Promise.all(
  assetNames
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFile(new URL(`assets/${name}`, distUrl), "utf8")),
)).join("\n");
const runtimeExportCopy = extractExportCopyLiterals(runtimeSource).join("\n");
const comparisonFlowtakeCopy = [
  comparison.match(/<th scope="row">Export<\/th>\s*<td>([\s\S]*?)<\/td>/u)?.[1],
  comparison.match(/<p class="comparison-card-label">Export<\/p>[\s\S]*?<p>([\s\S]*?)<\/p>/u)?.[1],
].filter(Boolean).join("\n");
const storyboardFlowtakeExportCopy = [
  guide.match(/<h3>Export locally<\/h3>\s*<p class="storyboard-caption">([\s\S]*?)<\/p>/u)?.[1],
  guide.match(/<h3>Record and edit with the current source build\.<\/h3>\s*<ul>([\s\S]*?)<\/ul>/u)?.[1],
].filter(Boolean).join("\n");

const count = (value, needle) => value.split(needle).length - 1;
const assertNoUnsupportedExportClaims = (value, label) => {
  assert.deepEqual(findExportTruthViolations(value), [], `${label} contains a false export claim`);
};
const assertPagesRuntimeAssets = (html, label) => {
  assert.match(
    html,
    /<script[^>]+src="\/Flowtake\/assets\/[^"]+\.js"[^>]*><\/script>/u,
    `${label} runtime script must use the Pages base`,
  );
  assert.match(
    html,
    /<link[^>]+href="\/Flowtake\/assets\/[^"]+\.css"[^>]*>/u,
    `${label} stylesheet must use the Pages base`,
  );
  assert.equal(
    /(?:src|href)="\/assets\//u.test(html),
    false,
    `${label} must not contain root-based runtime assets`,
  );
};

for (const [label, html] of [
  ["homepage", home],
  ["comparison", comparison],
  ["storyboard guide", guide],
]) {
  assertPagesRuntimeAssets(html, label);
}

assert.equal(home.includes('href="https://jnx03.github.io/Flowtake/"'), true, "homepage canonical changed");
assert.equal(home.includes("free, open-source screen recorder and editor"), true, "homepage metadata changed");
assert.equal(count(home, "<title>"), 1, "homepage title must be unique");
assert.equal(count(home, 'name="description"'), 1, "homepage description must be unique");
assert.equal(count(home, 'rel="canonical"'), 1, "homepage canonical must be unique");
assert.equal(count(home, 'property="og:url"'), 1, "homepage og:url must be unique");
assert.equal(home.includes('content="https://jnx03.github.io/Flowtake/"'), true, "homepage og:url is wrong");

const homeJsonLdBlocks = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)];
assert.equal(homeJsonLdBlocks.length, 1, "homepage must have one JSON-LD block");
const homeStructuredData = JSON.parse(homeJsonLdBlocks[0][1]);
assert.equal(homeStructuredData["@type"], "SoftwareApplication", "homepage structured data must describe the app");
assert.equal(homeStructuredData.isAccessibleForFree, true, "homepage must preserve the free-app boundary");
assert.equal(home.includes("VideoObject"), false, "homepage must not claim a finished video");
assert.equal(home.includes("AggregateRating"), false, "homepage must not claim unverified ratings");
assert.equal(
  runtimeSource.includes("Current source builds export H.264/MP4 or VP9/WebM locally."),
  true,
  "built homepage must state both local export formats",
);
assert.equal(
  runtimeSource.includes("Recorded and timeline audio are mixed into the exported file when present and enabled."),
  true,
  "built homepage must state the conditional audio behavior",
);
assert.equal(runtimeSource.includes("Community demo kit"), true, "built homepage must expose the free community kit");
assert.equal(runtimeSource.includes("No checkout, private upload, or lead form"), true, "built homepage must keep the no-funnel boundary");

assert.equal(comparison.includes("A Screen Studio"), true, "comparison H1 content missing");
assert.equal(comparison.includes("Where Screen Studio is still stronger"), true, "honesty section missing");
assert.equal(comparison.includes("Flowtake is not a feature-for-feature Screen Studio clone"), true, "comparison boundary missing");
assert.equal(count(comparison, "<title>"), 1, "comparison title must be unique");
assert.equal(count(comparison, 'name="description"'), 1, "comparison description must be unique");
assert.equal(count(comparison, 'rel="canonical"'), 1, "comparison canonical must be unique");
assert.equal(count(comparison, 'property="og:url"'), 1, "comparison og:url must be unique");
assert.equal(comparison.includes(`href="${comparisonUrl}"`), true, "comparison canonical is wrong");
assert.equal(comparison.includes(`content="${comparisonUrl}"`), true, "comparison og:url is wrong");
assert.equal(
  comparison.includes("Current source: local H.264/MP4 or VP9/WebM with resolution, 30/60 fps, and quality controls; recorded and timeline audio are included when present and enabled"),
  true,
  "comparison must preserve the implemented formats, controls, and audio behavior",
);

const jsonLdBlocks = [...comparison.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)];
assert.equal(jsonLdBlocks.length, 1, "comparison must have one JSON-LD block");
for (const block of jsonLdBlocks) JSON.parse(block[1]);

assert.equal(count(sitemap, `<loc>${comparisonUrl}</loc>`), 1, "comparison sitemap entry must be unique");

assert.equal(guide.includes("Plan a 45-second"), true, "storyboard guide H1 content missing");
assert.equal(guide.includes("A six-beat storyboard for one real developer workflow"), true, "storyboard guide template missing");
assert.equal(guide.includes("data-copy-template>Copy the six-beat template</button>"), true, "storyboard copy action missing");
assert.equal(guide.includes('id="six-beat-template"'), true, "serialized storyboard copy payload missing");
assert.equal(
  guide.includes("The brief is copied by your browser. Flowtake does not upload the text or count the action."),
  true,
  "storyboard copy privacy boundary missing",
);
assert.equal(guide.includes("Pre-production example—not customer work or a finished video"), true, "storyboard truth boundary missing");
assert.equal(count(guide, "<title>"), 1, "storyboard guide title must be unique");
assert.equal(count(guide, 'name="description"'), 1, "storyboard guide description must be unique");
assert.equal(count(guide, 'rel="canonical"'), 1, "storyboard guide canonical must be unique");
assert.equal(count(guide, 'property="og:url"'), 1, "storyboard guide og:url must be unique");
assert.equal(guide.includes(`href="${guideUrl}"`), true, "storyboard guide canonical is wrong");
assert.equal(guide.includes(`content="${guideUrl}"`), true, "storyboard guide og:url is wrong");

const guideJsonLdBlocks = [...guide.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)];
assert.equal(guideJsonLdBlocks.length, 1, "storyboard guide must have one JSON-LD block");
const guideStructuredData = JSON.parse(guideJsonLdBlocks[0][1]);
assert.equal(guideStructuredData["@type"], "WebPage", "storyboard guide structured data must remain WebPage-only");
assert.equal(guide.includes("VideoObject"), false, "storyboard guide must not claim video structured data");
assert.equal(count(sitemap, `<loc>${guideUrl}</loc>`), 1, "storyboard guide sitemap entry must be unique");
assert.equal(
  guide.includes("“Export MP4 or WebM locally—with the edit's audio when present.”"),
  true,
  "storyboard must keep the factual export caption",
);
assert.equal(
  guide.includes("PixiJS composites the edited frames; Mediabunny encodes the H.264/MP4 or VP9/WebM video stream."),
  true,
  "storyboard must state the current final-export path",
);
assert.equal(
  guide.includes("Recorded and timeline audio are mixed to the edit and muxed into the exported file when present and enabled."),
  true,
  "storyboard must state the conditional audio behavior",
);
for (const prohibited of [
  "$99",
  "flowtake.72-62-41-174.sslip.io",
  "/v1/leads",
  "/v1/events",
  "Request a sample storyboard",
]) {
  assert.equal(
    `${runtimeSource}\n${comparison}\n${guide}`.includes(prohibited),
    false,
    `built website contains removed service-funnel token: ${prohibited}`,
  );
}
assertNoUnsupportedExportClaims(`${runtimeExportCopy}\n${storyboardFlowtakeExportCopy}`, "built homepage/storyboard copy");
assertNoUnsupportedExportClaims(comparisonFlowtakeCopy, "built comparison Flowtake copy");

const previewServer = await preview({
  root: fileURLToPath(new URL("../", import.meta.url)),
  mode: "pages",
  preview: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
});

try {
  const previewOrigin = "http://127.0.0.1:4174";
  const [homeResponse, comparisonResponse, guideResponse, unknownResponse] = await Promise.all([
    fetch(`${previewOrigin}/Flowtake/`),
    fetch(`${previewOrigin}/Flowtake/screen-studio-alternative-windows/`),
    fetch(`${previewOrigin}/Flowtake/developer-tool-demo-storyboard/`),
    fetch(`${previewOrigin}/Flowtake/not-a-real-page/`),
  ]);

  assert.equal(homeResponse.status, 200, "preview homepage must return 200");
  assert.equal(comparisonResponse.status, 200, "preview comparison route must return 200");
  assert.equal(guideResponse.status, 200, "preview storyboard guide route must return 200");
  assert.equal(unknownResponse.status, 404, "preview unknown route must remain a real 404");

  const runtimeAssetPaths = [...new Set(
    [home, comparison, guide].flatMap((html) =>
      [...html.matchAll(/(?:src|href)="(\/Flowtake\/assets\/[^"]+)"/gu)].map((match) => match[1])
    ),
  )];
  assert.ok(runtimeAssetPaths.length >= 6, "built pages must expose their runtime assets");
  const runtimeAssetResponses = await Promise.all(
    runtimeAssetPaths.map(async (assetPath) => [assetPath, await fetch(`${previewOrigin}${assetPath}`)]),
  );
  for (const [assetPath, response] of runtimeAssetResponses) {
    assert.equal(response.status, 200, `preview asset must load: ${assetPath}`);
  }

  assert.equal(
    (await comparisonResponse.text()).includes("A Screen Studio"),
    true,
    "preview comparison response must contain its static body",
  );
  assert.equal(
    (await guideResponse.text()).includes("Plan a 45-second"),
    true,
    "preview storyboard guide response must contain its static body",
  );
} finally {
  await new Promise((resolve, reject) => {
    previewServer.httpServer.close((error) => (error ? reject(error) : resolve()));
  });
}

process.stdout.write("Verified root, Screen Studio alternative, and storyboard guide Pages artifacts.\n");
