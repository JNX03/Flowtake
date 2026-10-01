import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"

// Both files must ship with the same runtime version. A missing factory
// module sends inference back to a CDN/blob import that the app's CSP blocks.
const assets = new URL("../dist/assets/", import.meta.url)
const filenames = await readdir(assets)
for (const extension of ["mjs", "wasm"]) {
    const prefix = "ort-wasm-simd-threaded.asyncify-"
    const candidates = filenames.filter(name => name.startsWith(prefix) && name.endsWith(`.${extension}`))
    assert.equal(candidates.length, 1, `Expected one packaged ONNX ${extension} asset`)
    const [built, installed] = await Promise.all([
        readFile(new URL(candidates[0], assets)),
        readFile(new URL(`../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.${extension}`, import.meta.url)),
    ])
    const digest = bytes => createHash("sha256").update(bytes).digest("hex")
    assert.equal(digest(built), digest(installed), `Packaged ONNX ${extension} does not match the installed runtime`)
}
console.log("Verified packaged caption runtime module and WASM match the installed version.")
