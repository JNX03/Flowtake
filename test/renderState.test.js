import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
    createRenderableProjectState,
    getRenderProjectName
} from "../app/shared/renderState.js"

test("renderable project state omits app state and undo history", () => {
    const present = {
        project: {
            name: "Memory test",
            mouseEvents: [{ x: 10, y: 20, timestamp: 30 }]
        },
        cursorCoords: { inertia: 0.5 }
    }
    const panCoords = { points: [{ x: 1, y: 2 }] }
    const state = {
        animator: {
            rendererDims: { x: 1920, y: 1080 },
            backgroundAlpha: 1
        },
        app: { toasts: ["unused"] },
        editor: { isPlaying: false },
        recorder: { isRecording: false },
        timeline: { zoom: 1 },
        panCoords,
        undoableState: {
            past: [{ project: { mouseEvents: new Array(100).fill({ x: 1 }) } }],
            present,
            future: [{ project: { mouseEvents: new Array(100).fill({ x: 2 }) } }]
        }
    }

    const renderState = createRenderableProjectState(state, { x: 854, y: 480 })

    assert.deepEqual(Object.keys(renderState).sort(), ["animator", "panCoords", "plugin", "undoableState"])
    assert.equal(renderState.undoableState.present, present)
    assert.equal(renderState.panCoords, panCoords)
    assert.deepEqual(renderState.animator.rendererDims, { x: 854, y: 480 })
    assert.equal(renderState.animator.backgroundAlpha, 1)
    assert.deepEqual(renderState.plugin, { enabled: {}, config: {} })
    assert.equal("past" in renderState.undoableState, false)
    assert.equal("future" in renderState.undoableState, false)
    assert.equal("app" in renderState, false)
    assert.equal("editor" in renderState, false)
    assert.equal("recorder" in renderState, false)
    assert.equal("timeline" in renderState, false)
})

test("render project name falls back when state has already been released", () => {
    assert.equal(getRenderProjectName({
        undoableState: { present: { project: { name: "Launch clip" } } }
    }), "Launch clip")
    assert.equal(getRenderProjectName(null), "Recording")
})

test("large recording data is kept out of undo history on load", async () => {
    const storeSource = await readFile(new URL("../app/shared/redux/store.js", import.meta.url), "utf8")
    assert.match(storeSource, /projectSlice\.actions\.setMouseEvents\.type/)

    const loadProjectFiles = [
        "../app/windows/main/App.jsx",
        "../app/windows/main/components/projects/Projects.jsx",
        "../app/windows/main/components/projects/Row.jsx"
    ]

    await Promise.all(loadProjectFiles.map(async file => {
        const source = await readFile(new URL(file, import.meta.url), "utf8")
        assert.match(source, /withPreventUndo/)
        assert.match(source, /actions\.forEach\(action => dispatch\(withPreventUndo\(action\)\)\)/)
    }))
})
