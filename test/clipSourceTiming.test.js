import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("clip config persists explicit source bounds with a legacy timeline fallback", async () => {
    const clipConfigSource = await readFile(new URL(
        "../app/shared/scene/clip/ClipConfig.js",
        import.meta.url
    ), "utf8")

    assert.match(clipConfigSource, /args\.sourceStart \?\? args\.start/)
    assert.match(
        clipConfigSource,
        /args\.sourceEnd \?\? \(this\.sourceStart \+ args\.end - args\.start\)/
    )
})

test("both direct drag edits and the legacy context split use source-aware timing", async () => {
    const [clipSource, helpersSource] = await Promise.all([
        readFile(new URL(
            "../app/windows/main/components/timeline/Clip.jsx",
            import.meta.url
        ), "utf8"),
        readFile(new URL("../app/shared/helpers.js", import.meta.url), "utf8"),
    ])

    assert.match(clipSource, /resolveClipTimingChange\(anim,\s*start,\s*end\)/)
    assert.match(helpersSource, /Class === _configs\.ClipConfig/)
    assert.match(helpersSource, /getClipSplitTiming\(config,\s*time\)/)
    assert.match(helpersSource, /sourceEnd:\s*clipTiming\.left\.sourceEnd/)
    assert.match(helpersSource, /newConfig\.sourceStart = clipTiming\.right\.sourceStart/)
})
