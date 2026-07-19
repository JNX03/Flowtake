const LOOPBACK_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

export const DEMO_RECORDING_REVIEW_QUERY = "demo-review=recording";

export function isLoopbackHostname(hostname) {
  return typeof hostname === "string"
    && LOOPBACK_HOSTNAMES.has(hostname.trim().toLowerCase());
}

export function shouldShowDemoRecordingSlot({
  hasReviewedMedia = false,
  hostname = "",
  search = "",
} = {}) {
  if (hasReviewedMedia || !isLoopbackHostname(hostname)) return false;

  const params = new URLSearchParams(typeof search === "string" ? search : "");
  return params.get("demo-review") === "recording";
}

export function shouldShowDemoRecordingSlotForLocation(
  locationLike,
  hasReviewedMedia = false,
) {
  return shouldShowDemoRecordingSlot({
    hasReviewedMedia,
    hostname: locationLike?.hostname,
    search: locationLike?.search,
  });
}
