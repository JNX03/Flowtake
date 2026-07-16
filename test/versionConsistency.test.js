import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const readRepoFile = file => readFile(path.join(repoRoot, file), "utf8")

function readCargoPackageVersion(source, packageName) {
    const packageMatch = source.match(new RegExp(`\\[\\[package\\]\\]\\r?\\nname = "${packageName}"\\r?\\nversion = "([^"]+)"`))
    assert.ok(packageMatch, `Expected ${packageName} package version in Cargo.lock`)
    return packageMatch[1]
}

test("release manifests share the same app version", async () => {
    const [
        packageJson,
        packageLockJson,
        tauriConfig,
        cargoToml,
        cargoLock
    ] = await Promise.all([
        readRepoFile("package.json").then(JSON.parse),
        readRepoFile("package-lock.json").then(JSON.parse),
        readRepoFile("src-tauri/tauri.conf.json").then(JSON.parse),
        readRepoFile("src-tauri/Cargo.toml"),
        readRepoFile("src-tauri/Cargo.lock")
    ])

    const releaseVersion = packageJson.version

    assert.match(releaseVersion, /^\d+\.\d+\.\d+$/)
    assert.equal(packageLockJson.version, releaseVersion)
    assert.equal(packageLockJson.packages[""].version, releaseVersion)
    assert.equal(tauriConfig.version, releaseVersion)
    assert.match(cargoToml, new RegExp(`^version = "${releaseVersion}"$`, "m"))
    assert.equal(readCargoPackageVersion(cargoLock, "flowtake"), releaseVersion)
})

test("security support guidance cannot drift to a stale app version", async () => {
    const securityPolicy = await readRepoFile("SECURITY.md")
    const supportedVersions = securityPolicy.split("## Reporting a Vulnerability")[0]

    assert.match(supportedVersions, /Latest published release/)
    assert.doesNotMatch(supportedVersions, /\b\d+\.\d+(?:\.\d+|\.x)?\b/)
})

test("security policy describes the configured CSP without overstating it", async () => {
    const [securityPolicy, tauriConfig] = await Promise.all([
        readRepoFile("SECURITY.md"),
        readRepoFile("src-tauri/tauri.conf.json").then(JSON.parse)
    ])

    const directives = Object.fromEntries(tauriConfig.app.security.csp
        .split(";")
        .map(directive => directive.trim().split(/\s+/))
        .filter(parts => parts[0])
        .map(([name, ...sources]) => [name, sources]))

    assert.ok(directives["script-src"].includes("'unsafe-inline'"))
    assert.ok(directives["style-src"].includes("'unsafe-inline'"))
    assert.ok(directives["connect-src"].includes("https:"))
    assert.ok(directives["connect-src"].includes("wss:"))
    assert.doesNotMatch(securityPolicy, /\bstrict\s+(?:content security policy|CSP)\b|\bCSP\b.{0,40}\bstrict\b/is)
    assert.match(securityPolicy, /inline styles\/scripts and broad HTTPS\/WebSocket connections/i)
    assert.match(securityPolicy, /CSP reduction remains an active hardening area/i)
})

test("launch copy keeps signing and preview support boundaries separate", async () => {
    const website = await readRepoFile("website/src/App.jsx")
    const heroNote = website.match(
        /<p className="honest-note">\s*(Windows artifacts[\s\S]*?)\s*<\/p>/,
    )

    assert.ok(heroNote, "expected the hero release-boundary note")

    const note = heroNote[1].replace(/\s+/g, " ").trim()
    assert.match(note, /Windows artifacts are unsigned/i)
    assert.match(note, /macOS is ad-hoc signed but not notarized/i)
    assert.match(note, /macOS and Linux remain preview builds/i)
    assert.doesNotMatch(note, /release artifacts are unsigned|unsigned preview builds/i)
})
