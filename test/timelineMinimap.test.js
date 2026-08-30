import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
    buildTimelineMinimapSegments,
    formatMinimapViewportRange,
    getMinimapScrollLeftFromKeyboard,
    getMinimapScrollLeftFromPointer,
    getTimelineMinimapGeometry,
} from "../app/shared/editor/timelineMinimap.js"

const minimapSource = await readFile(
    new URL("../app/windows/main/components/timeline/Minimap.jsx", import.meta.url),
    "utf8"
)

test("viewport geometry follows DOM scroll dimensions and clamps both edges", () => {
    const geometry = getTimelineMinimapGeometry({
        duration: 10000,
        pxPerMs: 0.1,
        clientWidth: 250,
        scrollWidth: 1000,
        scrollLeft: 900,
    })

    assert.equal(geometry.scrollLeft, 750)
    assert.equal(geometry.maxScrollLeft, 750)
    assert.equal(geometry.viewportWidthRatio, 0.25)
    assert.equal(geometry.viewportLeftRatio, 0.75)
    assert.equal(geometry.startMs, 7500)
    assert.equal(geometry.endMs, 10000)
})

test("a fitted timeline exposes a full-width, stationary viewport", () => {
    const geometry = getTimelineMinimapGeometry({
        duration: 5000,
        pxPerMs: 0.1,
        clientWidth: 800,
        scrollWidth: 500,
        scrollLeft: 100,
    })

    assert.equal(geometry.scrollWidth, 800)
    assert.equal(geometry.maxScrollLeft, 0)
    assert.equal(geometry.scrollLeft, 0)
    assert.equal(geometry.viewportLeftRatio, 0)
    assert.equal(geometry.viewportWidthRatio, 1)
})

test("pointer mapping preserves click-to-center and viewport grab offsets", () => {
    const common = {
        barLeft: 100,
        barWidth: 400,
        scrollWidth: 2000,
        clientWidth: 500,
    }

    assert.equal(getMinimapScrollLeftFromPointer({
        ...common,
        clientX: 300,
        centerViewport: true,
    }), 750)

    assert.equal(getMinimapScrollLeftFromPointer({
        ...common,
        clientX: 350,
        grabOffsetPx: 25,
    }), 1125)

    assert.equal(getMinimapScrollLeftFromPointer({
        ...common,
        clientX: 1000,
        centerViewport: true,
    }), 1500)
})

test("keyboard scrolling follows horizontal scrollbar conventions", () => {
    const common = {
        scrollLeft: 500,
        scrollWidth: 2000,
        clientWidth: 500,
    }

    assert.equal(getMinimapScrollLeftFromKeyboard({
        ...common,
        key: "ArrowLeft",
    }), 450)
    assert.equal(getMinimapScrollLeftFromKeyboard({
        ...common,
        key: "ArrowRight",
        shiftKey: true,
    }), 700)
    assert.equal(getMinimapScrollLeftFromKeyboard({
        ...common,
        key: "PageDown",
    }), 1000)
    assert.equal(getMinimapScrollLeftFromKeyboard({
        ...common,
        key: "Home",
    }), 0)
    assert.equal(getMinimapScrollLeftFromKeyboard({
        ...common,
        key: "End",
    }), 1500)
    assert.equal(getMinimapScrollLeftFromKeyboard({
        ...common,
        key: "Escape",
    }), null)
})

test("accessible range text is stable for short and long projects", () => {
    assert.equal(formatMinimapViewportRange({
        startMs: 61000,
        endMs: 125000,
    }), "01:01 to 02:05")
    assert.equal(formatMinimapViewportRange({
        startMs: 3661000,
        endMs: 3725000,
    }), "1:01:01 to 1:02:05")
})

test("minimap entity segments merge ranges and stay below a hard DOM cap", () => {
    assert.deepEqual(buildTimelineMinimapSegments([
        { start: 100, end: 250 },
        { start: 200, end: 400 },
        { start: 700, end: 800 },
    ], 1_000), [
        { leftRatio: 0.1, widthRatio: 0.3 },
        { leftRatio: 0.7, widthRatio: 0.1 },
    ])

    const denseEntities = Array.from({ length: 2_000 }, (_, index) => ({
        start: index * 10,
        end: index * 10 + 3,
    }))
    const segments = buildTimelineMinimapSegments(
        denseEntities,
        20_000,
        24
    )
    assert.ok(segments.length <= 24)
    assert.ok(segments.every(segment =>
        segment.leftRatio >= 0
        && segment.widthRatio > 0
        && segment.leftRatio + segment.widthRatio <= 1
    ))
})

test("minimap owns resize, scroll, pointer capture, and accessible scrollbar wiring", () => {
    assert.match(minimapSource, /new ResizeObserver\(scheduleGeometrySync\)/)
    assert.match(minimapSource, /addEventListener\("scroll", scheduleGeometrySync/)
    assert.match(minimapSource, /requestAnimationFrame\(syncGeometry\)/)
    assert.match(minimapSource, /removeEventListener\("scroll", scheduleGeometrySync\)/)
    assert.match(minimapSource, /resizeObserver\?\.disconnect\(\)/)
    assert.match(minimapSource, /setPointerCapture/)
    assert.match(minimapSource, /releasePointerCapture/)
    assert.match(minimapSource, /onPointerCancel/)
    assert.match(minimapSource, /onLostPointerCapture/)
    assert.match(minimapSource, /role="scrollbar"/)
    assert.match(minimapSource, /aria-controls=/)
    assert.match(minimapSource, /aria-valuenow=/)
    assert.match(minimapSource, /getMinimapScrollLeftFromKeyboard/)
    assert.match(minimapSource, /centerViewport: true/)
    assert.match(minimapSource, /buildTimelineMinimapSegments/)
    assert.match(minimapSource, /MAX_SEGMENTS_PER_TYPE/)
    assert.doesNotMatch(minimapSource, /entities\.map/)
    assert.doesNotMatch(minimapSource, /window\.addEventListener\(["']mousemove/)
})
