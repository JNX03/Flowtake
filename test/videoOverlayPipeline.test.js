import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")

const [
    overlayCanvas,
    overlayAnimator,
    renderWorker,
    workerInputReader,
    constants,
    rustFiles,
    rustProjects,
    overlayInspector,
    timelineLaneInsert,
] = await Promise.all([
    read("app/windows/main/components/OverlayCanvas.jsx"),
    read("app/shared/scene/overlay/OverlayAnimator.js"),
    read("app/shared/workers/renderWorker.js"),
    read("app/shared/workers/WorkerInputReader.js"),
    read("app/shared/constants.js"),
    read("src-tauri/src/commands/files.rs"),
    read("src-tauri/src/commands/projects.rs"),
    read("app/windows/main/components/properties/OverlaySection.jsx"),
    read("app/shared/editor/timelineLaneInsert.js"),
])

test("canvas drops persist video identity and relative media path without an absolute path", () => {
    assert.match(overlayCanvas, /createOverlayLaneItem\(\{/)
    assert.match(overlayCanvas, /asset: \{\s*\.\.\.data,/)
    assert.match(timelineLaneInsert, /createTimelineMediaReference\(asset\)/)
    assert.match(overlayCanvas, /sourceDuration/)
    assert.match(overlayCanvas, /clampVideoOverlayEnd/)
    assert.doesNotMatch(overlayCanvas, /overlayType: "video"[^}]+absolutePath/s)
})

test("live preview uses a real video element synchronized to editor source time", () => {
    assert.match(overlayCanvas, /function VideoOverlayPreview/)
    assert.match(overlayCanvas, /getVideoOverlaySourceTime\(overlay, editorTime\)/)
    assert.match(overlayCanvas, /video\.currentTime = targetTime/)
    assert.match(overlayCanvas, /video\.playbackRate = playbackRate/)
    assert.match(overlayCanvas, /video\.play\(\)\.catch/)
    assert.match(overlayCanvas, /<video/)
    assert.match(overlayCanvas, /mediaAsset\?\.src \|\| overlay\.src \|\| null/)
})

test("video inspector exposes real timing controls through the shared clamp helper", () => {
    assert.match(overlayInspector, /firstSelected\.overlayType === "video"/)
    assert.match(overlayInspector, /Playback Speed/)
    assert.match(overlayInspector, /Source Start/)
    assert.match(overlayInspector, /Loop video/)
    assert.match(overlayInspector, /updateVideoSettings/)
    assert.match(overlayInspector, /clampVideoOverlayEnd/)
    assert.match(overlayInspector, /getGroup\("overlay-property"\)/)
})

test("Pixi animator accepts decoded video frames through an owned canvas texture", () => {
    assert.match(overlayAnimator, /config\.overlayType === "video"/)
    assert.match(overlayAnimator, /new CanvasSource\(\{ resource: canvas \}\)/)
    assert.match(overlayAnimator, /setVideoFrame\(id, content\)/)
    assert.match(overlayAnimator, /surface\.context\.drawImage/)
    assert.match(overlayAnimator, /surface\.texture\.source\.update\(\)/)
})

test("render worker decodes overlay-local timestamps with existing readers and closes handles", () => {
    assert.match(constants, /export const PROJECT_MEDIA = 'projectMedia'/)
    assert.match(workerInputReader, /sourceTimestamp \?\? rendererTimestamp/)
    assert.match(renderWorker, /new WorkerInputReader\(PROJECT_MEDIA/)
    assert.match(renderWorker, /relativePath: config\.relativePath/)
    assert.match(renderWorker, /createVideoOverlaySourceTimestamps\(config, this\.timestamps\)/)
    assert.match(renderWorker, /this\.scene\.overlayAnimator\?\.setVideoFrame/)
    assert.match(renderWorker, /for \(const reader of this\.videoOverlayReaders\.values\(\)\) await reader\.close\(\)/)
})

test("projectMedia handles are read-only and resolve through canonical containment", () => {
    assert.match(rustFiles, /if r#type == "projectMedia"/)
    assert.match(rustFiles, /if flag != "r"/)
    assert.match(rustFiles, /value\.get\("relativePath"\)/)
    assert.match(rustFiles, /open_project_media_file_for_read/)
    assert.match(rustProjects, /pub\(crate\) fn open_project_media_file_for_read/)
    assert.match(rustProjects, /with_project_media_io\(\|\|/)
    assert.match(rustProjects, /canonical_candidate\.starts_with\(&assets_dir\)/)
    assert.match(rustProjects, /canonical_candidate\.metadata\(\)\?\.is_file\(\)/)
    assert.match(rustProjects, /contained_media_handles_reject_traversal_and_can_be_reopened/)
    assert.match(rustProjects, /contained_media_resolution_rejects_symlinks_that_escape_assets/)
})
