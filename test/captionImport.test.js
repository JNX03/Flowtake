import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { createCaptionEntities } from "../app/shared/captions/captionEntities.js"
import {
    CaptionParseError,
    detectCaptionFormat,
    parseAss,
    parseCaptionFile,
    parseSrt,
    parseSrtTimestamp,
} from "../app/shared/captions/captionParser.js"

const transcriptSectionSource = await readFile(
    new URL("../app/windows/main/components/properties/TranscriptSection.jsx", import.meta.url),
    "utf8",
)

test("parses BOM and multiline SRT cues into millisecond timing", () => {
    const result = parseSrt("\uFEFF1\r\n00:00:01,250 --> 00:00:03,500 position:50%\r\nHello\r\nworld\r\n\r\n2\r\n00:00:04.000 --> 00:00:05.125\r\nNext")

    assert.equal(result.format, "srt")
    assert.deepEqual(result.cues, [
        { start: 1250, end: 3500, text: "Hello\nworld" },
        { start: 4000, end: 5125, text: "Next" },
    ])
    assert.deepEqual(result.warnings, [])
    assert.equal(parseSrtTimestamp("12:34:56,7"), 45296700)
})

test("sorts out-of-order cues and reports preserved overlaps", () => {
    const result = parseSrt("2\n00:00:03,000 --> 00:00:05,000\nSecond\n\n1\n00:00:01,000 --> 00:00:04,000\nFirst")
    assert.deepEqual(result.cues.map(cue => cue.text), ["First", "Second"])
    assert.match(result.warnings[0], /Out-of-order/)
    assert.match(result.warnings[1], /overlapping/)
})

test("rejects an SRT import atomically when any duration is invalid", () => {
    assert.throws(
        () => parseSrt("1\n00:00:02,000 --> 00:00:01,000\nBackwards"),
        error => {
            assert.ok(error instanceof CaptionParseError)
            assert.equal(error.issues.length, 1)
            assert.match(error.message, /must end after it starts/)
            return true
        },
    )
})

test("parses ASS Dialogue events, keeps commas and newlines, and strips overrides", () => {
    const source = `[Script Info]
Title: Import test

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.25,0:00:03.50,Default,,0,0,0,karaoke,{\\an8}Hello,\\Nworld
Dialogue: 0,0:00:04.00,0:00:05.25,Default,,0,0,0,,{\\b1}<script>alert(1)</script>{\\b0}`

    const result = parseAss(source)
    assert.deepEqual(result.cues, [
        { start: 1250, end: 3500, text: "Hello,\nworld" },
        { start: 4000, end: 5250, text: "<script>alert(1)</script>" },
    ])
    assert.ok(result.warnings.some(warning => /3 ASS formatting overrides were removed/.test(warning)))
    assert.ok(result.warnings.some(warning => /1 ASS effect was ignored/.test(warning)))
})

test("rejects ambiguous ASS field order and malformed Dialogue timing", () => {
    assert.throws(
        () => parseAss(`[Events]
Format: Text, End, Start
Dialogue: Reordered fields,0:00:02.00,0:00:01.00`),
        error => error instanceof CaptionParseError && /Text as the final field/.test(error.message),
    )

    assert.throws(
        () => parseAss(`[Events]
Format: Start, End, Text
Dialogue: nope,0:00:02.00,Bad timing`),
        error => error instanceof CaptionParseError && /invalid timestamp/.test(error.message),
    )
})

test("detects caption formats by extension or safe content sniffing", () => {
    assert.equal(detectCaptionFormat("captions.SRT", ""), "srt")
    assert.equal(detectCaptionFormat("captions", "[Events]\nDialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,Text"), "ass")
    assert.equal(detectCaptionFormat("captions.txt", "00:00:00,000 --> 00:00:01,000"), "srt")
    assert.throws(
        () => parseCaptionFile({ fileName: "captions.txt", source: "plain text" }),
        error => error instanceof CaptionParseError && /\.srt or \.ass/.test(error.message),
    )
})

test("builds current subtitle entities with collision-safe IDs", () => {
    const cues = [
        { start: 0, end: 1000, text: "One" },
        { start: 1000, end: 2000, text: "Two" },
    ]
    const entities = createCaptionEntities(cues, {
        existingIds: ["subtitle-import"],
        createId: () => "subtitle-import",
    })

    assert.deepEqual(entities.map(entity => entity.id), ["subtitle-import-2", "subtitle-import-3"])
    assert.deepEqual(entities[0].entranceEffect, { type: "none", duration: 300 })
    assert.deepEqual(entities[1].exitEffect, { type: "none", duration: 300 })
})

test("caption picker uses one grouped undo transaction and existing toast feedback", () => {
    assert.match(transcriptSectionSource, /accept="\.srt,\.ass/)
    assert.match(transcriptSectionSource, /aria-label="Choose an SRT or ASS caption file"/)
    assert.match(transcriptSectionSource, /role="status" aria-live="polite"/)
    assert.match(transcriptSectionSource, /const group = getGroup\("import-captions"\)/)
    assert.match(transcriptSectionSource, /withGroup\(setTranscript\(null\), group\)/)
    assert.match(transcriptSectionSource, /withGroup\(setSubtitles\(importedSubtitles\), group\)/)
    assert.match(transcriptSectionSource, /withGroup\(setSelectedIds\(\[\]\), group\)/)
    assert.match(transcriptSectionSource, /type: TOAST_SUCCESS/)
    assert.match(transcriptSectionSource, /type: TOAST_WARNING/)
    assert.match(transcriptSectionSource, /type: TOAST_ERROR/)
})
