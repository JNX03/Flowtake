import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const [projects, exporter, files, store, identifiers, cargoManifest, cargoLock] = await Promise.all([
    readFile(new URL("../src-tauri/src/commands/projects.rs", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/src/commands/exporter.rs", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/src/commands/files.rs", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/src/commands/store.rs", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/src/identifiers.rs", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/Cargo.toml", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/Cargo.lock", import.meta.url), "utf8"),
])

test("project commands validate canonical ids before filesystem mutations", () => {
    assert.match(identifiers, /Uuid::parse_str/)
    assert.match(projects, /pub async fn open_project[\s\S]*?validate_project_id\(&id\)\?/)
    assert.match(projects, /pub async fn delete_project[\s\S]*?validate_project_id\(&project_id\)\?/)

    const deleteStart = projects.indexOf("pub async fn delete_project")
    const deleteEnd = projects.indexOf("pub async fn save_json")
    const deleteCommand = projects.slice(deleteStart, deleteEnd)
    assert.ok(deleteCommand.indexOf("projects.contains_key") < deleteCommand.indexOf("remove_project_storage"))
})

test("render paths come only from a validated registered render", () => {
    assert.match(exporter, /validate_render_id\(&render_id\)\?/)
    assert.match(exporter, /state\.renders\.contains_key\(&render_id\)/)
    assert.match(files, /validate_render_id\(render_id\)\?/)
    assert.match(files, /state\s*\.renders\s*\.get\(render_id\)/)
    assert.doesNotMatch(files, /render_temp_dir\(render_id\)/)
})

test("renderer store writes cannot forge the backend project library", () => {
    assert.match(store, /key == "projects" \|\| key\.starts_with\("projects\."\)/)
    assert.match(store, /Project library state is backend-owned/)
})

test("renderer project path overrides must match the active project", () => {
    assert.match(files, /Requested project is not the active project/)
    assert.match(files, /validate_project_id\(requested_project_id\)\?/)
})

test("project archives exclude unused zip codecs and encryption", () => {
    assert.match(
        cargoManifest,
        /zip = \{ version = "8", default-features = false \}/
    )
    assert.match(projects, /CompressionMethod::Stored/)
    assert.doesNotMatch(cargoLock, /\nname = "aes"\n/)
})
