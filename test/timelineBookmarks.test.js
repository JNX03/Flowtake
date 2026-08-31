import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
    DEFAULT_BOOKMARK_COLOR,
    normalizeBookmark,
    normalizeBookmarks,
    normalizeEditorDomain,
} from "../app/shared/editor/projectSchema.js"
import {
    formatBookmarkTime,
    getBookmarkSnapPoints,
    resolveBookmarkDragTime,
} from "../app/shared/editor/timelineBookmarks.js"
import editorDomainReducer, {
    addBookmark,
    applyProperties,
    removeBookmark,
    updateBookmark,
} from "../app/shared/redux/sceneSlice.js"

test("bookmark normalization clamps scene time, duration, note, and color", () => {
    const bookmark = normalizeBookmark({
        id: " marker-a ",
        time: 9_500.4,
        duration: 2_000,
        note: "  Review this cut  ",
        color: "not-a-color",
    }, 10_000)

    assert.deepEqual(bookmark, {
        id: "marker-a",
        time: 9_500,
        duration: 500,
        note: "Review this cut",
        color: DEFAULT_BOOKMARK_COLOR,
    })
    assert.equal(normalizeBookmark({ id: "", time: 10 }, 100), null)
    assert.equal(normalizeBookmark({ id: "bad", time: Number.NaN }, 100), null)
})

test("bookmark collections discard invalid and duplicate IDs", () => {
    assert.deepEqual(normalizeBookmarks([
        { id: "a", time: 100, color: "#FF0000" },
        { id: "a", time: 200 },
        { time: 300 },
    ], 1_000), [{
        id: "a",
        time: 100,
        note: "",
        color: "#ff0000",
    }])
})

test("active-scene bookmark CRUD remains normalized", () => {
    let state = editorDomainReducer(undefined, { type: "init" })
    state = editorDomainReducer(state, applyProperties(normalizeEditorDomain(null, {
        projectId: "bookmark-project",
        duration: 10_000,
    })))
    state = editorDomainReducer(state, addBookmark({
        id: "marker-a",
        time: 1_000,
        note: "First",
        color: "#123456",
    }))
    state = editorDomainReducer(state, addBookmark({
        id: "marker-a",
        time: 2_000,
    }))
    state = editorDomainReducer(state, updateBookmark({
        id: "marker-a",
        changes: {
            time: 9_000,
            duration: 5_000,
            note: "Updated",
        },
    }))

    const scene = state.scenes[state.activeSceneId]
    assert.equal(scene.bookmarks.length, 1)
    assert.deepEqual(scene.bookmarks[0], {
        id: "marker-a",
        time: 9_000,
        duration: 1_000,
        note: "Updated",
        color: "#123456",
    })

    state = editorDomainReducer(state, removeBookmark("marker-a"))
    assert.deepEqual(state.scenes[state.activeSceneId].bookmarks, [])
})

test("native scene markers use and persist the measured project duration", () => {
    const migrated = normalizeEditorDomain({
        activeSceneId: "scene-native",
        sceneOrder: ["scene-native"],
        scenes: {
            "scene-native": {
                id: "scene-native",
                name: "Recording",
                duration: 0,
                nativeRecording: true,
                bookmarks: [{
                    id: "late-marker",
                    time: 8_000,
                }],
            },
        },
    }, {
        duration: 10_000,
    })

    assert.equal(migrated.scenes["scene-native"].duration, 10_000)
    assert.equal(migrated.scenes["scene-native"].bookmarks[0].time, 8_000)

    let state = editorDomainReducer(undefined, { type: "init" })
    state = editorDomainReducer(state, addBookmark({
        bookmark: {
            id: "measured-marker",
            time: 9_000,
        },
        projectDuration: 12_000,
    }))
    const scene = state.scenes[state.activeSceneId]
    assert.equal(scene.duration, 12_000)
    assert.equal(scene.bookmarks[0].time, 9_000)
})

test("bookmark updates clamp against the authoritative project duration", () => {
    let state = editorDomainReducer(undefined, { type: "init" })
    state = editorDomainReducer(state, addBookmark({
        bookmark: {
            id: "duration-refresh-marker",
            time: 1_500,
        },
        projectDuration: 2_000,
    }))

    state = editorDomainReducer(state, updateBookmark({
        id: "duration-refresh-marker",
        changes: {
            time: 9_000,
            duration: 5_000,
        },
        projectDuration: 12_000,
    }))

    const scene = state.scenes[state.activeSceneId]
    assert.equal(scene.duration, 12_000)
    assert.deepEqual(scene.bookmarks[0], {
        id: "duration-refresh-marker",
        time: 9_000,
        duration: 3_000,
        note: "",
        color: DEFAULT_BOOKMARK_COLOR,
    })
})

test("bookmark ranges contribute deterministic timeline snap points", () => {
    assert.deepEqual(getBookmarkSnapPoints([
        { id: "b", time: 4_000, duration: 1_000 },
        { id: "a", time: 1_000 },
        { id: "duplicate", time: 4_000 },
        { id: "invalid", time: Number.NaN },
    ]), [1_000, 4_000, 5_000])
})

test("bookmark dragging snaps, clamps ranges, and formats time", () => {
    assert.deepEqual(resolveBookmarkDragTime({
        initialTime: 1_000,
        deltaMs: 950,
        projectDuration: 10_000,
        snappingLines: [2_000],
        pxPerMs: 0.1,
        isSnappingEnabled: true,
    }), {
        time: 2_000,
        snapLine: 2_000,
    })
    assert.deepEqual(resolveBookmarkDragTime({
        initialTime: 1_000,
        duration: 2_000,
        deltaMs: 20_000,
        projectDuration: 10_000,
    }), {
        time: 8_000,
        snapLine: null,
    })
    assert.equal(formatBookmarkTime(61_234), "01:01.234")
    assert.equal(formatBookmarkTime(3_661_234), "1:01:01.234")
})

test("timeline exposes an accessible, persistent marker row and snap source", async () => {
    const [timeline, markers, dragInteraction, schema, store] = await Promise.all([
        readFile(new URL("../app/windows/main/components/timeline/Timeline.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/windows/main/components/timeline/TimelineMarkers.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/windows/main/components/timeline/useDragInteraction.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/editor/projectSchema.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/redux/store.js", import.meta.url), "utf8"),
    ])

    assert.match(timeline, /<TimelineMarkersHeader \/>/)
    assert.match(timeline, /<TimelineMarkers \/>/)
    assert.match(timeline, /getBookmarkSnapPoints\(bookmarks\)/)
    assert.match(timeline, /const staticLines = useMemo/)
    assert.doesNotMatch(timeline, /const time = useSelector\(selectTime\)/)
    assert.match(markers, /aria-label="Add marker at playhead"/)
    assert.match(markers, /aria-label="Timeline markers"/)
    assert.match(markers, /getGroup\("bookmark-retime"\)/)
    assert.match(markers, /\.\.\.snappingLines, playheadTime/)
    assert.match(markers, /projectDuration: duration/)
    assert.match(markers, /selectedBookmark && !isPlaying/)
    assert.match(markers, /if \(isPlaying\) return/)
    assert.match(dragInteraction, /selectTime\(store\.getState\(\)\)/)
    assert.match(schema, /bookmarks: normalizeBookmarks/)
    assert.match(store, /editorDomain: \{ \.\.\.editorDomain \}/)
})
