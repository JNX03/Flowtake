import assert from "node:assert/strict"
import test from "node:test"
import { setPrimaryMediaRenderGate } from "../app/shared/scene/primaryMediaVisibility.js"

test("primary media gap gate includes extra videos without overwriting role visibility", () => {
    const screen = { visible: true, renderable: true }
    const camera = { visible: false, renderable: true }
    const extraVisible = { visible: true, renderable: true }
    const extraHidden = { visible: false, renderable: true }
    const scene = {
        screen: { container: screen },
        camera: { outerContainer: camera },
        extraVideos: [
            { outerContainer: extraVisible },
            { outerContainer: extraHidden },
        ],
    }

    setPrimaryMediaRenderGate(scene, false)
    assert.deepEqual(
        [screen, camera, extraVisible, extraHidden].map(container => container.renderable),
        [false, false, false, false]
    )
    assert.deepEqual(
        [screen, camera, extraVisible, extraHidden].map(container => container.visible),
        [true, false, true, false]
    )

    setPrimaryMediaRenderGate(scene, true)
    assert.deepEqual(
        [screen, camera, extraVisible, extraHidden].map(container => container.renderable),
        [true, true, true, true]
    )
    assert.deepEqual(
        [screen, camera, extraVisible, extraHidden].map(container => container.visible),
        [true, false, true, false]
    )
})
