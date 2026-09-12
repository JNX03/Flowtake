import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import {
    getPreviewTextureDimensions,
    PREVIEW_TEXTURE_MAX_HEIGHT,
    PREVIEW_TEXTURE_MAX_WIDTH
} from "../app/shared/scene/previewQuality.js"
import {
    BALANCED_EDITOR_FPS,
    BALANCED_EDITOR_FRAME_INTERVAL_MS,
} from "../app/shared/editor/performanceCadence.js"
import {
    DECODE_CANVAS_POOL_SIZE,
    dedupeSequentialTimestamps,
    SequentialCanvasCursor,
} from "../app/shared/workers/sequentialCanvasCursor.js"
import {
    PERFORMANCE_MODE_EFFICIENCY,
    resolvePerformanceProfile,
} from "../app/shared/adaptivePerformance.js"

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

test("adaptive preview tiers change working texture size without changing aspect ratio", () => {
    const source = { x: 3840, y: 2160 }
    const efficient = getPreviewTextureDimensions(source, 854, 480)
    const quality = getPreviewTextureDimensions(source, 1920, 1080)

    assert.deepEqual(efficient, { x: 853, y: 480 })
    assert.deepEqual(quality, { x: 1920, y: 1080 })
    assert.ok(Math.abs(efficient.x / efficient.y - source.x / source.y) < 0.003)
})

test("efficiency mode bounds 4K camera, mask, and extra-video preview memory", async () => {
    const source = { x: 3840, y: 2160 }
    const profile = resolvePerformanceProfile(PERFORMANCE_MODE_EFFICIENCY)
    const texture = getPreviewTextureDimensions(
        source,
        profile.previewMaxWidth,
        profile.previewMaxHeight
    )

    assert.deepEqual(texture, { x: 853, y: 480 })

    // Camera frame + camera mask + one extra-video frame, at four bytes/pixel.
    const previewBytes = texture.x * texture.y * 4 * 3
    const nativeBytes = source.x * source.y * 4 * 3
    assert.ok(previewBytes < 5 * 1024 * 1024)
    assert.ok(nativeBytes / previewBytes > 20)

    const [previewSceneSource, cameraSource, extraVideoSource, managerSource] = await Promise.all([
        readFile(new URL("../app/shared/scene/PreviewScene.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/scene/Camera.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/scene/ExtraVideo.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/workers/PreviewWorkerManager.js", import.meta.url), "utf8"),
    ])

    assert.match(previewSceneSource, /initCameraVideo\(dims, content = null\)/)
    assert.match(previewSceneSource, /initExtraVideo\(index, dims\)/)
    assert.match(previewSceneSource, /this\.camera\.setTextureDimensions\(getPreviewTextureDimensions/)
    assert.match(previewSceneSource, /extraVideo\.setTextureDimensions\(getPreviewTextureDimensions/)
    assert.match(cameraSource, /new OffscreenCanvas\(textureDims\.x, textureDims\.y\)/)
    assert.match(cameraSource, /this\.fgMaskCanvas\.width,\s*this\.fgMaskCanvas\.height/s)
    assert.match(cameraSource, /this\.bg\.pivot\.x = this\.isMirrored \? this\.canvas\.width : 0/)
    assert.match(extraVideoSource, /this\.sprite\.width = this\.dims\.x/)
    assert.match(extraVideoSource, /this\.sprite\.height = this\.dims\.y/)
    assert.match(managerSource, /refreshPausedFrames\(\)/)
    assert.match(managerSource, /this\.postFrame\(`extra-\$\{index\}`/)
})

test("render scenes keep camera and extra-video backing surfaces at native resolution", async () => {
    const [sceneSource, renderSceneSource, renderWorkerSource] = await Promise.all([
        readFile(new URL("../app/shared/scene/Scene.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/scene/RenderScene.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/workers/renderWorker.js", import.meta.url), "utf8"),
    ])

    assert.match(sceneSource, /initCameraVideo\(dims, content = null, textureDims = dims\)/)
    assert.match(sceneSource, /initExtraVideo\(index, dims, textureDims = dims\)/)
    assert.match(renderWorkerSource, /this\.scene\.initCameraVideo\(cameraVideoDimensions\)/)
    assert.doesNotMatch(renderSceneSource, /getPreviewTextureDimensions|previewMaxWidth|previewMaxHeight/)
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

test("export decoding uses one continuous bounded native-resolution canvas stream", async () => {
    const pooledCanvas = { id: "reused-canvas" }
    const decodedFrames = [
        { canvas: pooledCanvas, timestamp: 0 },
        { canvas: pooledCanvas, timestamp: 0 },
        { canvas: pooledCanvas, timestamp: 1 / 30 },
    ]
    let nextCalls = 0
    let returnCalls = 0
    const iterator = {
        async next() {
            const value = decodedFrames[nextCalls++]
            return value ? { value, done: false } : { done: true }
        },
        async return() {
            returnCalls += 1
            return { done: true }
        },
    }
    const cursor = new SequentialCanvasCursor(iterator)

    assert.equal(DECODE_CANVAS_POOL_SIZE, 1)
    assert.equal((await cursor.read(0))?.canvas, pooledCanvas)
    assert.equal(await cursor.read(0), null)
    assert.equal(await cursor.read(1 / 60), null)
    assert.equal((await cursor.read(1 / 30))?.canvas, pooledCanvas)
    assert.equal(nextCalls, 3)

    await cursor.close()
    assert.equal(returnCalls, 1)

    const fourKPoolBytes = 3840 * 2160 * 4 * DECODE_CANVAS_POOL_SIZE
    assert.ok(fourKPoolBytes <= 32 * 1024 * 1024)

    const readerSource = await readFile(
        new URL("../app/shared/workers/WorkerInputReader.js", import.meta.url),
        "utf8"
    )
    assert.match(readerSource, /poolSize:\s*DECODE_CANVAS_POOL_SIZE/)
    assert.match(readerSource, /canvasesAtTimestamps\(this\.timestamps\)/)
    assert.match(readerSource, /this\.input\?\.dispose\(\)/)
    assert.doesNotMatch(readerSource, /new CanvasSink\(track,\s*\{[^}]*\b(?:width|height|fit)\s*:/s)
})

test("freeze-frame timestamps keep the sequential export decoder aligned", async () => {
    // createSink receives one entry per scheduled output frame. The render
    // setup reads the first entry once before the loop revisits it, while the
    // second scheduled zero is a real freeze-frame output.
    const scheduledTimestamps = [0, 0, 1]
    const sinkTimestamps = dedupeSequentialTimestamps(scheduledTimestamps)
    assert.deepEqual(sinkTimestamps, [0, 1])
    assert.deepEqual(dedupeSequentialTimestamps([0, 0, 0, 1]), [0, 1])
    assert.deepEqual(dedupeSequentialTimestamps([0, 0, 1, 0, 0]), [0, 1, 0])

    const decodedFrames = sinkTimestamps.map(timestamp => ({
        canvas: { timestamp },
        timestamp,
    }))
    let nextCalls = 0
    const cursor = new SequentialCanvasCursor({
        async next() {
            const value = decodedFrames[nextCalls++]
            return value ? { value, done: false } : { done: true }
        },
    })

    assert.equal((await cursor.read(scheduledTimestamps[0]))?.timestamp, 0) // setup
    assert.equal(await cursor.read(scheduledTimestamps[0]), null) // first render loop frame
    assert.equal(await cursor.read(scheduledTimestamps[1]), null) // held freeze frame
    assert.equal((await cursor.read(scheduledTimestamps[2]))?.timestamp, 1)
    assert.equal(nextCalls, 2)
})

test("balanced preview rendering and Redux publication share a 30fps cadence", async () => {
    assert.equal(BALANCED_EDITOR_FPS, 30)
    assert.equal(BALANCED_EDITOR_FRAME_INTERVAL_MS, 33)
    assert.ok(1000 / BALANCED_EDITOR_FRAME_INTERVAL_MS < 31)

    const [workerSource, clockSource] = await Promise.all([
        readFile(new URL("../app/shared/workers/previewWorker.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/editor/playbackClock.js", import.meta.url), "utf8"),
    ])

    assert.match(workerSource, /MIN_RENDER_INTERVAL = BALANCED_EDITOR_FRAME_INTERVAL_MS/)
    assert.match(workerSource, /this\.minRenderInterval = Number\(previewProfile\.previewFps\)/)
    assert.match(workerSource, /new PreviewScene\(args\.previewProfile\)/)
    assert.match(clockSource, /MIN_PLAYBACK_PUBLISH_DELTA_MS = BALANCED_EDITOR_FRAME_INTERVAL_MS/)
})

test("preview frame transfer obeys the adaptive cadence and skips hidden extra videos", async () => {
    const [managerSource, workerSource, sceneSource, screenSource, previewSource] = await Promise.all([
        readFile(new URL("../app/shared/workers/PreviewWorkerManager.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/workers/previewWorker.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/scene/PreviewScene.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/scene/Screen.js", import.meta.url), "utf8"),
        readFile(new URL("../app/windows/main/components/Preview.jsx", import.meta.url), "utf8"),
    ])

    assert.match(managerSource, /this\.previewFrameIntervalMs = 1000 \/ previewFps/)
    assert.match(managerSource, /const isFrameDue = !this\.isPlaying/)
    assert.match(managerSource, /slot\.isVisible && isFrameDue && !slot\.isPending/)
    assert.match(managerSource, /slot\.isVisible = Boolean\(visible\)/)
    assert.match(managerSource, /setPerformanceProfile\(performanceProfile/)
    assert.match(workerSource, /preview\.performanceProfile/)
    assert.match(sceneSource, /setPerformanceProfile\(previewProfile/)
    assert.match(screenSource, /setTextureDimensions\(textureDims\)/)
    assert.match(previewSource, /manager\?\.setPerformanceProfile\(performanceProfile\)/)
})
