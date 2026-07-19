import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import yaml from "js-yaml"

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
const rustAuditWorkflow = await readFile(
    new URL("../.github/workflows/rust-security-audit.yml", import.meta.url),
    "utf8"
)
const intakeUptimeWorkflow = await readFile(
    new URL("../.github/workflows/intake-uptime.yml", import.meta.url),
    "utf8"
)
const cargoAuditScript = await readFile(
    new URL("../scripts/run-cargo-audit.sh", import.meta.url),
    "utf8"
)

const parsedReleaseWorkflow = yaml.load(workflow)
const parsedCiWorkflow = yaml.load(ciWorkflow)
const parsedPagesWorkflow = yaml.load(pagesWorkflow)
const parsedRustAuditWorkflow = yaml.load(rustAuditWorkflow)
const parsedIntakeUptimeWorkflow = yaml.load(intakeUptimeWorkflow)

test("tracked GitHub workflows remain valid YAML", () => {
    for (const [name, parsed] of [
        ["release", parsedReleaseWorkflow],
        ["CI", parsedCiWorkflow],
        ["Pages", parsedPagesWorkflow],
        ["scheduled Rust audit", parsedRustAuditWorkflow],
        ["public intake uptime", parsedIntakeUptimeWorkflow],
    ]) {
        assert.ok(parsed && typeof parsed === "object", `${name} workflow must parse as YAML`)
        assert.ok(parsed.jobs && typeof parsed.jobs === "object", `${name} workflow must define jobs`)
    }
})

test("public intake monitoring is external, exact, least-privilege, and privacy-safe", () => {
    assert.deepEqual(Object.keys(parsedIntakeUptimeWorkflow.on).sort(), ["schedule", "workflow_dispatch"])
    assert.equal(parsedIntakeUptimeWorkflow.on.schedule[0].cron, "*/15 * * * *")
    assert.deepEqual(parsedIntakeUptimeWorkflow.permissions, {})
    assert.deepEqual(parsedIntakeUptimeWorkflow.jobs.health.permissions, {})
    assert.equal(parsedIntakeUptimeWorkflow.jobs.health["timeout-minutes"], 3)
    assert.match(intakeUptimeWorkflow, /https:\/\/flowtake\.72-62-41-174\.sslip\.io\/v1\/health/)
    assert.match(intakeUptimeWorkflow, /\[\[ "\$status" != "200" \|\| "\$body" != '\{"ok":true\}' \]\]/)
    assert.match(intakeUptimeWorkflow, /secrets\.FLOWTAKE_DISCORD_WEBHOOK/)
    assert.match(intakeUptimeWorkflow, /No lead or customer data was accessed\./)
    assert.doesNotMatch(intakeUptimeWorkflow, /decrypt|leadRefs|ciphertext|FLOWTAKE_ENCRYPTION_KEY/)
})

test("release publication fails closed across every supported platform", () => {
    assert.match(
        workflow,
        /if: always\(\) && needs\.release_quality_gate\.result == 'success' && needs\.build-windows\.result == 'success' && needs\.build-linux\.result == 'success' && needs\.build-macos\.result == 'success'/
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

test("every release path waits for an exact-commit test and security gate", () => {
    const gateStart = workflow.indexOf("  release_quality_gate:")
    const buildStart = workflow.indexOf("  build-windows:")
    assert.ok(gateStart >= 0 && gateStart < buildStart, "release gate must run before platform builds")

    const gate = workflow.slice(gateStart, buildStart)
    assert.match(gate, /needs: validate_release/)
    assert.match(gate, /ref: \$\{\{ needs\.validate_release\.outputs\.commit \}\}/)
    assert.match(gate, /EXPECTED_COMMIT: \$\{\{ needs\.validate_release\.outputs\.commit \}\}/)
    assert.match(gate, /test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_COMMIT"/)

    for (const requiredCommand of [
        "npm ci",
        "node --test",
        "test/releaseWorkflow.test.js",
        "test/nativeCapabilitySecurity.test.js",
        "test/nativePathSecurity.test.js",
        "test/youtubeOAuthSecurity.test.js",
        "test/liveStreamingSecurity.test.js",
        "test/updatesSettings.test.js",
        "npm test",
        "npm run lint",
        "npm run build:frontend",
        "bash ./scripts/run-cargo-audit.sh",
        "cargo check --locked --all-targets",
        "cargo test --lib --locked",
        "cargo clippy --locked --all-targets -- -D warnings --allow dead_code",
    ]) {
        assert.ok(gate.includes(requiredCommand), `release gate is missing: ${requiredCommand}`)
    }

    assert.match(gate, /install -Dm755 \/bin\/true src-tauri\/binaries\/ffmpeg-x86_64-unknown-linux-gnu/)
    assert.doesNotMatch(gate, /Download FFmpeg|FFMPEG_URL|Invoke-WebRequest/)
    assert.equal(
        workflow.match(/needs: \[validate_release, release_quality_gate\]/g)?.length,
        3,
        "every platform build must wait for the release gate"
    )
    assert.match(
        workflow,
        /needs: \[validate_release, release_quality_gate, build-windows, build-linux, build-macos\]/
    )
})

test("cargo-audit runner pins and verifies the exact RustSec release asset", () => {
    assert.match(cargoAuditScript, /CARGO_AUDIT_VERSION="0\.22\.2"/)
    assert.match(cargoAuditScript, /CARGO_AUDIT_TARGET="x86_64-unknown-linux-musl"/)
    assert.match(
        cargoAuditScript,
        /https:\/\/github\.com\/rustsec\/rustsec\/releases\/download\/cargo-audit\/v\$\{CARGO_AUDIT_VERSION\}\/\$\{CARGO_AUDIT_ARCHIVE\}/
    )
    assert.match(
        cargoAuditScript,
        /CARGO_AUDIT_SHA256="7fb9497f8594b389e5fce5ef9b92db08432996895b2e0c5a0167a69ed445c428"/
    )
    assert.match(cargoAuditScript, /sha256sum --check --strict -/)
    assert.match(cargoAuditScript, /--retry 3/)
    assert.match(cargoAuditScript, /--retry-all-errors/)
    assert.match(cargoAuditScript, /"\$\{CARGO_AUDIT_ARCHIVE_ROOT\}\/cargo-audit"/)
    assert.match(cargoAuditScript, /"\$\{cargo_audit_bin\}" audit --file "\$\{lockfile\}"/)

    const verifyIndex = cargoAuditScript.indexOf("sha256sum --check --strict -")
    const extractIndex = cargoAuditScript.indexOf("tar \\")
    const executeIndex = cargoAuditScript.indexOf('"${cargo_audit_bin}" audit --file')
    assert.ok(verifyIndex >= 0 && verifyIndex < extractIndex, "archive hash must be verified before extraction")
    assert.ok(extractIndex < executeIndex, "the verified binary must be extracted before execution")
})

test("cargo-audit runs without advisory ignores or inherited audit configuration", () => {
    assert.doesNotMatch(cargoAuditScript, /(?:^|\s)--ignore(?:\s|=)/m)
    assert.doesNotMatch(cargoAuditScript, /\|\|\s*true/)
    assert.match(cargoAuditScript, /CARGO_HOME="\$\{cargo_home\}"/)
    assert.match(cargoAuditScript, /cd -- "\$\{audit_workdir\}"/)
})

test("Rust security audit is required in CI, releases, and daily main monitoring", () => {
    const ciAuditJob = parsedCiWorkflow.jobs["rust-security-audit"]
    assert.equal(ciAuditJob.name, "Rust Security Audit")
    assert.deepEqual(ciAuditJob.permissions, { contents: "read" })
    assert.equal(ciAuditJob.if, undefined)
    assert.equal(ciAuditJob["continue-on-error"], undefined)
    assert.ok(ciAuditJob.steps.some(step => step.run === "bash ./scripts/run-cargo-audit.sh"))

    const releaseGate = parsedReleaseWorkflow.jobs.release_quality_gate
    assert.ok(releaseGate.steps.some(step => step.run === "bash ./scripts/run-cargo-audit.sh"))

    assert.deepEqual(Object.keys(parsedRustAuditWorkflow.on).sort(), ["schedule", "workflow_dispatch"])
    assert.equal(parsedRustAuditWorkflow.on.schedule.length, 1)
    assert.equal(parsedRustAuditWorkflow.on.schedule[0].cron, "23 4 * * *")
    assert.deepEqual(parsedRustAuditWorkflow.permissions, { contents: "read" })

    const scheduledJob = parsedRustAuditWorkflow.jobs.audit
    assert.equal(scheduledJob.if, undefined)
    assert.deepEqual(scheduledJob.permissions, { contents: "read" })
    assert.equal(scheduledJob["continue-on-error"], undefined)
    assert.ok(scheduledJob.steps.some(step => step.run === "bash ./scripts/run-cargo-audit.sh"))
    assert.equal(
        scheduledJob.steps.find(step => step.uses?.startsWith("actions/checkout@"))?.with?.ref,
        "refs/heads/main"
    )
    assert.doesNotMatch(rustAuditWorkflow, /issues:\s*write|create-issue|gh issue/)
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
    const workflows = [workflow, ciWorkflow, pagesWorkflow, rustAuditWorkflow, intakeUptimeWorkflow]
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
        5,
        "the quality gate, every build, and the publisher must check out the validated commit"
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
    const mainBranchGuard = pagesWorkflow.indexOf("Require a main-branch dispatch")
    const releaseGate = pagesWorkflow.indexOf("Require the matching hardened release and checksums")
    assert.ok(mainBranchGuard >= 0, "Pages deployment must reject non-main dispatches")
    assert.ok(mainBranchGuard < releaseGate, "main-branch guard must run before the release gate")
    assert.match(pagesWorkflow, /if \[\[ "\$GITHUB_REF" != "refs\/heads\/main" \]\]/)
    assert.match(pagesWorkflow, /Pages deployments must be dispatched from refs\/heads\/main/)
    assert.match(pagesWorkflow, /Require the matching hardened release and checksums/)
    assert.match(pagesWorkflow, /releases\/latest/)
    assert.match(pagesWorkflow, /actual_tag.*expected_tag/)
    assert.match(pagesWorkflow, /SHA256SUMS\.txt/)
})
