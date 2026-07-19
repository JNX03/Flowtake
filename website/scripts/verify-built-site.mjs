import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import {
  extractExportCopyLiterals,
  findExportTruthViolations,
} from "./export-truth-guard.mjs";
import { verifyReviewedDemoMediaTree } from "./verify-reviewed-demo-media.mjs";

const comparisonUrl = "https://jnx03.github.io/Flowtake/screen-studio-alternative-windows/";
const guideUrl = "https://jnx03.github.io/Flowtake/developer-tool-demo-storyboard/";
const distUrl = new URL("../dist/", import.meta.url);
const sourceReviewedDemo = await verifyReviewedDemoMediaTree({
  publicRootUrl: new URL("../public/assets/product-media/public/", import.meta.url),
});
const builtReviewedDemo = await verifyReviewedDemoMediaTree({
  publicRootUrl: new URL("../dist/assets/product-media/public/", import.meta.url),
});
assert.equal(
  builtReviewedDemo.active,
  sourceReviewedDemo.active,
  "built reviewed-demo activation must match the source publication manifest",
);
assert.deepEqual(
  builtReviewedDemo.assetPaths,
  sourceReviewedDemo.assetPaths,
  "built reviewed-demo assets must exactly match the verified source tree",
);

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
const stylesheetSource = (await Promise.all(
  assetNames
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFile(new URL(`assets/${name}`, distUrl), "utf8")),
)).join("\n");
const builtArtifactText = [home, comparison, guide, runtimeSource, stylesheetSource].join("\n");
for (const privateLocalReviewMarker of [
  "demo-review=recording",
  "demo-recording-slot",
  "flowtake-demo-source.mp4",
  "FlowtakeDemo",
  "Record the genuine Flowtake workflow.",
  "Uninterrupted Windows source capture sequence",
]) {
  assert.equal(
    builtArtifactText.includes(privateLocalReviewMarker),
    false,
    `Pages artifact must exclude local recording instructions: ${privateLocalReviewMarker}`,
  );
}
const homeRuntimeSource = (await Promise.all(
  assetNames
    .filter((name) => name.startsWith("home-") && name.endsWith(".js"))
    .map((name) => readFile(new URL(`assets/${name}`, distUrl), "utf8")),
)).join("\n");
const runtimeExportCopyLiterals = extractExportCopyLiterals(homeRuntimeSource);
const browserWebmCopyLiterals = runtimeExportCopyLiterals.filter((literal) =>
  /\bwebm\b/iu.test(literal)
);
const desktopRuntimeExportCopy = runtimeExportCopyLiterals
  .filter((literal) => !/\bwebm\b/iu.test(literal))
  .join("\n");
const comparisonFlowtakeCopy = [
  comparison.match(/<th scope="row">Export<\/th>\s*<td>([\s\S]*?)<\/td>/u)?.[1],
  comparison.match(/<p class="comparison-card-label">Export<\/p>[\s\S]*?<p>([\s\S]*?)<\/p>/u)?.[1],
].filter(Boolean).join("\n");
const storyboardFlowtakeExportCopy = [
  guide.match(/<h3>Export locally<\/h3>\s*<p class="storyboard-caption">([\s\S]*?)<\/p>/u)?.[1],
  guide.match(/<h3>Record and edit on the published app\.<\/h3>\s*<ul>([\s\S]*?)<\/ul>/u)?.[1],
].filter(Boolean).join("\n");

const count = (value, needle) => value.split(needle).length - 1;
const assertNoUnsupportedExportClaims = (value, label) => {
  assert.deepEqual(findExportTruthViolations(value), [], `${label} contains a false export claim`);
};
const assertScopedBrowserWebmClaims = (literals) => {
  assert.ok(literals.length >= 5, "built homepage must keep the reviewed browser WebM boundary");
  for (const literal of literals) {
    assert.match(literal, /\bvideo-only\b/iu, `browser WebM copy must disclose no audio: ${literal}`);
    assert.match(
      literal,
      /\b(?:browser|web recorder|pro editor|pro review|device-local|local)\b/iu,
      `browser WebM copy must name its product surface: ${literal}`,
    );
  }
  const nonFormatViolations = findExportTruthViolations(literals.join("\n"))
    .filter((violation) => violation.kind !== "unsupported-output");
  assert.deepEqual(
    nonFormatViolations,
    [],
    "browser WebM copy must preserve encoder, selector, and audio boundaries",
  );
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
  runtimeSource.includes("Export a local AVC MP4."),
  true,
  "built homepage must state the current local AVC MP4 output",
);
assert.equal(runtimeSource.includes("Mediabunny handles video encoding on your machine"), true, "built homepage must name the current encoder");
assert.equal(runtimeSource.includes("the current edited export is video-only"), true, "built homepage must disclose the audio boundary");

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
  comparison.includes("Local AVC MP4 with resolution, 30/60 fps, and quality controls; the current edited output is video-only"),
  true,
  "comparison must preserve the implemented output controls and audio boundary",
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
  guide.includes("The brief text is not uploaded when you copy it. Flowtake records only a cookie-free aggregate copy count."),
  true,
  "storyboard copy privacy boundary missing",
);
assert.equal(guide.includes("Pre-production example—not customer work or a finished video"), true, "storyboard truth boundary missing");
assert.doesNotMatch(
  guide,
  /\b(?:through|until|by|ends?|expires?)\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,\s+20\d{2}\b/iu,
  "storyboard guide must not publish a fixed natural-language offer deadline",
);
assert.equal(
  guide.includes("Maintainers can bring one complete public developer-tool workflow to the public clinic and request a no-obligation storyboard."),
  true,
  "storyboard guide must keep the approved evergreen public-workflow request",
);
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
assert.equal(guide.includes("“Export a local MP4.”"), true, "storyboard must keep the factual export caption");
assert.equal(
  guide.includes("PixiJS composites the edited frames; Mediabunny encodes and muxes the local AVC MP4."),
  true,
  "storyboard must state the current final-export path",
);
assert.equal(guide.includes("The edited MP4 currently has no muxed audio."), true, "storyboard must disclose the audio boundary");
assertScopedBrowserWebmClaims(browserWebmCopyLiterals);
assertNoUnsupportedExportClaims(`${desktopRuntimeExportCopy}\n${storyboardFlowtakeExportCopy}`, "built homepage/storyboard copy");
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

  const reviewedDemoResponses = await Promise.all(
    builtReviewedDemo.pagesPaths.map(async (assetPath) => [
      assetPath,
      await fetch(`${previewOrigin}${assetPath}`),
    ]),
  );
  for (const [assetPath, response] of reviewedDemoResponses) {
    assert.equal(response.status, 200, `preview reviewed demo asset must load: ${assetPath}`);
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
