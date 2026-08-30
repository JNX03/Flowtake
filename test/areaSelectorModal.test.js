import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(
    new URL("../app/windows/main/components/properties/AreaSelectorModal.jsx", import.meta.url),
    "utf8"
)

test("area selector stays bounded and keeps controls reachable in compact windows", () => {
    assert.match(
        source,
        /h-\[calc\(100dvh-1rem\)\][^"]*max-h-\[44rem\][^"]*w-\[calc\(100vw-1rem\)\][^"]*max-w-5xl[^"]*overflow-hidden/
    )
    assert.match(source, /min-h-0 flex-1 overscroll-contain overflow-auto/)
    assert.match(source, /grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4/)
    assert.match(source, /input input-sm w-full min-w-0/)
    assert.match(source, /shrink-0 flex-col gap-3[^"]*sm:flex-row sm:items-end/)
    assert.match(source, /btn-primary w-full sm:w-auto/)
    assert.doesNotMatch(source, /w-5xl max-w-10\/12 h-150 overflow-visible/)
    assert.doesNotMatch(source, /fieldset w-32/)
})

test("area selector keyboard save and canvas cleanup respect readiness", () => {
    assert.match(source, /const canSave = Boolean\(sample && userAreas\[0\]\)/)
    assert.match(source, /if \(!sample \|\| !userAreas\[0\]\) return/)
    assert.match(source, /useHotkeys\('enter', save, \{ enabled: isOpen && canSave \}\)/)
    assert.match(source, /disabled=\{!canSave\}/)
    assert.match(source, /const canvas = canvasRef\.current/)
    assert.match(source, /const context = canvas\?\.getContext\?\.\('2d'\)/)
    assert.match(source, /if \(canvas && context\)/)
})

