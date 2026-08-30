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
    "CHANGELOG.md",
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

test("final edited export implementation is a real Mediabunny AVC encode", async () => {
    const [renderWorker, outputWriter, exporter, exportForm, exportFormats] = await Promise.all([
        readRepoFile("app/shared/workers/renderWorker.js"),
        readRepoFile("app/shared/workers/WorkerOutputWriter.js"),
        readRepoFile("src-tauri/src/commands/exporter.rs"),
        readRepoFile("app/windows/exporter/components/form/NewRenderForm.jsx"),
        readRepoFile("app/shared/exportFormats.js"),
    ])

    // The writer is still a real Mediabunny AVC video encode; the chosen
    // container is the only thing the export format varies.
    assert.match(renderWorker, /Mp4OutputFormat[\s\S]*from\s*["']mediabunny["']/)
    assert.match(renderWorker, /OUTPUT_FORMAT_CLASSES\s*=\s*\{[\s\S]*mp4:\s*Mp4OutputFormat/)
    assert.match(renderWorker, /new WorkerOutputWriter\([\s\S]*?OUTPUT_FORMAT_CLASSES\[/)
    // The codec now travels with the chosen container instead of being hardcoded,
    // but it is still a real encoded video track, not a passthrough.
    assert.match(outputWriter, /new VideoSampleSource\(\{\s*codec:\s*this\.codec/)
    assert.match(renderWorker, /exportFormat\.videoCodec/)
    assert.match(outputWriter, /this\.output\.addVideoTrack\(this\.videoSampleSource/)
    assert.doesNotMatch(outputWriter, /\b(?:addAudioTrack|AudioSampleSource)\b/)
    // The renderer never picks its own path or container: both come from the
    // queued render's format.
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
        ["aspectRatio", "format", "fps", "includeAudio", "quality", "resolution"]
    )
    assert.match(exportForm, /FPS_OPTIONS\.map\(fpsOption/)
    // The container labels moved into the shared export-format table; MP4 must
    // still be an offered option.
    assert.match(exportForm, /EXPORT_FORMAT_OPTIONS\.map\(option/)
    assert.match(exportFormats, /label:\s*"MP4"/)
    assert.match(exportForm, />\s*Export\s*<ArrowRightIcon/)

    // The audio commands are no longer no-ops: the export pipeline muxes a real
    // audio track, so the form is allowed to offer the toggle it is backed by.
    for (const command of ["process_audio", "add_audio"]) {
        const body = commandBody(exporter, command)
        assert.doesNotMatch(
            body,
            /^\s*Ok\(\(\)\)\s*\}\s*$/mu,
            `${command} must do real work now that audio export ships`,
        )
        assert.match(body, /ffmpeg/iu, `${command} must drive the FFmpeg audio pipeline`)
    }
    assert.match(exporter, /fn build_audio_filter/)
    assert.match(exporter, /anullsrc=channel_layout=stereo:sample_rate=48000/)
})

test("public copy states the current Mediabunny AVC MP4 boundary", async () => {
    const entries = await Promise.all(
        publicTruthFiles.map(async file => [file, await readRepoFile(file)]),
    )

    for (const [file, source] of entries) {
        assertPositiveMediabunnyRole(source, file)
        assertNoFinalFfmpegClaims(source, file)
        assertNoUnsupportedExportClaims(source, file)
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
        "The exporter has no problem exporting WebM.",
        "The exporter has no trouble producing H.265.",
        "The final export has no WebM limitations and fully supports WebM output.",
        "The exporter has no WebM support problem.",
        "The exporter has no WebM format limitation.",
        "The exporter has no H.265 codec restriction.",
        "The exporter has no restriction on WebM output.",
        "The exporter has no WebM format selector and exports WebM automatically.",
        "The exporter does not support WebM and has WebM output.",
        "The exporter does not support WebM and can export WebM.",
        "The exporter does not support WebM and WebM output is available.",
        "The exporter does not support WebM and allows WebM export.",
        "The exporter does not support WebM and users can export WebM.",
        "The exporter does not support WebM and WebM can be exported.",
        "The exporter does not support WebM and automatically exports WebM.",
        "The exporter does not support WebM and now supports H.265.",
        "The exporter does not support WebM, then exports WebM.",
        "The exporter does not support WebM and actually exports WebM.",
        "The exporter does not support WebM and indeed supports H.265.",
        "The exporter does not support WebM and is able to export WebM.",
        "The exporter has no WebM output, despite supporting WebM.",
        "No H.265 or WebM export is offered even though WebM output is available.",
        "The exporter does not support WebM and it exports H.265.",
        "The exporter does not support WebM and we support H.265.",
        "The exporter does not support WebM and Flowtake exports H.265.",
        "The exporter does not support WebM, but it can be enabled.",
        "The exporter does not offer H.265 output, but users can turn it on.",
        "No WebM output is offered by default, but you can enable it.",
        "The exporter does not support WebM and outputs WebM anyway.",
        "The exporter does not support WebM and saves WebM files.",
        "The exporter does not support WebM and delivers WebM output.",
        "The exporter does not support WebM and generates WebM output.",
        "The exporter does not support WebM and without delay exports WebM.",
        "The final exporter writes WebM, but does not support it.",
        "The exporter exports WebM, but WebM is not supported.",
        "FFmpeg renders the final MP4, but is not the final encoder.",
        "The exporter does not support WebM but not only exports WebM, it also exports H.265.",
        "The exporter does not support WebM, but WebM is an output option.",
        "The exporter does not support WebM, but WebM output exists.",
        "The exporter does not support WebM and the app accepts H.265 output.",
        "Export WebM for preview.",
        "Export a WebM source file.",
        "Export the recording as WebM.",
        "Export WebM recording.",
        "The exporter does not support WebM and lets you download WebM.",
        "The exporter does not support WebM and converts the result to WebM.",
        "The exporter does not support WebM and returns a WebM file.",
        "The exporter does not support WebM and downloads WebM anyway.",
        "Import a WebM source, then export WebM.",
        "Use WebM as an input and export WebM.",
        "The app renders an imported WebM clip and exports WebM.",
        "Imported WebM clips can be exported as WebM.",
        "WebM input can be exported to WebM.",
        "A recorded WebM source can be written as WebM.",
        "Imported WebM clips can be encoded as WebM.",
        "A WebM input can be produced as WebM.",
        "Imported WebM clips can be muxed into WebM.",
        "A WebM source can be created as WebM.",
        "Create a WebM file.",
        "Produce a WebM file.",
        "Encode a WebM video.",
        "Mux a WebM file.",
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
        "FFmpeg handles capture and Mediabunny encodes the final MP4, and FFmpeg renders the final MP4.",
        "The final export has no audio; it is included when enabled.",
        "There is no format selector; users can switch it for the final export.",
        "Export .webm.",
        "The final output is .mkv.",
        "The final export has a soundtrack.",
        "Narration is included in the final MP4.",
        "# Export\nAudio: yes.",
        "The final MP4 has no audio except narration.",
        "The final MP4 has no audio; enable it for narration.",
        "The final MP4 has no audio and ships with narration.",
        "The final MP4 has no audio but embeds narration.",
        "The final MP4 has no audio and contains a voiceover.",
        "The final MP4 has no audio but ships with narration and no soundtrack.",
        "Choose a container for the final export.",
        "Switch the output profile.",
        "Set the final export encoder.",
        "The final export has no audio. Enable it for the final MP4.",
        "The final MP4 preserves narration.",
        "Narration prompt: “The final export includes narration.”",
        "Narration prompt: “The final export includes it.”",
        "Narration prompt: “It is included in the final export.”",
        "Voiceover prompt: “The final export includes voiceover.”",
        "Voiceover prompt: “It is muxed into the final MP4.”",
        "Narration prompt: “It is preserved in the final MP4.”",
        "Narration prompt: “This is included in the final export.”",
        "Voiceover prompt: “Included in the final export.”",
        "Narration prompt: “The final MP4 will have it.”",
        "Narration prompt: “It is in the final MP4.”",
        "Voiceover prompt: “Present in the final export.”",
        "Narration prompt: “The final MP4 ships with it.”",
        "Narration prompt: “It accompanies the final MP4.”",
        "Voiceover prompt: “Embedded in the final export.”",
        "Voiceover prompt: “Baked into the final MP4.”",
        "Narration prompt: “The final MP4 features narration.”",
        "Switch codecs for the final export.",
        "Pick the H.264 profile for the final export.",
        "Export QuickTime.",
        "Export Matroska.",
    ]) {
        assert.throws(
            () => assertNoUnsupportedExportClaims(falseClaim, "synthetic false claim"),
            assert.AssertionError,
            falseClaim,
        )
    }

    for (const limitation of [
        "The edited MP4 has no muxed audio. The export window does not expose a format or encoder selector.",
        "FFmpeg is not the final edited-MP4 encoder.",
        "The final MP4 is not encoded by FFmpeg.",
        "The exporter does not support WebM.",
        "The exporter does not offer H.265 or WebM output and does not expose a hardware-encoder selector.",
        "The exporter does not support WebM and cannot export WebM.",
        "The exporter does not support WebM and has no WebM output.",
        "The exporter does not support WebM and WebM output is unavailable.",
        "The exporter has no WebM output.",
        "No H.265 or WebM export is offered.",
        "If WebM is requested, then the exporter does not support WebM.",
        "If you need WebM output, then the exporter does not offer it.",
        "The exporter does not offer WebM output and users can inspect WebM metadata.",
        "The exporter does not support WebM and exports no WebM files.",
        "The exporter does not support WebM and produces no WebM output.",
        "The exporter does not support WebM and offers no WebM option.",
        "If WebM is requested, then it cannot be exported.",
        "The exporter does not support WebM and fails to export WebM.",
        "The exporter refuses to export WebM.",
        "The exporter is unable to export WebM.",
        "The exporter has no WebM output today.",
        "The exporter does not offer WebM output, but you can include it in a feature request.",
        "WebM output is unavailable. You can include it in the documentation.",
        "Narration prompt: “It is not included in the final export.”",
        "Voiceover prompt: “Do not mux it into the final MP4.”",
        "The exporter does not offer WebM output and users can inspect WebM input metadata before export.",
        "The exporter does not offer WebM output, but it can render an imported WebM clip for preview.",
        "Use WebM input for an AVC MP4 export.",
        "WebM is supported as an input, not as an output.",
        "Import a WebM source, then export MP4.",
        "Export a project imported from a WebM source.",
        "Save an edit made from an imported WebM clip.",
        "Use WebM as input and export an MP4.",
        "Import WebM, then export AVC MP4.",
        "Encode WebM input to MP4.",
        "Mux WebM input into MP4.",
        "Produce WebM input into MP4.",
        "Create WebM source before encoding MP4.",
        "Encode a WebM file to MP4.",
        "Mux a WebM file into AVC MP4.",
        "Save an edit made from an imported WebM file as AVC MP4.",
        "Export a project built from a WebM file to AVC MP4.",
        "Download an AVC MP4 created from a WebM file.",
        "The final MP4 has no audio and ships without narration.",
        "The final MP4 has no audio and contains no voiceover.",
        "Narration prompt: “This export contains no secrets.”",
        "Voiceover prompt: “This export includes a local MP4.”",
        "Narration prompt: “This demo includes the final result.”",
        "WebM isn't supported by the exporter.",
        "WebM isn't available as an output.",
        "The finished export lacks a soundtrack.",
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
        "Narration prompt: “Save or export [artifact] for [next step].”",
        "Voiceover prompt: “Save or export [artifact] for [next step].”",
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
