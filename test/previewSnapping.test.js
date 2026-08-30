import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { snapPreviewPosition } from "../app/shared/editor/previewSnapping.js"

const containerSize = { width: 1_000, height: 500 }
const movingSize = { width: 100, height: 50 }

test("preview snapping aligns an overlay to the canvas center within eight pixels", () => {
    const result = snapPreviewPosition({
        position: { x: 0.506, y: 0.49 },
        movingSize,
        containerSize,
    })

    assert.deepEqual(result.position, { x: 0.5, y: 0.5 })
    assert.deepEqual(result.guides.map(guide => guide.axis), ["x", "y"])
    assert.ok(result.guides.every(guide => guide.source === "canvas-center"))
})

test("preview snapping leaves positions outside the threshold unchanged", () => {
    const position = { x: 0.52, y: 0.53 }
    const result = snapPreviewPosition({
        position,
        movingSize,
        containerSize,
    })

    assert.deepEqual(result.position, position)
    assert.deepEqual(result.guides, [])
})

test("preview snapping aligns the moving edge to a canvas edge", () => {
    const result = snapPreviewPosition({
        position: { x: 0.056, y: 0.25 },
        movingSize,
        containerSize,
    })

    assert.equal(result.position.x, 0.05)
    assert.deepEqual(result.guides, [{
        axis: "x",
        value: 0,
        source: "canvas-left",
        moving: "left",
    }])
})

test("preview snapping aligns an overlay edge to a neighboring overlay", () => {
    const result = snapPreviewPosition({
        position: { x: 0.246, y: 0.25 },
        movingSize,
        containerSize,
        otherBounds: [{
            id: "overlay-b",
            left: 0.3,
            centerX: 0.35,
            right: 0.4,
            top: 0.4,
            centerY: 0.5,
            bottom: 0.6,
        }],
    })

    assert.equal(result.position.x, 0.25)
    assert.deepEqual(result.guides, [{
        axis: "x",
        value: 0.3,
        source: "overlay-b",
        moving: "right",
    }])
})

test("overlay canvas renders and clears guides from the shared snap helper", async () => {
    const source = await readFile(
        new URL("../app/windows/main/components/OverlayCanvas.jsx", import.meta.url),
        "utf8"
    )

    assert.match(source, /snapPreviewPosition\(\{/)
    assert.match(source, /onSnapGuidesChange\(snapped\.guides\)/)
    assert.match(source, /onSnapGuidesChange\(\[\]\)/)
    assert.match(source, /data-preview-snap-guide=/)
})
