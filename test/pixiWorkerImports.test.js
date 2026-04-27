import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..")
const workerFiles = [
    "app/shared/workers/previewWorker.js",
    "app/shared/workers/renderWorker.js"
]
const requiredPixiImports = [
    "pixi.js/webworker",
    "pixi.js/graphics",
    "pixi.js/mesh",
    "pixi.js/text"
]

test("Pixi workers import the worker-safe rendering modules", async () => {
    for (const workerFile of workerFiles) {
        const source = await readFile(path.join(rootDir, workerFile), "utf8")

        for (const specifier of requiredPixiImports) {
            assert.match(
                source,
                new RegExp(`import(?:\\(|\\s+)["']${specifier}["']`),
                `${workerFile} should import ${specifier}`
            )
        }
    }
})

test("worker-rendered scene modules avoid browser-only Pixi filter barrels", async () => {
    const sceneFiles = [
        "app/shared/scene/Scene.js",
        "app/shared/scene/Screen.js",
        "app/shared/scene/Camera.js"
    ]

    for (const sceneFile of sceneFiles) {
        const source = await readFile(path.join(rootDir, sceneFile), "utf8")

        assert.doesNotMatch(
            source,
            /from ["']pixi-filters["']/,
            `${sceneFile} should import concrete pixi-filters submodules`
        )
    }
})
