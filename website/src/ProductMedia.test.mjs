import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("genuine product media components are accessible, data-driven, and never simulate footage", async () => {
  const [video, showcase, reviewed, manifest, home, styles] = await Promise.all([
    readFile(new URL("./components/ProductVideo.jsx", import.meta.url), "utf8"),
    readFile(new URL("./components/FeatureShowcase.jsx", import.meta.url), "utf8"),
    readFile(new URL("./components/ReviewedDemoMedia.jsx", import.meta.url), "utf8"),
    readFile(new URL("./reviewedDemoMedia.js", import.meta.url), "utf8"),
    readFile(new URL("./HomePage.jsx", import.meta.url), "utf8"),
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
  assert.equal(video.includes("if (!hasSource)"), true);
  assert.equal(video.includes("Product footage is not available."), false);

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
  assert.equal(video.includes('label="English" default'), false);

  for (const required of [
    "if (!hasReviewedDemoMedia) return null;",
    "reviewedDemoMedia.master",
    "reviewedDemoMedia.features.map",
    "downloadSrc: assetUrl(entry.media.mp4)",
    "captionsSrc: assetUrl(entry.media.captions)",
    "loop={false}",
  ]) {
    assert.equal(reviewed.includes(required), true, `missing reviewed-media gate: ${required}`);
  }
  assert.equal((reviewed.match(/if \(!hasReviewedDemoMedia\) return null;/gu) || []).length, 2);
  assert.equal(reviewed.includes("placeholder"), false);
  assert.equal(reviewed.includes("concept"), false);

  for (const required of [
    "export const reviewedDemoMediaCandidate = null;",
    "status !== \"APPROVED_PUBLIC\"",
    "privacyReview !== \"PASS\"",
    "truthReview !== \"PASS\"",
    "secondReview !== \"PASS\"",
    "product-media/public/",
    "raw|source|master|private|manifest|contact-sheet|unreviewed|do-not-publish",
  ]) {
    assert.equal(manifest.includes(required), true, `missing fail-closed manifest rule: ${required}`);
  }

  for (const required of [
    "import.meta.env.DEV",
    "lazy(async () =>",
    'import("./components/DemoRecordingSlot.jsx")',
    "const hasProductDemo = hasReviewedDemoMedia;",
    'const productEvidenceTarget = hasReviewedDemoMedia ? "#demo" : "#product";',
    "hasProductDemo && <a href={productEvidenceTarget}>Demo</a>",
    "hasReviewedDemoMedia ? (",
    "<ReviewedHeroVideo />",
    ") : LocalDemoRecordingSlot ? (",
    "<LocalDemoRecordingSlot",
    "fallback={releaseCard}",
    "hasReviewedMedia={hasReviewedDemoMedia}",
    "locationLike={globalThis.location}",
    ") : releaseCard}",
    "<ReviewedDemoShowcase />",
  ]) {
    assert.equal(home.includes(required), true, `missing homepage media gate: ${required}`);
  }
  assert.ok(
    home.indexOf("hasReviewedDemoMedia ? (")
      < home.indexOf(") : LocalDemoRecordingSlot ? ("),
    "reviewed media must take precedence over the local recording guide",
  );
  assert.ok(
    home.indexOf("const releaseCard = (")
      < home.indexOf("hasReviewedDemoMedia ? ("),
    "the published release card must remain the default fallback",
  );
  assert.equal(home.includes("Real demo queued for isolated capture"), false);
  assert.equal(home.includes("The 42-second plan is ready."), false);
  assert.equal(home.includes("Concept frame"), false);
  assert.equal(home.includes("Concept illustration"), false);
});
