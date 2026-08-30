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
