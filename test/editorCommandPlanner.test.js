import assert from "node:assert/strict"
import test from "node:test"
import {
    createClipboardPayload,
    findRangeCollision,
    planDelete,
    planDuplicate,
    planPaste,
    planRetainLeft,
    planRetainRight,
    planSplit,
    rangesOverlap,
    TIMELINE_BOUNDARY_EPSILON_MS,
    toEntityArray,
} from "../app/shared/editor/commandPlanner.js"
import { resolveClipTimingChange } from "../app/shared/editor/playbackClock.js"

const makeIdFactory = prefix => ({ index }) => prefix + "-" + index

test("normalizes adapter state and treats touching ranges as non-overlapping", () => {
    const entity = { id: "a", start: 0, end: 1000 }
    assert.deepEqual(toEntityArray({ ids: ["a"], entities: { a: entity } }), [entity])
    assert.equal(rangesOverlap(entity, { start: 1000, end: 2000 }), false)
    assert.equal(rangesOverlap(entity, { start: 999, end: 2000 }), true)
})

test("plans an atomic split while preserving current entity fields", () => {
    const entities = [{
        id: "clip-a",
        start: 0,
        end: 5000,
        sourceStart: 500,
        sourceEnd: 5500,
        playbackRate: 1.5,
        layout: { mode: "camera-overlay", config: { scale: 0.5 } },
    }]

    const result = planSplit({
        row: "clips",
        entities,
        selectedIds: ["clip-a"],
        splitTime: 2500,
        createId: makeIdFactory("clip-right"),
    })

    assert.equal(result.ok, true)
    assert.deepEqual(result.selection, ["clip-right-0"])
    assert.deepEqual(result.operations[0], {
        op: "update",
        row: "clips",
        id: "clip-a",
        changes: { end: 2500, sourceEnd: 3000 },
    })
    assert.equal(result.operations[1].entity.start, 2500)
    assert.equal(result.operations[1].entity.end, 5000)
    assert.equal(result.operations[1].entity.sourceStart, 3000)
    assert.equal(result.operations[1].entity.sourceEnd, 5500)
    assert.equal(result.operations[1].entity.playbackRate, 1.5)
    assert.notEqual(result.operations[1].entity.layout, entities[0].layout)
})

test("moving the right split half opens a timeline gap without changing its source in-point", () => {
    const result = planSplit({
        row: "clips",
        entities: [{
            id: "clip",
            start: 0,
            end: 8_350,
            sourceStart: 0,
            sourceEnd: 8_350,
        }],
        selectedIds: ["clip"],
        splitTime: 3_450,
        createId: () => "right",
    })
    const right = result.operations[1].entity
    const moved = resolveClipTimingChange(right, 6_000, 10_900)

    assert.deepEqual(moved, {
        start: 6_000,
        end: 10_900,
        sourceStart: 3_450,
        sourceEnd: 8_350,
    })
    assert.equal(result.operations[0].changes.end, 3_450)
    assert.equal(moved.start - result.operations[0].changes.end, 2_550)
})

test("allows frame-boundary duration rounding but rejects a real timeline overflow", () => {
    const clip = {
        id: "clip",
        start: 0,
        end: 17_870,
        sourceStart: 0,
        sourceEnd: 17_870,
    }

    const roundedBoundary = planSplit({
        row: "clips",
        entities: [clip],
        selectedIds: ["clip"],
        splitTime: 3_450,
        createId: () => "right",
        timelineEnd: 17_867,
    })
    assert.equal(roundedBoundary.ok, true)

    const overflow = planSplit({
        row: "clips",
        entities: [{
            ...clip,
            end: 17_867 + TIMELINE_BOUNDARY_EPSILON_MS + 1,
            sourceEnd: 17_867 + TIMELINE_BOUNDARY_EPSILON_MS + 1,
        }],
        selectedIds: ["clip"],
        splitTime: 3_450,
        createId: () => "right",
        timelineEnd: 17_867,
    })
    assert.equal(overflow.ok, false)
    assert.equal(overflow.reason, "outside-timeline")
})

test("rejects the whole split at invalid boundaries or with unsplittable keyframes", () => {
    const entities = [
        { id: "a", start: 0, end: 5000 },
        { id: "b", start: 0, end: 5000, keyframes: [{ time: 1000, opacity: 0.5 }] },
    ]

    const boundary = planSplit({
        row: "clips",
        entities,
        selectedIds: ["a"],
        splitTime: 500,
        createId: makeIdFactory("split"),
    })
    assert.equal(boundary.ok, false)
    assert.equal(boundary.reason, "split-too-close-to-edge")
    assert.equal(boundary.operations, undefined)

    const keyframed = planSplit({
        row: "overlay-tracks",
        entities,
        selectedIds: ["b"],
        splitTime: 2500,
        createId: makeIdFactory("split"),
    })
    assert.equal(keyframed.ok, false)
    assert.equal(keyframed.reason, "missing-track")

    const keyedWithTrack = planSplit({
        row: "overlay-tracks",
        entities: [{ ...entities[1], trackIndex: 0 }],
        tracks: [{ id: 0, locked: false }],
        selectedIds: ["b"],
        splitTime: 2500,
        createId: makeIdFactory("split"),
    })
    assert.equal(keyedWithTrack.ok, false)
    assert.equal(keyedWithTrack.reason, "keyframed-split-requires-interpolation")
})

test("plans retain-left and retain-right as minimal updates", () => {
    const entities = [{ id: "caption", start: 0, end: 6000, text: "Hello" }]
    const base = { row: "subtitles", entities, selectedIds: ["caption"], splitTime: 3000 }

    assert.deepEqual(planRetainLeft(base).operations, [{
        op: "update",
        row: "subtitles",
        id: "caption",
        changes: { end: 3000 },
    }])
    assert.deepEqual(planRetainRight(base).operations, [{
        op: "update",
        row: "subtitles",
        id: "caption",
        changes: { start: 3000 },
    }])
})

test("duplicates a multi-selection as one time block and preserves lanes", () => {
    const entities = [
        { id: "a", start: 0, end: 1000, trackIndex: 0, src: "asset:a" },
        { id: "b", start: 2000, end: 3000, trackIndex: 1, src: "asset:b" },
    ]

    const result = planDuplicate({
        row: "audio-tracks",
        entities,
        selectedIds: ["a", "b"],
        tracks: [{ id: 0 }, { id: 1 }],
        timelineEnd: 7000,
        createId: makeIdFactory("copy"),
    })

    assert.equal(result.ok, true)
    assert.deepEqual(result.operations.map(operation => ({
        id: operation.entity.id,
        start: operation.entity.start,
        end: operation.entity.end,
        trackIndex: operation.entity.trackIndex,
    })), [
        { id: "copy-0", start: 3000, end: 4000, trackIndex: 0 },
        { id: "copy-1", start: 5000, end: 6000, trackIndex: 1 },
    ])
})

test("placement rejects collisions only within the same current lane", () => {
    const existing = [
        { id: "track-zero", start: 1000, end: 2000, trackIndex: 0 },
        { id: "track-one", start: 1000, end: 2000, trackIndex: 1 },
    ]

    assert.equal(findRangeCollision({
        row: "overlay-tracks",
        candidate: { id: "candidate", start: 1200, end: 1400, trackIndex: 1 },
        entities: [existing[0]],
    }), null)

    const copied = createClipboardPayload({
        row: "overlay-tracks",
        entities: [existing[0]],
        selectedIds: ["track-zero"],
        tracks: [{ id: 0 }],
    })
    const collision = planPaste({
        clipboard: copied.clipboard,
        entities: existing,
        at: 1000,
        tracks: [{ id: 0 }, { id: 1 }],
        createId: makeIdFactory("pasted"),
    })

    assert.equal(collision.ok, false)
    assert.equal(collision.reason, "overlap")
    assert.equal(collision.collisionId, "track-zero")
})

test("copy/paste keeps relative timing, deep clones data, and enforces timeline bounds", () => {
    const entities = [
        { id: "one", start: 1000, end: 2000, text: "One", style: { color: "red" } },
        { id: "two", start: 2500, end: 3000, text: "Two", style: { color: "blue" } },
    ]
    const copied = createClipboardPayload({
        row: "subtitles",
        entities,
        selectedIds: ["one", "two"],
    })
    assert.equal(copied.ok, true)
    assert.notEqual(copied.clipboard.elements[0].entity.style, entities[0].style)

    const pasted = planPaste({
        clipboard: copied.clipboard,
        entities,
        at: 4000,
        timelineEnd: 7000,
        createId: makeIdFactory("caption"),
    })
    assert.equal(pasted.ok, true)
    assert.deepEqual(pasted.operations.map(operation => [operation.entity.start, operation.entity.end]), [
        [4000, 5000],
        [5500, 6000],
    ])

    const outside = planPaste({
        clipboard: copied.clipboard,
        entities,
        at: 6000,
        timelineEnd: 7000,
        createId: makeIdFactory("late"),
    })
    assert.equal(outside.ok, false)
    assert.equal(outside.reason, "outside-timeline")
})

test("locked tracks reject destructive plans and delete is declarative", () => {
    const entities = [{ id: "audio", start: 0, end: 3000, trackIndex: 4 }]
    const locked = planDelete({
        row: "audio-tracks",
        entities,
        selectedIds: ["audio"],
        tracks: [{ id: 4, locked: true }],
    })
    assert.equal(locked.ok, false)
    assert.equal(locked.reason, "locked-track")

    const allowed = planDelete({
        row: "audio-tracks",
        entities,
        selectedIds: ["audio"],
        tracks: [{ id: 4, locked: false }],
    })
    assert.deepEqual(allowed, {
        ok: true,
        kind: "delete",
        row: "audio-tracks",
        operations: [{ op: "remove", row: "audio-tracks", id: "audio" }],
        selection: [],
    })
})

test("normal editing preserves non-ripple delete and split behavior", () => {
    const entities = [
        { id: "first", start: 0, end: 2000 },
        { id: "second", start: 2500, end: 4500 },
    ]

    const deleted = planDelete({
        row: "clips",
        entities,
        selectedIds: ["first"],
        editingMode: "normal",
    })
    assert.deepEqual(deleted, {
        ok: true,
        kind: "delete",
        row: "clips",
        operations: [{ op: "remove", row: "clips", id: "first" }],
        selection: [],
    })

    const split = planSplit({
        row: "clips",
        entities,
        selectedIds: ["first"],
        splitTime: 1000,
        createId: () => "right",
        editingMode: "ripple",
    })
    assert.equal(split.ripple, undefined)
    assert.deepEqual(split.operations, [
        {
            op: "update",
            row: "clips",
            id: "first",
            changes: { end: 1000, sourceEnd: 1000 },
        },
        {
            op: "add",
            row: "clips",
            entity: {
                id: "right",
                start: 1000,
                end: 2000,
                sourceStart: 1000,
                sourceEnd: 2000,
            },
        },
    ])
})

test("ripple delete closes selected durations cumulatively while preserving gaps", () => {
    const entities = [
        { id: "a", start: 0, end: 1000 },
        { id: "b", start: 1500, end: 2500 },
        { id: "c", start: 3000, end: 4000 },
        { id: "d", start: 5000, end: 6000 },
    ]

    const result = planDelete({
        row: "clips",
        entities,
        selectedIds: ["a", "c"],
        timelineEnd: 6000,
        editingMode: "ripple",
    })

    assert.equal(result.ok, true)
    assert.equal(result.ripple, true)
    assert.deepEqual(result.selection, [])
    assert.deepEqual(result.operations, [
        { op: "remove", row: "clips", id: "a" },
        { op: "remove", row: "clips", id: "c" },
        { op: "update", row: "clips", id: "b", changes: { start: 500, end: 1500 } },
        { op: "update", row: "clips", id: "d", changes: { start: 3000, end: 4000 } },
    ])
})

test("ripple delete shifts only compatible lanes with independent durations", () => {
    const entities = [
        { id: "zero-cut", start: 0, end: 1000, trackIndex: 0 },
        { id: "zero-next", start: 1500, end: 2500, trackIndex: 0 },
        { id: "one-cut", start: 0, end: 2000, trackIndex: 1 },
        { id: "one-next", start: 3000, end: 4000, trackIndex: 1 },
        { id: "two-untouched", start: 1000, end: 2000, trackIndex: 2 },
    ]
    const tracks = [0, 1, 2].map(id => ({ id, locked: false }))

    const result = planDelete({
        row: "audio-tracks",
        entities,
        selectedIds: ["zero-cut", "one-cut"],
        tracks,
        timelineEnd: 5000,
        editingMode: "ripple",
    })

    assert.equal(result.ok, true)
    assert.deepEqual(result.operations, [
        { op: "remove", row: "audio-tracks", id: "zero-cut" },
        { op: "remove", row: "audio-tracks", id: "one-cut" },
        {
            op: "update",
            row: "audio-tracks",
            id: "zero-next",
            changes: { start: 500, end: 1500 },
        },
        {
            op: "update",
            row: "audio-tracks",
            id: "one-next",
            changes: { start: 1000, end: 2000 },
        },
    ])
    assert.equal(result.operations.some(operation => operation.id === "two-untouched"), false)
})

test("ripple masks use their mask row as a lane", () => {
    const result = planDelete({
        row: "masks",
        entities: [
            { id: "row-zero-cut", start: 0, end: 1000, row: 0 },
            { id: "row-zero-next", start: 1000, end: 2000, row: 0 },
            { id: "row-one", start: 1000, end: 2000, row: 1 },
        ],
        selectedIds: ["row-zero-cut"],
        editingMode: "ripple",
    })

    assert.equal(result.ok, true)
    assert.deepEqual(result.operations, [
        { op: "remove", row: "masks", id: "row-zero-cut" },
        {
            op: "update",
            row: "masks",
            id: "row-zero-next",
            changes: { start: 0, end: 1000 },
        },
    ])
    assert.equal(result.operations.some(operation => operation.id === "row-one"), false)
})

test("ripple tracked edits reject locked and missing affected tracks", () => {
    const entity = { id: "audio", start: 0, end: 1000, trackIndex: 4 }

    for (const [tracks, reason] of [
        [[{ id: 4, locked: true }], "locked-track"],
        [[{ id: 0, locked: false }], "missing-track"],
    ]) {
        const result = planDelete({
            row: "audio-tracks",
            entities: [entity],
            selectedIds: ["audio"],
            tracks,
            editingMode: "ripple",
        })
        assert.equal(result.ok, false)
        assert.equal(result.reason, reason)
        assert.equal(result.operations, undefined)
    }
})

test("ripple retain-left and retain-right close the removed range", () => {
    const entities = [
        { id: "selected", start: 1000, end: 5000 },
        { id: "next", start: 6000, end: 7000 },
    ]

    const retainedLeft = planRetainLeft({
        row: "clips",
        entities,
        selectedIds: ["selected"],
        splitTime: 3500,
        timelineEnd: 8000,
        editingMode: "ripple",
    })
    assert.equal(retainedLeft.ok, true)
    assert.deepEqual(retainedLeft.operations, [
        {
            op: "update",
            row: "clips",
            id: "selected",
            changes: { end: 3500, sourceEnd: 3500 },
        },
        { op: "update", row: "clips", id: "next", changes: { start: 4500, end: 5500 } },
    ])

    const retainedRight = planRetainRight({
        row: "clips",
        entities,
        selectedIds: ["selected"],
        splitTime: 2500,
        timelineEnd: 8000,
        editingMode: "ripple",
    })
    assert.equal(retainedRight.ok, true)
    assert.deepEqual(retainedRight.selection, ["selected"])
    assert.deepEqual(retainedRight.operations, [
        {
            op: "update",
            row: "clips",
            id: "selected",
            changes: { end: 3500, sourceStart: 2500 },
        },
        { op: "update", row: "clips", id: "next", changes: { start: 4500, end: 5500 } },
    ])
})

test("ripple destructive edits reject overlapping source lanes atomically", () => {
    const entities = [
        { id: "a", start: 0, end: 3000 },
        { id: "b", start: 2000, end: 4000 },
    ]

    for (const result of [
        planDelete({
            row: "clips",
            entities,
            selectedIds: ["a"],
            editingMode: "ripple",
        }),
        planRetainLeft({
            row: "clips",
            entities,
            selectedIds: ["a"],
            splitTime: 1500,
            editingMode: "ripple",
        }),
    ]) {
        assert.equal(result.ok, false)
        assert.equal(result.reason, "ripple-existing-overlap")
        assert.equal(result.operations, undefined)
    }
})

test("ripple paste opens a lane block and shifts touching successors", () => {
    const copied = createClipboardPayload({
        row: "subtitles",
        entities: [{ id: "source", start: 0, end: 1000, text: "New" }],
        selectedIds: ["source"],
    })
    const existing = [
        { id: "before", start: 0, end: 1000, text: "Before" },
        { id: "after", start: 1500, end: 2500, text: "After" },
    ]

    const result = planPaste({
        clipboard: copied.clipboard,
        entities: existing,
        at: 1500,
        createId: () => "inserted",
        timelineEnd: 5000,
        editingMode: "ripple",
    })

    assert.equal(result.ok, true)
    assert.equal(result.ripple, true)
    assert.deepEqual(result.operations, [
        {
            op: "update",
            row: "subtitles",
            id: "after",
            changes: { start: 2500, end: 3500 },
        },
        {
            op: "add",
            row: "subtitles",
            entity: { id: "inserted", start: 1500, end: 2500, text: "New" },
        },
    ])
    assert.deepEqual(result.selection, ["inserted"])
})

test("ripple paste uses independent clipboard spans per track", () => {
    const clipboard = {
        version: 1,
        row: "overlay-tracks",
        elements: [
            {
                sourceId: "source-zero",
                offset: 0,
                entity: { id: "source-zero", start: 0, end: 1000, trackIndex: 0 },
            },
            {
                sourceId: "source-one",
                offset: 2000,
                entity: { id: "source-one", start: 0, end: 500, trackIndex: 1 },
            },
        ],
    }
    const entities = [
        { id: "next-zero", start: 1000, end: 2000, trackIndex: 0 },
        { id: "next-one", start: 1000, end: 2000, trackIndex: 1 },
        { id: "other", start: 1000, end: 2000, trackIndex: 2 },
    ]

    const result = planPaste({
        clipboard,
        entities,
        at: 1000,
        tracks: [{ id: 0 }, { id: 1 }, { id: 2 }],
        timelineEnd: 6000,
        createId: makeIdFactory("new"),
        editingMode: "ripple",
    })

    assert.equal(result.ok, true)
    assert.deepEqual(result.operations.slice(0, 2), [
        {
            op: "update",
            row: "overlay-tracks",
            id: "next-zero",
            changes: { start: 2000, end: 3000 },
        },
        {
            op: "update",
            row: "overlay-tracks",
            id: "next-one",
            changes: { start: 3500, end: 4500 },
        },
    ])
    assert.equal(result.operations.some(operation => operation.id === "other"), false)
    assert.deepEqual(result.operations.slice(2).map(operation => ({
        id: operation.entity.id,
        start: operation.entity.start,
        end: operation.entity.end,
        trackIndex: operation.entity.trackIndex,
    })), [
        { id: "new-0", start: 1000, end: 2000, trackIndex: 0 },
        { id: "new-1", start: 3000, end: 3500, trackIndex: 1 },
    ])
})

test("ripple paste rejects intersections, overflow, unsafe clipboard data, and missing tracks", () => {
    const baseClipboard = {
        version: 1,
        row: "clips",
        elements: [{
            sourceId: "source",
            offset: 0,
            entity: { id: "source", start: 0, end: 1000 },
        }],
    }

    const intersecting = planPaste({
        clipboard: baseClipboard,
        entities: [{ id: "existing", start: 0, end: 2000 }],
        at: 1000,
        createId: () => "new",
        timelineEnd: 4000,
        editingMode: "ripple",
    })
    assert.equal(intersecting.ok, false)
    assert.equal(intersecting.reason, "ripple-insertion-intersects-entity")

    const overflow = planPaste({
        clipboard: baseClipboard,
        entities: [{ id: "existing", start: 4000, end: 5000 }],
        at: 4000,
        createId: () => "new",
        timelineEnd: 5500,
        editingMode: "ripple",
    })
    assert.equal(overflow.ok, false)
    assert.equal(overflow.reason, "outside-timeline")
    assert.equal(overflow.entityId, "existing")
    assert.equal(overflow.operations, undefined)

    const negativeOffset = planPaste({
        clipboard: {
            ...baseClipboard,
            elements: [{ ...baseClipboard.elements[0], offset: -1 }],
        },
        entities: [],
        at: 1000,
        createId: () => "new",
        timelineEnd: 4000,
        editingMode: "ripple",
    })
    assert.equal(negativeOffset.ok, false)
    assert.equal(negativeOffset.reason, "ripple-negative-offset")

    const overlappingClipboard = planPaste({
        clipboard: {
            ...baseClipboard,
            elements: [
                baseClipboard.elements[0],
                { ...baseClipboard.elements[0], sourceId: "source-two" },
            ],
        },
        entities: [],
        at: 1000,
        createId: makeIdFactory("new"),
        timelineEnd: 4000,
        editingMode: "ripple",
    })
    assert.equal(overlappingClipboard.ok, false)
    assert.equal(overlappingClipboard.reason, "overlap")

    const missingTrack = planPaste({
        clipboard: {
            version: 1,
            row: "audio-tracks",
            elements: [{
                sourceId: "audio",
                offset: 0,
                entity: { id: "audio", start: 0, end: 1000, trackIndex: 9 },
            }],
        },
        entities: [],
        tracks: [{ id: 0 }],
        at: 1000,
        createId: () => "new-audio",
        timelineEnd: 4000,
        editingMode: "ripple",
    })
    assert.equal(missingTrack.ok, false)
    assert.equal(missingTrack.reason, "missing-track")
})

test("ripple duplicate inserts after the selection and moves successors", () => {
    const entities = [
        { id: "selected", start: 0, end: 1000, text: "One" },
        { id: "successor", start: 1000, end: 2000, text: "Two" },
    ]

    const result = planDuplicate({
        row: "subtitles",
        entities,
        selectedIds: ["selected"],
        createId: () => "duplicate",
        timelineEnd: 4000,
        editingMode: "ripple",
    })

    assert.equal(result.ok, true)
    assert.equal(result.kind, "duplicate")
    assert.equal(result.ripple, true)
    assert.deepEqual(result.operations, [
        {
            op: "update",
            row: "subtitles",
            id: "successor",
            changes: { start: 2000, end: 3000 },
        },
        {
            op: "add",
            row: "subtitles",
            entity: { id: "duplicate", start: 1000, end: 2000, text: "One" },
        },
    ])
})
