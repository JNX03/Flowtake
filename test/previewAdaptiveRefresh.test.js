import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const managerSource = await readFile(
    new URL("../app/shared/workers/PreviewWorkerManager.js", import.meta.url),
    "utf8"
)

async function loadManagerClass() {
    // PreviewWorkerManager's real imports include a Vite `?worker` module and
    // browser-only media packages. Evaluate the production class body with a
    // minimal base class so these scheduling methods can run in Node.
    const classBody = managerSource.slice(managerSource.indexOf("const PREVIEW_INIT_TIMEOUT_MS"))
    const prelude = `
        const CAMERA_VIDEO = "camera"
        const SCREEN_VIDEO = "screen"
        const SET_EXTRA_VISIBILITY = "visibility"
        const IS_PLAYING = "is-playing"
        class WorkerManager {
            terminate() { this.worker = null }
        }
    `
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(prelude + classBody).toString("base64")}`
    return (await import(moduleUrl)).default
}

const PreviewWorkerManager = await loadManagerClass()

class FakeVideoFrame {
    close() { return undefined }
}

function createManager() {
    const manager = Object.create(PreviewWorkerManager.prototype)
    Object.assign(manager, {
        stopped: false,
        worker: {},
        isPlaying: false,
        screenVideo: { readyState: 4 },
        cameraVideo: { readyState: 4 },
        isScreenFramePending: false,
        isCameraFramePending: false,
        deferredPausedScreenRefresh: false,
        deferredPausedCameraRefresh: false,
        hasCameraVideoBackgroundBlur: false,
        cameraVideoBackgroundBlurAmount: 0,
        eyeContactEnabled: false,
        faceLandmarkerReady: false,
        extraVideos: [{
            video: { readyState: 4 },
            isPending: false,
            isVisible: true,
            deferredPausedRefresh: false,
        }],
    })
    return manager
}

function flushPromises() {
    return new Promise(resolve => setImmediate(resolve))
}

test("profile refresh coalesces each pending preview source into one deferred read", async () => {
    const originalVideoFrame = globalThis.VideoFrame
    globalThis.VideoFrame = FakeVideoFrame

    try {
        const manager = createManager()
        const requests = []
        manager.postFrame = type => new Promise(resolve => requests.push({ type, resolve }))

        manager.refreshPausedFrames()
        assert.deepEqual(requests.map(request => request.type), ["screen", "camera", "extra-0"])

        // Multiple profile updates while those reads are pending must remain
        // one-bit latches, not enqueue one follow-up per update.
        manager.refreshPausedFrames()
        manager.refreshPausedFrames()
        assert.equal(manager.deferredPausedScreenRefresh, true)
        assert.equal(manager.deferredPausedCameraRefresh, true)
        assert.equal(manager.extraVideos[0].deferredPausedRefresh, true)

        requests.slice(0, 3).forEach(request => request.resolve())
        await flushPromises()

        assert.deepEqual(
            Object.fromEntries(["screen", "camera", "extra-0"].map(type => [
                type,
                requests.filter(request => request.type === type).length,
            ])),
            { screen: 2, camera: 2, "extra-0": 2 }
        )
        assert.equal(manager.deferredPausedScreenRefresh, false)
        assert.equal(manager.deferredPausedCameraRefresh, false)
        assert.equal(manager.extraVideos[0].deferredPausedRefresh, false)

        requests.slice(3).forEach(request => request.resolve())
        await flushPromises()
        assert.equal(requests.length, 6)
    } finally {
        globalThis.VideoFrame = originalVideoFrame
    }
})

test("showing a hidden paused extra refreshes once after visibility reaches the worker", async () => {
    const originalVideoFrame = globalThis.VideoFrame
    globalThis.VideoFrame = FakeVideoFrame

    try {
        const manager = createManager()
        const events = []
        manager.extraVideos[0].isVisible = false
        manager.postIfActive = type => {
            events.push(type)
            return true
        }
        manager.postFrame = type => {
            events.push(type)
            return Promise.resolve()
        }

        manager.setExtraVisibility(0, true)
        assert.deepEqual(events, ["visibility", "extra-0"])

        manager.setExtraVisibility(0, true)
        assert.deepEqual(events, ["visibility", "extra-0", "visibility"])

        await flushPromises()
    } finally {
        globalThis.VideoFrame = originalVideoFrame
    }
})

test("pausing refreshes cleared textures after worker playback state changes", async () => {
    const originalVideoFrame = globalThis.VideoFrame
    globalThis.VideoFrame = FakeVideoFrame

    try {
        const manager = createManager()
        const events = []
        manager.isPlaying = true
        manager.postIfActive = type => {
            events.push(type)
            return true
        }
        manager.postFrame = type => {
            events.push(type)
            return Promise.resolve()
        }

        manager.postIsPlaying(false)
        assert.deepEqual(events, ["is-playing", "screen", "camera", "extra-0"])

        await flushPromises()
    } finally {
        globalThis.VideoFrame = originalVideoFrame
    }
})

test("termination clears deferred refreshes and late settlements cannot restart reads", async () => {
    const originalVideoFrame = globalThis.VideoFrame
    globalThis.VideoFrame = FakeVideoFrame

    try {
        const manager = createManager()
        const requests = []
        manager.pendingRequestController = new AbortController()
        manager.postFrame = type => new Promise(resolve => requests.push({ type, resolve }))

        manager.refreshPausedFrames()
        manager.refreshPausedFrames()
        manager.terminate()

        assert.equal(manager.deferredPausedScreenRefresh, false)
        assert.equal(manager.deferredPausedCameraRefresh, false)
        assert.equal(manager.extraVideos[0].deferredPausedRefresh, false)

        requests.forEach(request => request.resolve())
        await flushPromises()
        assert.equal(requests.length, 3)
    } finally {
        globalThis.VideoFrame = originalVideoFrame
    }
})
