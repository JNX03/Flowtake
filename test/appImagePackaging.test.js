import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { load as loadYaml } from "js-yaml"

const readRepoFile = path => readFile(new URL(`../${path}`, import.meta.url), "utf8")

const [packageJson, packageLock, qualityWorkflowSource, releaseWorkflow, validationScript] =
    await Promise.all([
        readRepoFile("package.json").then(JSON.parse),
        readRepoFile("package-lock.json").then(JSON.parse),
        readRepoFile(".github/workflows/linux-appimage-quality.yml"),
        readRepoFile(".github/workflows/main.yml"),
        readRepoFile("scripts/validate-linux-appimage.sh"),
    ])

const qualityWorkflow = loadYaml(qualityWorkflowSource)

test("AppImage packaging uses the Tauri release with relocatable metadata", () => {
    assert.equal(packageJson.devDependencies["@tauri-apps/cli"], "^2.11.4")
    assert.equal(packageLock.packages["node_modules/@tauri-apps/cli"].version, "2.11.4")
    assert.equal(
        packageLock.packages["node_modules/@tauri-apps/cli-linux-x64-gnu"].version,
        "2.11.4"
    )
})

test("AppImage validation pins its external linter and rejects absolute metadata links", () => {
    assert.match(validationScript, /APPDIR_LINT_COMMIT="5da36fb54d5847ed76d2b9959d96722cbc857923"/)
    assert.match(validationScript, /APPDIR_LINT_SHA256="[A-Fa-f0-9]{64}"/)
    assert.match(validationScript, /EXCLUDELIST_SHA256="[A-Fa-f0-9]{64}"/)
    assert.match(validationScript, /sha256sum --check --strict/)
    assert.match(validationScript, /--appimage-extract/)
    assert.match(validationScript, /bash "\$tool_dir\/appdir-lint\.sh" "\$app_dir"/)
    assert.match(validationScript, /validate_relocatable_path "\$app_dir\/\.DirIcon"/)
    assert.match(validationScript, /if \[\[ "\$target" = \/\* \]\]/)
})

test("Linux packaging CI builds, lints, and launches the real AppImage", () => {
    const job = qualityWorkflow.jobs["appimage-quality"]
    assert.equal(job["runs-on"], "ubuntu-22.04")
    assert.equal(job["timeout-minutes"], 45)

    const commands = job.steps.map(step => step.run ?? "").join("\n")
    assert.match(commands, /npm run tauri -- build --bundles appimage/)
    assert.match(commands, /bash scripts\/validate-linux-appimage\.sh/)
    assert.match(commands, /Xvfb :99/)
    assert.match(commands, /xdotool search --name Flowtake/)
    assert.match(commands, /AppImage exited before showing a Flowtake window/)
})

test("release publication rejects an AppImage that fails metadata validation", () => {
    const buildStart = releaseWorkflow.indexOf("  build-linux:")
    const buildEnd = releaseWorkflow.indexOf("  build-macos:")
    const linuxJob = releaseWorkflow.slice(buildStart, buildEnd)

    assert.match(linuxJob, /desktop-file-utils/)
    assert.match(linuxJob, /- name: Validate AppImage metadata/)
    assert.match(linuxJob, /bash scripts\/validate-linux-appimage\.sh/)
    assert.ok(
        linuxJob.indexOf("- name: Validate AppImage metadata") <
            linuxJob.indexOf("- name: Collect Linux installers"),
        "AppImage validation must run before artifacts are collected"
    )
})
