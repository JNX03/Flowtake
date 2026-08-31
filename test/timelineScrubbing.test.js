import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
    clampTimelineTime,
    formatTimelineTime,
    getVisibleTimelineLabels,
    MAX_VISIBLE_TIMELINE_LABELS,
    shouldResumeTimelinePlayback,
    timelineTimeFromClientX,
    timelineTimeFromKeyboard,
} from "../app/shared/editor/timelineScrubbing.js"

const [cursorSource, timeScaleSource] = await Promise.all([
    readFile(new URL("../app/windows/main/components/timeline/Cursor.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/timeline/TimeScale.jsx", import.meta.url), "utf8"),
])

test("timeline time clamps invalid and out-of-range values", () => {
    assert.equal(clampTimelineTime(-10, 100, 500), 100)
    assert.equal(clampTimelineTime(900, 100, 500), 500)
    assert.equal(clampTimelineTime(250, 100, 500), 250)
    assert.equal(clampTimelineTime(Number.NaN, 100, 500), 100)
    assert.equal(clampTimelineTime(250, 500, 100), 500)
})

test("client coordinates map to timeline time with scroll and grab offsets", () => {
    assert.equal(timelineTimeFromClientX({
        clientX: 350,
        contentLeft: 100,
        pxPerMs: 0.1,
        start: 0,
        end: 10000,
    }), 2500)
    assert.equal(timelineTimeFromClientX({
        clientX: 350,
        contentLeft: 100,
        pointerOffsetPx: 10,
        pxPerMs: 0.1,
        start: 0,
        end: 10000,
    }), 2400)
    assert.equal(timelineTimeFromClientX({
        clientX: -100,
        contentLeft: 100,
        pxPerMs: 0.1,
        start: 500,
        end: 10000,
    }), 500)
    assert.equal(timelineTimeFromClientX({
        clientX: 1000,
        contentLeft: 100,
        pxPerMs: 0,
        start: 500,
        end: 10000,
    }), 500)
})

test("keyboard seeking follows slider conventions and clamps", () => {
    const base = { time: 5000, start: 1000, end: 6000 }
    assert.equal(timelineTimeFromKeyboard({ ...base, key: "ArrowLeft" }), 4900)
    assert.equal(timelineTimeFromKeyboard({ ...base, key: "ArrowRight", shiftKey: true }), 6000)
    assert.equal(timelineTimeFromKeyboard({ ...base, key: "PageDown" }), 4000)
    assert.equal(timelineTimeFromKeyboard({ ...base, key: "Home" }), 1000)
    assert.equal(timelineTimeFromKeyboard({ ...base, key: "End" }), 6000)
    assert.equal(timelineTimeFromKeyboard({ ...base, key: "Escape" }), null)
})

test("playback resumes only when it was active and the scrub did not end at the boundary", () => {
    assert.equal(shouldResumeTimelinePlayback({ wasPlaying: true, time: 4999, end: 5000 }), true)
    assert.equal(shouldResumeTimelinePlayback({ wasPlaying: true, time: 5000, end: 5000 }), false)
    assert.equal(shouldResumeTimelinePlayback({ wasPlaying: false, time: 1000, end: 5000 }), false)
})

test("timeline aria time formatting is stable", () => {
    assert.equal(formatTimelineTime(0), "00:00.000")
    assert.equal(formatTimelineTime(61005), "01:01.005")
    assert.equal(formatTimelineTime(3661005), "01:01:01.005")
})

test("timeline labels stay bounded to the visible viewport for long projects", () => {
    const labels = getVisibleTimelineLabels({
        duration: 2 * 60 * 60 * 1000,
        intervalMs: 100,
        pxPerMs: 0.25,
        scrollLeft: 900000,
        viewportWidth: 1920
    })

    assert.ok(labels.length > 0)
    assert.ok(labels.length <= MAX_VISIBLE_TIMELINE_LABELS)
    assert.ok(labels[0].px < 900000)
    assert.ok(labels.at(-1).px > 900000 + 1920)
    assert.ok(labels.every((label, index) => index === 0 || label.ms > labels[index - 1].ms))
})

test("playhead and ruler use pointer capture without document mouse listeners", () => {
    assert.match(cursorSource, /setPointerCapture/)
    assert.match(cursorSource, /releasePointerCapture/)
    assert.match(cursorSource, /onPointerMove/)
    assert.match(cursorSource, /onPointerCancel/)
    assert.match(cursorSource, /onLostPointerCapture/)
    assert.match(cursorSource, /role="slider"/)
    assert.match(cursorSource, /aria-valuenow/)
    assert.match(cursorSource, /timelineTimeFromKeyboard/)
    assert.match(cursorSource, /createTimelineAutoScrollController/)
    assert.match(cursorSource, /scrubAutoScroll\.stop\(\)/)
    assert.doesNotMatch(cursorSource, /window\.addEventListener\(["']mousemove/)

    assert.match(timeScaleSource, /setPointerCapture/)
    assert.match(timeScaleSource, /onPointerMove/)
    assert.match(timeScaleSource, /shouldResumeTimelinePlayback/)
    assert.match(timeScaleSource, /getVisibleTimelineLabels/)
    assert.match(timeScaleSource, /useThrottledCallback/)
    assert.match(timeScaleSource, /setTimeThrottled\.cancel\(\)/)
    assert.match(timeScaleSource, /createTimelineAutoScrollController/)
    assert.match(timeScaleSource, /scrubAutoScroll\.stop\(\)/)
    assert.doesNotMatch(timeScaleSource, /addEventListener\(["']mousemove/)
})
