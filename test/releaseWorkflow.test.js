import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const workflow = await readFile(
    new URL("../.github/workflows/main.yml", import.meta.url),
    "utf8"
)
const ciWorkflow = await readFile(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8"
)
const pagesWorkflow = await readFile(
    new URL("../.github/workflows/pages.yml", import.meta.url),
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

test("release publication generates and verifies a checksum manifest", () => {
    assert.match(workflow, /- name: Stage flat release assets and verify SHA-256 checksums/)
    assert.match(workflow, /declare -A staged_names=\(\)/)
    assert.match(workflow, /duplicate flat release filename/)
    assert.match(workflow, /cp -- "\$source" "release-assets\/\$name"/)
    assert.match(workflow, /find \. -maxdepth 1 -type f ! -name SHA256SUMS\.txt -printf '%f\\0' \| sort -z/)
    assert.match(workflow, /sha256sum "\$file"/)
    assert.match(workflow, /sha256sum --check --strict SHA256SUMS\.txt/)
    assert.match(workflow, /files:\s*\|\s*\n\s+release-assets\/\*/)
})

test("release FFmpeg archives are immutable and verified before extraction", () => {
    assert.doesNotMatch(
        workflow,
        /(?:releases\/download\/latest|ffmpeg-(?:master-latest|release-amd64-static))/,
        "release jobs must not download FFmpeg through a mutable alias"
    )

    for (const pinnedArtifact of [
        "autobuild-2026-06-30-13-34/ffmpeg-N-125365-g9a01c1cb6a-win64-gpl.zip",
        "releases/ffmpeg-7.0.2-amd64-static.tar.xz",
        "releases/download/b6.0/ffmpeg-darwin-arm64.gz",
        "releases/download/b6.0/ffmpeg-darwin-x64.gz",
    ]) {
        assert.ok(workflow.includes(pinnedArtifact), `missing immutable FFmpeg pin: ${pinnedArtifact}`)
    }

    for (const sha256 of [
        "52c0383c460f0ec1039088f1591921fb82e3b870b32aab8faf2ff1e5ae14bf9d",
        "abda8d77ce8309141f83ab8edf0596834087c52467f6badf376a6a2a4c87cf67",
        "6be74d6f449889c2e87a75873894f8520cad56c08ac76f2a628d85b0519daaca",
        "a12354fce7eb62361473bbe10d53a1893695babd35869ec8e92e5dfea8d0440b",
    ]) {
        assert.ok(workflow.includes(sha256), `missing FFmpeg SHA-256 pin: ${sha256}`)
    }

    const windowsVerify = workflow.indexOf("Get-FileHash -Path ffmpeg.zip -Algorithm SHA256")
    const windowsExtract = workflow.indexOf("Expand-Archive -Path ffmpeg.zip")
    assert.ok(windowsVerify >= 0 && windowsVerify < windowsExtract)

    const linuxVerify = workflow.indexOf("sha256sum --check --strict -")
    const linuxExtract = workflow.indexOf("tar -xf ffmpeg.tar.xz")
    assert.ok(linuxVerify >= 0 && linuxVerify < linuxExtract)

    const macVerify = workflow.indexOf("shasum -a 256 --check")
    const macExtract = workflow.indexOf("gunzip -f ffmpeg-arm64.gz")
    assert.ok(macVerify >= 0 && macVerify < macExtract)

    assert.equal(
        workflow.match(/curl --fail --location --show-error --silent/g)?.length,
        3,
        "every Unix FFmpeg download must fail on HTTP errors"
    )
})

test("release automation pins actions, minimizes write access, and binds manual runs to a tag", () => {
    const workflows = [workflow, ciWorkflow, pagesWorkflow]
    const actionRefs = workflows.flatMap(contents => [
        ...contents.matchAll(/uses:\s+([^@\s]+)@([^\s#]+)/g),
    ])
    assert.ok(actionRefs.length > 0)
    for (const [, action, ref] of actionRefs) {
        assert.match(ref, /^[0-9a-f]{40}$/, `${action} must use an immutable commit SHA`)
    }

    assert.match(workflow, /permissions:\s*\n\s+contents: read/)
    assert.equal(
        workflow.match(/contents: write/g)?.length,
        1,
        "only the final publisher may receive contents:write"
    )
    assert.match(workflow, /validate_release:/)
    assert.match(
        workflow,
        /group: release-\$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.tag \|\| github\.ref_name \}\}/,
        "tag push and manual dispatch must share one release concurrency key"
    )
    assert.match(workflow, /commit: \$\{\{ steps\.validated_ref\.outputs\.commit \}\}/)
    assert.match(workflow, /release tag must match vMAJOR\.MINOR\.PATCH/)
    assert.match(workflow, /git describe --tags --exact-match HEAD/)
    assert.match(workflow, /git merge-base --is-ancestor HEAD refs\/remotes\/origin\/main/)
    assert.match(workflow, /release tag commit must already be contained in origin\/main/)
    assert.match(workflow, /Tag does not match package version/)
    assert.equal(
        workflow.match(/ref: \$\{\{ needs\.validate_release\.outputs\.commit \}\}/g)?.length,
        4,
        "every build and the publisher must check out the validated commit"
    )
    assert.match(workflow, /Reverify immutable release target/)
    assert.match(
        workflow,
        /git rev-list -n 1 "refs\/tags\/\$RELEASE_TAG"\)" = "\$EXPECTED_COMMIT"/
    )
})

test("Pages deployment waits for the matching hardened release", () => {
    assert.match(pagesWorkflow, /"on":\s*\n\s+workflow_dispatch:/)
    assert.doesNotMatch(pagesWorkflow, /\n\s+push:/)
    assert.match(pagesWorkflow, /Require the matching hardened release and checksums/)
    assert.match(pagesWorkflow, /releases\/latest/)
    assert.match(pagesWorkflow, /actual_tag.*expected_tag/)
    assert.match(pagesWorkflow, /SHA256SUMS\.txt/)
})
