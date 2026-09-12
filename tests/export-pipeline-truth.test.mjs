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

// CHANGELOG.md intentionally stays outside this current-capability check: its
// v1.6.0 notes describe the historical release boundary, not today's source.
const currentPublicTruthFiles = [
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

function assertNoFalseExportClaims(source, label) {
    assert.deepEqual(
        findExportTruthViolations(source),
        [],
        `${label} contains a false export claim`,
    )
}

function assertPositiveMediabunnyVideoRole(source, label) {
    const truthfulLine = source.split(/\r?\n/u).find(line => {
        const normalized = line.toLowerCase()
        return normalized.includes("mediabunny")
            && ["h.264", "h264", "avc", "vp9", "mp4", "webm"]
                .some(format => normalized.includes(format))
            && (normalized.includes("encod") || normalized.includes("mux"))
    })
    assert.ok(truthfulLine, `${label} must state Mediabunny's encoded-video role`)
    assert.doesNotMatch(
        truthfulLine,
        /\bmediabunny\b.{0,100}\b(?:does\s+not|doesn't|cannot|can't|never|is\s+unable\s+to)\b.{0,60}\b(?:encod|mux)\w*/iu,
        `${label} reverses Mediabunny's encoded-video role`,
    )
}

test("edited export implements local MP4/WebM video plus optional audio", async () => {
    const [renderWorker, outputWriter, exporter, state, exportForm, exportFormats] = await Promise.all([
        readRepoFile("app/shared/workers/renderWorker.js"),
        readRepoFile("app/shared/workers/WorkerOutputWriter.js"),
        readRepoFile("src-tauri/src/commands/exporter.rs"),
        readRepoFile("src-tauri/src/state.rs"),
        readRepoFile("app/windows/exporter/components/form/NewRenderForm.jsx"),
        readRepoFile("app/shared/exportFormats.js"),
    ])

    assert.match(renderWorker, /Mp4OutputFormat[\s\S]*WebMOutputFormat[\s\S]*from\s*["']mediabunny["']/)
    assert.match(renderWorker, /OUTPUT_FORMAT_CLASSES\s*=\s*\{[\s\S]*mp4:\s*Mp4OutputFormat[\s\S]*webm:\s*WebMOutputFormat/)
    assert.match(renderWorker, /new WorkerOutputWriter\([\s\S]*?OUTPUT_FORMAT_CLASSES\[/)
    assert.match(outputWriter, /new VideoSampleSource\(\{\s*codec:\s*this\.codec/)
    assert.match(renderWorker, /exportFormat\.videoCodec/)
    assert.match(outputWriter, /this\.output\.addVideoTrack\(this\.videoSampleSource/)
    assert.doesNotMatch(outputWriter, /\b(?:addAudioTrack|AudioSampleSource)\b/)

    assert.match(exportFormats, /label:\s*"MP4"[\s\S]*videoCodec:\s*"avc"[\s\S]*audioCodec:\s*"aac"/)
    assert.match(exportFormats, /label:\s*"WebM"[\s\S]*videoCodec:\s*"vp9"[\s\S]*audioCodec:\s*"opus"/)
    assert.match(state, /pub enum RenderFormat\s*\{[\s\S]*Mp4,[\s\S]*WebM/)
    assert.match(exporter, /render\.temp_dir\.join\(render\.format\.output_file_name\(\)\)/)
    assert.match(exporter, /render\.output_path\.clone\(\)/)
    assert.match(exporter, /std::fs::copy\(&source, &dest\)/)

    const configFields = exportForm
        .match(/config:\s*\{([^}]+)\}/u)?.[1]
        .split(",")
        .map(field => field.trim().replace(/:.*$/u, ""))
        .filter(Boolean)
        .sort()
    assert.deepEqual(
        configFields,
        ["aspectRatio", "format", "fps", "includeAudio", "quality", "resolution"],
    )
    assert.match(exportForm, /EXPORT_FORMAT_OPTIONS\.map\(option/)
    assert.match(exportForm, /Include audio/)
    assert.match(exportForm, /Mix recorded and timeline audio into the exported video/)

    for (const command of ["process_audio", "add_audio"]) {
        const body = commandBody(exporter, command)
        assert.doesNotMatch(body, /^\s*Ok\(\(\)\)\s*\}\s*$/mu)
        assert.match(body, /ffmpeg/iu, `${command} must drive the FFmpeg audio stage`)
    }
    assert.match(exporter, /fn build_audio_filter/)
    assert.match(exporter, /render_format\.audio_encoder\(\)/)
    assert.match(exporter, /"-c:v"\.to_string\(\),\s*"copy"\.to_string\(\)/)
})

test("current public copy states the implemented formats and conditional audio", async () => {
    const entries = await Promise.all(
        currentPublicTruthFiles.map(async file => [file, await readRepoFile(file)]),
    )

    for (const [file, source] of entries) {
        assertPositiveMediabunnyVideoRole(source, file)
        assertNoFalseExportClaims(source, file)
    }

    for (const file of [
        "README.md",
        "docs/features/export.md",
        "website/src/HomePage.jsx",
        "website/developer-tool-demo-storyboard/index.html",
    ]) {
        const source = entries.find(([candidate]) => candidate === file)[1]
        assert.match(source, /\blocal(?:ly)?\b|on your machine/iu, `${file} must preserve local export`)
        assert.match(source, /\bmp4\b/iu, `${file} must disclose MP4 output`)
        assert.match(source, /\bwebm\b/iu, `${file} must disclose WebM output`)
        assert.match(
            source,
            /\b(?:when|if)\b.{0,180}\b(?:audio|microphone|system|timeline)\b|\b(?:audio|microphone|system|timeline)\b.{0,180}\b(?:when|if)\b/isu,
            `${file} must make audio availability conditional`,
        )
    }
})

test("tracked export copy matches the current UI and pipeline", async () => {
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
        storyboard.match(/<h3>Record and edit with Flowtake v1\.7\.0\.<\/h3>\s*<ul>([\s\S]*?)<\/ul>/u)?.[1],
    ].filter(Boolean).join("\n")
    const exportCopy = [readmeExport, exportDoc, pipelineExport, homepageCopy, storyboardExportCopy].join("\n")

    assertNoFalseExportClaims(exportCopy, "tracked export copy")
    assertNoFalseExportClaims(comparisonFlowtakeCopy, "comparison Flowtake copy")
    assert.doesNotMatch(exportCopy, /\b24\s*fps\b|custom resolution|CRF-based|fixed bitrate|estimated time|final file size/iu)

    assert.match(readmeExport, /H\.264\/MP4 or VP9\/WebM/iu)
    assert.match(readmeExport, /when present and enabled/iu)
    assert.match(exportDoc, /MP4 with H\.264\/AVC video/iu)
    assert.match(exportDoc, /WebM with VP9 video/iu)
    assert.match(exportDoc, /click \*\*Export\*\*/u)
    assert.doesNotMatch(exportDoc, /click \*\*Render\*\*/u)
    assert.match(pipelineExport, /timeline-aware mix/iu)
    assert.match(pipelineExport, /MP4 or WebM/iu)
    assert.match(homepage, /Flowtake v1\.7 exports H\.264\/MP4 or VP9\/WebM locally/iu)
    assert.match(storyboard, /with the edit's audio when present/iu)
    assert.match(comparison, /recorded and timeline audio are included when present and enabled/iu)
})

test("truth guard rejects stale or overbroad claims and accepts precise capability copy", () => {
    for (const falseClaim of [
        "Export H.265 video.",
        "Choose MOV output.",
        "Export WebM with AV1.",
        "Choose a hardware encoder for the final export.",
        "Pick the H.264 profile for the final export.",
        "Set a fixed bitrate for the final export.",
        "FFmpeg encodes the final H.264 video.",
        "The current edited export is video-only.",
        "The edited MP4 has no muxed audio.",
        "The final export does not include audio.",
        "The final export has audio.",
        "Audio tracks are exported in the final MP4.",
        "Audio tracks are muxed into every finished export.",
        "The exporter does not support WebM.",
        "WebM is unavailable as an output.",
        "The app has no MP4 export option.",
    ]) {
        assert.throws(
            () => assertNoFalseExportClaims(falseClaim, "synthetic false claim"),
            assert.AssertionError,
            falseClaim,
        )
    }

    for (const accurateClaim of [
        "Export MP4 or WebM locally.",
        "Choose MP4 or WebM in the export format control.",
        "MP4 uses H.264 video and WebM uses VP9 video.",
        "Recorded and timeline audio are included when present and enabled.",
        "When the project has audio, the exporter can include it.",
        "Turn Include audio off for a silent export.",
        "Mediabunny encodes the MP4 or WebM video stream.",
        "FFmpeg mixes and muxes enabled timeline audio when present.",
        "Mediabunny encodes video; FFmpeg optionally muxes recorded audio when present.",
        "The exporter does not expose a codec, bitrate, or hardware-encoder selector.",
    ]) {
        assert.doesNotThrow(
            () => assertNoFalseExportClaims(accurateClaim, "synthetic accurate claim"),
            accurateClaim,
        )
    }

    const builtRuntime = [
        'const formatCopy = "Export MP4 or WebM locally.";',
        'const realMedia = "/Flowtake/media/flowtake-feature-export.webm";',
        'const audioCopy = "Recorded and timeline audio are included when present.";',
    ].join("\n")
    assert.deepEqual(extractExportCopyLiterals(builtRuntime), [
        "Export MP4 or WebM locally.",
        "Recorded and timeline audio are included when present.",
    ])
})
