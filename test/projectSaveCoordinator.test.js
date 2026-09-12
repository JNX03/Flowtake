import assert from "node:assert/strict"
import test from "node:test"

import {
    createProjectSaveCoordinator
} from "../app/shared/editor/projectSaveCoordinator.js"
import editorReducer, {
    SAVE_STATUS_ERROR,
    SAVE_STATUS_PENDING,
    SAVE_STATUS_SAVED,
    SAVE_STATUS_SAVING,
    setSaveStatus
} from "../app/shared/redux/editorSlice.js"

test("project save flush coalesces edits that are still waiting on the debounce", async () => {
    const coordinator = createProjectSaveCoordinator({ delayMs: 60_000 })
    const writes = []
    let currentValue = "first"
    const save = async () => writes.push(currentValue)

    coordinator.request(save)
    currentValue = "latest"
    coordinator.request(save)

    await coordinator.flush()

    assert.deepEqual(writes, ["latest"])
    assert.deepEqual(coordinator.revisions, { requested: 2, persisted: 2 })
    assert.equal(coordinator.isPending, false)
})

test("project close flush waits for an edit requested during an in-flight save", async () => {
    const coordinator = createProjectSaveCoordinator({ delayMs: 60_000 })
    const writes = []
    const completions = []
    let currentValue = "first"
    let attempt = 0
    let releaseFirstSave
    let signalFirstSaveStarted
    const firstSaveStarted = new Promise(resolve => {
        signalFirstSaveStarted = resolve
    })
    const firstSaveGate = new Promise(resolve => {
        releaseFirstSave = resolve
    })
    const save = async ({ revision, isLatest }) => {
        const value = currentValue
        writes.push(value)
        attempt += 1

        if (attempt === 1) {
            signalFirstSaveStarted()
            await firstSaveGate
        }

        completions.push({ value, revision, isLatest: isLatest() })
    }

    coordinator.request(save)
    const firstFlush = coordinator.flush()
    await firstSaveStarted

    currentValue = "latest"
    coordinator.request(save)
    const closeFlush = coordinator.flush()
    releaseFirstSave()

    await Promise.all([firstFlush, closeFlush])

    assert.deepEqual(writes, ["first", "latest"])
    assert.deepEqual(completions, [
        { value: "first", revision: 1, isLatest: false },
        { value: "latest", revision: 2, isLatest: true },
    ])
    assert.deepEqual(coordinator.revisions, { requested: 2, persisted: 2 })
    assert.equal(coordinator.isPending, false)
})

test("failed project saves stay pending and can be retried", async () => {
    const coordinator = createProjectSaveCoordinator({ delayMs: 60_000 })
    let attempts = 0

    coordinator.request(async () => {
        attempts += 1
        if (attempts === 1) throw new Error("disk unavailable")
    })

    await assert.rejects(coordinator.flush(), /disk unavailable/)
    assert.equal(coordinator.isPending, true)
    assert.deepEqual(coordinator.revisions, { requested: 1, persisted: 0 })

    await coordinator.flush()

    assert.equal(attempts, 2)
    assert.equal(coordinator.isPending, false)
    assert.deepEqual(coordinator.revisions, { requested: 1, persisted: 1 })
})

test("editor save state distinguishes pending, active, success, and failure", () => {
    let state = editorReducer(undefined, { type: "editor/init" })

    state = editorReducer(state, setSaveStatus(SAVE_STATUS_PENDING))
    assert.equal(state.isSaving, true)
    assert.equal(state.saveError, null)

    state = editorReducer(state, setSaveStatus(SAVE_STATUS_SAVING))
    assert.equal(state.isSaving, true)

    state = editorReducer(state, setSaveStatus(SAVE_STATUS_SAVED))
    assert.equal(state.isSaving, false)
    assert.equal(state.saveError, null)

    state = editorReducer(state, setSaveStatus({
        status: SAVE_STATUS_ERROR,
        error: "permission denied",
    }))
    assert.equal(state.isSaving, false)
    assert.equal(state.saveStatus, SAVE_STATUS_ERROR)
    assert.equal(state.saveError, "permission denied")
})
