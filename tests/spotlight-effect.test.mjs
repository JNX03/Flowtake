import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import {
    getSpotlightFeatherBands,
    normalizeSpotlightConfig
} from "../app/shared/scene/spotlight/spotlightMath.js"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const readRepoFile = file => readFile(path.join(repoRoot, file), "utf8")

test("spotlight config clamps unsafe values", () => {
    assert.deepEqual(
        normalizeSpotlightConfig({ radius: -10, opacity: 2, feather: -5 }),
        { radius: 1, opacity: .95, feather: 0 }
    )

    assert.deepEqual(
        normalizeSpotlightConfig({ radius: Number.NaN, opacity: Number.NaN, feather: Number.NaN }),
        { radius: 160, opacity: .55, feather: 80 }
    )
})

test("spotlight feather bands fade from the clear center to the dimmed screen", () => {
    const bands = getSpotlightFeatherBands(120, 90, .6)

    assert.ok(bands.length >= 4)
    assert.ok(bands.length <= 10)
    assert.equal(bands[0].innerRadius, 120)
    assert.equal(bands.at(-1).outerRadius, 210)

    for (let i = 1; i < bands.length; i++) {
        assert.equal(bands[i].innerRadius, bands[i - 1].outerRadius)
        assert.ok(bands[i].alpha > bands[i - 1].alpha)
    }
})

test("spotlight settings are wired through preview and export renderers", async () => {
    const cursorSlice = await readRepoFile("app/shared/redux/cursorCoordsSlice.js")
    const preview = await readRepoFile("app/windows/main/components/Preview.jsx")
    const previewScene = await readRepoFile("app/shared/scene/PreviewScene.js")
    const renderWorker = await readRepoFile("app/shared/workers/renderWorker.js")
    const renderScene = await readRepoFile("app/shared/scene/RenderScene.js")

    assert.match(cursorSlice, /showSpotlight: false/)
    assert.match(cursorSlice, /setShowSpotlight/)
    assert.match(preview, /cursorCoords\.showSpotlight/)
    assert.match(preview, /cursorCoords\.spotlightRadius/)
    assert.match(preview, /cursorCoords\.spotlightOpacity/)
    assert.match(preview, /cursorCoords\.spotlightFeather/)
    assert.match(previewScene, /this\.spotlightAnimator\.setState\(\{ showSpotlight: payload \}\)/)
    assert.match(renderWorker, /showSpotlight: selectShowSpotlight/)
    assert.match(renderScene, /this\.spotlightAnimator\.setState\(\{/)
})
