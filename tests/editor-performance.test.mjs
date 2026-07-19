import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import {
    getPreviewTextureDimensions,
    PREVIEW_TEXTURE_MAX_HEIGHT,
    PREVIEW_TEXTURE_MAX_WIDTH
} from "../app/shared/scene/previewQuality.js"

test("Retina recordings use a bounded editor texture without changing source coordinates", () => {
    const source = { x: 2940, y: 1912 }
    const preview = getPreviewTextureDimensions(source)

    assert.deepEqual(preview, { x: 1107, y: 720 })
    assert.ok(preview.x <= PREVIEW_TEXTURE_MAX_WIDTH)
    assert.ok(preview.y <= PREVIEW_TEXTURE_MAX_HEIGHT)
    assert.ok(
        (source.x * source.y) / (preview.x * preview.y) > 6,
        "the measured Retina capture should upload at least six times fewer preview pixels"
    )
})

test("downscaled preview textures stay centered in full-resolution scene coordinates", async () => {
    const screenSource = await readFile(
        new URL("../app/shared/scene/Screen.js", import.meta.url),
        "utf8"
    )

    assert.match(
        screenSource,
        /this\.fg\.pivot\.set\(textureDims\.x \* 0\.5, textureDims\.y \* 0\.5\)/
    )
    assert.match(
        screenSource,
        /this\.fg\.position\.set\(dims\.x \* 0\.5, dims\.y \* 0\.5\)/
    )
    assert.match(screenSource, /this\.fg\.width = dims\.x/)
    assert.match(screenSource, /this\.fg\.height = dims\.y/)
})

test("preview texture bounds preserve small and portrait aspect ratios", () => {
    assert.deepEqual(
        getPreviewTextureDimensions({ x: 1280, y: 720 }),
        { x: 1280, y: 720 }
    )

    const portrait = getPreviewTextureDimensions({ x: 1179, y: 2556 })
    assert.deepEqual(portrait, { x: 332, y: 720 })
    assert.ok(Math.abs(portrait.x / portrait.y - 1179 / 2556) < 0.002)
})

test("new projects use responsive cursor and zoom timing defaults", async () => {
    const [cursorSource, zoomSource] = await Promise.all([
        readFile(new URL("../app/shared/redux/cursorCoordsSlice.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/redux/zoomSlice.js", import.meta.url), "utf8"),
    ])

    assert.match(cursorSource, /inertia:\s*300/)
    assert.match(zoomSource, /intro:\s*700/)
    assert.match(zoomSource, /outro:\s*700/)
})

test("preview keeps expensive motion filters bounded while export retains quality", async () => {
    const sceneSource = await readFile(
        new URL("../app/shared/scene/Scene.js", import.meta.url),
        "utf8"
    )

    assert.match(sceneSource, /maxKernelSize:\s*this\.isPreview \? 8 : 32/)
    assert.match(sceneSource, /this\.container\.filters = shouldApplyZoomBlur \? \[this\.zoomBlur\] : null/)
    assert.match(sceneSource, /this\.isPreview \? 11 : 25/)
})
