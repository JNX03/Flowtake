/**
 * Close the native project archive before tearing down the live editor.
 *
 * Native close can fail while validating or writing the archive. Keeping the
 * irreversible UI teardown behind that boundary leaves the current editor
 * usable and makes a retry safe.
 */
export async function closeProjectSafely({
    flushSaves,
    commitNativeProject,
    teardownEditorResources,
    finalizeNativeProject,
}) {
    // Before this commit succeeds, every failure must leave the live editor
    // and native project session untouched so the user can retry.
    await flushSaves()
    await commitNativeProject()

    // The archive is durable now. Cleanup failures must not strand a half-
    // destroyed editor; finalize the native session and let the caller reset
    // the UI to the project library, reporting any non-fatal cleanup issue.
    let teardownError = null
    let finalizeError = null
    try {
        await teardownEditorResources()
    } catch (error) {
        teardownError = error
    }

    try {
        await finalizeNativeProject()
    } catch (error) {
        finalizeError = error
    }

    return { teardownError, finalizeError }
}
