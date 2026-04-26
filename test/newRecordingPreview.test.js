import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(
    new URL("../app/windows/main/components/newRecording/NewRecording.jsx", import.meta.url),
    "utf8"
)

test("source preview polling avoids screenshot retry storms", () => {
    assert.match(source, /retry:\s*false/)
    assert.match(source, /refetchInterval:\s*2000/)
    assert.match(source, /refetchIntervalInBackground:\s*false/)
    assert.match(source, /previewUnavailable/)
    assert.doesNotMatch(source, /key=\{captureSourcePreview\}/)
    assert.doesNotMatch(source, /queryKey:\s*\[[^\n]*source\?\.[^\n]*source\]/)
})
