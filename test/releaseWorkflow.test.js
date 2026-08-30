import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const workflow = await readFile(
    new URL("../.github/workflows/main.yml", import.meta.url),
    "utf8"
)

test("release publication fails closed across every supported platform", () => {
    assert.match(
        workflow,
        /if: always\(\) && needs\.build-windows\.result == 'success' && needs\.build-linux\.result == 'success' && needs\.build-macos\.result == 'success'/
    )
    assert.doesNotMatch(
        workflow,
        /needs\.build-(?:windows|linux|macos)\.result == 'success'\s*\|\|/
    )
})

test("platform jobs and the publisher reject missing release artifacts", () => {
    assert.equal(
        workflow.match(/if-no-files-found: error/g)?.length,
        3,
        "each platform upload must reject an empty artifact set"
    )
    assert.match(workflow, /- name: Verify complete release payload/)
    assert.match(workflow, /fail_on_unmatched_files: true/)

    for (const requiredArtifact of [
        "Flowtake-windows-x64-portable.zip",
        "Flowtake-macos-universal.zip",
        "Flowtake-linux-x64-portable.tar.gz",
        "*.exe",
        "*.msi",
        "*.dmg",
        "*.deb",
        "*.AppImage",
        "*.rpm",
    ]) {
        assert.ok(workflow.includes(requiredArtifact), `missing release assertion for ${requiredArtifact}`)
    }

    assert.doesNotMatch(
        workflow,
        /cp src-tauri\/(?:target|binaries)\/[^\n]+\|\| true/,
        "required platform artifacts must never be copied best-effort"
    )
})
