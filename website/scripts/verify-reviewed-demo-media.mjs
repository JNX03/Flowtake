import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, open, readFile, readdir } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  reviewedDemoMediaCandidate,
  validateReviewedDemoMedia,
} from "../src/reviewedDemoMedia.js";

const PUBLIC_PATH_PREFIX = "product-media/public/";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const PRIVATE_FILENAME_PATTERN =
  /(?:^|[-_.])(?:raw|source|master|private|manifest|contact-sheet|unreviewed|do-not-publish)(?:[-_.]|$)/u;
const MEBIBYTE = 1024 * 1024;
const DURATION_TOLERANCE_SECONDS = 0.05;
const FPS_TOLERANCE = 0.05;
const REVIEWED_CAPTION_CUES = Object.freeze([
  Object.freeze({ start: 0, end: 3, text: "Record the workflow once." }),
  Object.freeze({ start: 3, end: 10, text: "Capture the IDE, terminal, browser, or desktop." }),
  Object.freeze({ start: 10, end: 18, text: "Keep the take editable." }),
  Object.freeze({ start: 18, end: 28, text: "Shape the motion around the explanation." }),
  Object.freeze({ start: 28, end: 36, text: "Export a local MP4." }),
  Object.freeze({ start: 36, end: 42, text: "Free. Local-first. MIT licensed." }),
]);
const CANONICAL_REVIEWED_VTT = `WEBVTT

00:00:00.000 --> 00:00:03.000
Record the workflow once.

00:00:03.000 --> 00:00:10.000
Capture the IDE, terminal, browser, or desktop.

00:00:10.000 --> 00:00:18.000
Keep the take editable.

00:00:18.000 --> 00:00:28.000
Shape the motion around the explanation.

00:00:28.000 --> 00:00:36.000
Export a local MP4.

00:00:36.000 --> 00:00:42.000
Free. Local-first. MIT licensed.
`;

export const APPROVED_PUBLIC_DEMO_ASSETS = Object.freeze({
  "flowtake-v1.6.0-demo.mp4": Object.freeze({
    minBytes: 1024,
    maxBytes: 128 * MEBIBYTE,
  }),
  "flowtake-v1.6.0-demo.webm": Object.freeze({
    minBytes: 1024,
    maxBytes: 128 * MEBIBYTE,
  }),
  "flowtake-v1.6.0-demo-poster.webp": Object.freeze({
    minBytes: 128,
    maxBytes: 8 * MEBIBYTE,
  }),
  "flowtake-v1.6.0-demo-en.vtt": Object.freeze({
    minBytes: 10,
    maxBytes: 256 * 1024,
  }),
  "flowtake-v1.6.0-record.mp4": Object.freeze({
    minBytes: 512,
    maxBytes: 64 * MEBIBYTE,
  }),
  "flowtake-v1.6.0-edit.mp4": Object.freeze({
    minBytes: 512,
    maxBytes: 64 * MEBIBYTE,
  }),
  "flowtake-v1.6.0-export.mp4": Object.freeze({
    minBytes: 512,
    maxBytes: 64 * MEBIBYTE,
  }),
});

export const APPROVED_PUBLIC_DEMO_FILENAMES = Object.freeze(
  Object.keys(APPROVED_PUBLIC_DEMO_ASSETS).sort(),
);

export const APPROVED_PUBLIC_DEMO_PATHS = Object.freeze(
  APPROVED_PUBLIC_DEMO_FILENAMES.map((filename) => `${PUBLIC_PATH_PREFIX}${filename}`),
);

const statOrNull = async (url) => {
  try {
    return await lstat(url);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
};

const sha256File = async (url) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(url)) hash.update(chunk);
  return hash.digest("hex");
};

const runTool = (executable, args, label) => {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * MEBIBYTE,
  });
  assert.equal(result.error, undefined, `${label} could not start: ${result.error?.message ?? "unknown error"}`);
  assert.equal(
    result.status,
    0,
    `${label} failed with exit ${result.status}: ${`${result.stderr ?? ""}\n${result.stdout ?? ""}`.trim().slice(-4000)}`,
  );
  return result.stdout;
};

const executableOrNull = async (candidate) => {
  if (!candidate) return null;
  const stats = await statOrNull(pathToFileURL(candidate));
  return stats?.isFile() ? candidate : null;
};

const discoverExecutable = async (name, override) => {
  if (override) {
    const explicit = await executableOrNull(override);
    assert.ok(explicit, `configured ${name} executable is not a regular file: ${override}`);
    return explicit;
  }

  const locator = process.platform === "win32" ? "where.exe" : "which";
  const output = runTool(locator, [name], `${name} executable discovery`);
  for (const candidate of output.split(/\r?\n/u).map((entry) => entry.trim()).filter(Boolean)) {
    const executable = await executableOrNull(candidate);
    if (executable) return executable;
  }
  assert.fail(`${name} executable discovery returned no regular file`);
};

export async function discoverMediaTools() {
  const [ffprobe, ffmpeg] = await Promise.all([
    discoverExecutable("ffprobe", process.env.FLOWTAKE_FFPROBE_PATH),
    discoverExecutable("ffmpeg", process.env.FLOWTAKE_FFMPEG_PATH),
  ]);
  return Object.freeze({ ffprobe, ffmpeg });
}

const parseRate = (value) => {
  const [numerator, denominator = "1"] = String(value ?? "").split("/");
  const rate = Number(numerator) / Number(denominator);
  return Number.isFinite(rate) ? rate : Number.NaN;
};

const assertNear = (actual, expected, tolerance, label) => {
  assert.equal(Number.isFinite(actual), true, `${label} must be finite`);
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label} must be ${expected} +/- ${tolerance}; got ${actual}`,
  );
};

const probeFile = (ffprobe, fileUrl, label) => {
  const output = runTool(ffprobe, [
    "-v", "error",
    "-show_streams",
    "-show_format",
    "-show_chapters",
    "-of", "json",
    fileURLToPath(fileUrl),
  ], `${label} ffprobe`);
  return JSON.parse(output);
};

const unexpectedTagKeys = (probeResult) => {
  const allowed = new Set([
    "compatible_brands",
    "duration",
    "encoder",
    "handler_name",
    "language",
    "major_brand",
    "minor_version",
    "vendor_id",
  ]);
  const keys = [
    ...Object.keys(probeResult.format?.tags ?? {}),
    ...(probeResult.streams ?? []).flatMap((stream) => Object.keys(stream.tags ?? {})),
  ];
  return [...new Set(keys.map((key) => key.toLowerCase()).filter((key) => !allowed.has(key)))];
};

const videoFacts = (probeResult, label) => {
  const videoStreams = probeResult.streams?.filter((stream) => stream.codec_type === "video") ?? [];
  const audioStreams = probeResult.streams?.filter((stream) => stream.codec_type === "audio") ?? [];
  assert.equal(videoStreams.length, 1, `${label} must contain exactly one video stream`);
  const [video] = videoStreams;
  return Object.freeze({
    streamTypes: Object.freeze(
      (probeResult.streams ?? []).map((stream) => String(stream.codec_type ?? "")),
    ),
    codec: video.codec_name,
    pixelFormat: video.pix_fmt,
    width: Number(video.width),
    height: Number(video.height),
    fps: parseRate(video.avg_frame_rate || video.r_frame_rate),
    durationSeconds: Number(probeResult.format?.duration ?? video.duration),
    audioCount: audioStreams.length,
    chapterCount: probeResult.chapters?.length ?? 0,
    unexpectedTags: unexpectedTagKeys(probeResult),
  });
};

export function assertReviewedVideoFacts(facts, asset, allowedCodecs, label) {
  assert.deepEqual(
    facts.streamTypes,
    ["video"],
    `${label} must contain exactly one video stream and no other streams`,
  );
  assert.ok(allowedCodecs.includes(facts.codec), `${label} has unsupported codec: ${facts.codec}`);
  assert.equal(facts.codec, asset.codec, `${label} codec does not match the approved manifest`);
  assert.equal(facts.pixelFormat, "yuv420p", `${label} must use yuv420p`);
  assert.equal(facts.width, 1920, `${label} width must be 1920`);
  assert.equal(facts.height, 1080, `${label} height must be 1080`);
  assertNear(facts.fps, 30, FPS_TOLERANCE, `${label} frame rate`);
  assert.equal(facts.audioCount, 0, `${label} must contain no audio streams`);
  assert.equal(facts.chapterCount, 0, `${label} must contain no chapters`);
  assert.deepEqual(facts.unexpectedTags, [], `${label} contains unexpected metadata tags`);
  assertNear(
    facts.durationSeconds,
    asset.durationSeconds,
    DURATION_TOLERANCE_SECONDS,
    `${label} duration`,
  );
}

export const assertPosterFacts = (probeResult, asset, label) => {
  const streams = probeResult.streams ?? [];
  const videoStreams = probeResult.streams?.filter((stream) => stream.codec_type === "video") ?? [];
  const audioStreams = probeResult.streams?.filter((stream) => stream.codec_type === "audio") ?? [];
  assert.deepEqual(
    streams.map((stream) => String(stream.codec_type ?? "")),
    ["video"],
    `${label} must contain exactly one image stream and no other streams`,
  );
  assert.equal(videoStreams.length, 1, `${label} must contain exactly one image stream`);
  assert.equal(audioStreams.length, 0, `${label} must contain no audio streams`);
  assert.equal(probeResult.chapters?.length ?? 0, 0, `${label} must contain no chapters`);
  assert.deepEqual(unexpectedTagKeys(probeResult), [], `${label} contains unexpected metadata tags`);
  assert.equal(videoStreams[0].codec_name, "webp", `${label} must be WebP`);
  assert.equal(Number(videoStreams[0].width), asset.width, `${label} width does not match the manifest`);
  assert.equal(Number(videoStreams[0].height), asset.height, `${label} height does not match the manifest`);
  assert.equal(asset.width, 1920, `${label} width must be 1920`);
  assert.equal(asset.height, 1080, `${label} height must be 1080`);
};

const parseVttTimestamp = (value) => {
  const match = value.match(/^(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})$/u);
  assert.ok(match, `invalid WebVTT timestamp: ${value}`);
  const [, hours = "0", minutes, seconds, milliseconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(milliseconds) / 1000;
};

const parseVttCues = (value) => {
  const normalized = value.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  assert.match(normalized, /^WEBVTT(?:[ \t].*)?\n/u, "reviewed caption file must start with WEBVTT");
  const lines = normalized.split("\n");
  const cues = [];
  for (let index = 0; index < lines.length; index += 1) {
    const timing = lines[index].match(
      /^((?:(?:\d{2}):)?\d{2}:\d{2}\.\d{3})[ \t]+-->[ \t]+((?:(?:\d{2}):)?\d{2}:\d{2}\.\d{3})(?:[ \t].*)?$/u,
    );
    if (!timing) continue;
    const textLines = [];
    for (index += 1; index < lines.length && lines[index].trim(); index += 1) {
      textLines.push(lines[index].trim());
    }
    cues.push({
      start: parseVttTimestamp(timing[1]),
      end: parseVttTimestamp(timing[2]),
      text: textLines.join("\n"),
    });
  }
  return cues;
};

export function assertReviewedVttText(value, asset) {
  const normalized = value.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  assert.equal(
    normalized,
    CANONICAL_REVIEWED_VTT,
    "reviewed caption file must exactly match the canonical six-cue WebVTT",
  );
  const cues = parseVttCues(value);
  assert.equal(asset.cueCount, REVIEWED_CAPTION_CUES.length, "approved VTT cue count must be six");
  assert.equal(cues.length, asset.cueCount, "VTT cue count does not match the approved manifest");
  for (const [index, expected] of REVIEWED_CAPTION_CUES.entries()) {
    const actual = cues[index];
    assertNear(actual.start, expected.start, 0.001, `VTT cue ${index + 1} start`);
    assertNear(actual.end, expected.end, 0.001, `VTT cue ${index + 1} end`);
    assert.equal(actual.text, expected.text, `VTT cue ${index + 1} text changed`);
  }
}

const assertMp4FastStart = async (fileUrl) => {
  const stats = await lstat(fileUrl);
  const handle = await open(fileUrl, "r");
  const boxes = [];
  let offset = 0;
  try {
    while (offset + 8 <= stats.size && boxes.length < 128) {
      const header = Buffer.alloc(16);
      const { bytesRead } = await handle.read(header, 0, 16, offset);
      if (bytesRead < 8) break;
      let boxSize = header.readUInt32BE(0);
      const type = header.toString("ascii", 4, 8);
      let headerSize = 8;
      if (boxSize === 1) {
        assert.ok(bytesRead >= 16, `${fileURLToPath(fileUrl)} has a truncated extended MP4 box`);
        const extendedSize = header.readBigUInt64BE(8);
        assert.ok(extendedSize <= BigInt(Number.MAX_SAFE_INTEGER), "MP4 box is too large");
        boxSize = Number(extendedSize);
        headerSize = 16;
      } else if (boxSize === 0) {
        boxSize = stats.size - offset;
      }
      assert.ok(
        boxSize >= headerSize && offset + boxSize <= stats.size,
        `${fileURLToPath(fileUrl)} has an invalid top-level MP4 box`,
      );
      boxes.push(type);
      offset += boxSize;
    }
  } finally {
    await handle.close();
  }
  const moovIndex = boxes.indexOf("moov");
  const mdatIndex = boxes.indexOf("mdat");
  assert.ok(
    moovIndex >= 0 && mdatIndex >= 0 && moovIndex < mdatIndex,
    `${fileURLToPath(fileUrl)} is not a fast-start MP4`,
  );
};

const fullDecodeMedia = (ffmpeg, fileUrl, label) => {
  runTool(ffmpeg, [
    "-hide_banner",
    "-v", "error",
    "-xerror",
    "-nostdin",
    "-i", fileURLToPath(fileUrl),
    "-map", "0:v:0",
    "-f", "null",
    process.platform === "win32" ? "NUL" : "/dev/null",
  ], `${label} full decode`);
};

export async function inspectReviewedDemoMedia({
  candidate,
  publicRootUrl,
  tools,
  probe = probeFile,
  decode = fullDecodeMedia,
  assertFastStart = assertMp4FastStart,
  readCaptionText = (fileUrl) => readFile(fileUrl, "utf8"),
}) {
  const resolvedTools = tools ?? await discoverMediaTools();
  const videoSpecs = [
    {
      asset: candidate.master.media.mp4,
      allowedCodecs: ["h264"],
      fastStart: true,
    },
    {
      asset: candidate.master.media.webm,
      allowedCodecs: ["vp9", "vp8"],
      fastStart: false,
    },
    ...candidate.features.map((feature) => ({
      asset: feature.media.mp4,
      allowedCodecs: ["h264"],
      fastStart: true,
    })),
  ];

  for (const { asset, allowedCodecs, fastStart } of videoSpecs) {
    const filename = asset.path.slice(PUBLIC_PATH_PREFIX.length);
    const fileUrl = new URL(filename, publicRootUrl);
    const facts = videoFacts(probe(resolvedTools.ffprobe, fileUrl, filename), filename);
    assertReviewedVideoFacts(facts, asset, allowedCodecs, filename);
    if (fastStart) await assertFastStart(fileUrl);
    decode(resolvedTools.ffmpeg, fileUrl, filename);
  }

  const poster = candidate.master.media.poster;
  const posterName = poster.path.slice(PUBLIC_PATH_PREFIX.length);
  const posterUrl = new URL(posterName, publicRootUrl);
  assertPosterFacts(
    probe(resolvedTools.ffprobe, posterUrl, posterName),
    poster,
    posterName,
  );
  decode(resolvedTools.ffmpeg, posterUrl, posterName);

  const captions = candidate.master.media.captions;
  const captionsName = captions.path.slice(PUBLIC_PATH_PREFIX.length);
  assertReviewedVttText(
    await readCaptionText(new URL(captionsName, publicRootUrl)),
    captions,
  );
}

const addAsset = (entries, asset) => {
  if (asset !== null && asset !== undefined) entries.push(asset);
};

export function collectReviewedDemoAssets(candidate) {
  if (!candidate || typeof candidate !== "object") return [];

  const entries = [];
  const masterMedia = candidate.master?.media;
  addAsset(entries, masterMedia?.mp4);
  addAsset(entries, masterMedia?.webm);
  addAsset(entries, masterMedia?.poster);
  addAsset(entries, masterMedia?.captions);

  for (const feature of candidate.features ?? []) {
    const media = feature?.media;
    addAsset(entries, media?.mp4);
    addAsset(entries, media?.webm);
    addAsset(entries, media?.poster);
    addAsset(entries, media?.captions);
  }

  return entries;
}

export function assertApprovedPublicDemoPath(assetPath) {
  assert.equal(typeof assetPath, "string", "reviewed demo asset path must be text");
  assert.equal(
    APPROVED_PUBLIC_DEMO_PATHS.includes(assetPath),
    true,
    `reviewed demo asset is not in the exact public allowlist: ${assetPath}`,
  );

  const filename = assetPath.slice(PUBLIC_PATH_PREFIX.length).toLowerCase();
  assert.doesNotMatch(
    filename,
    PRIVATE_FILENAME_PATTERN,
    `private-review filename must never enter the public demo tree: ${filename}`,
  );
}

export function assertApprovedPublicDemoSize(filename, size) {
  const bounds = APPROVED_PUBLIC_DEMO_ASSETS[filename];
  assert.ok(bounds, `missing size bounds for reviewed demo asset: ${filename}`);
  assert.equal(Number.isSafeInteger(size), true, `asset size must be an integer: ${filename}`);
  assert.ok(
    size >= bounds.minBytes && size <= bounds.maxBytes,
    `${filename} size ${size} is outside ${bounds.minBytes}-${bounds.maxBytes} bytes`,
  );
}

export function assertReviewedDemoCandidate(candidate) {
  assert.equal(
    validateReviewedDemoMedia(candidate),
    true,
    "reviewed demo candidate did not pass the publication manifest validator",
  );

  const assets = collectReviewedDemoAssets(candidate);
  const paths = assets.map((asset) => asset.path);
  assert.equal(paths.length, new Set(paths).size, "reviewed demo manifest contains duplicate asset paths");
  assert.deepEqual(
    [...paths].sort(),
    APPROVED_PUBLIC_DEMO_PATHS,
    "reviewed demo manifest must contain exactly the seven approved public candidates",
  );

  for (const asset of assets) {
    assertApprovedPublicDemoPath(asset.path);
    assert.match(asset.sha256, SHA256_PATTERN, `invalid SHA-256 for ${asset.path}`);
  }

  return assets;
}

export async function verifyReviewedDemoMediaTree({
  candidate = reviewedDemoMediaCandidate,
  publicRootUrl,
  inspectMedia = inspectReviewedDemoMedia,
} = {}) {
  assert.ok(publicRootUrl instanceof URL, "publicRootUrl must be a URL");
  const rootStats = await statOrNull(publicRootUrl);

  if (candidate === null) {
    assert.equal(validateReviewedDemoMedia(candidate), false, "null demo candidate must fail closed");
    assert.equal(
      rootStats,
      null,
      "product-media/public must be absent while the reviewed demo candidate is null",
    );
    return Object.freeze({
      active: false,
      assetPaths: Object.freeze([]),
      pagesPaths: Object.freeze([]),
    });
  }

  const assets = assertReviewedDemoCandidate(candidate);
  assert.ok(rootStats?.isDirectory(), "approved product-media/public path must be a directory");

  const directoryEntries = await readdir(publicRootUrl, { withFileTypes: true });
  for (const entry of directoryEntries) {
    assert.equal(entry.isFile(), true, `reviewed demo directory may contain files only: ${entry.name}`);
    assert.equal(entry.isSymbolicLink(), false, `reviewed demo asset must not be a symlink: ${entry.name}`);
  }

  const filenames = directoryEntries.map((entry) => entry.name).sort();
  assert.deepEqual(
    filenames,
    APPROVED_PUBLIC_DEMO_FILENAMES,
    "product-media/public directory contents must exactly match the approved allowlist",
  );

  const assetsByFilename = new Map(
    assets.map((asset) => [asset.path.slice(PUBLIC_PATH_PREFIX.length), asset]),
  );

  for (const filename of APPROVED_PUBLIC_DEMO_FILENAMES) {
    const fileUrl = new URL(filename, publicRootUrl);
    const stats = await lstat(fileUrl);
    assert.equal(stats.isFile(), true, `reviewed demo asset must be a regular file: ${filename}`);
    assert.equal(stats.isSymbolicLink(), false, `reviewed demo asset must not be a symlink: ${filename}`);
    assertApprovedPublicDemoSize(filename, stats.size);

    const expected = assetsByFilename.get(filename);
    assert.ok(expected, `approved demo manifest is missing ${filename}`);
    assert.equal(
      await sha256File(fileUrl),
      expected.sha256,
      `reviewed demo asset hash mismatch: ${filename}`,
    );
  }

  await inspectMedia({ candidate, publicRootUrl });

  const assetPaths = Object.freeze([...APPROVED_PUBLIC_DEMO_PATHS]);
  return Object.freeze({
    active: true,
    assetPaths,
    pagesPaths: Object.freeze(assetPaths.map((assetPath) => `/Flowtake/assets/${assetPath}`)),
  });
}

const isCli = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const result = await verifyReviewedDemoMediaTree({
    publicRootUrl: new URL("../public/assets/product-media/public/", import.meta.url),
  });
  process.stdout.write(
    result.active
      ? `Verified ${result.assetPaths.length} reviewed public demo assets.\n`
      : "Verified reviewed demo media is fail-closed.\n",
  );
}
