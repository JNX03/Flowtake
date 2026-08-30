import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { build } from "esbuild"

const source = await readFile(
    new URL("../app/shared/editor/editorCommands.js", import.meta.url),
    "utf8",
)

const bundle = await build({
    entryPoints: [
        fileURLToPath(new URL("../app/shared/editor/editorCommands.js", import.meta.url)),
    ],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    write: false,
})
const executor = await import(
    "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].text).toString("base64")
)

test("executor maps every supported planner row to current Redux actions", () => {
    for (const row of ["clips", "subtitles", "audio-tracks", "overlay-tracks", "masks"]) {
        assert.ok(source.includes('"' + row + '": {'))
    }

    for (const action of [
        "addClip", "updateClip", "removeClip",
        "addSubtitle", "updateSubtitle", "removeSubtitle",
        "addAudioClip", "updateAudioClip", "removeAudioClip",
        "addOverlay", "updateOverlay", "removeOverlay",
        "addMask", "updateMask", "removeMask",
    ]) {
        assert.ok(source.includes(action))
    }
})

test("supported-row helper keeps toolbar affordances honest", () => {
    for (const row of ["clips", "subtitles", "audio-tracks", "overlay-tracks", "masks"]) {
        assert.equal(executor.isEditorCommandRow(row), true)
    }
    for (const row of ["zooms", "clicks", "spatials", "keyboard-layouts", null]) {
        assert.equal(executor.isEditorCommandRow(row), false)
    }
})

test("executor resolves a complete plan before grouped dispatch", () => {
    assert.ok(source.includes("const actions = []"))
    assert.ok(source.includes("unsupported-plan-operation"))
    assert.ok(source.includes('const group = groupFactory("editor-" + plan.kind)'))
    assert.ok(source.includes("dispatch(withGroup(action, group))"))
    assert.ok(source.includes("setSelectedRow(plan.row)"))
    assert.ok(source.includes("setSelectedIds(plan.selection)"))
})

test("facade exposes selection edit thunks and in-memory copy paste", () => {
    for (const thunk of [
        "splitEditorSelection",
        "retainLeftEditorSelection",
        "retainRightEditorSelection",
        "deleteEditorSelection",
        "duplicateEditorSelection",
        "copyEditorSelection",
        "pasteEditorClipboard",
    ]) {
        assert.ok(source.includes("export const " + thunk))
    }

    assert.ok(source.includes("let editorClipboard = null"))
    assert.ok(source.includes("editorClipboard = cloneSerializable(result.clipboard)"))
    assert.ok(source.includes("empty-editor-clipboard"))
    assert.ok(source.includes("export function clearEditorClipboard"))
})

test("executeEditorPlan dispatches one grouped Redux transaction", () => {
    const dispatched = []
    const plan = {
        ok: true,
        kind: "split",
        row: "clips",
        operations: [
            { op: "update", row: "clips", id: "clip-a", changes: { end: 2000 } },
            { op: "add", row: "clips", entity: { id: "clip-b", start: 2000, end: 4000 } },
        ],
        selection: ["clip-b"],
    }

    const result = executor.executeEditorPlan(plan, {
        groupFactory: () => "group-1",
    })(action => dispatched.push(action))

    assert.equal(result.ok, true)
    assert.equal(result.group, "group-1")
    assert.deepEqual(dispatched.map(action => action.type), [
        "clipAnims/updateClip",
        "clipAnims/addClip",
        "timeline/setSelectedRow",
        "timeline/setSelectedIds",
    ])
    assert.ok(dispatched.every(action => action.meta?.group === "group-1"))
})

test("copy and paste re-plan against current Redux state", () => {
    executor.clearEditorClipboard()
    const state = {
        editor: { duration: 10000 },
        timeline: {
            selectedRow: "clips",
            selectedIds: ["clip-a"],
            time: 3000,
        },
        undoableState: {
            present: {
                clipAnims: {
                    ids: ["clip-a"],
                    entities: {
                        "clip-a": { id: "clip-a", start: 0, end: 1000, playbackRate: 1 },
                    },
                },
            },
        },
    }

    const copied = executor.copyEditorSelection()(
        () => {},
        () => state,
    )
    assert.equal(copied.ok, true)

    const dispatched = []
    const pasted = executor.pasteEditorClipboard({
        createId: () => "clip-copy",
        groupFactory: () => "group-2",
    })(
        action => dispatched.push(action),
        () => state,
    )

    assert.equal(pasted.ok, true)
    assert.equal(dispatched[0].type, "clipAnims/addClip")
    assert.deepEqual(dispatched[0].payload, {
        id: "clip-copy",
        start: 3000,
        end: 4000,
        playbackRate: 1,
    })
    assert.equal(dispatched.at(-1).type, "timeline/setSelectedIds")
    assert.deepEqual(dispatched.at(-1).payload, ["clip-copy"])
    executor.clearEditorClipboard()
})

test("selection commands read ripple mode and dispatch every lane shift in one group", () => {
    const state = {
        editor: { duration: 5000 },
        timeline: {
            selectedRow: "clips",
            selectedIds: ["clip-a"],
            time: 1000,
            editingMode: "ripple",
        },
        undoableState: {
            present: {
                clipAnims: {
                    ids: ["clip-a", "clip-b"],
                    entities: {
                        "clip-a": { id: "clip-a", start: 0, end: 1000 },
                        "clip-b": { id: "clip-b", start: 1500, end: 2500 },
                    },
                },
            },
        },
    }
    const dispatched = []

    const result = executor.deleteEditorSelection({
        groupFactory: () => "ripple-delete-group",
    })(
        action => dispatched.push(action),
        () => state,
    )

    assert.equal(result.ok, true)
    assert.equal(result.ripple, true)
    assert.deepEqual(dispatched.map(action => action.type), [
        "clipAnims/removeClip",
        "clipAnims/updateClip",
        "timeline/setSelectedIds",
    ])
    assert.deepEqual(dispatched[1].payload, {
        id: "clip-b",
        changes: { start: 500, end: 1500 },
    })
    assert.ok(dispatched.every(action => action.meta?.group === "ripple-delete-group"))
})

test("an explicit normal-mode override preserves legacy command execution", () => {
    const state = {
        editor: { duration: 5000 },
        timeline: {
            selectedRow: "clips",
            selectedIds: ["clip-a"],
            editingMode: "ripple",
        },
        undoableState: {
            present: {
                clipAnims: {
                    ids: ["clip-a", "clip-b"],
                    entities: {
                        "clip-a": { id: "clip-a", start: 0, end: 1000 },
                        "clip-b": { id: "clip-b", start: 1000, end: 2000 },
                    },
                },
            },
        },
    }
    const dispatched = []

    const result = executor.deleteEditorSelection({
        editingMode: "normal",
        groupFactory: () => "normal-delete-group",
    })(
        action => dispatched.push(action),
        () => state,
    )

    assert.equal(result.ok, true)
    assert.equal(result.ripple, undefined)
    assert.deepEqual(dispatched.map(action => action.type), [
        "clipAnims/removeClip",
        "timeline/setSelectedIds",
    ])
})

test("ripple duplicate shifts the successor before adding and selects the copy", () => {
    const state = {
        editor: { duration: 5000 },
        timeline: {
            selectedRow: "subtitles",
            selectedIds: ["caption-a"],
            editingMode: "ripple",
        },
        undoableState: {
            present: {
                subtitleAnims: {
                    ids: ["caption-a", "caption-b"],
                    entities: {
                        "caption-a": { id: "caption-a", start: 0, end: 1000, text: "A" },
                        "caption-b": { id: "caption-b", start: 1000, end: 2000, text: "B" },
                    },
                },
            },
        },
    }
    const dispatched = []

    const result = executor.duplicateEditorSelection({
        createId: () => "caption-copy",
        groupFactory: () => "ripple-duplicate-group",
    })(
        action => dispatched.push(action),
        () => state,
    )

    assert.equal(result.ok, true)
    assert.equal(result.ripple, true)
    assert.deepEqual(dispatched.map(action => action.type), [
        "subtitleAnims/updateSubtitle",
        "subtitleAnims/addSubtitle",
        "timeline/setSelectedRow",
        "timeline/setSelectedIds",
    ])
    assert.deepEqual(dispatched[0].payload, {
        id: "caption-b",
        changes: { start: 2000, end: 3000 },
    })
    assert.equal(dispatched[1].payload.id, "caption-copy")
    assert.deepEqual(dispatched.at(-1).payload, ["caption-copy"])
    assert.ok(dispatched.every(action => action.meta?.group === "ripple-duplicate-group"))
})

test("ripple clipboard paste is re-planned atomically against the latest playhead", () => {
    executor.clearEditorClipboard()
    const state = {
        editor: { duration: 5000 },
        timeline: {
            selectedRow: "clips",
            selectedIds: ["clip-a"],
            time: 1000,
            editingMode: "ripple",
        },
        undoableState: {
            present: {
                clipAnims: {
                    ids: ["clip-a", "clip-b"],
                    entities: {
                        "clip-a": { id: "clip-a", start: 0, end: 1000 },
                        "clip-b": { id: "clip-b", start: 1000, end: 2000 },
                    },
                },
            },
        },
    }
    assert.equal(executor.copyEditorSelection()(() => {}, () => state).ok, true)

    const dispatched = []
    const pasted = executor.pasteEditorClipboard({
        createId: () => "clip-copy",
        groupFactory: () => "ripple-paste-group",
    })(
        action => dispatched.push(action),
        () => state,
    )
    assert.equal(pasted.ok, true)
    assert.deepEqual(dispatched.map(action => action.type), [
        "clipAnims/updateClip",
        "clipAnims/addClip",
        "timeline/setSelectedRow",
        "timeline/setSelectedIds",
    ])
    assert.deepEqual(dispatched[0].payload, {
        id: "clip-b",
        changes: { start: 2000, end: 3000 },
    })

    const rejectedActions = []
    const rejected = executor.pasteEditorClipboard({
        at: 500,
        createId: () => "unsafe-copy",
        groupFactory: () => "must-not-dispatch",
    })(
        action => rejectedActions.push(action),
        () => state,
    )
    assert.equal(rejected.ok, false)
    assert.equal(rejected.reason, "ripple-insertion-intersects-entity")
    assert.deepEqual(rejectedActions, [])
    executor.clearEditorClipboard()
})
