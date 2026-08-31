import assert from "node:assert/strict"
import test from "node:test"
import {
    buildRenderTimelineFrames,
    findActivePlaybackClip,
    findNextPlaybackClip,
    getClipSourceRange,
    getClipSplitTiming,
    isFreezePlaybackRate,
    mediaTimeToClipTimelineMs,
    mediaTimeToTimelineMs,
    normalizePlaybackRate,
    resolveClipTimingChange,
    shouldPublishPlaybackTime,
    timelineTimeToClipMediaMs,
    timelineTimeToMediaMs,
} from "../app/shared/editor/playbackClock.js"

test("media time is authoritative and clamps to timeline bounds", () => {
    assert.equal(mediaTimeToTimelineMs(1.25, 0, 5000), 1250)
    assert.equal(mediaTimeToTimelineMs(-2, 250, 5000), 250)
    assert.equal(mediaTimeToTimelineMs(9, 0, 5000), 5000)
    assert.equal(mediaTimeToTimelineMs(Number.NaN, 400, 5000), 400)
})

test("playback publication ignores duplicate sub-frame values", () => {
    assert.equal(shouldPublishPlaybackTime(1000, null), true)
    assert.equal(shouldPublishPlaybackTime(1004, 1000), false)
    assert.equal(shouldPublishPlaybackTime(1008, 1000), true)
    assert.equal(shouldPublishPlaybackTime(Number.NaN, 1000), false)
})

test("invalid and zero playback rates recover to a safe value", () => {
    assert.equal(normalizePlaybackRate(2), 2)
    assert.equal(normalizePlaybackRate(0), 1)
    assert.equal(normalizePlaybackRate(-1), 1)
    assert.equal(normalizePlaybackRate("bad"), 1)
})

test("freeze clips keep media on the held source frame", () => {
    const clips = [
        { id: "before", start: 0, end: 1000, playbackRate: 1 },
        { id: "freeze", start: 1000, end: 3000, playbackRate: 0 },
        { id: "after", start: 3000, end: 4000, playbackRate: 1 },
    ]

    assert.equal(isFreezePlaybackRate(0), true)
    assert.equal(isFreezePlaybackRate(1), false)
    assert.equal(timelineTimeToMediaMs(clips, 2250, 4000), 1000)
    assert.equal(timelineTimeToMediaMs(clips, 3500, 4000), 3500)
})

test("clip boundaries are half-open and gaps find the next clip", () => {
    const clips = [
        { id: "a", start: 0, end: 1000 },
        { id: "b", start: 1000, end: 2000 },
        { id: "c", start: 2500, end: 3000 },
    ]

    assert.equal(findActivePlaybackClip(clips, 999, 3000)?.id, "a")
    assert.equal(findActivePlaybackClip(clips, 1000, 3000)?.id, "b")
    assert.equal(findActivePlaybackClip(clips, 3000, 3000)?.id, "c")
    assert.equal(findActivePlaybackClip(clips, 2250, 3000), null)
    assert.equal(findNextPlaybackClip(clips, 2250)?.id, "c")
    assert.equal(findActivePlaybackClip([{ id: "tail", start: 0, end: 1000 }], 1000, 2000), null)
})

test("moved clips preserve source time while trims move only the edited source edge", () => {
    const moved = {
        id: "moved",
        start: 4000,
        end: 6000,
        sourceStart: 1000,
        sourceEnd: 3000,
        playbackRate: 1,
    }

    assert.deepEqual(getClipSourceRange(moved), { sourceStart: 1000, sourceEnd: 3000 })
    assert.equal(timelineTimeToClipMediaMs(moved, 4500), 1500)
    assert.equal(mediaTimeToClipTimelineMs(moved, 1.5), 4500)
    assert.equal(timelineTimeToMediaMs([moved], 4500, 6000), 1500)

    assert.deepEqual(resolveClipTimingChange(moved, 5000, 7000), {
        start: 5000,
        end: 7000,
        sourceStart: 1000,
        sourceEnd: 3000,
    })
    assert.deepEqual(resolveClipTimingChange(moved, 4500, 6000), {
        start: 4500,
        end: 6000,
        sourceStart: 1500,
        sourceEnd: 3000,
    })
    assert.deepEqual(resolveClipTimingChange(moved, 4000, 5500), {
        start: 4000,
        end: 5500,
        sourceStart: 1000,
        sourceEnd: 2500,
    })
})

test("split timing keeps both source halves touching without changing total duration", () => {
    const clip = {
        id: "clip",
        start: 4000,
        end: 6000,
        sourceStart: 1000,
        sourceEnd: 3000,
    }

    assert.deepEqual(getClipSplitTiming(clip, 4750), {
        left: {
            end: 4750,
            sourceStart: 1000,
            sourceEnd: 1750,
        },
        right: {
            start: 4750,
            sourceStart: 1750,
            sourceEnd: 3000,
        },
    })
})

test("render frames keep blank gaps on the output clock and resume the next source segment", () => {
    const frames = buildRenderTimelineFrames({
        clips: [
            { id: "first", start: 0, end: 1000, sourceStart: 0, sourceEnd: 1000 },
            { id: "second", start: 2000, end: 3000, sourceStart: 1000, sourceEnd: 2000 },
        ],
        timelineStart: 0,
        timelineEnd: 3000,
        fps: 2,
    })

    assert.deepEqual(frames.map(frame => ({
        output: frame.outputTimestamp,
        timeline: frame.timelineTimestamp,
        source: frame.sourceTimestamp,
        gap: frame.isGap,
    })), [
        { output: 0, timeline: 0, source: 0, gap: false },
        { output: 500, timeline: 500, source: 500, gap: false },
        { output: 1000, timeline: 1000, source: null, gap: true },
        { output: 1500, timeline: 1500, source: null, gap: true },
        { output: 2000, timeline: 2000, source: 1000, gap: false },
        { output: 2500, timeline: 2500, source: 1500, gap: false },
    ])
})

test("freeze render frames hold their source while timeline output continues", () => {
    const frames = buildRenderTimelineFrames({
        clips: [{
            id: "freeze",
            start: 1000,
            end: 2000,
            sourceStart: 250,
            sourceEnd: 1250,
            playbackRate: 0,
        }],
        timelineStart: 1000,
        timelineEnd: 2000,
        fps: 2,
    })

    assert.deepEqual(frames.map(frame => [
        frame.timelineTimestamp,
        frame.sourceTimestamp,
        frame.isFreeze,
    ]), [
        [1000, 250, true],
        [1500, 250, true],
    ])
})
