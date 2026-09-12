import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import { createWriteStream } from "node:fs"
import {
    mkdir,
    mkdtemp,
    open,
    readFile,
    readdir,
    rm,
    symlink,
    writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Writable } from "node:stream"
import { fileURLToPath } from "node:url"
import { Client } from "@modelcontextprotocol/client"
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio"
import test from "node:test"
import yazl from "yazl"
import {
    addFlowtakeCaptions,
    getFlowtakeProjectSummary,
    getFlowtakeTimeline,
    listFlowtakeProjects,
    splitFlowtakeItem,
    toMcpError,
    trimFlowtakeItem,
    updateFlowtakeCaption,
} from "../src/flowtakeEditing.mjs"
import {
    FlowtakeProjectStore,
    ProjectStoreError,
    assertArchivePayloadPreserved,
    extractProjectArchive,
    preflightProjectArchive,
    writeZipFromDirectory,
} from "../src/projectStore.mjs"
import { parseServerOptions } from "../server.mjs"

const SERVER_PATH = fileURLToPath(new URL("../server.mjs", import.meta.url))

function makeProject({ id = "project-demo", name = "Private demo" } = {}) {
    return {
        version: 1,
        project: {
            id,
            name,
            hasCameraVideo: false,
            hasMicrophoneAudio: false,
            hasSystemAudio: false,
            aspectRatio: "16x9",
            videoDetails: { start: 0, end: 10000 },
        },
        clipAnims: {
            playbackRate: 1,
            entities: [{
                id: "clip-main",
                start: 0,
                end: 10000,
                sourceStart: 0,
                sourceEnd: 10000,
                playbackRate: 1,
            }],
        },
        subtitleAnims: {
            entities: [{
                id: "caption-existing",
                start: 500,
                end: 1500,
                text: "Private caption text",
                entranceEffect: { type: "none", duration: 300 },
                exitEffect: { type: "none", duration: 300 },
            }],
        },
        audioTrackAnims: {
            tracks: [{ id: 0, name: "Audio 1", locked: false }],
            entities: [],
        },
        overlayAnims: {
            tracks: [{ id: 0, name: "Overlay 1", locked: false }],
            entities: [],
        },
        maskAnims: { entities: [] },
    }
}

async function createFixture() {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), "flowtake-mcp-test-"))
    const appData = path.join(fixtureRoot, "app-data")
    const projectsDirectory = path.join(appData, "projects")
    const tempDirectory = path.join(appData, "temp")
    await mkdir(projectsDirectory, { recursive: true })
    await mkdir(tempDirectory, { recursive: true })
    return {
        fixtureRoot,
        projectsDirectory,
        tempDirectory,
        store: new FlowtakeProjectStore({ projectsDirectory, tempDirectory }),
    }
}

async function addExtractedProject(fixture, id = "project-demo") {
    const directory = path.join(fixture.projectsDirectory, id)
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, "project.json"), `${JSON.stringify(makeProject({ id }), null, 2)}\n`)
    return directory
}

async function addArchiveProject(fixture, id = "archive-demo") {
    const source = path.join(fixture.fixtureRoot, `${id}-source`)
    const nestedMedia = path.join(source, "media", "audio")
    const nestedAssets = path.join(source, "assets", "overlays")
    await mkdir(source, { recursive: true })
    await mkdir(nestedMedia, { recursive: true })
    await mkdir(nestedAssets, { recursive: true })
    await writeFile(path.join(source, "project.json"), `${JSON.stringify(makeProject({ id }), null, 2)}\n`)
    await writeFile(path.join(source, "screen.mp4"), Buffer.alloc(256 * 1024, 0x5a))
    await writeFile(path.join(nestedMedia, "system-audio.bin"), Buffer.from(
        Array.from({ length: 8192 }, (_, index) => (index * 31) % 256),
    ))
    await writeFile(path.join(nestedAssets, "logo.rgba"), Buffer.from(
        Array.from({ length: 4096 }, (_, index) => (index * 17 + 5) % 256),
    ))
    const archive = path.join(fixture.projectsDirectory, `${id}.zip`)
    await writeZipFromDirectory(source, archive)
    return archive
}

async function writeCustomArchive(destination, entries) {
    await new Promise((resolve, reject) => {
        const archive = new yazl.ZipFile()
        const output = createWriteStream(destination, { flags: "wx" })
        archive.outputStream.on("error", reject)
        output.on("error", reject)
        output.on("close", resolve)
        archive.outputStream.pipe(output)
        for (const entry of entries) {
            archive.addBuffer(entry.contents, entry.name, {
                compress: entry.compress ?? true,
                mode: entry.mode ?? 0o100600,
            })
        }
        archive.end()
    })
}

function createDiskFullOutputStream(destination) {
    let handle

    return new Writable({
        construct(callback) {
            open(destination, "wx", 0o600).then(fileHandle => {
                handle = fileHandle
                this.emit("open", fileHandle.fd)
                callback()
            }, callback)
        },
        write(chunk, _encoding, callback) {
            const partialChunk = chunk.subarray(0, Math.min(chunk.length, 64))
            handle.write(partialChunk).then(() => {
                const error = new Error("Injected archive output failure")
                error.code = "ENOSPC"
                callback(error)
            }, callback)
        },
        destroy(error, callback) {
            if (!handle) {
                callback(error)
                return
            }
            const currentHandle = handle
            handle = null
            currentHandle.close().then(
                () => callback(error),
                closeError => callback(error ?? closeError),
            )
        },
    })
}

async function withFixture(run) {
    const fixture = await createFixture()
    try {
        return await run(fixture)
    } finally {
        await rm(fixture.fixtureRoot, { recursive: true, force: true })
    }
}

test("read tools stay inside the allowlist and keep caption text opt-in", async () => {
    await withFixture(async fixture => {
        await addExtractedProject(fixture)
        const listed = await fixture.store.listProjects()
        assert.equal(listed.length, 1)
        assert.equal(listed[0].projectRef, "project-demo/project.json")
        assert.equal(listed[0].document.project.name, "Private demo")

        const privateList = await listFlowtakeProjects(fixture.store)
        assert.equal(privateList.projects[0].name, undefined)
        const namedList = await listFlowtakeProjects(fixture.store, { includeNames: true })
        assert.equal(namedList.projects[0].name, "Private demo")

        const privateSummary = await getFlowtakeProjectSummary(fixture.store, "project-demo")
        assert.equal(privateSummary.summary.name, undefined)
        const namedSummary = await getFlowtakeProjectSummary(
            fixture.store,
            "project-demo",
            { includeName: true },
        )
        assert.equal(namedSummary.summary.name, "Private demo")

        const hidden = await getFlowtakeTimeline(fixture.store, {
            projectRef: "project-demo",
            rows: ["subtitles"],
        })
        assert.equal(hidden.items[0].text, undefined)
        assert.equal(hidden.items[0].textLength, 20)

        const visible = await getFlowtakeTimeline(fixture.store, {
            projectRef: "project-demo",
            rows: ["subtitles"],
            includeText: true,
        })
        assert.equal(visible.items[0].text, "Private caption text")

        await assert.rejects(
            fixture.store.readProject(path.resolve(fixture.fixtureRoot, "outside.zip")),
            error => error instanceof ProjectStoreError && error.code === "invalid-project-reference",
        )
        await assert.rejects(
            fixture.store.readProject("../outside.zip"),
            error => error instanceof ProjectStoreError && error.code === "project-outside-root",
        )
    })
})

test("unexpected errors do not expose local filesystem paths", () => {
    const secretPath = "C:\\Users\\Private Client\\recordings\\secret.mp4"
    const result = toMcpError(new Error(`ENOENT while opening ${secretPath}`))
    assert.equal(result.error, "internal-error")
    assert.doesNotMatch(result.message, /Private Client|secret\.mp4|C:\\/)
})

test("timeline duration includes content beyond the recorded source end", async () => {
    await withFixture(async fixture => {
        const projectDirectory = path.join(fixture.projectsDirectory, "extended-timeline")
        const project = makeProject({ id: "extended-timeline" })
        project.clipAnims.entities[0].end = 8000
        project.clipAnims.entities[0].sourceEnd = 8000
        project.clipAnims.entities.push({
            id: "clip-late",
            start: 10000,
            end: 12000,
            sourceStart: 8000,
            sourceEnd: 10000,
            playbackRate: 1,
        })
        await mkdir(projectDirectory, { recursive: true })
        await writeFile(
            path.join(projectDirectory, "project.json"),
            `${JSON.stringify(project, null, 2)}\n`,
        )

        const summary = await getFlowtakeProjectSummary(fixture.store, "extended-timeline")
        assert.equal(summary.summary.durationMs, 12000)

        const timeline = await getFlowtakeTimeline(fixture.store, {
            projectRef: "extended-timeline",
            rows: ["clips"],
        })
        assert.deepEqual(timeline.range, { startMs: 0, endMs: 12000 })
        assert.equal(timeline.items.find(item => item.id === "clip-late").endMs, 12000)

        const trimmed = await trimFlowtakeItem(fixture.store, {
            projectRef: "extended-timeline",
            expectedRevision: summary.revision,
            row: "clips",
            itemId: "clip-late",
            startMs: 10000,
            endMs: 11000,
            dryRun: true,
        })
        assert.equal(trimmed.dryRun, true)
        assert.deepEqual(trimmed.editResult.range, { startMs: 10000, endMs: 11000 })
    })
})

test("video overlay split and trim fail closed instead of shifting source playback", async () => {
    await withFixture(async fixture => {
        const projectDirectory = path.join(fixture.projectsDirectory, "video-overlay-project")
        const project = makeProject({ id: "video-overlay-project" })
        project.overlayAnims.entities = [{
            id: "video-overlay",
            trackIndex: 0,
            start: 1000,
            end: 5000,
            overlayType: "video",
            sourceStart: 750,
            sourceDuration: 6000,
            playbackRate: 1.5,
            loop: true,
        }]
        await mkdir(projectDirectory, { recursive: true })
        await writeFile(
            path.join(projectDirectory, "project.json"),
            `${JSON.stringify(project, null, 2)}\n`,
        )

        const summary = await getFlowtakeProjectSummary(fixture.store, "video-overlay-project")
        const timeline = await getFlowtakeTimeline(fixture.store, {
            projectRef: "video-overlay-project",
            rows: ["overlay-tracks"],
        })
        assert.equal(timeline.items[0].overlayType, "video")

        await assert.rejects(
            splitFlowtakeItem(fixture.store, {
                projectRef: "video-overlay-project",
                expectedRevision: summary.revision,
                row: "overlay-tracks",
                itemId: "video-overlay",
                splitAtMs: 3000,
                dryRun: true,
            }),
            error => error.code === "video-overlay-source-timing-unsupported",
        )
        await assert.rejects(
            trimFlowtakeItem(fixture.store, {
                projectRef: "video-overlay-project",
                expectedRevision: summary.revision,
                row: "overlay-tracks",
                itemId: "video-overlay",
                startMs: 2000,
                dryRun: true,
            }),
            error => error.code === "video-overlay-source-timing-unsupported",
        )

        const unchanged = await fixture.store.readProject("video-overlay-project")
        assert.equal(unchanged.revision, summary.revision)
        assert.equal(unchanged.document.overlayAnims.entities[0].sourceStart, 750)
    })
})

test("split, trim, captions, revisions, backups, and dry runs are guarded", async () => {
    await withFixture(async fixture => {
        await addExtractedProject(fixture)
        const initial = await getFlowtakeProjectSummary(fixture.store, "project-demo")
        const before = await readFile(path.join(fixture.projectsDirectory, "project-demo", "project.json"), "utf8")

        const dryRun = await splitFlowtakeItem(fixture.store, {
            projectRef: "project-demo",
            expectedRevision: initial.revision,
            row: "clips",
            itemId: "clip-main",
            splitAtMs: 5000,
            newItemId: "clip-right",
            dryRun: true,
        })
        assert.equal(dryRun.dryRun, true)
        assert.equal(dryRun.backupRef, null)
        assert.equal(
            await readFile(path.join(fixture.projectsDirectory, "project-demo", "project.json"), "utf8"),
            before,
        )

        const split = await splitFlowtakeItem(fixture.store, {
            projectRef: "project-demo",
            expectedRevision: initial.revision,
            row: "clips",
            itemId: "clip-main",
            splitAtMs: 5000,
            newItemId: "clip-right",
        })
        assert.equal(split.dryRun, false)
        assert.match(split.backupRef, /^\.flowtake-mcp-backups\//)
        assert.notEqual(split.revision, initial.revision)

        await assert.rejects(
            splitFlowtakeItem(fixture.store, {
                projectRef: "project-demo",
                expectedRevision: initial.revision,
                row: "clips",
                itemId: "clip-main",
                splitAtMs: 2500,
            }),
            error => error.code === "revision-mismatch",
        )

        const trimmed = await trimFlowtakeItem(fixture.store, {
            projectRef: "project-demo",
            expectedRevision: split.revision,
            row: "clips",
            itemId: "clip-main",
            startMs: 1000,
            endMs: 4000,
        })
        const afterTrim = await fixture.store.readProject("project-demo")
        const trimmedClip = afterTrim.document.clipAnims.entities.find(item => item.id === "clip-main")
        assert.deepEqual(
            {
                start: trimmedClip.start,
                end: trimmedClip.end,
                sourceStart: trimmedClip.sourceStart,
                sourceEnd: trimmedClip.sourceEnd,
            },
            { start: 1000, end: 4000, sourceStart: 1000, sourceEnd: 4000 },
        )

        const added = await addFlowtakeCaptions(fixture.store, {
            projectRef: "project-demo",
            expectedRevision: trimmed.revision,
            captions: [{
                id: "caption-ai",
                startMs: 2000,
                endMs: 3200,
                text: "AI-added caption",
                entranceEffect: { type: "fade", duration: 250 },
            }],
        })
        assert.equal(added.editResult.added[0].id, "caption-ai")

        const updated = await updateFlowtakeCaption(fixture.store, {
            projectRef: "project-demo",
            expectedRevision: added.revision,
            itemId: "caption-ai",
            text: "Revised locally",
            exitEffect: { type: "slide-down", duration: 400 },
        })
        assert.equal(updated.editResult.updated.text, "Revised locally")

        const backupNames = await readdir(path.join(fixture.projectsDirectory, ".flowtake-mcp-backups"))
        assert.equal(backupNames.length, 4)
        await assert.rejects(
            fixture.store.readProject(`.flowtake-mcp-backups/${backupNames[0]}`),
            error => error.code === "protected-backup-reference",
        )
    })
})

test("ZIP edits stream media, verify replacement, and fail closed for an open Flowtake workspace", async () => {
    await withFixture(async fixture => {
        const archivePath = await addArchiveProject(fixture)
        const originalArchive = await readFile(archivePath)
        let summary = await getFlowtakeProjectSummary(fixture.store, "archive-demo.zip")
        assert.deepEqual(summary.storageState, {
            archive: true,
            openWorkspacePresent: false,
            writable: true,
            note: "Archive is not currently extracted by Flowtake according to the configured temp directory.",
        })

        const openWorkspace = path.join(fixture.tempDirectory, "archive-demo")
        await mkdir(openWorkspace, { recursive: true })
        summary = await getFlowtakeProjectSummary(fixture.store, "archive-demo.zip")
        assert.equal(summary.storageState.openWorkspacePresent, true)
        assert.equal(summary.storageState.writable, false)
        const openPreview = await splitFlowtakeItem(fixture.store, {
            projectRef: "archive-demo.zip",
            expectedRevision: summary.revision,
            row: "clips",
            itemId: "clip-main",
            splitAtMs: 5000,
            newItemId: "clip-preview",
            dryRun: true,
        })
        assert.equal(openPreview.dryRun, true)
        assert.match(openPreview.previewWarning, /last saved archive/i)
        await assert.rejects(
            splitFlowtakeItem(fixture.store, {
                projectRef: "archive-demo.zip",
                expectedRevision: summary.revision,
                row: "clips",
                itemId: "clip-main",
                splitAtMs: 5000,
                newItemId: "clip-right",
            }),
            error => error.code === "project-open-in-flowtake",
        )

        await rm(openWorkspace, { recursive: true, force: true })
        const changed = await splitFlowtakeItem(fixture.store, {
            projectRef: "archive-demo.zip",
            expectedRevision: summary.revision,
            row: "clips",
            itemId: "clip-main",
            splitAtMs: 5000,
            newItemId: "clip-right",
        })
        assert.notEqual(changed.revision, summary.revision)

        const unpacked = path.join(fixture.fixtureRoot, "verified")
        await mkdir(unpacked)
        await extractProjectArchive(archivePath, unpacked)
        assert.deepEqual(await readFile(path.join(unpacked, "screen.mp4")), Buffer.alloc(256 * 1024, 0x5a))
        assert.deepEqual(
            await readFile(path.join(unpacked, "media", "audio", "system-audio.bin")),
            Buffer.from(Array.from({ length: 8192 }, (_, index) => (index * 31) % 256)),
        )
        assert.deepEqual(
            await readFile(path.join(unpacked, "assets", "overlays", "logo.rgba")),
            Buffer.from(Array.from({ length: 4096 }, (_, index) => (index * 17 + 5) % 256)),
        )
        const manifest = JSON.parse(await readFile(path.join(unpacked, "project.json"), "utf8"))
        assert.deepEqual(manifest.clipAnims.entities.map(item => item.id), ["clip-main", "clip-right"])

        const backups = await readdir(path.join(fixture.projectsDirectory, ".flowtake-mcp-backups"))
        assert.equal(backups.length, 1)
        assert.match(backups[0], /\.archive\.zip$/)
        const backupPath = path.join(
            fixture.projectsDirectory,
            ".flowtake-mcp-backups",
            backups[0],
        )
        assert.deepEqual(await readFile(backupPath), originalArchive)

        const restored = path.join(fixture.fixtureRoot, "restored-backup")
        await mkdir(restored)
        await extractProjectArchive(backupPath, restored)
        const backupManifest = JSON.parse(await readFile(path.join(restored, "project.json"), "utf8"))
        assert.equal(backupManifest.clipAnims.entities.length, 1)
        assert.deepEqual(
            await readFile(path.join(restored, "media", "audio", "system-audio.bin")),
            Buffer.from(Array.from({ length: 8192 }, (_, index) => (index * 31) % 256)),
        )

        await writeFile(archivePath, await readFile(backupPath))
        assert.deepEqual(await readFile(archivePath), originalArchive)
    })
})

test("ZIP output failures close streams, remove partial archives, and preserve the original", async () => {
    await withFixture(async fixture => {
        const archivePath = await addArchiveProject(fixture)
        const originalArchive = await readFile(archivePath)
        let failedOutput
        const store = new FlowtakeProjectStore({
            projectsDirectory: fixture.projectsDirectory,
            tempDirectory: fixture.tempDirectory,
            writeArchive: (sourceDirectory, destinationZip) => writeZipFromDirectory(
                sourceDirectory,
                destinationZip,
                {
                    createOutputStream: destination => {
                        failedOutput = createDiskFullOutputStream(destination)
                        return failedOutput
                    },
                },
            ),
        })
        const summary = await getFlowtakeProjectSummary(store, "archive-demo.zip")

        await assert.rejects(
            splitFlowtakeItem(store, {
                projectRef: "archive-demo.zip",
                expectedRevision: summary.revision,
                row: "clips",
                itemId: "clip-main",
                splitAtMs: 5000,
                newItemId: "clip-right",
            }),
            error => error.code === "ENOSPC",
        )

        assert.equal(failedOutput.destroyed, true)
        assert.equal(failedOutput.closed, true)
        assert.deepEqual(await readFile(archivePath), originalArchive)
        const projectEntries = await readdir(fixture.projectsDirectory)
        assert.equal(projectEntries.some(name => name.includes(".flowtake-mcp-") && name.endsWith(".tmp")), false)
        const backups = await readdir(path.join(fixture.projectsDirectory, ".flowtake-mcp-backups"))
            .catch(error => error.code === "ENOENT" ? [] : Promise.reject(error))
        assert.deepEqual(backups, [])
    })
})

test("archive preflight rejects symlinks, case collisions, and zip-bomb expansion before extraction", async () => {
    await withFixture(async fixture => {
        const manifest = Buffer.from(`${JSON.stringify(makeProject())}\n`)
        const symlinkArchive = path.join(fixture.projectsDirectory, "symlink.zip")
        await writeCustomArchive(symlinkArchive, [
            { name: "project.json", contents: manifest },
            { name: "escape", contents: Buffer.from("../outside"), mode: 0o120777 },
        ])
        await assert.rejects(
            preflightProjectArchive(symlinkArchive),
            error => error.code === "unsafe-project-archive" && /symbolic link/i.test(error.message),
        )

        const collisionArchive = path.join(fixture.projectsDirectory, "collision.zip")
        await writeCustomArchive(collisionArchive, [
            { name: "project.json", contents: manifest },
            { name: "PROJECT.JSON", contents: manifest },
        ])
        await assert.rejects(
            preflightProjectArchive(collisionArchive),
            error => error.code === "unsafe-project-archive" && /case-colliding/i.test(error.message),
        )

        const backslashArchive = path.join(fixture.projectsDirectory, "backslash.zip")
        await writeCustomArchive(backslashArchive, [
            { name: "project.json", contents: manifest },
            { name: "folder/escape.txt", contents: Buffer.from("unsafe") },
        ])
        const backslashBytes = await readFile(backslashArchive)
        const slashName = Buffer.from("folder/escape.txt")
        const backslashName = Buffer.from("folder\\escape.txt")
        let backslashReplacementCount = 0
        for (let offset = backslashBytes.indexOf(slashName); offset >= 0; offset = backslashBytes.indexOf(slashName, offset + 1)) {
            backslashName.copy(backslashBytes, offset)
            backslashReplacementCount += 1
        }
        assert.equal(backslashReplacementCount, 2)
        await writeFile(backslashArchive, backslashBytes)
        await assert.rejects(
            preflightProjectArchive(backslashArchive),
            error => ["invalid-project-archive", "unsafe-project-archive"].includes(error.code),
        )

        const traversalArchive = path.join(fixture.projectsDirectory, "traversal.zip")
        await writeCustomArchive(traversalArchive, [
            { name: "project.json", contents: manifest },
            { name: "aa/evil", contents: Buffer.from("unsafe") },
        ])
        const traversalBytes = await readFile(traversalArchive)
        const safeName = Buffer.from("aa/evil")
        const unsafeName = Buffer.from("../evil")
        let replacementCount = 0
        for (let offset = traversalBytes.indexOf(safeName); offset >= 0; offset = traversalBytes.indexOf(safeName, offset + 1)) {
            unsafeName.copy(traversalBytes, offset)
            replacementCount += 1
        }
        assert.equal(replacementCount, 2)
        await writeFile(traversalArchive, traversalBytes)
        await assert.rejects(
            preflightProjectArchive(traversalArchive),
            error => error.code === "invalid-project-archive" || error.code === "unsafe-project-archive",
        )

        const bombArchive = path.join(fixture.projectsDirectory, "bomb.zip")
        await writeCustomArchive(bombArchive, [
            { name: "project.json", contents: manifest },
            { name: "repeated.bin", contents: Buffer.alloc(2 * 1024 * 1024, 0x41) },
        ])
        await assert.rejects(
            preflightProjectArchive(bombArchive),
            error => error.code === "unsafe-project-archive" && /expansion ratio/i.test(error.message),
        )

        const originalPayloadArchive = path.join(fixture.projectsDirectory, "payload-original.zip")
        const changedPayloadArchive = path.join(fixture.projectsDirectory, "payload-changed.zip")
        await writeCustomArchive(originalPayloadArchive, [
            { name: "project.json", contents: manifest },
            { name: "media/nested.bin", contents: Buffer.from([1, 2, 3, 4]) },
        ])
        await writeCustomArchive(changedPayloadArchive, [
            { name: "project.json", contents: manifest },
            { name: "media/nested.bin", contents: Buffer.from([1, 2, 3, 5]) },
        ])
        const originalPayload = await preflightProjectArchive(originalPayloadArchive)
        const changedPayload = await preflightProjectArchive(changedPayloadArchive)
        assert.throws(
            () => assertArchivePayloadPreserved(originalPayload, changedPayload),
            error => error.code === "archive-verification-failed",
        )

        for (const archive of [
            symlinkArchive,
            collisionArchive,
            backslashArchive,
            traversalArchive,
            bombArchive,
        ]) {
            const destination = path.join(fixture.fixtureRoot, `extract-${path.basename(archive)}`)
            await mkdir(destination)
            await assert.rejects(extractProjectArchive(archive, destination))
            assert.deepEqual(await readdir(destination), [])
        }
    })
})

test("server options reject missing paths and backup directories cannot escape the allowlist", async t => {
    assert.throws(() => parseServerOptions(["--projects-dir"]), /requires a directory/)
    assert.throws(() => parseServerOptions(["--projects-dir="]), /requires a directory/)
    assert.throws(() => parseServerOptions(["--projects-dir", "   "]), /requires a directory/)
    assert.throws(() => parseServerOptions(["--temp-dir"]), /requires a directory/)

    await withFixture(async fixture => {
        assert.throws(() => new FlowtakeProjectStore({
            projectsDirectory: fixture.projectsDirectory,
            backupDirectory: path.join(fixture.fixtureRoot, "outside-backups"),
        }), /must stay inside/)

        const outside = path.join(fixture.fixtureRoot, "outside")
        const linkedBackup = path.join(fixture.projectsDirectory, ".flowtake-mcp-backups")
        await mkdir(outside)
        try {
            await symlink(outside, linkedBackup, globalThis.process.platform === "win32" ? "junction" : "dir")
        } catch (error) {
            if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
                t.diagnostic(`backup symlink assertion skipped: ${error.code}`)
                return
            }
            throw error
        }
        const linkedStore = new FlowtakeProjectStore({
            projectsDirectory: fixture.projectsDirectory,
            tempDirectory: fixture.tempDirectory,
        })
        await assert.rejects(
            linkedStore.initialize(),
            error => error.code === "unsafe-backup-directory",
        )
    })
})

test("official MCP stdio client negotiates and calls the local server", async () => {
    await withFixture(async fixture => {
        await addExtractedProject(fixture, "protocol-demo")
        const transport = new StdioClientTransport({
            command: globalThis.process.execPath,
            args: [
                SERVER_PATH,
                "--projects-dir",
                fixture.projectsDirectory,
                "--temp-dir",
                fixture.tempDirectory,
            ],
            stderr: "pipe",
        })
        const stderrChunks = []
        transport.stderr.on("data", chunk => stderrChunks.push(chunk.toString()))
        const client = new Client({ name: "flowtake-mcp-test", version: "1.0.0" })

        try {
            await client.connect(transport)
            const tools = await client.listTools()
            assert.deepEqual(tools.tools.map(tool => tool.name).sort(), [
                "flowtake_add_captions",
                "flowtake_delete_item",
                "flowtake_get_timeline",
                "flowtake_list_projects",
                "flowtake_project_summary",
                "flowtake_split_item",
                "flowtake_trim_item",
                "flowtake_update_caption",
            ])

            const result = await client.callTool({
                name: "flowtake_list_projects",
                arguments: { limit: 10 },
            })
            assert.equal(result.isError, undefined)
            assert.equal(result.structuredContent.projects[0].projectRef, "protocol-demo/project.json")
            assert.equal(result.structuredContent.projects[0].name, undefined)

            const namedResult = await client.callTool({
                name: "flowtake_list_projects",
                arguments: { limit: 10, includeNames: true },
            })
            assert.equal(namedResult.structuredContent.projects[0].name, "Private demo")

            const summaryResult = await client.callTool({
                name: "flowtake_project_summary",
                arguments: { projectRef: "protocol-demo/project.json" },
            })
            const revision = summaryResult.structuredContent.revision
            const blocked = await client.callTool({
                name: "flowtake_split_item",
                arguments: {
                    projectRef: "protocol-demo/project.json",
                    expectedRevision: revision,
                    row: "clips",
                    itemId: "clip-main",
                    splitAtMs: 5000,
                    newItemId: "protocol-right",
                    flowtakeClosed: false,
                },
            })
            assert.equal(blocked.isError, true)
            assert.equal(JSON.parse(blocked.content[0].text).error, "flowtake-must-be-closed")

            const preview = await client.callTool({
                name: "flowtake_split_item",
                arguments: {
                    projectRef: "protocol-demo/project.json",
                    expectedRevision: revision,
                    row: "clips",
                    itemId: "clip-main",
                    splitAtMs: 5000,
                    newItemId: "protocol-right",
                    flowtakeClosed: false,
                    dryRun: true,
                },
            })
            assert.equal(preview.isError, undefined)
            assert.equal(preview.structuredContent.dryRun, true)
            assert.doesNotMatch(stderrChunks.join(""), new RegExp(
                fixture.projectsDirectory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "i",
            ))
        } finally {
            await client.close()
        }
    })
})
