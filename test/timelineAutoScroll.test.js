import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
    createTimelineAutoScrollController,
    getTimelineAutoScrollDelta
} from "../app/shared/editor/timelineAutoScroll.js"

const rect = { left: 100, right: 900 }

test("edge velocity is directional, accelerated, capped, and zero in the safe area", () => {
    assert.equal(getTimelineAutoScrollDelta(500, rect), 0)
    assert.equal(getTimelineAutoScrollDelta(172, rect), 0)
    assert.equal(getTimelineAutoScrollDelta(828, rect), 0)

    const nearLeftEdge = getTimelineAutoScrollDelta(110, rect)
    const fartherFromLeftEdge = getTimelineAutoScrollDelta(150, rect)
    assert.ok(nearLeftEdge < fartherFromLeftEdge)
    assert.ok(fartherFromLeftEdge < 0)

    assert.equal(getTimelineAutoScrollDelta(0, rect), -28)
    assert.equal(getTimelineAutoScrollDelta(1000, rect), 28)
})

test("controller scrolls on animation frames and keeps the latest pointer", () => {
    const frames = new Map()
    const scrollFrames = []
    let nextFrameId = 1
    const container = {
        scrollLeft: 100,
        scrollWidth: 1000,
        clientWidth: 400,
        getBoundingClientRect: () => rect
    }

    const controller = createTimelineAutoScrollController({
        getContainer: () => container,
        requestFrame(callback) {
            const id = nextFrameId++
            frames.set(id, callback)
            return id
        },
        cancelFrame: id => frames.delete(id),
        onScrollFrame: frame => scrollFrames.push(frame)
    })

    const runNextFrame = () => {
        const [id, callback] = frames.entries().next().value
        frames.delete(id)
        callback()
    }

    controller.start({ clientX: 890, clientY: 20 })
    assert.equal(frames.size, 1)
    controller.update({ clientX: 895, clientY: 30 })
    assert.equal(frames.size, 1, "pointer updates do not queue duplicate frames")

    runNextFrame()
    assert.ok(container.scrollLeft > 100)
    assert.equal(scrollFrames.length, 1)
    assert.deepEqual(scrollFrames[0].pointer, { clientX: 895, clientY: 30 })
    assert.equal(frames.size, 1, "edge scrolling continues while movement is possible")

    controller.update({ clientX: 500, clientY: 30 })
    runNextFrame()
    assert.equal(frames.size, 0, "safe-area pointers stop the animation loop")
})

test("controller clamps at timeline bounds and cancels queued work", () => {
    const frames = new Map()
    const cancelled = []
    let nextFrameId = 1
    const container = {
        scrollLeft: 0,
        scrollWidth: 900,
        clientWidth: 400,
        getBoundingClientRect: () => rect
    }
    const controller = createTimelineAutoScrollController({
        getContainer: () => container,
        requestFrame(callback) {
            const id = nextFrameId++
            frames.set(id, callback)
            return id
        },
        cancelFrame(id) {
            cancelled.push(id)
            frames.delete(id)
        }
    })

    controller.start({ clientX: 0, clientY: 0 })
    const [firstId, firstFrame] = frames.entries().next().value
    frames.delete(firstId)
    firstFrame()
    assert.equal(container.scrollLeft, 0)
    assert.equal(frames.size, 0, "a blocked edge does not spin animation frames")

    controller.update({ clientX: 1000, clientY: 0 })
    assert.equal(frames.size, 1)
    controller.stop()
    assert.deepEqual(cancelled, [2])
    assert.equal(frames.size, 0)
    assert.equal(controller.isActive(), false)
})

test("Action wires one controller to the existing mouse gesture and cleans up every exit", async () => {
    const source = await readFile(
        new URL("../app/windows/main/components/timeline/Action.jsx", import.meta.url),
        "utf8"
    )

    assert.match(source, /createTimelineAutoScrollController/)
    assert.match(source, /closest\("\.flowtake-timeline-scroll"\)/)
    assert.match(source, /Math\.abs\(event\.clientX - gestureOriginX\) < 3/)
    assert.match(source, /window\.dispatchEvent\(new MouseEvent\("mousemove"/)
    assert.match(source, /window\.addEventListener\("mouseup", finishGesture\)/)
    assert.match(source, /window\.addEventListener\("blur", cancelGesture\)/)
    assert.match(source, /document\.addEventListener\("visibilitychange", handleVisibilityChange\)/)
    assert.match(source, /controller\.stop\(\)/)
    assert.match(source, /removeWindowListeners\(\)/)
})
