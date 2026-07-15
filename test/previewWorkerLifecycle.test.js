import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { postAsync } from "../app/shared/workers/helpers.js"

class FakeWorker {
    constructor({ postError = null } = {}) {
        this.messageListeners = new Set()
        this.postError = postError
        this.lastMessage = null
    }

    addEventListener(type, listener) {
        if (type === "message") this.messageListeners.add(listener)
    }

    removeEventListener(type, listener) {
        if (type === "message") this.messageListeners.delete(listener)
    }

    postMessage(message) {
        if (this.postError) throw this.postError
        this.lastMessage = message
    }

    respond(payload, error = null) {
        const event = {
            data: {
                id: this.lastMessage.id,
                isResponse: true,
                payload,
                error
            }
        }
        for (const listener of [...this.messageListeners]) listener(event)
    }
}

test("postAsync resolves a matching response and removes its listener", async () => {
    const worker = new FakeWorker()
    const pending = postAsync(worker, "FRAME", { frame: 1 }, "request-1")

    assert.equal(worker.messageListeners.size, 1)
    worker.respond({ accepted: true })

    assert.deepEqual(await pending, { accepted: true })
    assert.equal(worker.messageListeners.size, 0)
})

test("postAsync times out instead of leaving a pending listener", async () => {
    const worker = new FakeWorker()
    const pending = postAsync(worker, "FRAME", null, "request-2", [], {
        timeoutMs: 20,
        timeoutMessage: "frame request expired"
    })

    await assert.rejects(pending, error => (
        error.name === "TimeoutError" && error.message === "frame request expired"
    ))
    assert.equal(worker.messageListeners.size, 0)
})

test("postAsync aborts all work owned by a terminating manager", async () => {
    const worker = new FakeWorker()
    const controller = new AbortController()
    const pending = postAsync(worker, "INIT_PREVIEW", null, "request-3", [], {
        signal: controller.signal,
        timeoutMs: 1000
    })

    controller.abort(new Error("preview worker terminated"))

    await assert.rejects(pending, error => (
        error.name === "AbortError" && error.message === "preview worker terminated"
    ))
    assert.equal(worker.messageListeners.size, 0)
})

test("postAsync cleans up when postMessage throws synchronously", async () => {
    const worker = new FakeWorker({ postError: new Error("clone failed") })
    const pending = postAsync(worker, "UPDATE", null, "request-4", [], { timeoutMs: 1000 })

    await assert.rejects(pending, /clone failed/)
    assert.equal(worker.messageListeners.size, 0)
})

const [managerSource, previewSource] = await Promise.all([
    readFile(new URL("../app/shared/workers/PreviewWorkerManager.js", import.meta.url), "utf8"),
    readFile(new URL("../app/windows/main/components/Preview.jsx", import.meta.url), "utf8")
])

test("preview worker teardown rejects requests and frame pumps always unlock", () => {
    assert.match(managerSource, /PREVIEW_INIT_TIMEOUT_MS/)
    assert.match(managerSource, /pendingRequestController\.abort\(error\)/)
    assert.match(managerSource, /this\.request\(FRAME/)
    assert.match(managerSource, /finally \{\s*closeFrameResource\(frame\)\s*this\.isScreenFramePending = false/)
    assert.match(managerSource, /finally \{\s*closeFrameResource\(frame\)\s*closeFrameResource\(mask\)\s*this\.isCameraFramePending = false/)
})

test("preview clock updates do not rerender the full preview editor", () => {
    assert.match(previewSource, /function PreviewClockBridge\(\{ manager \}\)/)
    assert.match(previewSource, /manager\?\.postTime\(time\)/)
    assert.match(previewSource, /<PreviewClockBridge manager=\{manager\} \/>/)
    assert.match(previewSource, /const start = selectTime\(reduxStore\.getState\(\)\)/)
    assert.doesNotMatch(previewSource, /export default function Preview\(\)[\s\S]*const time = useSelector\(selectTime\)/)
})
