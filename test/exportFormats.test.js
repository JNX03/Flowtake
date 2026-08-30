import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
    assertExportCodecSupport,
    getExportFormatConfig,
    resolveExportFormat,
} from "../app/shared/exportFormats.js"

test("legacy renders default to MP4 while WebM selects VP9 and Opus", () => {
    assert.equal(resolveExportFormat(undefined), "mp4")
    assert.deepEqual(
        {
            extension: getExportFormatConfig(null).extension,
            videoCodec: getExportFormatConfig(null).videoCodec,
            audioCodec: getExportFormatConfig(null).audioCodec,
        },
        { extension: "mp4", videoCodec: "avc", audioCodec: "aac" }
    )
    assert.deepEqual(
        {
            extension: getExportFormatConfig("webm").extension,
            videoCodec: getExportFormatConfig("webm").videoCodec,
            audioCodec: getExportFormatConfig("webm").audioCodec,
        },
        { extension: "webm", videoCodec: "vp9", audioCodec: "opus" }
    )
})

test("arbitrary export formats and path-shaped extensions are rejected", () => {
    assert.throws(() => resolveExportFormat("mkv"), /Choose MP4 or WebM/)
    assert.throws(() => resolveExportFormat("../webm"), /Choose MP4 or WebM/)
})

test("codec preflight uses the selected codec and gives a clear failure", async () => {
    const calls = []
    const config = await assertExportCodecSupport(
        "webm",
        { x: 1920, y: 1080 },
        async (codec, options) => {
            calls.push({ codec, options })
            return true
        }
    )

    assert.equal(config.value, "webm")
    assert.deepEqual(calls, [{ codec: "vp9", options: { width: 1920, height: 1080 } }])

    await assert.rejects(
        assertExportCodecSupport("webm", { x: 1920, y: 1080 }, async () => false),
        /WebM export requires VP9 encoding/
    )
})

test("format choice is wired through form, worker output, native mux, and upload MIME", async () => {
    const [form, manager, worker, writer, files, exporter, socialUpload] = await Promise.all([
        readFile(new URL("../app/windows/exporter/components/form/NewRenderForm.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/workers/RenderWorkerManager.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/workers/renderWorker.js", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/workers/WorkerOutputWriter.js", import.meta.url), "utf8"),
        readFile(new URL("../src-tauri/src/commands/files.rs", import.meta.url), "utf8"),
        readFile(new URL("../src-tauri/src/commands/exporter.rs", import.meta.url), "utf8"),
        readFile(new URL("../src-tauri/src/commands/social_upload.rs", import.meta.url), "utf8"),
    ])

    assert.match(form, /EXPORT_FORMAT_OPTIONS/)
    assert.match(form, /format,/)
    assert.match(form, /includeAudio: hasProjectAudio/)
    assert.match(form, /assertExportCodecSupport\(format, resolution, canEncodeVideo\)/)
    assert.match(manager, /assertExportCodecSupport/)
    assert.match(worker, /WebMOutputFormat/)
    assert.match(worker, /format: exportFormat\.value/)
    assert.match(worker, /extension: exportFormat\.extension/)
    assert.match(writer, /codec: this\.codec/)
    assert.match(files, /Render output format does not match the queued render/)
    assert.match(files, /Custom render output paths are not allowed/)
    assert.match(exporter, /render_format\.audio_encoder\(\)/)
    assert.match(exporter, /render\.format\.output_file_name\(\)/)
    assert.match(socialUpload, /render\.format\.mime_type\(\)/)
    assert.match(worker, /hasIncludedAudio/)
    assert.match(worker, /buildAudioPlan/)
    assert.match(worker, /videoOverlayReaders/)
})
