import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
    OVERLAY_EASING_NAMES,
    resolveOverlayAtTime,
} from "../app/shared/editor/overlayKeyframes.js"

const overlay = {
    id: "overlay-a",
    start: 1_000,
    end: 4_000,
    position: { x: 0, y: 0 },
    rotation: 0,
    scale: 1,
    opacity: 1,
    keyframes: [
        {
            time: 0,
            position: { x: 0, y: 0 },
            rotation: 0,
            scale: 1,
            opacity: 1,
        },
        {
            time: 1_000,
            position: { x: 1, y: 0.5 },
            rotation: 180,
            scale: 2,
            opacity: 0,
            easing: "linear",
        },
    ],
}

test("overlay keyframes resolve linear transform channels identically", () => {
    const resolved = resolveOverlayAtTime(overlay, 1_500)
    assert.deepEqual(resolved.position, { x: 0.5, y: 0.25 })
    assert.equal(resolved.rotation, 90)
    assert.equal(resolved.scale, 1.5)
    assert.equal(resolved.opacity, 0.5)
})

test("target-keyframe easing is applied and unknown values fail to linear", () => {
    const eased = resolveOverlayAtTime({
        ...overlay,
        keyframes: [
            overlay.keyframes[0],
            { ...overlay.keyframes[1], easing: "expOut" },
        ],
    }, 1_250)
    const fallback = resolveOverlayAtTime({
        ...overlay,
        keyframes: [
            overlay.keyframes[0],
            { ...overlay.keyframes[1], easing: "unknown" },
        ],
    }, 1_250)

    assert.ok(eased.position.x > 0.25)
    assert.equal(fallback.position.x, 0.25)
    assert.deepEqual(OVERLAY_EASING_NAMES, [
        "linear",
        "smooth",
        "expOut",
        "snap",
        "bounce",
        "elastic",
    ])
})

test("resolution clamps to the first and last keyframes", () => {
    assert.equal(resolveOverlayAtTime(overlay, 500).rotation, 0)
    assert.equal(resolveOverlayAtTime(overlay, 3_000).rotation, 180)
    assert.equal(resolveOverlayAtTime({ ...overlay, keyframes: [] }, 1_500).id, "overlay-a")
})

test("direct manipulation, renderer, and inspector share one easing contract", async () => {
    const [canvasSource, animatorSource, inspectorSource] = await Promise.all([
        readFile(new URL("../app/windows/main/components/OverlayCanvas.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/scene/overlay/OverlayAnimator.js", import.meta.url), "utf8"),
        readFile(new URL("../app/windows/main/components/properties/OverlaySection.jsx", import.meta.url), "utf8"),
    ])

    assert.match(canvasSource, /resolveOverlayAtTime/)
    assert.match(animatorSource, /resolveOverlayAtTime/)
    assert.doesNotMatch(canvasSource, /function lerpKeyframes/)
    assert.doesNotMatch(animatorSource, /function lerpKeyframes/)
    assert.match(inspectorSource, /OVERLAY_EASING_NAMES/)
    assert.match(inspectorSource, /onChangeKeyframeEasing/)
    assert.match(inspectorSource, /Easing for keyframe at/)
})

test("live preview, export renderer, and inspector expose the same rich overlay styles", async () => {
    const [canvasSource, animatorSource, inspectorSource] = await Promise.all([
        readFile(new URL("../app/windows/main/components/OverlayCanvas.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/scene/overlay/OverlayAnimator.js", import.meta.url), "utf8"),
        readFile(new URL("../app/windows/main/components/properties/OverlaySection.jsx", import.meta.url), "utf8"),
    ])

    for (const property of [
        "fontFamily",
        "fontWeight",
        "fontStyle",
        "textAlign",
        "letterSpacing",
        "lineHeight",
        "textBackgroundEnabled",
        "textBackgroundColor",
        "textBackgroundOpacity",
        "textBackgroundPadding",
        "textBackgroundRadius",
        "blendMode",
        "visible",
    ]) {
        assert.match(canvasSource, new RegExp(property))
        assert.match(animatorSource, new RegExp(property))
        assert.match(inspectorSource, new RegExp(property))
    }

    assert.match(canvasSource, /withGroup\(/)
    assert.match(canvasSource, /getGroup\("overlay-move"\)/)
    assert.match(canvasSource, /getGroup\("overlay-resize"\)/)
    assert.match(canvasSource, /getGroup\("overlay-rotate"\)/)
    assert.match(canvasSource, /getGroup\("overlay-text-edit"\)/)
    assert.match(canvasSource, /onDoubleClick=\{startTextEdit\}/)
    assert.match(canvasSource, /aria-label="Edit text overlay"/)
    assert.match(canvasSource, /event\.metaKey \|\| event\.ctrlKey/)
    assert.match(canvasSource, /cancelTextEdit/)
    assert.match(canvasSource, /isSelected && !isEditingText/)
    assert.match(inspectorSource, /getGroup\("overlay-property"\)/)
    assert.match(inspectorSource, /Background Opacity/)
})
