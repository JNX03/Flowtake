export const DEFAULT_PROJECT_SAVE_DELAY_MS = 3000

/**
 * Serializes project saves and keeps a revision pending until a write succeeds.
 *
 * A save request can arrive while an earlier write is in flight. The drain loop
 * immediately writes the newest state again before it reports idle, which lets
 * project close flush the latest edit instead of observing a stale boolean and
 * racing ahead of the trailing debounce.
 */
export function createProjectSaveCoordinator({
    delayMs = DEFAULT_PROJECT_SAVE_DELAY_MS,
    setTimer = globalThis.setTimeout,
    clearTimer = globalThis.clearTimeout,
} = {}) {
    let timerId = null
    let latestSave = null
    let requestedRevision = 0
    let persistedRevision = 0
    let drainPromise = null

    const cancelTimer = () => {
        if (timerId === null) return
        clearTimer(timerId)
        timerId = null
    }

    const drain = () => {
        if (drainPromise) return drainPromise
        if (!latestSave || persistedRevision >= requestedRevision) return Promise.resolve()

        drainPromise = (async () => {
            while (persistedRevision < requestedRevision) {
                const revision = requestedRevision
                await latestSave({
                    revision,
                    isLatest: () => revision === requestedRevision,
                })
                persistedRevision = revision
            }
        })().finally(() => {
            // A request made during an in-flight write schedules a fallback
            // timer. The loop above already persisted that revision, so do not
            // leave the coordinator reporting a phantom pending save.
            if (persistedRevision >= requestedRevision) cancelTimer()
            drainPromise = null
        })

        return drainPromise
    }

    const schedule = () => {
        cancelTimer()
        timerId = setTimer(() => {
            timerId = null
            // Save errors are reflected in Redux by the supplied task. Keep the
            // revision pending so a later edit or explicit close can retry it.
            void drain().catch(() => {})
        }, delayMs)
    }

    return {
        request(save) {
            if (typeof save !== "function") throw new TypeError("A project save function is required.")
            latestSave = save
            requestedRevision += 1
            schedule()
            return requestedRevision
        },

        async flush() {
            cancelTimer()
            await drain()
        },

        get isPending() {
            return timerId !== null || drainPromise !== null || persistedRevision < requestedRevision
        },

        get revisions() {
            return { requested: requestedRevision, persisted: persistedRevision }
        },
    }
}
