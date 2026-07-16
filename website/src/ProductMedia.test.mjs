import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("genuine product media components are accessible, data-driven, and never simulate footage", async () => {
  const [video, showcase, styles] = await Promise.all([
    readFile(new URL("./components/ProductVideo.jsx", import.meta.url), "utf8"),
    readFile(new URL("./components/FeatureShowcase.jsx", import.meta.url), "utf8"),
    readFile(new URL("./components/product-media.css", import.meta.url), "utf8"),
  ]);

  for (const required of [
    "controls",
    "muted",
    "playsInline",
    'preload="metadata"',
    'type="video/webm"',
    'type="video/mp4"',
    'kind="captions"',
    "prefers-reduced-motion: reduce",
    "Product footage could not be loaded.",
    "downloadSrc",
    "href={fallbackSrc}",
    "aspect-ratio: 16 / 9",
    "object-fit: contain",
  ]) {
    assert.equal(`${video}\n${styles}`.includes(required), true, `missing media requirement: ${required}`);
  }

  for (const required of [
    "group.features",
    "aria-pressed={isSelected}",
    "aria-controls={isSelected ? videoId : undefined}",
    "setSelectedId(feature.id)",
    "key={selected.id}",
    "downloadSrc={selected.media.download}",
  ]) {
    assert.equal(showcase.includes(required), true, `missing showcase behavior: ${required}`);
  }

  assert.equal(styles.includes("position: sticky"), true);
  assert.equal(styles.includes("grid-auto-columns: min(75vw, 360px)"), true);
  assert.equal(styles.includes("linear-gradient"), false);
  assert.equal(styles.includes("radial-gradient"), false);
  assert.equal(video.includes("data:image"), false);
  assert.equal(video.includes("<svg"), false);
  assert.equal(showcase.includes("placeholder"), false);
  assert.equal(styles.includes("aspect-ratio: 16 / 10"), false);
  assert.equal(styles.includes("object-fit: cover"), false);
  assert.equal(video.includes("Use the video controls or download link"), false);
});
