import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  reviewedDemoMediaCandidate,
  validateReviewedDemoMedia,
} from "./reviewedDemoMedia.js";
import {
  APPROVED_PUBLIC_DEMO_ASSETS,
  APPROVED_PUBLIC_DEMO_FILENAMES,
  APPROVED_PUBLIC_DEMO_PATHS,
  assertApprovedPublicDemoPath,
  assertApprovedPublicDemoSize,
  assertPosterFacts,
  assertReviewedDemoCandidate,
  assertReviewedVideoFacts,
  assertReviewedVttText,
  inspectReviewedDemoMedia,
  verifyReviewedDemoMediaTree,
} from "../scripts/verify-reviewed-demo-media.mjs";

const publicPath = (filename) => `product-media/public/${filename}`;
const hash = (value) => createHash("sha256").update(value).digest("hex");

const mediaAsset = (filename, bytes, facts) => ({
  path: publicPath(filename),
  sha256: hash(bytes),
  ...facts,
});

const buildApprovedFixture = (files) => ({
  schemaVersion: 1,
  status: "APPROVED_PUBLIC",
  releaseVersion: "1.6.0",
  privacyReview: "PASS",
  truthReview: "PASS",
  secondReview: "PASS",
  sourceSha256: "f".repeat(64),
  reviewedAt: "2026-07-18T10:00:00.000Z",
  master: {
    id: "master",
    title: "Record, edit, and export with Flowtake.",
    body: "A genuine 42-second walkthrough of the published desktop app.",
    label: "Flowtake v1.6.0 product walkthrough",
    durationSeconds: 42,
    media: {
      burnedInCaptions: true,
      mp4: mediaAsset("flowtake-v1.6.0-demo.mp4", files["flowtake-v1.6.0-demo.mp4"], {
        codec: "h264",
        pixelFormat: "yuv420p",
        hasAudio: false,
        durationSeconds: 42,
      }),
      webm: mediaAsset("flowtake-v1.6.0-demo.webm", files["flowtake-v1.6.0-demo.webm"], {
        codec: "vp9",
        pixelFormat: "yuv420p",
        hasAudio: false,
        durationSeconds: 42,
      }),
      poster: mediaAsset("flowtake-v1.6.0-demo-poster.webp", files["flowtake-v1.6.0-demo-poster.webp"], {
        width: 1920,
        height: 1080,
      }),
      captions: mediaAsset("flowtake-v1.6.0-demo-en.vtt", files["flowtake-v1.6.0-demo-en.vtt"], {
        cueCount: 6,
      }),
    },
  },
  features: [
    {
      id: "record",
      title: "Choose the recording source.",
      body: "Select the real window and begin recording.",
      label: "Flowtake Record workflow",
      durationSeconds: 18,
      media: {
        burnedInCaptions: true,
        mp4: mediaAsset("flowtake-v1.6.0-record.mp4", files["flowtake-v1.6.0-record.mp4"], {
          codec: "h264",
          pixelFormat: "yuv420p",
          hasAudio: false,
          durationSeconds: 18,
        }),
        webm: null,
        poster: null,
        captions: null,
      },
    },
    {
      id: "edit",
      title: "Edit the saved take.",
      body: "Trim the clip and adjust a real zoom treatment.",
      label: "Flowtake Edit workflow",
      durationSeconds: 10,
      media: {
        burnedInCaptions: true,
        mp4: mediaAsset("flowtake-v1.6.0-edit.mp4", files["flowtake-v1.6.0-edit.mp4"], {
          codec: "h264",
          pixelFormat: "yuv420p",
          hasAudio: false,
          durationSeconds: 10,
        }),
        webm: null,
        poster: null,
        captions: null,
      },
    },
    {
      id: "export",
      title: "Export the local MP4.",
      body: "Show the completed row and its Folder and Play controls.",
      label: "Flowtake Export workflow",
      durationSeconds: 8,
      media: {
        burnedInCaptions: true,
        mp4: mediaAsset("flowtake-v1.6.0-export.mp4", files["flowtake-v1.6.0-export.mp4"], {
          codec: "h264",
          pixelFormat: "yuv420p",
          hasAudio: false,
          durationSeconds: 8,
        }),
        webm: null,
        poster: null,
        captions: null,
      },
    },
  ],
});

const reviewedVtt = `WEBVTT

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

const fixtureFiles = () => Object.fromEntries(
  APPROVED_PUBLIC_DEMO_FILENAMES.map((filename, index) => {
    if (filename.endsWith(".vtt")) return [filename, Buffer.from(reviewedVtt)];
    const { minBytes } = APPROVED_PUBLIC_DEMO_ASSETS[filename];
    return [filename, Buffer.alloc(minBytes, 65 + index)];
  }),
);

test("repository demo media stays fail-closed until an approved manifest and exact public tree exist", async () => {
  const result = await verifyReviewedDemoMediaTree({
    candidate: reviewedDemoMediaCandidate,
    publicRootUrl: new URL("../public/assets/product-media/public/", import.meta.url),
  });

  if (reviewedDemoMediaCandidate === null) {
    assert.equal(validateReviewedDemoMedia(reviewedDemoMediaCandidate), false);
    assert.deepEqual(result, {
      active: false,
      assetPaths: [],
      pagesPaths: [],
    });
  } else {
    assert.equal(result.active, true);
    assert.deepEqual(result.assetPaths, APPROVED_PUBLIC_DEMO_PATHS);
  }
});

test("approved manifest uses exactly the seven reviewed public candidates", () => {
  const candidate = buildApprovedFixture(fixtureFiles());

  assert.equal(validateReviewedDemoMedia(candidate), true);
  assert.deepEqual(candidate.features.map((feature) => feature.durationSeconds), [18, 10, 8]);
  assert.deepEqual(
    assertReviewedDemoCandidate(candidate).map((asset) => asset.path).sort(),
    APPROVED_PUBLIC_DEMO_PATHS,
  );

  const unreviewed = structuredClone(candidate);
  unreviewed.status = "UNREVIEWED - DO NOT PUBLISH";
  assert.equal(validateReviewedDemoMedia(unreviewed), false);
  assert.throws(() => assertReviewedDemoCandidate(unreviewed), /publication manifest validator/u);

  const missingExport = structuredClone(candidate);
  missingExport.features.pop();
  assert.equal(validateReviewedDemoMedia(missingExport), false);
  assert.throws(() => assertReviewedDemoCandidate(missingExport), /publication manifest validator/u);

  const unexpectedDerivative = structuredClone(candidate);
  unexpectedDerivative.features[0].media.webm = {
    ...unexpectedDerivative.master.media.webm,
    path: "product-media/public/flowtake-v1.6.0-record.webm",
  };
  assert.throws(
    () => assertReviewedDemoCandidate(unexpectedDerivative),
    /publication manifest validator|allowlist|seven approved/u,
  );
});

test("private-review names and out-of-bounds files are rejected", () => {
  assert.doesNotThrow(() => {
    assertApprovedPublicDemoPath("product-media/public/flowtake-v1.6.0-demo.mp4");
  });

  for (const unsafe of [
    "product-media/public/flowtake-v1.6.0-demo-raw.mp4",
    "product-media/public/flowtake-v1.6.0-demo-source.mp4",
    "product-media/public/flowtake-v1.6.0-demo-master.mp4",
    "product-media/public/flowtake-v1.6.0-demo-private.mp4",
    "product-media/public/flowtake-v1.6.0-demo-manifest.txt",
    "product-media/public/flowtake-v1.6.0-review-contact-sheet.webp",
    "product-media/public/flowtake-v1.6.0-demo-unreviewed.mp4",
  ]) {
    assert.throws(() => assertApprovedPublicDemoPath(unsafe), /allowlist|private-review/u);
  }

  const filename = "flowtake-v1.6.0-demo.mp4";
  const { minBytes, maxBytes } = APPROVED_PUBLIC_DEMO_ASSETS[filename];
  assert.doesNotThrow(() => assertApprovedPublicDemoSize(filename, minBytes));
  assert.doesNotThrow(() => assertApprovedPublicDemoSize(filename, maxBytes));
  assert.throws(() => assertApprovedPublicDemoSize(filename, minBytes - 1), /outside/u);
  assert.throws(() => assertApprovedPublicDemoSize(filename, maxBytes + 1), /outside/u);
});

test("media facts and reviewed VTT timeline are independently launch-gated", () => {
  const candidate = buildApprovedFixture(fixtureFiles());
  const mp4 = candidate.master.media.mp4;
  const facts = {
    codec: "h264",
    streamTypes: ["video"],
    pixelFormat: "yuv420p",
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 42,
    audioCount: 0,
    chapterCount: 0,
    unexpectedTags: [],
  };

  assert.doesNotThrow(() => assertReviewedVideoFacts(facts, mp4, ["h264"], "demo MP4"));
  assert.throws(
    () => assertReviewedVideoFacts({ ...facts, audioCount: 1 }, mp4, ["h264"], "demo MP4"),
    /no audio streams/u,
  );
  assert.throws(
    () => assertReviewedVideoFacts({ ...facts, chapterCount: 1 }, mp4, ["h264"], "demo MP4"),
    /no chapters/u,
  );
  assert.throws(
    () => assertReviewedVideoFacts({ ...facts, unexpectedTags: ["comment"] }, mp4, ["h264"], "demo MP4"),
    /unexpected metadata/u,
  );
  assert.throws(
    () => assertReviewedVideoFacts({ ...facts, durationSeconds: 42.051 }, mp4, ["h264"], "demo MP4"),
    /duration/u,
  );
  for (const streamTypes of [
    ["video", "subtitle"],
    ["video", "data"],
    ["video", "attachment"],
    ["video", "video"],
  ]) {
    assert.throws(
      () => assertReviewedVideoFacts({ ...facts, streamTypes }, mp4, ["h264"], "demo MP4"),
      /exactly one video stream and no other streams/u,
    );
  }
  assert.doesNotThrow(() => assertReviewedVttText(reviewedVtt, candidate.master.media.captions));
  assert.throws(
    () => assertReviewedVttText(reviewedVtt.replace("Export a local MP4.", "Export the file."), candidate.master.media.captions),
    /canonical six-cue WebVTT/u,
  );
  for (const extra of [
    "\nNOTE PRIVATE EXTRA PAYLOAD\n",
    "\nSTYLE\n::cue { color: red; }\n",
    "\nREGION\nid:private\n",
    "\nstray private text\n",
    "\n00:00:42.000 --> 00:00:43.000 position:10%\nUnexpected cue.\n",
  ]) {
    assert.throws(
      () => assertReviewedVttText(`${reviewedVtt}${extra}`, candidate.master.media.captions),
      /canonical six-cue WebVTT/u,
    );
  }
  assert.throws(
    () => assertReviewedVttText(
      reviewedVtt.replace(
        "00:00:00.000 --> 00:00:03.000",
        "private-cue-id\n00:00:00.000 --> 00:00:03.000",
      ),
      candidate.master.media.captions,
    ),
    /canonical six-cue WebVTT/u,
  );
});

test("poster rejects extra streams and is included in the full-decode gate", async () => {
  const candidate = buildApprovedFixture(fixtureFiles());
  const posterProbe = {
    streams: [{
      codec_type: "video",
      codec_name: "webp",
      width: 1920,
      height: 1080,
      tags: {},
    }],
    format: { tags: {} },
    chapters: [],
  };

  assert.doesNotThrow(() => {
    assertPosterFacts(posterProbe, candidate.master.media.poster, "demo poster");
  });
  for (const codecType of ["subtitle", "data", "attachment", "video"]) {
    assert.throws(
      () => assertPosterFacts(
        {
          ...posterProbe,
          streams: [
            ...posterProbe.streams,
            { codec_type: codecType, codec_name: codecType === "video" ? "webp" : "bin" },
          ],
        },
        candidate.master.media.poster,
        "demo poster",
      ),
      /exactly one image stream and no other streams/u,
    );
  }

  const decoded = [];
  const fastStarted = [];
  const videoAssets = [
    candidate.master.media.mp4,
    candidate.master.media.webm,
    ...candidate.features.map((feature) => feature.media.mp4),
  ];
  const videoByName = new Map(
    videoAssets.map((asset) => [asset.path.slice(publicPath("x").length - 1), asset]),
  );
  const probe = (_ffprobe, fileUrl) => {
    const filename = fileUrl.pathname.split("/").at(-1);
    if (filename.endsWith(".webp")) return posterProbe;
    const asset = videoByName.get(filename);
    return {
      streams: [{
        codec_type: "video",
        codec_name: asset.codec,
        pix_fmt: asset.pixelFormat,
        width: 1920,
        height: 1080,
        avg_frame_rate: "30/1",
        tags: {},
      }],
      format: { duration: String(asset.durationSeconds), tags: {} },
      chapters: [],
    };
  };

  await inspectReviewedDemoMedia({
    candidate,
    publicRootUrl: new URL("file:///reviewed-demo/"),
    tools: { ffprobe: "ffprobe", ffmpeg: "ffmpeg" },
    probe,
    decode: (_ffmpeg, fileUrl) => decoded.push(fileUrl.pathname.split("/").at(-1)),
    assertFastStart: async (fileUrl) => fastStarted.push(fileUrl.pathname.split("/").at(-1)),
    readCaptionText: async () => reviewedVtt,
  });

  assert.deepEqual(decoded.sort(), [
    "flowtake-v1.6.0-demo.mp4",
    "flowtake-v1.6.0-demo-poster.webp",
    "flowtake-v1.6.0-demo.webm",
    "flowtake-v1.6.0-edit.mp4",
    "flowtake-v1.6.0-export.mp4",
    "flowtake-v1.6.0-record.mp4",
  ].sort());
  assert.deepEqual(fastStarted.sort(), [
    "flowtake-v1.6.0-demo.mp4",
    "flowtake-v1.6.0-edit.mp4",
    "flowtake-v1.6.0-export.mp4",
    "flowtake-v1.6.0-record.mp4",
  ].sort());
});

test("public tree requires exact contents, bounded sizes, and matching hashes", async (t) => {
  const rootPath = await mkdtemp(join(tmpdir(), "flowtake-reviewed-demo-"));
  const publicPathRoot = join(rootPath, "product-media", "public");
  const publicRootUrl = pathToFileURL(`${publicPathRoot}${sep}`);
  const files = fixtureFiles();
  const candidate = buildApprovedFixture(files);
  t.after(() => rm(rootPath, { recursive: true, force: true }));

  await mkdir(publicPathRoot, { recursive: true });
  await Promise.all(
    Object.entries(files).map(([filename, bytes]) => writeFile(join(publicPathRoot, filename), bytes)),
  );

  let inspectionCount = 0;
  const inspectMedia = async ({ candidate: inspectedCandidate, publicRootUrl: inspectedRoot }) => {
    inspectionCount += 1;
    assert.equal(inspectedCandidate, candidate);
    assert.equal(inspectedRoot, publicRootUrl);
  };
  const verified = await verifyReviewedDemoMediaTree({ candidate, publicRootUrl, inspectMedia });
  assert.equal(verified.active, true);
  assert.equal(inspectionCount, 1);
  assert.deepEqual(verified.assetPaths, APPROVED_PUBLIC_DEMO_PATHS);
  assert.deepEqual(
    verified.pagesPaths,
    APPROVED_PUBLIC_DEMO_PATHS.map((assetPath) => `/Flowtake/assets/${assetPath}`),
  );

  const extraPath = join(publicPathRoot, "flowtake-v1.6.0-demo-manifest.txt");
  await writeFile(extraPath, "private review manifest");
  await assert.rejects(
    verifyReviewedDemoMediaTree({ candidate, publicRootUrl, inspectMedia }),
    /directory contents must exactly match/u,
  );
  await unlink(extraPath);

  const wrongHash = structuredClone(candidate);
  wrongHash.master.media.mp4.sha256 = "0".repeat(64);
  await assert.rejects(
    verifyReviewedDemoMediaTree({ candidate: wrongHash, publicRootUrl, inspectMedia }),
    /hash mismatch/u,
  );
});
