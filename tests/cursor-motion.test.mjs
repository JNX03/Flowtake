import assert from "node:assert/strict"
import { test } from "node:test"
import {
    applyInertia,
    getInertiaCoords
} from "../app/shared/sceneHelpers.js"
import Drag from "../app/shared/scene/cursorAnim/Drag.js"

globalThis.self = globalThis

const sparseMove = [
    { type: "mousemove", x: 0, y: 0, timestamp: 0 },
    { type: "mousemove", x: 120, y: 0, timestamp: 600 },
]

test("cursor inertia moves smoothly between sparse captured samples", () => {
    const coords = applyInertia(sparseMove, 900, 650)
    const early = getInertiaCoords(100, coords)
    const middle = getInertiaCoords(250, coords)
    const late = getInertiaCoords(500, coords)

    assert.ok(early.x > 0, "cursor should start moving before the next raw event")
    assert.ok(middle.x > early.x, "cursor should continue moving forward")
    assert.ok(late.x > middle.x, "cursor should remain monotonic on a straight path")
    assert.ok(late.x < 120, "inertia should still smooth toward the target")
})

test("drag cursor animation uses smoothed inertia coordinates", () => {
    const coords = applyInertia(sparseMove, 900, 650)
    const drag = new Drag({ events: sparseMove }, coords)
    const middle = drag.getCoords(250)

    assert.ok(middle.x > 0, "drag playback should not snap to the previous raw event")
    assert.ok(middle.x < 120, "drag playback should stay on the smoothed path")
})

test("click configs start on mouse-down and avoid overlapping fast clicks", async () => {
    const { default: ClickConfig } = await import("../app/shared/scene/click/ClickConfig.js")
    const clicks = ClickConfig.createBulk([
        { type: "mousedown", x: 10, y: 10, timestamp: 100 },
        { type: "mouseup", x: 10, y: 10, timestamp: 140 },
        { type: "mousedown", x: 20, y: 20, timestamp: 300 },
        { type: "mouseup", x: 20, y: 20, timestamp: 340 },
    ])

    assert.equal(clicks.length, 2)
    assert.equal(clicks[0].start, 100)
    assert.ok(clicks[0].end < clicks[1].start)
    assert.equal(clicks[0].ringSize, 52)
    assert.equal(clicks[0].scaleAmount, 0.82)
})

test("click animation ripples after the actual click frame", async () => {
    const { default: Click } = await import("../app/shared/scene/click/Click.js")
    const click = new Click({
        start: 100,
        end: 460,
        intro: 80,
        outro: 180,
        isActive: true,
    }, { cursorScale: 1 })

    assert.equal(click.computeFrame(99).ringProgress, 0)
    assert.equal(click.computeFrame(100).ringProgress, 0)

    const pressed = click.computeFrame(140)
    assert.ok(pressed.ringProgress > 0)
    assert.ok(pressed.scale < 1)

    const faded = click.computeFrame(460)
    assert.equal(faded.ringProgress, 1)
    assert.equal(faded.ringConfig.alphaProgress, 0)
})
