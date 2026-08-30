import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  getReferencedTimelineMediaIds,
  hydrateProjectMedia,
  importProjectMedia,
  normalizeProjectMediaMetadata,
  rebindTimelineMediaEntities,
} from "../app/shared/editor/projectMedia.js"
import editorDomainReducer, {
  removeMedia,
  upsertMedia,
} from "../app/shared/redux/sceneSlice.js"

test("project media metadata excludes runtime-only values", () => {
  const metadata = normalizeProjectMediaMetadata({
    id: "media-1",
    path: "assets/video.mp4",
    name: "Walkthrough.mp4",
    fileName: "stored.mp4",
    mimeType: "video/mp4",
    size: 2048,
    src: "asset://runtime",
    absolutePath: "C:/runtime/video.mp4",
    sessionOnly: true,
    availability: "missing",
    isMissing: true,
    resolutionError: new Error("offline"),
  })

  assert.deepEqual(metadata, {
    id: "media-1",
    relativePath: "assets/video.mp4",
    originalName: "Walkthrough.mp4",
    fileName: "stored.mp4",
    name: "Walkthrough.mp4",
    size: 2048,
    mimeType: "video/mp4",
    type: "video",
    category: "media",
  })
  assert.equal(
    normalizeProjectMediaMetadata({
      id: "unsafe",
      relativePath: "assets/../project.json",
    }),
    null
  )
})

test("durable import keeps metadata portable and runtime URLs resolvable", async () => {
  const calls = []
  const { metadata, asset } = await importProjectMedia("C:/source/demo.wav", {
    id: "media-audio",
    createdAt: 123,
    invoke: async (channel, sourcePath) => {
      calls.push([channel, sourcePath])
      return {
        relativePath: "assets/abc.wav",
        absolutePath: "C:/project/assets/abc.wav",
        originalName: "demo.wav",
        fileName: "abc.wav",
        size: 42,
        mimeType: "audio/wav",
      }
    },
    toFileSrc: path => `asset:${path}`,
  })

  assert.deepEqual(calls, [["import-project-media", "C:/source/demo.wav"]])
  assert.equal(metadata.relativePath, "assets/abc.wav")
  assert.equal(metadata.createdAt, 123)
  assert.equal(metadata.absolutePath, undefined)
  assert.equal(metadata.src, undefined)
  assert.equal(asset.src, "asset:C:/project/assets/abc.wav")
  assert.equal(asset.absolutePath, "C:/project/assets/abc.wav")
  assert.equal(asset.availability, "ready")
  assert.equal(asset.isMissing, false)
})

test("reopen hydration retains unresolved assets with an explicit missing state", async () => {
  const media = [
    {
      id: "ready",
      relativePath: "assets/ready.png",
      originalName: "ready.png",
      mimeType: "image/png",
    },
    {
      id: "missing",
      relativePath: "assets/missing.mp4",
      originalName: "missing.mp4",
      mimeType: "video/mp4",
    },
  ]

  const assets = await hydrateProjectMedia(media, {
    invoke: async (_channel, relativePath) => {
      if (relativePath.includes("missing")) throw new Error("not found")
      return { absolutePath: "C:/project/assets/ready.png" }
    },
    toFileSrc: path => `asset:${path}`,
  })

  assert.equal(assets.length, 2)
  assert.equal(assets[0].availability, "ready")
  assert.equal(assets[1].availability, "missing")
  assert.equal(assets[1].isMissing, true)
  assert.equal(assets[1].src, null)
  assert.match(assets[1].missingReason, /missing or unavailable/)
})

test("saved timeline media entities reopen with fresh runtime URLs and intact identity", async () => {
  const savedDocument = JSON.parse(JSON.stringify({
    audioTrackAnims: {
      entities: [{
        id: "audio-clip",
        start: 500,
        end: 2_500,
        trackIndex: 0,
        mediaId: "audio-media",
        relativePath: "assets/audio.wav",
        mimeType: "audio/wav",
        src: "asset:C:/old-project/assets/audio.wav",
      }],
    },
    overlayAnims: {
      entities: [{
        id: "image-overlay",
        start: 1_000,
        end: 4_000,
        trackIndex: 0,
        overlayType: "image",
        mediaId: "image-media",
        relativePath: "assets/image.png",
        mimeType: "image/png",
        src: "asset:C:/old-project/assets/image.png",
      }, {
        id: "video-overlay",
        start: 4_500,
        end: 8_500,
        trackIndex: 0,
        overlayType: "video",
        mediaId: "video-media",
        relativePath: "assets/video.webm",
        mimeType: "video/webm",
        src: "asset:C:/old-project/assets/video.webm",
      }],
    },
  }))
  const hydratedAssets = await hydrateProjectMedia([
    {
      id: "audio-media",
      relativePath: "assets/audio.wav",
      originalName: "audio.wav",
      mimeType: "audio/wav",
    },
    {
      id: "image-media",
      relativePath: "assets/image.png",
      originalName: "image.png",
      mimeType: "image/png",
    },
    {
      id: "video-media",
      relativePath: "assets/video.webm",
      originalName: "video.webm",
      mimeType: "video/webm",
    },
  ], {
    invoke: async (_channel, relativePath) => ({
      absolutePath: `D:/reopened-project/${relativePath}`,
    }),
    toFileSrc: path => `runtime:${path}`,
  })

  const audioClips = rebindTimelineMediaEntities(
    savedDocument.audioTrackAnims,
    hydratedAssets
  )
  const overlays = rebindTimelineMediaEntities(
    savedDocument.overlayAnims,
    hydratedAssets
  )

  assert.equal(audioClips[0].mediaId, "audio-media")
  assert.equal(audioClips[0].relativePath, "assets/audio.wav")
  assert.equal(audioClips[0].src, "runtime:D:/reopened-project/assets/audio.wav")
  assert.equal(audioClips[0].start, 500)
  assert.equal(overlays[0].src, "runtime:D:/reopened-project/assets/image.png")
  assert.equal(overlays[1].src, "runtime:D:/reopened-project/assets/video.webm")
  assert.equal(overlays[1].end, 8_500)
})

test("timeline media rebind clears stale URLs when durable media is unavailable", () => {
  const [entity] = rebindTimelineMediaEntities([{
    id: "missing-image",
    start: 0,
    end: 1_000,
    mediaId: "missing-media",
    relativePath: "assets/missing.png",
    src: "asset:C:/stale/missing.png",
  }], [])

  assert.equal(entity.mediaId, "missing-media")
  assert.equal(entity.relativePath, "assets/missing.png")
  assert.equal(entity.src, null)
})

test("timeline media rebind upgrades relative-path-only legacy entities", () => {
  const [entity] = rebindTimelineMediaEntities([{
    id: "legacy-image",
    start: 0,
    end: 1_000,
    relativePath: "assets/legacy.png",
    src: "asset:C:/stale/legacy.png",
  }], [{
    id: "legacy-media",
    relativePath: "assets/legacy.png",
    mimeType: "image/png",
    src: "runtime:D:/project/assets/legacy.png",
  }])

  assert.equal(entity.mediaId, "legacy-media")
  assert.equal(entity.relativePath, "assets/legacy.png")
  assert.equal(entity.mimeType, "image/png")
  assert.equal(entity.src, "runtime:D:/project/assets/legacy.png")
})

test("referenced timeline media ids cover audio, image, and video entities", () => {
  const referenced = getReferencedTimelineMediaIds(
    [{ id: "audio", mediaId: "audio-media" }],
    {
      entities: [
        { id: "image", mediaId: "image-media" },
        { id: "video", mediaId: "video-media" },
        { id: "shape", overlayType: "shape" },
      ],
    }
  )

  assert.deepEqual(
    [...referenced].sort(),
    ["audio-media", "image-media", "video-media"]
  )
})

test("editor domain stores metadata only and removal does not require file deletion", () => {
  let state = editorDomainReducer(undefined, upsertMedia({
    id: "media-1",
    relativePath: "assets/video.mp4",
    originalName: "video.mp4",
    mimeType: "video/mp4",
    src: "asset://runtime",
    absolutePath: "C:/project/assets/video.mp4",
    isMissing: false,
  }))

  assert.deepEqual(state.media.ids, ["media-1"])
  assert.equal(state.media.entities["media-1"].src, undefined)
  assert.equal(state.media.entities["media-1"].absolutePath, undefined)

  state = editorDomainReducer(state, removeMedia("media-1"))
  assert.deepEqual(state.media.ids, [])
})

test("asset panel and open-project flow use durable and session-only paths", async () => {
  const [panel, helpers, projectMedia] = await Promise.all([
    readFile(new URL(
      "../app/windows/main/components/assets/AssetPanel.jsx",
      import.meta.url
    ), "utf8"),
    readFile(new URL("../app/shared/helpers.js", import.meta.url), "utf8"),
    readFile(new URL("../app/shared/editor/projectMedia.js", import.meta.url), "utf8"),
  ])

  assert.match(panel, /openDialog\(\{/)
  assert.match(panel, /importProjectMedia\(sourcePath\)/)
  assert.match(panel, /sessionOnly: true/)
  assert.match(panel, /new FileReader\(\)/)
  assert.match(panel, /getReferencedTimelineMediaIds\(timelineAudioClips, timelineOverlays\)/)
  assert.match(panel, /referencedAssetIds\.has\(assetId\)/)
  assert.match(panel, /This asset is used on the timeline/)
  assert.match(panel, /dispatch\(removeMedia\(assetId\)\)/)
  assert.match(panel, /dispatch\(removeMedia\(assetIds\)\)/)
  assert.match(panel, /Missing file/)
  assert.doesNotMatch(panel, /delete-project-media/)

  assert.match(helpers, /hydrateProjectMedia\(json\.editorDomain\.media\)/)
  assert.match(helpers, /rebindTimelineMediaEntities\(\s*json\.audioTrackAnims/)
  assert.match(helpers, /rebindTimelineMediaEntities\(\s*json\.overlayAnims/)
  assert.match(helpers, /setAudioClips\(hydratedAudioClips\)/)
  assert.match(helpers, /setOverlays\(hydratedOverlays\)/)
  assert.match(helpers, /setAssets\(hydratedProjectMedia\)/)
  assert.match(projectMedia, /convertFileSrc/)
  assert.match(projectMedia, /"resolve-project-media"/)
})
