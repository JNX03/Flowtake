import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import process from "node:process";

const comparisonUrl = "https://jnx03.github.io/Flowtake/screen-studio-alternative-windows/";
const distUrl = new URL("../dist/", import.meta.url);

const [home, comparison, sitemap] = await Promise.all([
  readFile(new URL("index.html", distUrl), "utf8"),
  readFile(new URL("screen-studio-alternative-windows/index.html", distUrl), "utf8"),
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

process.stdout.write("Verified root and Screen Studio alternative Pages artifacts.\n");
