import assert from "node:assert/strict"
import test from "node:test"

import {
    selectDuration,
    selectSourceDuration,
} from "../app/shared/redux/editorSlice.js"

const createState = ({
    sourceDuration = 10_000,
    clips = [],
    audio = [],
    overlays = [],
    clicks = [],
} = {}) => ({
    editor: { duration: sourceDuration },
    undoableState: {
        present: {
            clipAnims: {
                entities: Object.fromEntries(clips.map(entity => [entity.id, entity])),
            },
            audioTrackAnims: {
                entities: Object.fromEntries(audio.map(entity => [entity.id, entity])),
            },
            overlayAnims: {
                entities: Object.fromEntries(overlays.map(entity => [entity.id, entity])),
            },
            clickAnims: {
                entities: Object.fromEntries(clicks.map(entity => [entity.id, entity])),
            },
        },
    },
})

test("timeline duration grows to preserve a moved split gap", () => {
    const state = createState({
        clips: [
            { id: "left", start: 0, end: 3_450 },
            { id: "right", start: 6_000, end: 10_900 },
        ],
    })

    assert.equal(selectSourceDuration(state), 10_000)
    assert.equal(selectDuration(state), 10_900)
})

test("timeline duration follows the current undoable item bounds", () => {
    const extended = createState({
        clips: [{ id: "clip", start: 2_000, end: 13_000 }],
    })
    const restored = createState({
        clips: [{ id: "clip", start: 0, end: 10_000 }],
    })

    assert.equal(selectDuration(extended), 13_000)
    assert.equal(selectDuration(restored), 10_000)
})

test("audio and overlay items can extend the shared timeline", () => {
    const state = createState({
        clips: [{ id: "clip", start: 0, end: 10_000 }],
        audio: [{ id: "audio", start: 10_000, end: 12_000 }],
        overlays: [{ id: "overlay", start: 5_000, end: 11_000 }],
    })

    assert.equal(selectDuration(state), 12_000)
})

test("source-synchronised capture effects do not create an invisible timeline tail", () => {
    const state = createState({
        clips: [{ id: "clip", start: 0, end: 10_000 }],
        clicks: [{ id: "click", start: 9_500, end: 12_500 }],
    })

    assert.equal(selectDuration(state), 10_000)
})
