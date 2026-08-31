import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const modalSource = await readFile(
    new URL("../app/windows/main/components/Modal.jsx", import.meta.url),
    "utf8"
)

test("editor dialogs use native modal focus containment and restore focus", () => {
    assert.match(modalSource, /dialog\.showModal\(\)/)
    assert.match(modalSource, /if \(dialog\.open\) dialog\.close\(\)/)
    assert.match(modalSource, /previousFocus\?\.isConnected/)
    assert.match(modalSource, /onCancel=\{handleCancel\}/)
    assert.match(modalSource, /event\.preventDefault\(\)/)
    assert.match(modalSource, /aria-labelledby=\{titleId\}/)
    assert.match(modalSource, /aria-label=\{`Close \$\{title\}`\}/)
})
