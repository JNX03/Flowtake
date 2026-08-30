import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
    buildRenderDiagnostic,
    sanitizeRenderError,
} from "../app/shared/renderDiagnostics.js"

test("render diagnostics redact local paths and credential-like values", () => {
    const sanitized = sanitizeRenderError(
        "Failed C:\\Users\\Jane\\Videos\\clip.mp4 token=super-secret"
    )

    assert.doesNotMatch(sanitized, /Jane/)
    assert.doesNotMatch(sanitized, /super-secret/)
    assert.match(sanitized, /\[local path\]/)
    assert.match(sanitized, /token=\[redacted\]/i)
})

test("render diagnostic includes export settings without project paths", () => {
    const diagnostic = buildRenderDiagnostic({
        status: "render-canceled",
        config: {
            resolution: { x: 1920, y: 1080 },
            fps: 30,
            quality: "high",
            includeAudio: false,
        },
        error: "Encoder failed",
    })

    assert.match(diagnostic, /1920x1080/)
    assert.match(diagnostic, /30 FPS/)
    assert.match(diagnostic, /Audio: excluded/)
    assert.match(diagnostic, /Encoder failed/)
})

test("export form and worker honor the explicit audio policy", async () => {
    const [
        formSource,
        workerSource,
        managerSource,
        rowSource,
        bridgeSource,
        rustSource,
        exportButtonSource,
        exporterAppSource,
    ] = await Promise.all([
        readFile(new URL("../app/windows/exporter/components/form/NewRenderForm.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/workers/renderWorker.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/workers/RenderWorkerManager.js", import.meta.url), "utf8"),
        readFile(new URL("../app/windows/exporter/components/queue/Row.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/tauriBridge.js", import.meta.url), "utf8"),
        readFile(new URL("../src-tauri/src/commands/exporter.rs", import.meta.url), "utf8"),
        readFile(new URL("../app/windows/main/components/ExportButton.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/windows/exporter/App.jsx", import.meta.url), "utf8"),
    ])

    assert.match(formSource, /Include audio/)
    assert.match(formSource, /includeAudio: hasProjectAudio && includeAudio/)
    assert.match(workerSource, /render\.config\?\.includeAudio !== false/)
    assert.match(workerSource, /buildAudioPlan/)
    assert.match(workerSource, /systemAudioVolume/)
    assert.match(workerSource, /microphoneAudioVolume/)
    assert.match(workerSource, /postIpc\("process-audio", \[this\.render\.id, buildAudioPlan\(this\.render\)\]\)/)
    assert.match(workerSource, /if \(hasIncludedAudio\(this\.render\)\) \{/)
    assert.match(bridgeSource, /audioPlan: args\[1\]/)
    assert.match(rustSource, /fn build_audio_filter/)
    assert.match(rustSource, /amix=inputs=2/)
    assert.match(rustSource, /concat=n=/)
    assert.match(rustSource, /run_export_ffmpeg\(&ffmpeg, &args, "audio muxing"\)/)
    assert.match(managerSource, /sanitizeRenderError/)
    assert.match(managerSource, /error: safeMessage/)
    assert.match(rowSource, /Copy export diagnostic/)
    assert.match(rowSource, /buildRenderDiagnostic\(render\)/)
    assert.match(rowSource, /removeListener\(['"]upload-progress['"]/)
    assert.match(formSource, /const isExportReady =/)
    assert.match(formSource, /DEFAULT_EXPORT_FPS = 60/)
    assert.match(formSource, /DEFAULT_EXPORT_QUALITY = "high"/)
    assert.match(formSource, /DEFAULT_EXPORT_RESOLUTION_BY_ASPECT/)
    assert.match(formSource, /QUALITY_OPTIONS\.includes\(stored\) \? stored : DEFAULT_EXPORT_QUALITY/)
    assert.match(formSource, /FPS_OPTIONS\.includes\(stored\) \? stored : DEFAULT_EXPORT_FPS/)
    assert.match(formSource, /&& !isPendingSetResolutionString/)
    assert.match(formSource, /disabled=\{!isExportReady \|\| isInitializing\}/)
    assert.match(exportButtonSource, /data-export-primary/)
    assert.match(exportButtonSource, /role="dialog"/)
    assert.match(exportButtonSource, /removeListener\("render-queue-progress"/)
    assert.match(exporterAppSource, /removeListener\(['"]open-section['"]/)
    assert.match(exporterAppSource, /removeListener\(['"]clear-pending-renders['"]/)
    assert.match(exporterAppSource, /removeListener\(['"]cancel-running-render['"]/)
    assert.match(rustSource, /emit_to\("main", "render-queue-progress", progress\)/)
    assert.match(rustSource, /emit_to\("main", "has-exports", has_renders\)/)
})
