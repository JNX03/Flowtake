import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("project media commands are registered and mapped with named arguments", async () => {
  const [bridge, lib] = await Promise.all([
    read("app/shared/tauriBridge.js"),
    read("src-tauri/src/lib.rs"),
  ])

  assert.match(bridge, /'import-project-media': 'import_project_media'/)
  assert.match(bridge, /'resolve-project-media': 'resolve_project_media'/)
  assert.match(
    bridge,
    /'import_project_media': \(args\) => \(\{ sourcePath: args\[0\] \}\)/
  )
  assert.match(
    bridge,
    /'resolve_project_media': \(args\) => \(\{ relativePath: args\[0\] \}\)/
  )
  assert.match(lib, /commands::projects::import_project_media/)
  assert.match(lib, /commands::projects::resolve_project_media/)
})

test("project media imports are durable, collision-safe, and serializable", async () => {
  const projects = await read("src-tauri/src/commands/projects.rs")

  assert.match(projects, /#\[serde\(rename_all = "camelCase"\)\]/)
  assert.match(projects, /pub relative_path: String/)
  assert.match(projects, /pub absolute_path: String/)
  assert.match(projects, /pub original_name: String/)
  assert.match(projects, /pub size: u64/)
  assert.match(projects, /pub mime_type: String/)
  assert.match(projects, /spawn_blocking/)
  assert.match(projects, /\.create_new\(true\)/)
  assert.match(projects, /uuid::Uuid::new_v4/)
  assert.match(projects, /PROJECT_ASSETS_DIRECTORY/)
  assert.match(projects, /PROJECT_MEDIA_IO/)
  assert.match(projects, /with_project_media_io/)
  assert.match(projects, /\.canonicalize\(\)/)
  assert.match(projects, /starts_with\(&assets_dir\)/)
  assert.match(projects, /validate_project_media_relative_path/)
  assert.match(projects, /mime_guess::from_path/)
})

test("closing a project still archives the complete temp directory", async () => {
  const projects = await read("src-tauri/src/commands/projects.rs")
  const zipDirectory = projects.slice(
    projects.indexOf("fn zip_directory("),
    projects.indexOf("fn walkdir(")
  )

  assert.match(projects, /zip_directory\(temp, &zip_path\)\?/)
  assert.match(zipDirectory, /fn zip_directory\(/)
  assert.match(zipDirectory, /std::io::copy\(&mut f, &mut zip_writer\)\?/)
  assert.doesNotMatch(zipDirectory, /read_to_end/)
  assert.doesNotMatch(projects, /delete_project_media/)
})
