import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")

const [videoWrapper, renderWorker, scene, audioExporter] = await Promise.all([
    read("app/windows/main/components/VideoWrapper.jsx"),
    read("app/shared/workers/renderWorker.js"),
    read("app/shared/scene/Scene.js"),
    read("src-tauri/src/commands/exporter.rs"),
])

test("preview advances through gaps without jumping to the next clip", () => {
    assert.match(videoWrapper, /kind:\s*"gap"/)
    assert.match(videoWrapper, /timelineClock\.timelineStart \+ \(now - timelineClock\.startedAt\)/)
    assert.match(videoWrapper, /mediaTimeToClipTimelineMs\(activeClip,\s*video\.currentTime\)/)
    assert.doesNotMatch(videoWrapper, /nextTime\s*=\s*nextClip\.start/)
})

test("render keeps timeline and media clocks separate and gates only source layers", () => {
    assert.match(renderWorker, /sourceTimestamp:\s*timestamp\.sourceTimestamp === null/)
    assert.match(renderWorker, /sceneTimestamp:\s*Math\.round\(timestamp\.timelineTimestamp\)/)
    assert.match(renderWorker, /this\.scene\.time = timestamp\.sceneTimestamp/)
    assert.match(renderWorker, /setPrimaryMediaVisible\(!timestamp\.isGap\)/)
    assert.match(scene, /setPrimaryMediaRenderGate\(this,\s*visible\)/)
})

test("audio export inserts silence for timeline gaps and freeze holds", () => {
    assert.match(audioExporter, /anullsrc=channel_layout=stereo:sample_rate=48000/)
    assert.match(audioExporter, /clip\.start > timeline_cursor/)
    assert.match(audioExporter, /clip\.playback_rate == 0\.0/)
    assert.match(audioExporter, /source_start/)
    assert.match(audioExporter, /source_end/)
})
