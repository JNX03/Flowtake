import assert from "node:assert/strict"
import test from "node:test"

import { createPixiAppOptions } from "../app/shared/scene/pixiAppOptions.js"

test("Pixi app options are safe for worker rendering", () => {
    const canvas = { kind: "offscreen-canvas" }
    const options = createPixiAppOptions(canvas)

    assert.equal(options.canvas, canvas)
    assert.equal(options.manageImports, false)
    assert.equal(options.preference, "webgl")
    assert.equal(options.useBackBuffer, true)
    assert.deepEqual(options.accessibilityOptions, { activateOnTab: false })
})
