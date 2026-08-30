import assert from "node:assert/strict"
import test from "node:test"

import {
    findClosestTimelineGap,
    getTimelineCanvasEnd,
} from "../app/shared/editor/timelineMovePlacement.js"

test("timeline move placement clamps free items to project bounds", () => {
    assert.equal(findClosestTimelineGap({
        targetStart: -500,
        duration: 1_000,
        timelineDuration: 10_000,
    }), 0)
    assert.equal(findClosestTimelineGap({
        targetStart: 9_800,
        duration: 1_000,
        timelineDuration: 10_000,
    }), 9_000)
})

test("timeline move placement chooses the closest valid gap", () => {
    assert.equal(findClosestTimelineGap({
        targetStart: 3_500,
        duration: 1_000,
        timelineDuration: 10_000,
        items: [
            { id: "left", start: 2_000, end: 4_000 },
            { id: "right", start: 5_000, end: 7_000 },
        ],
    }), 4_000)
})

test("timeline move placement merges occupied ranges and fails when no gap fits", () => {
    assert.equal(findClosestTimelineGap({
        targetStart: 2_000,
        duration: 3_000,
        timelineDuration: 6_000,
        items: [
            { id: "a", start: 0, end: 2_500 },
            { id: "b", start: 2_000, end: 4_500 },
            { id: "c", start: 4_000, end: 6_000 },
        ],
    }), null)
})

test("timeline move placement ignores the item being moved", () => {
    assert.equal(findClosestTimelineGap({
        targetStart: 2_000,
        duration: 1_000,
        timelineDuration: 5_000,
        itemId: "self",
        items: [
            { id: "self", start: 2_000, end: 3_000 },
            { id: "other", start: 4_000, end: 5_000 },
        ],
    }), 2_000)
})

test("timeline move placement can extend an open-ended project", () => {
    assert.equal(findClosestTimelineGap({
        targetStart: 6_000,
        duration: 5_000,
        timelineDuration: Infinity,
        itemId: "right",
        items: [
            { id: "left", start: 0, end: 3_500 },
            { id: "right", start: 3_500, end: 8_500 },
        ],
    }), 6_000)
})

test("timeline canvas keeps a finite five-second editing tail", () => {
    assert.equal(getTimelineCanvasEnd(10_900), 15_900)
    assert.equal(getTimelineCanvasEnd(10_900, 2_000), 12_900)
    assert.equal(getTimelineCanvasEnd(-1_000), 5_000)
})
