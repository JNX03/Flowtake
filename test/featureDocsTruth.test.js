import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const readDoc = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("recording docs describe the current video-only edited MP4 pipeline", async () => {
    const recording = await readDoc("docs/features/recording.md")

    assert.match(recording, /edited MP4 export is currently video-only/i)
    assert.match(recording, /PixiJS render worker composites/i)
    assert.match(recording, /Mediabunny encodes and muxes/i)
    assert.match(recording, /FFmpeg remains part of recording capture and native media utilities/i)
    assert.doesNotMatch(recording, /mixed during export/i)
})

test("effects docs do not claim audio muxing or separate SRT export", async () => {
    const effects = await readDoc("docs/features/effects.md")

    assert.match(effects, /final edited MP4 in v1\.6\.0 is video-only/i)
    assert.match(effects, /does not provide a separate `\.srt` export/i)
    assert.match(effects, /PixiJS composites/i)
    assert.match(effects, /Mediabunny encodes and muxes/i)
    assert.doesNotMatch(effects, /mix them with your recording/i)
    assert.doesNotMatch(effects, /as a separate `\.srt` file/i)
})
