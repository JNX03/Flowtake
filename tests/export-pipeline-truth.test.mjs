import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import {
    extractExportCopyLiterals,
    findExportTruthViolations,
} from "../website/scripts/export-truth-guard.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const readRepoFile = file => readFile(path.join(repoRoot, file), "utf8")

const publicTruthFiles = [
    "README.md",
    "SECURITY.md",
    "docs/ARCHITECTURE.md",
    "docs/architecture/README.md",
    "docs/architecture/video-pipeline.md",
    "docs/features/README.md",
    "docs/features/export.md",
    "website/src/HomePage.jsx",
    "website/developer-tool-demo-storyboard/index.html",
]

function commandBody(source, name) {
    const start = source.indexOf(`pub async fn ${name}`)
    assert.notEqual(start, -1, `missing ${name}`)
    const end = source.indexOf("#[tauri::command]", start)
    return source.slice(start, end === -1 ? source.length : end)
}

function assertNoFinalFfmpegClaims(source, label) {
    const violations = findExportTruthViolations(source)
        .filter(({ kind }) => kind === "final-ffmpeg")
    assert.deepEqual(violations, [], `${label} assigns final edited export to FFmpeg`)
}

function assertNoUnsupportedExportClaims(source, label) {
    assert.deepEqual(findExportTruthViolations(source), [], `${label} contains a false export claim`)
}

function assertPositiveMediabunnyRole(source, label) {
    const truthfulLine = source.split(/\r?\n/u).find(line => {
        const normalized = line.toLowerCase()
        return ["mediabunny", "avc", "mp4"].every(required => normalized.includes(required))
            && (normalized.includes("encod") || normalized.includes("mux"))
    })
    assert.ok(
        truthfulLine,
        `${label} must relate Mediabunny, AVC, MP4, and the encoding or muxing role on one line`,
    )
    const reversedRole = /\bmediabunny\b.{0,80}\b(?:does\s+not|doesn't|cannot|can't|is\s+unable\s+to)\s+(?:currently\s+)?\b(?:encod|mux)\w*|\bmediabunny\b.{0,80}\bonly\s+decodes\b.{0,80}\bnever\b.{0,40}\b(?:encod|mux)\w*|\bmediabunny\b.{0,80}\bis\s+not\b.{0,40}\bencoder\b|\bmediabunny\b.{0,80}\b(?:encod|mux)\w*.{0,60}\b(?:neither\b.{0,30}\bavc\b.{0,30}\bmp4\b|not\b.{0,30}\bmp4\b)|\b(?:not|never)\b.{0,40}\b(?:encod|mux)\w*.{0,80}\b(?:by|with|through)\s+mediabunny\b/iu
    assert.doesNotMatch(
        truthfulLine,
        reversedRole,
        `${label} reverses the Mediabunny final-export role`,
    )
    const forwardRole = /\bmediabunny\b.{0,160}\b(?:encod|mux)\w*/iu
    const passiveRole = /\b(?:encod|mux)\w*.{0,80}\b(?:by|with|through)\s+mediabunny\b/iu
    assert.ok(
        forwardRole.test(truthfulLine) || passiveRole.test(truthfulLine),
        `${label} must positively assign AVC MP4 encoding or muxing to Mediabunny`,
    )
}

function assertAudioCommandNoop(source, command) {
    const expected = `pub async fn ${command}(app: AppHandle, render_id: String) -> AppResult<()> { let state = app.state::<Mutex<AppState>>(); let state = state.lock().unwrap(); let _render = state .renders .get(&render_id) .ok_or_else(|| AppError::General(format!("Render not found: {}", render_id)))?; Ok(()) }`
    assert.equal(source.replace(/\s+/gu, " ").trim(), expected)
}

test("final edited export implementation is Mediabunny AVC MP4", async () => {
    const [renderWorker, outputWriter, exporter, exportForm] = await Promise.all([
        readRepoFile("app/shared/workers/renderWorker.js"),
        readRepoFile("app/shared/workers/WorkerOutputWriter.js"),
        readRepoFile("src-tauri/src/commands/exporter.rs"),
        readRepoFile("app/windows/exporter/components/form/NewRenderForm.jsx"),
    ])

    assert.match(renderWorker, /import\s*\{\s*Mp4OutputFormat\s*\}\s*from\s*["']mediabunny["']/)
    assert.match(renderWorker, /new WorkerOutputWriter\([\s\S]*?Mp4OutputFormat/)
    assert.match(outputWriter, /new VideoSampleSource\(\{\s*codec:\s*['"]avc['"]/)
    assert.match(outputWriter, /this\.output\.addVideoTrack\(this\.videoSampleSource/)
    assert.doesNotMatch(outputWriter, /\b(?:addAudioTrack|AudioSampleSource)\b/)
    assert.match(exporter, /render\.temp_dir\.join\("output\.mp4"\)/)
    assert.match(exporter, /render\.output_path\.clone\(\)/)
    assert.match(exporter, /std::fs::copy\(&source, &dest\)/)
    const configFields = exportForm
        .match(/config:\s*\{([^}]+)\}/u)?.[1]
        .split(",")
        .map(field => field.trim())
        .filter(Boolean)
        .sort()
    assert.deepEqual(configFields, ["aspectRatio", "fps", "quality", "resolution"])
    assert.match(exportForm, /\{\[60, 30\]\.map\(fpsOption/)
    assert.match(exportForm, />MP4</)
    assert.match(exportForm, />\s*Export\s*<ArrowRightIcon/)
    assert.doesNotMatch(exportForm, /config: \{[^}]*\b(?:format|codec|encoder|bitrate|audio)\b/)

    for (const command of ["process_audio", "add_audio"]) {
        const body = commandBody(exporter, command)
        assertAudioCommandNoop(body, command)
        assert.throws(
            () => assertAudioCommandNoop(
                body.replace("Ok(())", "audio_pipeline::attach(&_render).await?; Ok(())"),
                command,
            ),
            assert.AssertionError,
        )
    }
})

test("public copy states the current Mediabunny AVC MP4 boundary", async () => {
    const entries = await Promise.all(
        publicTruthFiles.map(async file => [file, await readRepoFile(file)]),
    )

    for (const [file, source] of entries) {
        assertPositiveMediabunnyRole(source, file)
        assertNoFinalFfmpegClaims(source, file)
    }

    for (const file of [
        "README.md",
        "docs/features/export.md",
        "website/src/HomePage.jsx",
        "website/developer-tool-demo-storyboard/index.html",
    ]) {
        const source = entries.find(([candidate]) => candidate === file)[1]
        assert.match(source, /\blocal(?:ly)?\b|on your machine/iu, `${file} must preserve local export`)
    }
})

test("export copy exposes only implemented output and audio behavior", async () => {
    const [readme, exportDoc, pipeline, homepage, storyboard, comparison] = await Promise.all([
        readRepoFile("README.md"),
        readRepoFile("docs/features/export.md"),
        readRepoFile("docs/architecture/video-pipeline.md"),
        readRepoFile("website/src/HomePage.jsx"),
        readRepoFile("website/developer-tool-demo-storyboard/index.html"),
        readRepoFile("website/screen-studio-alternative-windows/index.html"),
    ])
    const readmeExport = readme.slice(readme.indexOf("### Export"), readme.indexOf("## Privacy"))
    const pipelineExport = pipeline.slice(pipeline.indexOf("## 3. Export"))
    const homepageCopy = extractExportCopyLiterals(homepage).join("\n")
    const comparisonFlowtakeCopy = [
        comparison.match(/<th scope="row">Export<\/th>\s*<td>([\s\S]*?)<\/td>/u)?.[1],
        comparison.match(/<p class="comparison-card-label">Export<\/p>[\s\S]*?<p>([\s\S]*?)<\/p>/u)?.[1],
    ].filter(Boolean).join("\n")
    const storyboardExportCopy = [
        storyboard.match(/<h3>Export locally<\/h3>\s*<p class="storyboard-caption">([\s\S]*?)<\/p>/u)?.[1],
        storyboard.match(/<h3>Record and edit on the published app\.<\/h3>\s*<ul>([\s\S]*?)<\/ul>/u)?.[1],
    ].filter(Boolean).join("\n")
    const exportCopy = [readmeExport, exportDoc, pipelineExport, homepageCopy, storyboardExportCopy].join("\n")

    assertNoUnsupportedExportClaims(exportCopy, "tracked export copy")
    assertNoUnsupportedExportClaims(comparisonFlowtakeCopy, "comparison Flowtake copy")
    assert.doesNotMatch(exportCopy, /\b24\s*fps\b|custom resolution|CRF-based|fixed bitrate|estimated time|final file size/iu)

    assert.match(readmeExport, /video-only edited export/iu)
    assert.match(exportDoc, /edited MP4 is video-only/iu)
    assert.match(exportDoc, /click \*\*Export\*\*/u)
    assert.doesNotMatch(exportDoc, /click \*\*Render\*\*/u)
    assert.match(pipelineExport, /no microphone, system, or timeline audio track is muxed/iu)
    assert.match(homepage, /current edited export is video-only/iu)
    assert.match(storyboard, /edited MP4 currently has no muxed audio/iu)
    assert.match(comparison, /current edited output is video-only/iu)
})

test("truth guards reject paraphrased claims and allow explicit limitations", () => {
    for (const falseClaim of [
        "Export WebM with AV1.",
        "Choose a hardware encoder for the final export.",
        "Audio tracks are muxed into every finished export.",
        "FFmpeg is responsible for final MP4 encoding.",
        "| **Video Encoding** | [FFmpeg](https://ffmpeg.org/) |",
        "FFmpeg is not the final encoder, but FFmpeg renders the final MP4.",
        "The final export has no format selector, but users can choose a hardware encoder.",
        "The finished export has no audio by default, but audio is included when enabled.",
        "The final export has audio.",
        "Export audio with the finished MP4.",
        "Audio tracks are exported in the final MP4.",
        "Encoder settings are available for the final export.",
        "FFmpeg is not the final encoder, but it renders the final MP4.",
        "The final export has no audio by default, but it is included when enabled.",
        "There is no format selector, but users can choose one for the final export.",
        "Although FFmpeg is not the final encoder, it renders the final MP4.",
        "Export H.265 video.",
        "Export H.265/HEVC video.",
        "Choose H.265 for the final MP4.",
        "Export MKV.",
        "The final exporter writes MOV.",
        "Choose AVI output.",
        "The finished export is GIF.",
        "Export MPEG-TS.",
        "# Export\n| **Encoder** | Software (x264/x265) or hardware (NVENC, VideoToolbox) |",
        "# Export\n- Choose an encoder",
        "# Export\n| Format | H.265/HEVC |",
        "# Export\n## Output formats\n| Format | H.265/HEVC |",
        "FFmpeg handles capture and encoding.",
        "FFmpeg is not the final encoder, although it renders the final MP4.",
        "The final export has no audio; it is included when enabled.",
        "There is no format selector; users can switch it for the final export.",
        "Export .webm.",
        "The final output is .mkv.",
        "The final export has a soundtrack.",
        "Narration is included in the final MP4.",
        "# Export\nAudio: yes.",
        "The final MP4 has no audio except narration.",
        "The final MP4 has no audio; enable it for narration.",
        "Choose a container for the final export.",
        "Switch the output profile.",
        "Set the final export encoder.",
        "The final export has no audio. Enable it for the final MP4.",
        "The final MP4 preserves narration.",
        "Switch codecs for the final export.",
        "Pick the H.264 profile for the final export.",
        "Export QuickTime.",
        "Export Matroska.",
    ]) {
        assert.throws(
            () => assertNoUnsupportedExportClaims(falseClaim, "synthetic false claim"),
            assert.AssertionError,
        )
    }

    for (const limitation of [
        "The edited MP4 has no muxed audio. The export window does not expose a format or encoder selector.",
        "FFmpeg is not the final edited-MP4 encoder.",
        "The final MP4 is not encoded by FFmpeg.",
        "The exporter does not support WebM.",
        "WebM is not supported by the final exporter.",
        "The final export has no audio.",
        "The final export does not include audio.",
        "FFmpeg handles capture while Mediabunny encodes the final MP4.",
        "FFmpeg handles recording capture and Mediabunny encodes the final MP4.",
        "Although FFmpeg handles capture, Mediabunny encodes the final MP4.",
        "The exporter doesn't support WebM.",
        "We do not export WebM.",
        "Final exports exclude WebM.",
        "We never use FFmpeg for final exports.",
        "Format selection is unavailable in the exporter.",
        "AVC MP4 is encoded with Mediabunny.",
        "AVC MP4 is encoded through Mediabunny.",
        "Mediabunny does not handle capture; it encodes and muxes the final AVC MP4.",
    ]) {
        assert.doesNotThrow(() => assertNoUnsupportedExportClaims(
            limitation,
            "synthetic limitation",
        ))
    }

    const builtRuntime = [
        'const falseCopy = "Export WebM with AV1.";',
        'const realMedia = "/Flowtake/media/flowtake-feature-export.webm";',
        'const limitation = "The exporter does not support WebM.";',
    ].join("\n")
    assert.deepEqual(extractExportCopyLiterals(builtRuntime), [
        "Export WebM with AV1.",
        "The exporter does not support WebM.",
    ])

    for (const reversedRole of [
        "Mediabunny does not encode the final AVC MP4.",
        "Mediabunny only decodes frames and never encodes the final AVC MP4.",
        "The final edited output is an AVC MP4, but Mediabunny is not the encoder.",
        "Mediabunny cannot encode the final AVC MP4.",
        "Mediabunny can't encode the final AVC MP4.",
        "Mediabunny is unable to encode the final AVC MP4.",
        "Mediabunny encodes neither AVC nor MP4.",
        "Mediabunny encodes AVC but not MP4.",
    ]) {
        assert.throws(
            () => assertPositiveMediabunnyRole(reversedRole, "synthetic reversed role"),
            assert.AssertionError,
        )
    }
})
