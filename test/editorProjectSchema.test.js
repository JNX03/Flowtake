import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
    EDITOR_SCHEMA_VERSION,
    migrateProjectDocument,
    normalizeEditorDomain,
} from "../app/shared/editor/projectSchema.js"
import editorDomainReducer, {
    addScene,
    applyProperties,
    removeMedia,
    removeScene,
    renameScene,
    reorderScenes,
    setActiveScene,
    setCanvasSize,
    setProjectFps,
    updateTimelineView,
    upsertMedia,
} from "../app/shared/redux/sceneSlice.js"

test("legacy projects migrate to one stable native recording scene", () => {
    const legacy = {
        project: { id: "project-42", name: "Legacy recording" },
        clipAnims: { ids: [], entities: [] },
        customFutureField: { preserved: true },
    }

    const migrated = migrateProjectDocument(legacy, {
        projectId: "project-42",
        duration: 12_500,
    })

    assert.equal(legacy.editorDomain, undefined)
    assert.equal(migrated.editorDomain.schemaVersion, EDITOR_SCHEMA_VERSION)
    assert.deepEqual(migrated.editorDomain.sceneOrder, ["scene-project-42"])
    assert.equal(migrated.editorDomain.activeSceneId, "scene-project-42")
    assert.equal(migrated.editorDomain.scenes["scene-project-42"].duration, 12_500)
    assert.equal(migrated.editorDomain.scenes["scene-project-42"].nativeRecording, true)
    assert.equal(migrated.editorDomain.settings.fps, 30)
    assert.deepEqual(migrated.customFutureField, { preserved: true })
})

test("migration is idempotent and normalizes media and project settings", () => {
    const document = {
        project: { id: "p1" },
        editorDomain: {
            schemaVersion: 1,
            activeSceneId: "missing",
            scenes: [{
                id: "scene-a",
                name: " Intro ",
                timelineView: { scrollLeft: -20, playhead: 500 },
            }],
            media: [
                { id: "media-a", name: "A" },
                { id: "media-a", name: "Duplicate" },
                { name: "Missing id" },
            ],
            settings: {
                fps: 500,
                canvas: { width: 1920, height: -1 },
            },
        },
    }

    const once = migrateProjectDocument(document)
    const twice = migrateProjectDocument(once)

    assert.deepEqual(twice, once)
    assert.equal(once.editorDomain.activeSceneId, "scene-a")
    assert.equal(once.editorDomain.scenes["scene-a"].name, "Intro")
    assert.equal(once.editorDomain.scenes["scene-a"].timelineView.scrollLeft, 0)
    assert.deepEqual(once.editorDomain.media.ids, ["media-a"])
    assert.equal(once.editorDomain.media.entities["media-a"].name, "A")
    assert.equal(once.editorDomain.settings.fps, 240)
    assert.deepEqual(once.editorDomain.settings.canvas, { width: 1920, height: null })
})

test("newer schemas fail closed instead of being silently rewritten", () => {
    assert.throws(
        () => migrateProjectDocument({
            editorDomain: { schemaVersion: EDITOR_SCHEMA_VERSION + 1 },
        }),
        /supports up to/
    )
    assert.throws(() => migrateProjectDocument(null), /must be an object/)
})

test("editor domain reducer keeps scene, view, FPS, canvas, and media state valid", () => {
    let state = editorDomainReducer(undefined, { type: "init" })
    state = editorDomainReducer(state, applyProperties(normalizeEditorDomain(null, {
        projectId: "project-a",
        duration: 10_000,
    })))
    state = editorDomainReducer(state, addScene({
        id: "scene-b",
        name: "Outro",
        duration: 2_000,
    }))
    state = editorDomainReducer(state, addScene({
        id: " scene-b ",
        name: "Duplicate",
    }))
    state = editorDomainReducer(state, renameScene({ id: "scene-b", name: "Finale" }))
    state = editorDomainReducer(state, updateTimelineView({
        sceneId: "scene-b",
        changes: { pxPerMs: 0.5, scrollLeft: 80, playhead: 750 },
    }))
    state = editorDomainReducer(state, setProjectFps(60))
    state = editorDomainReducer(state, setCanvasSize({ width: 1080, height: 1920 }))
    state = editorDomainReducer(state, upsertMedia([
        { id: "media-video", type: "video", path: "assets/video.mp4" },
        { id: "media-audio", type: "audio", path: "assets/audio.wav" },
    ]))
    state = editorDomainReducer(state, upsertMedia({
        id: "media-video",
        duration: 9_000,
    }))
    state = editorDomainReducer(state, removeMedia("media-audio"))

    assert.equal(state.activeSceneId, "scene-b")
    assert.equal(state.sceneOrder.filter(id => id === "scene-b").length, 1)
    assert.equal(state.scenes["scene-b"].name, "Finale")
    assert.deepEqual(state.scenes["scene-b"].timelineView, {
        pxPerMs: 0.5,
        scrollLeft: 80,
        playhead: 750,
    })
    assert.equal(state.settings.fps, 60)
    assert.deepEqual(state.settings.canvas, { width: 1080, height: 1920 })
    assert.deepEqual(state.media.ids, ["media-video"])
    assert.equal(state.media.entities["media-video"].duration, 9_000)

    state = editorDomainReducer(state, setActiveScene("scene-project-a"))
    state = editorDomainReducer(state, reorderScenes(["scene-b", "scene-project-a"]))
    state = editorDomainReducer(state, removeScene("scene-b"))
    assert.deepEqual(state.sceneOrder, ["scene-project-a"])
    assert.equal(state.activeSceneId, "scene-project-a")

    const onlySceneState = editorDomainReducer(state, removeScene("scene-project-a"))
    assert.deepEqual(onlySceneState.sceneOrder, ["scene-project-a"])
})

test("project hydration and autosave include the editor domain", async () => {
    const [helpersSource, storeSource, rowSource, projectsSource] = await Promise.all([
        readFile(new URL("../app/shared/helpers.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/redux/store.js", import.meta.url), "utf8"),
        readFile(new URL("../app/windows/main/components/projects/Row.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/windows/main/components/projects/Projects.jsx", import.meta.url), "utf8"),
    ])

    assert.match(helpersSource, /migrateProjectDocument\(rawJson/)
    assert.match(helpersSource, /applyEditorDomainProperties\(json\.editorDomain\)/)
    assert.match(storeSource, /editorDomain: editorDomainReducer/)
    assert.match(storeSource, /editorDomain: \{ \.\.\.editorDomain \}/)
    assert.match(storeSource, /editorDomainSlice\.actions\.applyProperties\.type/)
    assert.match(storeSource, /resetEditorDomain\(\)/)
    assert.match(rowSource, /finally \{\s*setIsOpenProcessing\(false\)/)
    assert.match(rowSource, /dispatch\(setLoaderMessage\(null\)\)/)
    assert.match(rowSource, /Couldn't open project/)
    assert.match(projectsSource, /finally \{\s*setIsOpening\(false\)/)
    assert.match(projectsSource, /Couldn't open project/)
})
