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

test("render snapshot derives sequence end without mutating source duration", () => {
    const videoDetails = {
        duration: 8_350,
        start: 0,
        end: 8_350,
    }
    const state = {
        editor: { duration: 8_350 },
        undoableState: {
            present: {
                project: { videoDetails },
                clipAnims: {
                    entities: {
                        left: { id: "left", start: 0, end: 3_450 },
                        right: { id: "right", start: 6_000, end: 10_900 },
                    },
                },
            },
        },
    }

    const renderState = createRenderableProjectState(state)
    assert.deepEqual(
        renderState.undoableState.present.project.videoDetails,
        {
            duration: 8_350,
            start: 0,
            end: 10_900,
        }
    )
    assert.equal(videoDetails.end, 8_350)
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

test("undo and redo states are included in project autosave", async () => {
    const storeSource = await readFile(new URL("../app/shared/redux/store.js", import.meta.url), "utf8")

    assert.match(storeSource, /ActionTypes\.UNDO/)
    assert.match(storeSource, /ActionTypes\.REDO/)
    assert.match(storeSource, /HISTORY_ACTION_TYPES\.has\(action\.type\)/)
    assert.match(storeSource, /matcher: matchesSaveableChange/)
    assert.match(storeSource, /projectSaveCoordinator\.request/)
    assert.match(storeSource, /(?:await\s+)?projectSaveCoordinator\.flush\(\)/)
    assert.match(storeSource, /if \(!project\.id\) \{\s*dispatch\(setSaveStatus\(SAVE_STATUS_IDLE\)\)/)
    assert.match(storeSource, /catch \(error\) \{\s*console\.error\("\[saveProject\]"/)
    assert.match(storeSource, /setSaveStatus\(\{\s*status: SAVE_STATUS_ERROR/)
    assert.match(storeSource, /throw error/)
    assert.match(storeSource, /if \(isLatest\(\)\) dispatch\(setSaveStatus\(SAVE_STATUS_SAVED\)\)/)
})

test("project close persists before releasing Redux state", async () => {
    const storeSource = await readFile(new URL("../app/shared/redux/store.js", import.meta.url), "utf8")
    const flushIndex = storeSource.indexOf("flushSaves: () => projectSaveCoordinator.flush()")
    const nativeCommitIndex = storeSource.indexOf('invoke("commit-project-close")')
    const sceneCleanupIndex = storeSource.indexOf("dispatch(setIsCleaningUpScene(true))")
    const nativeFinalizeIndex = storeSource.indexOf('invoke("finalize-project-close")')
    const resetProjectIndex = storeSource.indexOf("dispatch(resetProject())")

    assert.ok(flushIndex >= 0)
    assert.ok(nativeCommitIndex > flushIndex)
    assert.ok(sceneCleanupIndex > nativeCommitIndex)
    assert.ok(nativeFinalizeIndex > sceneCleanupIndex)
    assert.ok(resetProjectIndex > nativeFinalizeIndex)
    assert.match(storeSource, /await closeProjectSafely\(/)
    assert.match(storeSource, /EDITOR_CLEANUP_TIMEOUT_MS/)
    assert.match(storeSource, /finally \{\s*dispatch\(setIsProjectClosing\(false\)\)/)
})

test("save indicator renders explicit success and failure states", async () => {
    const indicatorSource = await readFile(
        new URL("../app/windows/main/components/titleBar/SaveIndicator.jsx", import.meta.url),
        "utf8"
    )

    assert.match(indicatorSource, /saveStatus === SAVE_STATUS_ERROR/)
    assert.match(indicatorSource, /saveStatus === SAVE_STATUS_SAVED/)
    assert.match(indicatorSource, /role="alert"/)
    assert.doesNotMatch(indicatorSource, /wasSaving && !isSaving/)
})

test("editor worker dependencies keep one Pixi adapter instance in development", async () => {
    const viteConfig = await readFile(new URL("../vite.config.mjs", import.meta.url), "utf8")

    assert.match(viteConfig, /optimizeDeps:/)
    assert.match(viteConfig, /include:/)
    assert.match(viteConfig, /exclude:/)
    for (const feature of ["graphics", "mesh", "text", "webworker"])
        assert.match(viteConfig, new RegExp(`pixi\\.js/${feature}`))
    for (const filter of ["adjustment", "drop-shadow", "hsl-adjustment", "motion-blur", "zoom-blur"])
        assert.match(viteConfig, new RegExp(`pixi-filters/${filter}`))
    assert.match(viteConfig, /pixi\.js > eventemitter3/)
})
