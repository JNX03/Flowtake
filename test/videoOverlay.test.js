import assert from "node:assert/strict"
import test from "node:test"
import {
    clampVideoOverlayEnd,
    createVideoOverlaySourceTimestamps,
    getVideoOverlaySourceTime,
    isVideoOverlayActive,
} from "../app/shared/editor/videoOverlay.js"

test("video overlay duration is clamped to both source and project bounds", () => {
    assert.equal(clampVideoOverlayEnd({
        start: 8000,
        projectDuration: 10000,
        sourceDuration: 5000,
    }), 10000)

    assert.equal(clampVideoOverlayEnd({
        start: 1000,
        projectDuration: 10000,
        sourceDuration: 2500,
        sourceStart: 500,
        playbackRate: 2,
    }), 2000)

    assert.equal(clampVideoOverlayEnd({
        start: 1000,
        projectDuration: 10000,
        sourceDuration: null,
    }), 5000)
})

test("source time follows overlay-local time, offset, playback rate, and looping", () => {
    const base = {
        overlayType: "video",
        start: 2000,
        end: 8000,
        sourceStart: 500,
        sourceDuration: 3000,
        playbackRate: 2,
    }

    assert.equal(getVideoOverlaySourceTime(base, 2500), 1500)
    assert.equal(getVideoOverlaySourceTime(base, 5000), 3000)
    assert.equal(getVideoOverlaySourceTime({ ...base, loop: true }, 4000), 2000)
})

test("render timestamp plan includes only visible video-overlay frames", () => {
    const config = {
        overlayType: "video",
        start: 1000,
        end: 2000,
        sourceStart: 250,
        playbackRate: 1,
    }
    const timestamps = [
        { rendererTimestamp: 0, outputTimestamp: 0 },
        { rendererTimestamp: 1000, outputTimestamp: 1000 },
        { rendererTimestamp: 1500, outputTimestamp: 1500 },
        {
            rendererTimestamp: null,
            sceneTimestamp: 1750,
            outputTimestamp: 1750,
            isGap: true,
        },
        { rendererTimestamp: 2500, outputTimestamp: 2500 },
    ]

    assert.deepEqual(createVideoOverlaySourceTimestamps(config, timestamps), [
        { rendererTimestamp: 1000, outputTimestamp: 1000, sourceTimestamp: 250 },
        { rendererTimestamp: 1500, outputTimestamp: 1500, sourceTimestamp: 750 },
        {
            rendererTimestamp: null,
            sceneTimestamp: 1750,
            outputTimestamp: 1750,
            isGap: true,
            sourceTimestamp: 1000,
        },
    ])
    assert.equal(isVideoOverlayActive({ ...config, visible: false }, 1500), false)
    assert.deepEqual(createVideoOverlaySourceTimestamps({ overlayType: "image" }, timestamps), [])
})
