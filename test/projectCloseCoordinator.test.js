import test from "node:test"
import assert from "node:assert/strict"

import { closeProjectSafely } from "../app/shared/editor/projectCloseCoordinator.js"

test("a native close failure leaves editor resources intact and allows retry", async () => {
    const calls = []
    let closeAttempts = 0
    let editorResourcesAlive = true

    const close = () => closeProjectSafely({
        flushSaves: async () => calls.push("flush"),
        commitNativeProject: async () => {
            calls.push("native-commit")
            closeAttempts += 1
            if (closeAttempts === 1) {
                const error = new Error("No space left while staging project archive")
                error.code = "ENOSPC"
                throw error
            }
        },
        teardownEditorResources: async () => {
            calls.push("teardown")
            editorResourcesAlive = false
        },
        finalizeNativeProject: async () => calls.push("native-finalize"),
    })

    await assert.rejects(close(), error =>
        error.code === "ENOSPC" && /No space left/.test(error.message)
    )
    assert.deepEqual(calls, ["flush", "native-commit"])
    assert.equal(editorResourcesAlive, true)

    await close()
    assert.deepEqual(calls, [
        "flush",
        "native-commit",
        "flush",
        "native-commit",
        "teardown",
        "native-finalize",
    ])
    assert.equal(editorResourcesAlive, false)
})

test("successful close persists before tearing down editor resources", async () => {
    const calls = []

    const result = await closeProjectSafely({
        flushSaves: async () => calls.push("flush"),
        commitNativeProject: async () => calls.push("native-commit"),
        teardownEditorResources: async () => calls.push("teardown"),
        finalizeNativeProject: async () => calls.push("native-finalize"),
    })

    assert.deepEqual(calls, ["flush", "native-commit", "teardown", "native-finalize"])
    assert.deepEqual(result, { teardownError: null, finalizeError: null })
})

test("a post-commit teardown failure still finalizes the durable project", async () => {
    const calls = []
    const teardownFailure = new Error("cleanup timed out")

    const result = await closeProjectSafely({
        flushSaves: async () => calls.push("flush"),
        commitNativeProject: async () => calls.push("native-commit"),
        teardownEditorResources: async () => {
            calls.push("teardown")
            throw teardownFailure
        },
        finalizeNativeProject: async () => calls.push("native-finalize"),
    })

    assert.deepEqual(calls, ["flush", "native-commit", "teardown", "native-finalize"])
    assert.equal(result.teardownError, teardownFailure)
    assert.equal(result.finalizeError, null)
})
