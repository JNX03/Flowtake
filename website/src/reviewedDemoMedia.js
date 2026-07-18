const FEATURE_IDS = ["record", "edit", "export"];
const FEATURE_DURATION_SECONDS = Object.freeze({
  record: 18,
  edit: 10,
  export: 8,
});
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_PUBLIC_PATH_PATTERN = /^product-media\/public\/[a-z0-9][a-z0-9.-]*\.(?:mp4|webm|webp|vtt)$/u;
const PRIVATE_FILENAME_PATTERN =
  /(?:^|[-_.])(?:raw|source|master|private|manifest|contact-sheet|unreviewed|do-not-publish)(?:[-_.]|$)/u;

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const isSha256 = (value) => typeof value === "string" && SHA256_PATTERN.test(value);
const hasSafePublicPath = (value, extension) => (
  typeof value === "string"
  && SAFE_PUBLIC_PATH_PATTERN.test(value)
  && value.endsWith(extension)
  && !PRIVATE_FILENAME_PATTERN.test(value.slice("product-media/public/".length).toLowerCase())
);

const isVideoAsset = (asset, extension, codecs, durationSeconds) => (
  isObject(asset)
  && hasSafePublicPath(asset.path, extension)
  && isSha256(asset.sha256)
  && codecs.includes(asset.codec)
  && asset.pixelFormat === "yuv420p"
  && asset.hasAudio === false
  && Number.isFinite(asset.durationSeconds)
  && Math.abs(asset.durationSeconds - durationSeconds) <= 0.05
);

const isPosterAsset = (asset) => (
  isObject(asset)
  && hasSafePublicPath(asset.path, ".webp")
  && isSha256(asset.sha256)
  && asset.width === 1920
  && asset.height === 1080
);

const isCaptionAsset = (asset) => (
  isObject(asset)
  && hasSafePublicPath(asset.path, ".vtt")
  && isSha256(asset.sha256)
  && Number.isInteger(asset.cueCount)
  && asset.cueCount > 0
);

const isMasterMediaSet = (media, durationSeconds) => (
  isObject(media)
  && media.burnedInCaptions === true
  && isVideoAsset(media.mp4, ".mp4", ["h264"], durationSeconds)
  && isVideoAsset(media.webm, ".webm", ["vp9", "vp8"], durationSeconds)
  && isPosterAsset(media.poster)
  && isCaptionAsset(media.captions)
  && media.mp4.path === "product-media/public/flowtake-v1.6.0-demo.mp4"
  && media.webm.path === "product-media/public/flowtake-v1.6.0-demo.webm"
  && media.poster.path === "product-media/public/flowtake-v1.6.0-demo-poster.webp"
  && media.captions.path === "product-media/public/flowtake-v1.6.0-demo-en.vtt"
);

const isFeatureMediaSet = (media, id, durationSeconds) => (
  isObject(media)
  && media.burnedInCaptions === true
  && isVideoAsset(media.mp4, ".mp4", ["h264"], durationSeconds)
  && media.mp4.path === `product-media/public/flowtake-v1.6.0-${id}.mp4`
  && media.webm === null
  && media.poster === null
  && media.captions === null
);

const allAssetPaths = (candidate) => {
  const mediaSets = [candidate.master.media, ...candidate.features.map((feature) => feature.media)];
  return mediaSets.flatMap((media) => [
    media.mp4.path,
    ...(media.webm ? [media.webm.path] : []),
    ...(media.poster ? [media.poster.path] : []),
    ...(media.captions ? [media.captions.path] : []),
  ]);
};

export function validateReviewedDemoMedia(candidate) {
  if (!isObject(candidate)) return false;
  if (candidate.schemaVersion !== 1) return false;
  if (candidate.status !== "APPROVED_PUBLIC") return false;
  if (candidate.releaseVersion !== "1.6.0") return false;
  if (candidate.privacyReview !== "PASS") return false;
  if (candidate.truthReview !== "PASS") return false;
  if (candidate.secondReview !== "PASS") return false;
  if (!isSha256(candidate.sourceSha256)) return false;
  if (!isText(candidate.reviewedAt) || !Number.isFinite(Date.parse(candidate.reviewedAt))) return false;

  const { master } = candidate;
  if (!isObject(master)) return false;
  if (master.id !== "master" || master.durationSeconds !== 42) return false;
  if (![master.title, master.body, master.label].every(isText)) return false;
  if (!isMasterMediaSet(master.media, master.durationSeconds)) return false;

  if (!Array.isArray(candidate.features) || candidate.features.length !== FEATURE_IDS.length) return false;
  if (candidate.features.some((feature, index) => (
    !isObject(feature)
    || feature.id !== FEATURE_IDS[index]
    || !isText(feature.title)
    || !isText(feature.body)
    || !isText(feature.label)
    || feature.durationSeconds !== FEATURE_DURATION_SECONDS[feature.id]
    || !isFeatureMediaSet(feature.media, feature.id, feature.durationSeconds)
  ))) return false;

  const paths = allAssetPaths(candidate);
  return paths.length === new Set(paths).size;
}

// This remains null until the genuine isolated-session source and every public
// derivative pass privacy, truth, codec, duration, hash, and second review.
export const reviewedDemoMediaCandidate = null;

export const reviewedDemoMedia = validateReviewedDemoMedia(reviewedDemoMediaCandidate)
  ? Object.freeze(reviewedDemoMediaCandidate)
  : null;

export const hasReviewedDemoMedia = reviewedDemoMedia !== null;
