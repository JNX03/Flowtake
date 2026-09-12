import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

test("audio meters cap analyzer and React update cadence", async () => {
    const source = await readFile(
        new URL("../app/shared/hooks/useAudioMeter.js", import.meta.url),
        "utf8"
    )

    assert.match(source, /maxFps = 30/)
    assert.match(source, /now - lastSampleAt < minimumInterval/)
    assert.match(source, /Math\.min\(60, Math\.max\(10/)
})
