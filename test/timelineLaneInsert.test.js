import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
    createAudioLaneItem,
    createOverlayLaneItem,
    getOverlayLaneInsertDuration,
    planTimelineLaneInsert,
} from "../app/shared/editor/timelineLaneInsert.js"

test("timeline lane insertion rejects playback and locked tracks atomically", () => {
    const input = {
        requestedStart: 2_000,
        requestedDuration: 1_000,
        projectDuration: 10_000,
        track: { id: 3, locked: false },
    }

    assert.deepEqual(
        planTimelineLaneInsert({ ...input, isPlaying: true }),
        { ok: false, reason: "playback-active" }
    )
    assert.deepEqual(
        planTimelineLaneInsert({
            ...input,
            track: { id: 3, locked: true },
        }),
        { ok: false, reason: "locked-track" }
    )
})

test("timeline lane insertion clamps a complete item inside project bounds", () => {
    assert.deepEqual(planTimelineLaneInsert({
        requestedStart: 9_800,
        requestedDuration: 2_000,
        projectDuration: 10_000,
        track: { id: 0, locked: false },
    }), {
        ok: true,
        start: 8_000,
        end: 10_000,
        pointerTime: 9_800,
    })
})

test("timeline lane insertion chooses the closest non-overlapping gap", () => {
    assert.deepEqual(planTimelineLaneInsert({
        requestedStart: 4_000,
        requestedDuration: 1_000,
        projectDuration: 10_000,
        track: { id: 0, locked: false },
        items: [
            { id: "occupied", start: 2_500, end: 4_500, trackIndex: 0 },
        ],
    }), {
        ok: true,
        start: 4_500,
        end: 5_500,
        pointerTime: 4_000,
    })
})

test("timeline lane insertion fails without shortening or moving existing items", () => {
    assert.deepEqual(planTimelineLaneInsert({
        requestedStart: 2_000,
        requestedDuration: 2_000,
        projectDuration: 4_000,
        track: { id: 0, locked: false },
        items: [
            { id: "left", start: 0, end: 2_500, trackIndex: 0 },
            { id: "right", start: 2_500, end: 4_000, trackIndex: 0 },
        ],
    }), {
        ok: false,
        reason: "no-available-space",
    })
})

test("audio lane items preserve project and session media fields", () => {
    assert.deepEqual(createAudioLaneItem({
        id: "audio-1",
        trackId: 4,
        start: 500,
        end: 2_500,
        asset: {
            id: "media-1",
            name: "Voiceover",
            src: "asset://voiceover.wav",
            relativePath: "assets/voiceover.wav",
            mimeType: "audio/wav",
            duration: 8_000,
        },
    }), {
        id: "audio-1",
        start: 500,
        end: 2_500,
        trackIndex: 4,
        name: "Voiceover",
        volume: 1,
        sourceStart: 0,
        sourceEnd: 2_000,
        playbackRate: 1,
        src: "asset://voiceover.wav",
        mediaId: "media-1",
        relativePath: "assets/voiceover.wav",
        mimeType: "audio/wav",
        sourceDuration: 8_000,
    })
})

test("video lane items preserve source timing and durable media metadata", () => {
    const asset = {
        id: "video-1",
        type: "video",
        name: "Cutaway",
        relativePath: "assets/cutaway.webm",
        mimeType: "video/webm",
        sourceStart: 1_000,
        sourceDuration: 9_000,
        playbackRate: 2,
        width: 1_920,
        height: 1_080,
    }

    assert.equal(getOverlayLaneInsertDuration(asset), 4_000)
    assert.deepEqual(createOverlayLaneItem({
        id: "overlay-1",
        trackId: 2,
        start: 3_000,
        end: 7_000,
        asset,
    }), {
        id: "overlay-1",
        start: 3_000,
        end: 7_000,
        trackIndex: 2,
        opacity: 1,
        position: { x: 0.5, y: 0.5 },
        overlayType: "video",
        name: "Cutaway",
        src: null,
        mediaId: "video-1",
        relativePath: "assets/cutaway.webm",
        mimeType: "video/webm",
        sourceStart: 1_000,
        sourceDuration: 9_000,
        durationEstimated: false,
        playbackRate: 2,
        loop: false,
        width: 1_920,
        height: 1_080,
    })
})

test("image lane items preserve durable media identity for reopen hydration", () => {
    assert.deepEqual(createOverlayLaneItem({
        id: "overlay-image",
        trackId: 3,
        start: 1_000,
        end: 5_000,
        asset: {
            id: "image-1",
            type: "image",
            name: "Diagram",
            src: "asset://runtime-image.png",
            relativePath: "assets/diagram.png",
            mimeType: "image/png",
            width: 640,
            height: 360,
        },
    }), {
        id: "overlay-image",
        start: 1_000,
        end: 5_000,
        trackIndex: 3,
        opacity: 1,
        position: { x: 0.5, y: 0.5 },
        overlayType: "image",
        name: "Diagram",
        src: "asset://runtime-image.png",
        mediaId: "image-1",
        relativePath: "assets/diagram.png",
        mimeType: "image/png",
        width: 640,
        height: 360,
    })
})

test("unknown video duration uses a bounded estimated timeline span", () => {
    const asset = {
        id: "session-video",
        type: "video",
        src: "data:video/webm;base64,AAAA",
    }

    assert.equal(getOverlayLaneInsertDuration(asset), 4_000)
    assert.equal(createOverlayLaneItem({
        id: "overlay-session",
        trackId: 0,
        start: 0,
        end: 4_000,
        asset,
    }).durationEstimated, true)
})

test("every timeline media drop surface uses the shared safe insertion path", () => {
    const timeline = readFileSync(
        new URL("../app/windows/main/components/timeline/Timeline.jsx", import.meta.url),
        "utf8"
    )
    const audioTracks = readFileSync(
        new URL("../app/windows/main/components/timeline/AudioTracks.jsx", import.meta.url),
        "utf8"
    )
    const overlayTracks = readFileSync(
        new URL("../app/windows/main/components/timeline/OverlayTracks.jsx", import.meta.url),
        "utf8"
    )

    assert.match(timeline, /planTimelineLaneInsert/)
    assert.match(timeline, /selectNextAudioTrackId/)
    assert.match(timeline, /withGroup\(addAudioClip/)
    assert.match(timeline, /withGroup\(addOverlay/)
    assert.match(audioTracks, /disabled=\{track\.locked \|\| isPlaying\}/)
    assert.match(audioTracks, /planTimelineLaneInsert/)
    assert.match(overlayTracks, /disabled=\{track\.locked \|\| isPlaying\}/)
    assert.match(overlayTracks, /createOverlayLaneItem/)
    assert.doesNotMatch(overlayTracks, /data\.type === "video"[\s\S]*overlayType: "image"/)
})
