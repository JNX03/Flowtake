import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(
    new URL("../app/windows/main/components/settings/UpdatesSettings.jsx", import.meta.url),
    "utf8"
)

test("update progress listener uses explicit IPC cleanup", () => {
    assert.match(source, /const handleProgress = \(_event, data\) =>/)
    assert.match(source, /ipcRenderer\.on\("update-download-progress", handleProgress\)/)
    assert.match(source, /ipcRenderer\.removeListener\("update-download-progress", handleProgress\)/)
    assert.doesNotMatch(
        source,
        /unlistenRef\.current\s*=\s*window\.electron\.ipcRenderer\.on/
    )
})
