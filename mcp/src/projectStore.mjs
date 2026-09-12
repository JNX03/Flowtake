import { Buffer } from "node:buffer"
import { createHash, randomUUID } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import {
    copyFile,
    lstat,
    mkdir,
    mkdtemp,
    open,
    readdir,
    readFile,
    realpath,
    rename,
    rm,
    stat,
    statfs,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { finished, pipeline } from "node:stream/promises"
import yauzl from "yauzl"
import yazl from "yazl"

const MAX_MANIFEST_BYTES = 16 * 1024 * 1024
const MAX_ARCHIVE_ENTRIES = 10000
const MAX_ENTRY_UNCOMPRESSED_BYTES = 32 * 1024 * 1024 * 1024
const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 64 * 1024 * 1024 * 1024
const MAX_ENTRY_EXPANSION_RATIO = 1000
const MAX_ARCHIVE_EXPANSION_RATIO = 500
const BACKUP_DIRECTORY = ".flowtake-mcp-backups"
const locks = new Map()

export class ProjectStoreError extends Error {
    constructor(code, message, details = {}) {
        super(message)
        this.name = "ProjectStoreError"
        this.code = code
        this.details = details
    }
}

function sha256(value) {
    return createHash("sha256").update(value).digest("hex")
}

function timestampForFile(date = new Date()) {
    return date.toISOString().replace(/[-:]/g, "").replace(".", "-")
}

function isInside(root, candidate) {
    const relative = path.relative(root, candidate)
    return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
}

function toProjectRef(root, target) {
    return path.relative(root, target).split(path.sep).join("/")
}

async function nearestExistingPath(candidate) {
    let current = candidate
    while (true) {
        if (await lstat(current).catch(() => null)) return current
        const parent = path.dirname(current)
        if (parent === current) return current
        current = parent
    }
}

function safeBackupBase(reference) {
    return reference
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120) || "project"
}

function parseManifest(raw, sourceLabel) {
    try {
        const document = JSON.parse(raw)
        if (!document || typeof document !== "object" || Array.isArray(document)) {
            throw new TypeError("manifest root must be an object")
        }
        return document
    } catch {
        throw new ProjectStoreError(
            "invalid-project-json",
            `Project metadata is not valid JSON (${sourceLabel})`,
        )
    }
}

async function readSmallFile(filePath) {
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) {
        throw new ProjectStoreError("invalid-project", "project.json is not a regular file")
    }
    if (fileStat.size > MAX_MANIFEST_BYTES) {
        throw new ProjectStoreError(
            "manifest-too-large",
            `project.json exceeds the ${MAX_MANIFEST_BYTES / 1024 / 1024} MiB safety limit`,
        )
    }
    return readFile(filePath, "utf8")
}

function openZip(zipPath) {
    return new Promise((resolve, reject) => {
        yauzl.open(zipPath, {
            autoClose: true,
            decodeStrings: true,
            lazyEntries: true,
            strictFileNames: true,
            validateEntrySizes: true,
        }, (error, zipFile) => {
            if (error) reject(error)
            else resolve(zipFile)
        })
    })
}

function invalidArchive(message, details = {}) {
    return new ProjectStoreError("unsafe-project-archive", message, details)
}

function normalizedArchiveEntry(entry) {
    const fileName = entry.fileName
    if (typeof fileName !== "string" || !fileName || fileName.length > 1024) {
        throw invalidArchive("Archive contains an empty or overlong entry name")
    }
    if (fileName.includes("\\") || fileName.includes("\0") || fileName.includes("\ufffd")) {
        throw invalidArchive(`Archive entry uses an unsafe path encoding: ${fileName}`)
    }
    if (fileName.startsWith("/") || /^[a-zA-Z]:/.test(fileName)) {
        throw invalidArchive(`Archive entry uses an absolute path: ${fileName}`)
    }

    const isDirectoryName = fileName.endsWith("/")
    const trimmedName = isDirectoryName ? fileName.slice(0, -1) : fileName
    const segments = trimmedName.split("/")
    const hasUnsafeWindowsCharacter = segment => [...segment].some(character => (
        character.charCodeAt(0) <= 31 || '<>:"|?*'.includes(character)
    ))
    if (segments.length === 0 || segments.some(segment => (
        !segment
        || segment === "."
        || segment === ".."
        || segment.length > 255
        || hasUnsafeWindowsCharacter(segment)
        || /[. ]$/.test(segment)
        || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment)
    ))) {
        throw invalidArchive(`Archive entry has an unsafe path: ${fileName}`)
    }

    const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff
    const unixType = unixMode & 0o170000
    let type
    if (unixType === 0) type = isDirectoryName ? "directory" : "file"
    else if (unixType === 0o040000) type = "directory"
    else if (unixType === 0o100000) type = "file"
    else if (unixType === 0o120000) {
        throw invalidArchive(`Archive contains a symbolic link: ${fileName}`)
    } else {
        throw invalidArchive(`Archive contains a non-regular filesystem entry: ${fileName}`)
    }
    if ((type === "directory") !== isDirectoryName) {
        throw invalidArchive(`Archive entry type does not match its path: ${fileName}`)
    }
    if ((entry.generalPurposeBitFlag & 0x1) !== 0) {
        throw invalidArchive(`Encrypted archive entries are not supported: ${fileName}`)
    }
    if (![0, 8].includes(entry.compressionMethod)) {
        throw invalidArchive(`Unsupported ZIP compression method for ${fileName}`)
    }
    if (entry.uncompressedSize > MAX_ENTRY_UNCOMPRESSED_BYTES) {
        throw invalidArchive(`Archive entry is too large to extract safely: ${fileName}`)
    }
    const expansionRatio = entry.uncompressedSize / Math.max(1, entry.compressedSize)
    if (expansionRatio > MAX_ENTRY_EXPANSION_RATIO) {
        throw invalidArchive(`Archive entry has a suspicious expansion ratio: ${fileName}`)
    }

    const canonicalPath = segments
        .map(segment => segment.normalize("NFC").toLocaleLowerCase("en-US"))
        .join("/")
    return {
        fileName,
        canonicalPath,
        type,
        mode: unixMode & 0o777,
        compressedSize: entry.compressedSize,
        uncompressedSize: entry.uncompressedSize,
        crc32: entry.crc32,
    }
}

export async function preflightProjectArchive(zipPath) {
    let zipFile
    try {
        zipFile = await openZip(zipPath)
    } catch {
        throw new ProjectStoreError("invalid-project-archive", "Could not open the project archive safely")
    }

    return new Promise((resolve, reject) => {
        const entries = []
        const names = new Set()
        const filePaths = new Set()
        const requiredDirectories = new Set()
        let totalCompressed = 0
        let totalUncompressed = 0
        let settled = false

        const fail = error => {
            if (settled) return
            settled = true
            zipFile.close()
            reject(error instanceof ProjectStoreError
                ? error
                : new ProjectStoreError("invalid-project-archive", "Project archive validation failed"))
        }
        zipFile.on("error", fail)
        zipFile.on("entry", entry => {
            try {
                if (entries.length >= MAX_ARCHIVE_ENTRIES) {
                    throw invalidArchive(`Archive exceeds the ${MAX_ARCHIVE_ENTRIES} entry safety limit`)
                }
                const normalized = normalizedArchiveEntry(entry)
                if (names.has(normalized.canonicalPath)) {
                    throw invalidArchive(`Archive has a duplicate or case-colliding path: ${normalized.fileName}`)
                }

                const pathParts = normalized.canonicalPath.split("/")
                for (let index = 1; index < pathParts.length; index += 1) {
                    const parent = pathParts.slice(0, index).join("/")
                    if (filePaths.has(parent)) {
                        throw invalidArchive(`Archive nests an entry beneath a file: ${normalized.fileName}`)
                    }
                    requiredDirectories.add(parent)
                }
                if (normalized.type === "file" && requiredDirectories.has(normalized.canonicalPath)) {
                    throw invalidArchive(`Archive path is both a file and a directory: ${normalized.fileName}`)
                }

                names.add(normalized.canonicalPath)
                if (normalized.type === "file") filePaths.add(normalized.canonicalPath)
                totalCompressed += normalized.compressedSize
                totalUncompressed += normalized.uncompressedSize
                if (totalUncompressed > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
                    throw invalidArchive("Archive exceeds the total uncompressed-size safety limit")
                }
                entries.push(normalized)
                zipFile.readEntry()
            } catch (error) {
                fail(error)
            }
        })
        zipFile.on("end", () => {
            if (settled) return
            if (!entries.some(entry => entry.fileName === "project.json" && entry.type === "file")) {
                fail(new ProjectStoreError(
                    "missing-project-json",
                    "The project archive does not contain project.json at its root",
                ))
                return
            }
            if (totalUncompressed / Math.max(1, totalCompressed) > MAX_ARCHIVE_EXPANSION_RATIO) {
                fail(invalidArchive("Archive has a suspicious total expansion ratio"))
                return
            }
            settled = true
            resolve({ entries, totalCompressed, totalUncompressed })
        })
        zipFile.readEntry()
    })
}

async function ensureExtractionCapacity(directory, totalUncompressed) {
    const filesystem = await statfs(directory, { bigint: true })
    const available = filesystem.bavail * filesystem.bsize
    const needed = BigInt(Math.ceil(totalUncompressed * 1.05))
    if (needed > available) {
        throw invalidArchive("Not enough free temporary disk space to extract this project safely")
    }
}

async function ensureBackupCapacity(directory, sourceBytes) {
    const filesystem = await statfs(directory, { bigint: true })
    const available = filesystem.bavail * filesystem.bsize
    const needed = BigInt(sourceBytes) + (16n * 1024n * 1024n)
    if (needed > available) {
        throw new ProjectStoreError(
            "backup-disk-space",
            "Not enough free disk space to create a recoverable project archive backup",
        )
    }
}

export async function extractProjectArchive(zipPath, destinationDirectory) {
    const destination = path.resolve(destinationDirectory)
    const destinationStat = await lstat(destination).catch(() => null)
    if (!destinationStat?.isDirectory() || destinationStat.isSymbolicLink()) {
        throw invalidArchive("Archive extraction destination must be a real directory")
    }
    if ((await readdir(destination)).length !== 0) {
        throw invalidArchive("Archive extraction destination must be empty")
    }
    const realDestination = await realpath(destination)
    const signatureBefore = await sourceSignature(zipPath)
    const preflight = await preflightProjectArchive(zipPath)
    if (await sourceSignature(zipPath) !== signatureBefore) {
        throw new ProjectStoreError("project-changed", "Project archive changed during safety preflight")
    }
    await ensureExtractionCapacity(realDestination, preflight.totalUncompressed)

    const zipFile = await openZip(zipPath)
    return new Promise((resolve, reject) => {
        let index = 0
        let settled = false
        const fail = error => {
            if (settled) return
            settled = true
            zipFile.close()
            reject(error instanceof ProjectStoreError
                ? error
                : new ProjectStoreError("invalid-project-archive", "Project archive extraction failed"))
        }
        zipFile.on("error", fail)
        zipFile.on("entry", entry => {
            void (async () => {
                const expected = preflight.entries[index]
                const current = normalizedArchiveEntry(entry)
                if (!expected
                    || current.fileName !== expected.fileName
                    || current.compressedSize !== expected.compressedSize
                    || current.uncompressedSize !== expected.uncompressedSize
                    || current.crc32 !== expected.crc32) {
                    throw new ProjectStoreError("project-changed", "Project archive changed after safety preflight")
                }
                index += 1

                const outputPath = path.resolve(destination, ...current.fileName.replace(/\/$/, "").split("/"))
                if (!isInside(realDestination, outputPath)) {
                    throw invalidArchive(`Archive entry escapes the extraction directory: ${current.fileName}`)
                }
                if (current.type === "directory") {
                    await mkdir(outputPath, { recursive: true, mode: current.mode || 0o700 })
                    zipFile.readEntry()
                    return
                }

                const parent = path.dirname(outputPath)
                await mkdir(parent, { recursive: true, mode: 0o700 })
                const realParent = await realpath(parent)
                if (!isInside(realDestination, realParent)) {
                    throw invalidArchive(`Archive entry parent escapes the extraction directory: ${current.fileName}`)
                }
                const stream = await new Promise((resolveStream, rejectStream) => {
                    zipFile.openReadStream(entry, (error, readStream) => {
                        if (error) rejectStream(error)
                        else resolveStream(readStream)
                    })
                })
                await pipeline(
                    stream,
                    createWriteStream(outputPath, { flags: "wx", mode: current.mode || 0o600 }),
                )
                const outputStat = await stat(outputPath)
                if (outputStat.size !== current.uncompressedSize) {
                    throw invalidArchive(`Extracted size did not verify for ${current.fileName}`)
                }
                zipFile.readEntry()
            })().catch(fail)
        })
        zipFile.on("end", () => {
            if (settled) return
            if (index !== preflight.entries.length) {
                fail(new ProjectStoreError("project-changed", "Project archive entry count changed after preflight"))
                return
            }
            void sourceSignature(zipPath).then(signatureAfter => {
                if (signatureAfter !== signatureBefore) {
                    fail(new ProjectStoreError("project-changed", "Project archive changed during extraction"))
                    return
                }
                settled = true
                resolve(preflight)
            }, fail)
        })
        zipFile.readEntry()
    })
}

async function readZipManifest(zipPath) {
    let zipFile
    try {
        zipFile = await openZip(zipPath)
    } catch {
        throw new ProjectStoreError("invalid-project-archive", "Could not open the project archive safely")
    }

    return new Promise((resolve, reject) => {
        let settled = false

        const fail = error => {
            if (settled) return
            settled = true
            zipFile.close()
            reject(error instanceof ProjectStoreError
                ? error
                : new ProjectStoreError("invalid-project-archive", "Project archive manifest could not be read"))
        }

        zipFile.on("error", fail)
        zipFile.on("end", () => {
            if (!settled) fail(new ProjectStoreError(
                "missing-project-json",
                "The project archive does not contain project.json at its root",
            ))
        })
        zipFile.on("entry", entry => {
            if (entry.fileName !== "project.json") {
                zipFile.readEntry()
                return
            }
            if (entry.uncompressedSize > MAX_MANIFEST_BYTES) {
                fail(new ProjectStoreError(
                    "manifest-too-large",
                    `project.json exceeds the ${MAX_MANIFEST_BYTES / 1024 / 1024} MiB safety limit`,
                ))
                return
            }

            zipFile.openReadStream(entry, (error, stream) => {
                if (error) {
                    fail(error)
                    return
                }
                const chunks = []
                let size = 0
                stream.on("error", fail)
                stream.on("data", chunk => {
                    size += chunk.length
                    if (size > MAX_MANIFEST_BYTES) {
                        stream.destroy(new ProjectStoreError(
                            "manifest-too-large",
                            `project.json exceeds the ${MAX_MANIFEST_BYTES / 1024 / 1024} MiB safety limit`,
                        ))
                        return
                    }
                    chunks.push(chunk)
                })
                stream.on("end", () => {
                    if (settled) return
                    settled = true
                    const raw = Buffer.concat(chunks).toString("utf8")
                    zipFile.close()
                    resolve(raw)
                })
            })
        })
        zipFile.readEntry()
    })
}

async function collectArchiveEntries(root) {
    const entries = []

    async function visit(directory) {
        const children = await readdir(directory, { withFileTypes: true })
        for (const child of children) {
            const absolutePath = path.join(directory, child.name)
            const relativePath = path.relative(root, absolutePath).split(path.sep).join("/")
            const entryStat = await lstat(absolutePath)
            if (entryStat.isSymbolicLink()) {
                throw new ProjectStoreError(
                    "unsafe-project-entry",
                    `Refusing to package symbolic link: ${relativePath}`,
                )
            }
            if (entryStat.isDirectory()) {
                entries.push({ type: "directory", absolutePath, relativePath, mode: entryStat.mode })
                await visit(absolutePath)
            } else if (entryStat.isFile()) {
                entries.push({ type: "file", absolutePath, relativePath, mode: entryStat.mode })
            } else {
                throw new ProjectStoreError(
                    "unsafe-project-entry",
                    `Refusing to package non-file project entry: ${relativePath}`,
                )
            }
        }
    }

    await visit(root)
    return entries
}

async function destroyArchiveStreams(archive, output, inputStreams) {
    archive?.outputStream?.unpipe(output)

    const streams = [archive?.outputStream, output, ...inputStreams].filter(Boolean)
    for (const stream of streams) {
        if (!stream.destroyed) stream.destroy()
    }
    await Promise.allSettled(streams.map(stream => finished(stream, { cleanup: true })))
}

export async function writeZipFromDirectory(
    sourceDirectory,
    destinationZip,
    { createOutputStream = createWriteStream } = {},
) {
    const entries = await collectArchiveEntries(sourceDirectory)
    await mkdir(path.dirname(destinationZip), { recursive: true })

    const archive = new yazl.ZipFile()
    const inputStreams = new Set()
    let output
    let destinationCreated = false

    try {
        output = createOutputStream(destinationZip, { flags: "wx", mode: 0o600 })
        output.once("open", () => {
            destinationCreated = true
        })
        for (const entry of entries) {
            if (entry.type === "directory") {
                archive.addEmptyDirectory(`${entry.relativePath}/`, { mode: entry.mode })
            } else {
                const input = createReadStream(entry.absolutePath)
                inputStreams.add(input)
                input.once("close", () => inputStreams.delete(input))
                archive.addReadStream(input, entry.relativePath, {
                    compress: true,
                    mode: entry.mode,
                })
            }
        }
        archive.end()
        await pipeline(archive.outputStream, output)
    } catch (error) {
        await destroyArchiveStreams(archive, output, inputStreams)
        if (destinationCreated) {
            await rm(destinationZip, { force: true }).catch(() => {})
        }
        throw error
    }
}

export function assertArchivePayloadPreserved(original, repacked) {
    const payloadFiles = preflight => preflight.entries
        .filter(entry => entry.type === "file" && entry.fileName !== "project.json")
        .map(entry => ({
            fileName: entry.fileName,
            uncompressedSize: entry.uncompressedSize,
            crc32: entry.crc32,
        }))
        .sort((left, right) => left.fileName.localeCompare(right.fileName))

    const before = payloadFiles(original)
    const after = payloadFiles(repacked)
    if (before.length !== after.length) {
        throw new ProjectStoreError(
            "archive-verification-failed",
            "Repacked project archive did not preserve every media and asset file",
        )
    }
    for (let index = 0; index < before.length; index += 1) {
        const expected = before[index]
        const actual = after[index]
        if (actual.fileName !== expected.fileName
            || actual.uncompressedSize !== expected.uncompressedSize
            || actual.crc32 !== expected.crc32) {
            throw new ProjectStoreError(
                "archive-verification-failed",
                `Repacked project archive changed or dropped asset: ${expected.fileName}`,
            )
        }
    }
}

async function syncFile(filePath) {
    const handle = await open(filePath, "r+")
    try {
        await handle.sync()
    } finally {
        await handle.close()
    }
}

async function atomicWriteFile(target, contents) {
    const temporary = path.join(
        path.dirname(target),
        `.${path.basename(target)}.flowtake-mcp-${randomUUID()}.tmp`,
    )
    let handle
    try {
        handle = await open(temporary, "wx", 0o600)
        await handle.writeFile(contents, "utf8")
        await handle.sync()
        await handle.close()
        handle = null
        await rename(temporary, target)
    } finally {
        if (handle) await handle.close().catch(() => {})
        await rm(temporary, { force: true }).catch(() => {})
    }
}

async function atomicCopyFile(source, target, expectedSourceSignature) {
    const temporary = path.join(
        path.dirname(target),
        `.${path.basename(target)}.flowtake-mcp-${randomUUID()}.tmp`,
    )
    try {
        const signatureBefore = await sourceSignature(source)
        if (expectedSourceSignature && signatureBefore !== expectedSourceSignature) {
            throw new ProjectStoreError(
                "project-changed",
                "Project archive changed before its recoverable backup could be created",
            )
        }
        await copyFile(source, temporary)
        await syncFile(temporary)
        const [signatureAfter, sourceStat, backupStat] = await Promise.all([
            sourceSignature(source),
            stat(source),
            stat(temporary),
        ])
        if (signatureAfter !== signatureBefore || backupStat.size !== sourceStat.size) {
            throw new ProjectStoreError(
                "project-changed",
                "Project archive changed while its recoverable backup was being created",
            )
        }
        await rename(temporary, target)
    } finally {
        await rm(temporary, { force: true }).catch(() => {})
    }
}

async function sourceSignature(target) {
    const sourceStat = await stat(target)
    return `${sourceStat.size}:${sourceStat.mtimeMs}`
}

async function withProjectLock(key, task) {
    const prior = locks.get(key) ?? Promise.resolve()
    let release
    const gate = new Promise(resolve => { release = resolve })
    const tail = prior.catch(() => {}).then(() => gate)
    locks.set(key, tail)

    await prior.catch(() => {})
    try {
        return await task()
    } finally {
        release()
        if (locks.get(key) === tail) locks.delete(key)
    }
}

function normalizeExpectedRevision(value) {
    if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
        throw new ProjectStoreError(
            "invalid-revision",
            "expectedRevision must be the 64-character revision returned by a read tool",
        )
    }
    return value.toLowerCase()
}

export class FlowtakeProjectStore {
    constructor({ projectsDirectory, backupDirectory, tempDirectory, writeArchive = writeZipFromDirectory } = {}) {
        if (!projectsDirectory) {
            throw new TypeError("A Flowtake projects directory is required")
        }
        this.projectsDirectory = path.resolve(projectsDirectory)
        this.backupDirectory = path.resolve(
            backupDirectory ?? path.join(this.projectsDirectory, BACKUP_DIRECTORY),
        )
        this.tempDirectory = path.resolve(
            tempDirectory ?? path.join(path.dirname(this.projectsDirectory), "temp"),
        )
        if (typeof writeArchive !== "function") {
            throw new TypeError("The archive writer must be a function")
        }
        this.writeArchive = writeArchive
        if (!isInside(this.projectsDirectory, this.backupDirectory)) {
            throw new TypeError("The backup directory must stay inside the configured projects directory")
        }
        this.realProjectsDirectory = null
        this.realBackupDirectory = null
    }

    async initialize() {
        const rootStat = await stat(this.projectsDirectory).catch(() => null)
        if (!rootStat?.isDirectory()) {
            throw new ProjectStoreError(
                "projects-directory-not-found",
                "Configured Flowtake projects directory does not exist or is not a directory",
            )
        }
        this.realProjectsDirectory = await realpath(this.projectsDirectory)
        const backupAncestor = await nearestExistingPath(this.backupDirectory)
        const realBackupAncestor = await realpath(backupAncestor)
        if (!isInside(this.realProjectsDirectory, realBackupAncestor)) {
            throw new ProjectStoreError(
                "unsafe-backup-directory",
                "Backup directory resolves outside the configured projects directory",
            )
        }
        await mkdir(this.backupDirectory, { recursive: true })
        await this.#assertBackupDirectory()
        return this
    }

    async #assertBackupDirectory() {
        const backupStat = await lstat(this.backupDirectory).catch(() => null)
        if (!backupStat?.isDirectory() || backupStat.isSymbolicLink()) {
            throw new ProjectStoreError(
                "unsafe-backup-directory",
                "Backup path must be a real directory, not a file or symbolic link",
            )
        }
        const resolved = await realpath(this.backupDirectory)
        if (!isInside(this.realProjectsDirectory, resolved)) {
            throw new ProjectStoreError(
                "unsafe-backup-directory",
                "Backup directory resolves outside the configured projects directory",
            )
        }
        if (this.realBackupDirectory && resolved !== this.realBackupDirectory) {
            throw new ProjectStoreError(
                "unsafe-backup-directory",
                "Backup directory changed after the MCP server started",
            )
        }
        this.realBackupDirectory = resolved
    }

    async #ensureInitialized() {
        if (!this.realProjectsDirectory) await this.initialize()
    }

    async #resolveExistingReference(reference) {
        await this.#ensureInitialized()
        if (typeof reference !== "string" || !reference.trim() || reference.length > 512) {
            throw new ProjectStoreError("invalid-project-reference", "projectRef must be a non-empty relative reference")
        }
        const trimmed = reference.trim()
        if (trimmed.includes("\0") || path.isAbsolute(trimmed)) {
            throw new ProjectStoreError("invalid-project-reference", "Absolute and null-containing project references are not allowed")
        }

        const requested = path.resolve(this.projectsDirectory, trimmed)
        if (!isInside(this.projectsDirectory, requested)) {
            throw new ProjectStoreError("project-outside-root", "Project reference escapes the configured projects directory")
        }
        if (isInside(this.backupDirectory, requested)) {
            throw new ProjectStoreError(
                "protected-backup-reference",
                "Project backups are recovery artifacts and cannot be opened through editing tools",
            )
        }

        const candidates = path.extname(requested)
            ? [requested]
            : [requested, `${requested}.zip`, path.join(requested, "project.json")]

        for (const candidate of candidates) {
            if (!isInside(this.projectsDirectory, candidate)) continue
            const candidateStat = await lstat(candidate).catch(() => null)
            if (!candidateStat) continue
            if (candidateStat.isSymbolicLink()) {
                throw new ProjectStoreError("unsafe-project-reference", "Symbolic-link project references are not allowed")
            }

            let target = candidate
            if (candidateStat.isDirectory()) {
                target = path.join(candidate, "project.json")
                const manifestStat = await lstat(target).catch(() => null)
                if (!manifestStat?.isFile() || manifestStat.isSymbolicLink()) continue
            }

            const realTarget = await realpath(target)
            if (!isInside(this.realProjectsDirectory, realTarget)) {
                throw new ProjectStoreError("project-outside-root", "Resolved project path escapes the configured projects directory")
            }

            if (path.extname(target).toLowerCase() === ".zip") {
                return { kind: "zip", target, reference: toProjectRef(this.projectsDirectory, target) }
            }
            if (path.basename(target).toLowerCase() === "project.json") {
                return { kind: "json", target, reference: toProjectRef(this.projectsDirectory, target) }
            }
        }

        throw new ProjectStoreError("project-not-found", `No Flowtake project matched ${trimmed}`)
    }

    async #readResolved(resolved) {
        const raw = resolved.kind === "zip"
            ? await readZipManifest(resolved.target)
            : await readSmallFile(resolved.target)
        const openWorkspacePresent = await this.#hasOpenWorkspace(resolved)
        return {
            ...resolved,
            raw,
            document: parseManifest(raw, resolved.reference),
            revision: sha256(raw),
            sourceSignature: await sourceSignature(resolved.target),
            openWorkspacePresent,
        }
    }

    async #hasOpenWorkspace(resolved) {
        if (resolved.kind !== "zip") return false
        const projectId = path.basename(resolved.target, path.extname(resolved.target))
        const workspace = path.join(this.tempDirectory, projectId)
        return Boolean(await lstat(workspace).catch(() => null))
    }

    async #assertArchiveIsClosed(resolved) {
        if (!await this.#hasOpenWorkspace(resolved)) return
        const projectId = path.basename(resolved.target, path.extname(resolved.target))
        throw new ProjectStoreError(
            "project-open-in-flowtake",
            `Flowtake's extracted workspace for ${projectId} still exists. Close the project in Flowtake before editing its archive. If Flowtake already exited after a crash, reopen and close that project to clear the stale workspace, then read it again.`,
        )
    }

    async readProject(reference) {
        const resolved = await this.#resolveExistingReference(reference)
        return this.#readResolved(resolved)
    }

    async listProjects({ limit = 100 } = {}) {
        await this.#ensureInitialized()
        const boundedLimit = Math.min(500, Math.max(1, Number(limit) || 100))
        const entries = await readdir(this.projectsDirectory, { withFileTypes: true })
        const references = []

        for (const entry of entries) {
            if (entry.name === BACKUP_DIRECTORY || entry.isSymbolicLink()) continue
            if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".zip") {
                references.push(entry.name)
            } else if (entry.isDirectory()) {
                const manifest = path.join(this.projectsDirectory, entry.name, "project.json")
                const manifestStat = await lstat(manifest).catch(() => null)
                if (manifestStat?.isFile() && !manifestStat.isSymbolicLink()) references.push(entry.name)
            }
            if (references.length >= boundedLimit) break
        }

        const projects = []
        for (const reference of references) {
            try {
                const project = await this.readProject(reference)
                const sourceStat = await stat(project.target)
                projects.push({
                    projectRef: project.reference,
                    kind: project.kind,
                    revision: project.revision,
                    modifiedAt: sourceStat.mtime.toISOString(),
                    openWorkspacePresent: project.openWorkspacePresent,
                    document: project.document,
                })
            } catch (error) {
                projects.push({
                    projectRef: reference,
                    error: error instanceof ProjectStoreError ? error.code : "read-failed",
                })
            }
        }
        return projects
    }

    async #writeBackup(loaded) {
        await this.#assertBackupDirectory()
        const backupKind = loaded.kind === "zip" ? "archive.zip" : "project.json"
        const name = [
            safeBackupBase(loaded.reference),
            timestampForFile(),
            loaded.revision.slice(0, 12),
            randomUUID().slice(0, 8),
            backupKind,
        ].join(".")
        const backupPath = path.join(this.backupDirectory, name)
        if (loaded.kind === "zip") {
            const sourceStat = await stat(loaded.target)
            await ensureBackupCapacity(this.backupDirectory, sourceStat.size)
            await atomicCopyFile(loaded.target, backupPath, loaded.sourceSignature)
        } else {
            await atomicCopyFile(loaded.target, backupPath, loaded.sourceSignature)
        }
        return toProjectRef(this.projectsDirectory, backupPath)
    }

    async #assertUnchanged(loaded) {
        await this.#assertArchiveIsClosed(loaded)
        const current = await this.#readResolved({
            kind: loaded.kind,
            target: loaded.target,
            reference: loaded.reference,
        })
        if (current.revision !== loaded.revision || current.sourceSignature !== loaded.sourceSignature) {
            throw new ProjectStoreError(
                "project-changed",
                "Project changed after it was read. Read it again and retry with the new revision.",
                { currentRevision: current.revision },
            )
        }
    }

    async #replaceJsonProject(loaded, nextRaw) {
        await this.#assertUnchanged(loaded)
        const backupRef = await this.#writeBackup(loaded)
        await this.#assertUnchanged(loaded)
        await atomicWriteFile(loaded.target, nextRaw)
        return backupRef
    }

    async #replaceZipProject(loaded, nextRaw) {
        const extractionDirectory = await mkdtemp(path.join(tmpdir(), "flowtake-mcp-"))
        const temporaryArchive = path.join(
            path.dirname(loaded.target),
            `.${path.basename(loaded.target)}.flowtake-mcp-${randomUUID()}.tmp`,
        )

        try {
            await this.#assertUnchanged(loaded)
            const originalArchive = await extractProjectArchive(loaded.target, extractionDirectory)
            const extractedManifest = path.join(extractionDirectory, "project.json")
            const extractedRaw = await readSmallFile(extractedManifest)
            if (sha256(extractedRaw) !== loaded.revision) {
                throw new ProjectStoreError(
                    "project-changed",
                    "The extracted project manifest no longer matches the requested revision",
                )
            }
            await atomicWriteFile(extractedManifest, nextRaw)
            await this.writeArchive(extractionDirectory, temporaryArchive)
            await syncFile(temporaryArchive)

            const repackedArchive = await preflightProjectArchive(temporaryArchive)
            assertArchivePayloadPreserved(originalArchive, repackedArchive)
            const packedManifest = await readZipManifest(temporaryArchive)
            if (sha256(packedManifest) !== sha256(nextRaw)) {
                throw new ProjectStoreError("archive-verification-failed", "Repacked project manifest did not verify")
            }

            await this.#assertUnchanged(loaded)
            const backupRef = await this.#writeBackup(loaded)
            await this.#assertUnchanged(loaded)
            await rename(temporaryArchive, loaded.target)
            return backupRef
        } finally {
            await rm(extractionDirectory, { recursive: true, force: true }).catch(() => {})
            await rm(temporaryArchive, { force: true }).catch(() => {})
        }
    }

    async editProject(reference, expectedRevision, edit, { dryRun = false } = {}) {
        const resolved = await this.#resolveExistingReference(reference)
        const normalizedRevision = normalizeExpectedRevision(expectedRevision)

        return withProjectLock(resolved.target, async () => {
            const loaded = await this.#readResolved(resolved)
            if (loaded.revision !== normalizedRevision) {
                throw new ProjectStoreError(
                    "revision-mismatch",
                    "Project revision is stale. Read the project again before editing.",
                    { currentRevision: loaded.revision },
                )
            }
            if (!dryRun) await this.#assertArchiveIsClosed(loaded)

            const nextDocument = structuredClone(loaded.document)
            const editResult = await edit(nextDocument)
            const nextRaw = `${JSON.stringify(nextDocument, null, 2)}\n`
            const nextRevision = sha256(nextRaw)

            if (dryRun) {
                return {
                    projectRef: loaded.reference,
                    previousRevision: loaded.revision,
                    revision: nextRevision,
                    dryRun: true,
                    backupRef: null,
                    previewWarning: loaded.openWorkspacePresent
                        ? "Flowtake has an open workspace for this archive. This preview uses the last saved archive; close the project and re-read it before a real write."
                        : null,
                    editResult,
                    document: nextDocument,
                }
            }

            const backupRef = loaded.kind === "zip"
                ? await this.#replaceZipProject(loaded, nextRaw)
                : await this.#replaceJsonProject(loaded, nextRaw)
            const verified = await this.#readResolved(resolved)
            if (verified.revision !== nextRevision) {
                throw new ProjectStoreError(
                    "write-verification-failed",
                    "Saved project did not match the expected revision",
                    { currentRevision: verified.revision },
                )
            }

            return {
                projectRef: loaded.reference,
                previousRevision: loaded.revision,
                revision: verified.revision,
                dryRun: false,
                backupRef,
                editResult,
                document: verified.document,
            }
        })
    }
}
