import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("native policy permits caption WASM without permitting remote or blob scripts", async () => {
    const config = JSON.parse(await readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"))
    const directives = new Map(config.app.security.csp.split(";").map(directive => {
        const [name, ...sources] = directive.trim().split(/\s+/)
        return [name, sources]
    }))
    const scripts = directives.get("script-src")
    assert.ok(scripts.includes("'wasm-unsafe-eval'"), "Caption WASM must be allowed to compile")
    assert.ok(scripts.includes("'self'"))
    assert.ok(scripts.every(source => ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"].includes(source)), "Caption setup must not allow arbitrary eval, remote, or blob scripts")
})
