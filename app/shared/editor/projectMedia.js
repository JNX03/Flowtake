import { convertFileSrc } from "@tauri-apps/api/core"

const PROJECT_MEDIA_PREFIX = "assets/"

const cleanString = value =>
    typeof value === "string" && value.trim() ? value.trim() : null

const finiteNonNegative = value =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
        ? value
        : null

function safeRelativePath(value) {
    const relativePath = cleanString(value)
    if (!relativePath
        || !relativePath.startsWith(PROJECT_MEDIA_PREFIX)
        || relativePath.includes(String.fromCharCode(92))
        || relativePath.split("/").some(part => !part || part === "." || part === "..")) {
        return null
    }
    return relativePath
}

function inferMediaType(mimeType, fileName) {
    if (mimeType?.startsWith("audio/")) return "audio"
    if (mimeType?.startsWith("video/")) return "video"
    if (mimeType?.startsWith("image/")) return "image"

    const extension = fileName?.split(".").pop()?.toLocaleLowerCase()
    if (["mp3", "wav", "m4a", "aac", "ogg", "flac", "opus"].includes(extension)) {
        return "audio"
    }
    if (["mp4", "mov", "mkv", "webm", "m4v", "avi"].includes(extension)) {
        return "video"
    }
    return "image"
}

function createMediaId() {
    if (globalThis.crypto?.randomUUID) {
        return "media-" + globalThis.crypto.randomUUID()
    }
    return "media-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10)
}

function collectionEntities(value) {
    if (Array.isArray(value)) return value
    if (Array.isArray(value?.entities)) return value.entities
    if (value?.entities && typeof value.entities === "object") {
        return Object.values(value.entities)
    }
    return []
}

/**
 * Captures the portable identity and current runtime URL for a media-backed
 * timeline entity. `src` is intentionally treated as runtime data; the
 * durable link is `mediaId` plus the contained project `relativePath`.
 */
export function createTimelineMediaReference(asset = {}) {
    const mediaId = cleanString(asset.mediaId) ?? cleanString(asset.id)
    const relativePath = safeRelativePath(asset.relativePath)
    const mimeType = cleanString(asset.mimeType)
    const src = typeof asset.src === "string" && asset.src ? asset.src : null

    return {
        src,
        ...(mediaId ? { mediaId } : {}),
        ...(relativePath ? { relativePath } : {}),
        ...(mimeType ? { mimeType } : {}),
    }
}

/**
 * Replaces stale saved runtime URLs with URLs from the freshly hydrated media
 * library while leaving timeline timing and editing metadata untouched.
 *
 * A relative-path fallback upgrades older entities that carried a project
 * media path but not its id. If a durable reference cannot be hydrated, its
 * runtime src becomes null rather than retaining a stale absolute URL.
 */
export function rebindTimelineMediaEntities(value, hydratedAssets = []) {
    const assets = collectionEntities(hydratedAssets)
    const assetsById = new Map()
    const assetsByRelativePath = new Map()

    for (const asset of assets) {
        const reference = createTimelineMediaReference(asset)
        if (reference.mediaId) assetsById.set(reference.mediaId, asset)
        if (reference.relativePath) {
            assetsByRelativePath.set(reference.relativePath, asset)
        }
    }

    return collectionEntities(value)
        .filter(entity => entity && typeof entity === "object")
        .map(entity => {
            const mediaId = cleanString(entity.mediaId)
            const relativePath = safeRelativePath(entity.relativePath)
            const asset = (mediaId ? assetsById.get(mediaId) : null)
                ?? (relativePath ? assetsByRelativePath.get(relativePath) : null)

            if (!mediaId && !relativePath && !asset) return { ...entity }

            if (!asset) {
                return {
                    ...entity,
                    ...(mediaId ? { mediaId } : {}),
                    ...(relativePath ? { relativePath } : {}),
                    src: null,
                }
            }

            const reference = createTimelineMediaReference(asset)
            return {
                ...entity,
                ...reference,
                mediaId: reference.mediaId ?? mediaId,
                relativePath: reference.relativePath ?? relativePath,
                mimeType: reference.mimeType ?? entity.mimeType ?? null,
            }
        })
}

export function getReferencedTimelineMediaIds(...collections) {
    const ids = new Set()
    for (const collection of collections) {
        for (const entity of collectionEntities(collection)) {
            const mediaId = cleanString(entity?.mediaId)
            if (mediaId) ids.add(mediaId)
        }
    }
    return ids
}

export function normalizeProjectMediaMetadata(value, {
    id = value?.id,
    createdAt = value?.createdAt,
} = {}) {
    const normalizedId = cleanString(id)
    const relativePath = safeRelativePath(value?.relativePath ?? value?.path)
    if (!normalizedId || !relativePath) return null

    const fileName = cleanString(value?.fileName)
        ?? relativePath.split("/").pop()
    const originalName = cleanString(value?.originalName ?? value?.name)
        ?? fileName
    const mimeType = cleanString(value?.mimeType) ?? "application/octet-stream"
    const type = inferMediaType(mimeType, originalName)
    const size = finiteNonNegative(value?.size)
    const duration = finiteNonNegative(value?.duration)
    const timestamp = finiteNonNegative(createdAt)

    return {
        id: normalizedId,
        relativePath,
        originalName,
        fileName,
        name: originalName,
        size: size ?? 0,
        mimeType,
        type,
        category: type === "audio" ? "audio" : "media",
        ...(duration == null ? {} : { duration }),
        ...(timestamp == null ? {} : { createdAt: timestamp }),
    }
}

export function normalizeProjectMediaCollection(value) {
    const sourceEntities = Array.isArray(value)
        ? Object.fromEntries(value
            .filter(item => item && typeof item.id === "string")
            .map(item => [item.id, item]))
        : (value?.entities && typeof value.entities === "object" ? value.entities : {})
    const requestedIds = Array.isArray(value?.ids)
        ? value.ids
        : Object.keys(sourceEntities)
    const ids = []
    const entities = {}

    for (const requestedId of [...requestedIds, ...Object.keys(sourceEntities)]) {
        if (ids.includes(requestedId)) continue
        const metadata = normalizeProjectMediaMetadata(sourceEntities[requestedId], {
            id: requestedId,
        })
        if (!metadata) continue
        ids.push(metadata.id)
        entities[metadata.id] = metadata
    }

    return { ids, entities }
}

function getInvoke(invoke) {
    if (invoke) return invoke
    return (...args) => window.electron.ipcRenderer.invoke(...args)
}

function createRuntimeAsset(metadata, resolved, {
    toFileSrc = convertFileSrc,
    error = null,
} = {}) {
    const absolutePath = cleanString(resolved?.absolutePath)
    let src = null
    let resolutionError = error

    if (absolutePath) {
        try {
            src = toFileSrc(absolutePath)
        } catch (caughtError) {
            resolutionError = caughtError
        }
    }

    const isMissing = !src
    return {
        ...metadata,
        src,
        absolutePath: absolutePath ?? null,
        persistence: "project",
        availability: isMissing ? "missing" : "ready",
        isMissing,
        missingReason: isMissing
            ? "This file is missing or unavailable in the project archive."
            : null,
        resolutionError: isMissing && resolutionError
            ? String(resolutionError?.message || resolutionError)
            : null,
    }
}

export async function importProjectMedia(sourcePath, {
    invoke,
    toFileSrc = convertFileSrc,
    id = createMediaId(),
    createdAt = Date.now(),
} = {}) {
    if (!cleanString(sourcePath)) throw new TypeError("A source media path is required")

    const imported = await getInvoke(invoke)("import-project-media", sourcePath)
    const metadata = normalizeProjectMediaMetadata(imported, { id, createdAt })
    if (!metadata) throw new Error("The imported media metadata was invalid")

    return {
        metadata,
        asset: createRuntimeAsset(metadata, imported, { toFileSrc }),
    }
}

export async function hydrateProjectMedia(media, {
    invoke,
    toFileSrc = convertFileSrc,
} = {}) {
    const normalized = normalizeProjectMediaCollection(media)
    const invokeCommand = getInvoke(invoke)

    return Promise.all(normalized.ids.map(async id => {
        const metadata = normalized.entities[id]
        try {
            const resolved = await invokeCommand(
                "resolve-project-media",
                metadata.relativePath
            )
            return createRuntimeAsset(metadata, resolved, { toFileSrc })
        } catch (error) {
            return createRuntimeAsset(metadata, null, { toFileSrc, error })
        }
    }))
}
