import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

const comparisonUrl = "https://jnx03.github.io/Flowtake/screen-studio-alternative-windows/";
const guideUrl = "https://jnx03.github.io/Flowtake/developer-tool-demo-storyboard/";
const distUrl = new URL("../dist/", import.meta.url);

const [home, comparison, guide, sitemap] = await Promise.all([
  readFile(new URL("index.html", distUrl), "utf8"),
  readFile(new URL("screen-studio-alternative-windows/index.html", distUrl), "utf8"),
  readFile(new URL("developer-tool-demo-storyboard/index.html", distUrl), "utf8"),
  readFile(new URL("sitemap.xml", distUrl), "utf8"),
]);

const count = (value, needle) => value.split(needle).length - 1;

assert.equal(home.includes('href="https://jnx03.github.io/Flowtake/"'), true, "homepage canonical changed");
assert.equal(home.includes("free recorder and developer demo studio"), true, "homepage metadata changed");

assert.equal(comparison.includes("A Screen Studio"), true, "comparison H1 content missing");
assert.equal(comparison.includes("Where Screen Studio is still stronger"), true, "honesty section missing");
assert.equal(comparison.includes("Flowtake is not a feature-for-feature Screen Studio clone"), true, "comparison boundary missing");
assert.equal(count(comparison, "<title>"), 1, "comparison title must be unique");
assert.equal(count(comparison, 'name="description"'), 1, "comparison description must be unique");
assert.equal(count(comparison, 'rel="canonical"'), 1, "comparison canonical must be unique");
assert.equal(count(comparison, 'property="og:url"'), 1, "comparison og:url must be unique");
assert.equal(comparison.includes(`href="${comparisonUrl}"`), true, "comparison canonical is wrong");
assert.equal(comparison.includes(`content="${comparisonUrl}"`), true, "comparison og:url is wrong");
assert.equal(comparison.includes("/Flowtake/assets/"), true, "Pages asset base is missing");

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
assert.equal(count(guide, "<title>"), 1, "storyboard guide title must be unique");
assert.equal(count(guide, 'name="description"'), 1, "storyboard guide description must be unique");
assert.equal(count(guide, 'rel="canonical"'), 1, "storyboard guide canonical must be unique");
assert.equal(count(guide, 'property="og:url"'), 1, "storyboard guide og:url must be unique");
assert.equal(guide.includes(`href="${guideUrl}"`), true, "storyboard guide canonical is wrong");
assert.equal(guide.includes(`content="${guideUrl}"`), true, "storyboard guide og:url is wrong");
assert.equal(guide.includes("/Flowtake/assets/"), true, "storyboard guide Pages asset base is missing");

const guideJsonLdBlocks = [...guide.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)];
assert.equal(guideJsonLdBlocks.length, 1, "storyboard guide must have one JSON-LD block");
const guideStructuredData = JSON.parse(guideJsonLdBlocks[0][1]);
assert.equal(guideStructuredData["@type"], "WebPage", "storyboard guide structured data must remain WebPage-only");
assert.equal(guide.includes("VideoObject"), false, "storyboard guide must not claim video structured data");
assert.equal(count(sitemap, `<loc>${guideUrl}</loc>`), 1, "storyboard guide sitemap entry must be unique");

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
