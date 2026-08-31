export const EDITOR_SCHEMA_VERSION = 1
export const DEFAULT_PROJECT_FPS = 30
export const DEFAULT_BOOKMARK_COLOR = "#8b5cf6"

const BOOKMARK_NOTE_LIMIT = 240
const BOOKMARK_ID_LIMIT = 128
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

const DEFAULT_SCENE_ID = "scene-main"

function cloneSerializable(value) {
    if (value == null) return value
    if (typeof structuredClone === "function") return structuredClone(value)
    return JSON.parse(JSON.stringify(value))
}

function finiteNumber(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function positiveInteger(value, fallback = null) {
    return Number.isInteger(value) && value > 0 ? value : fallback
}

function normalizeSceneId(value) {
    return typeof value === "string" && value.trim() ? value.trim() : DEFAULT_SCENE_ID
}

export function normalizeBookmark(bookmark, sceneDuration = 0) {
    if (!bookmark || typeof bookmark !== "object" || Array.isArray(bookmark)) return null

    const id = typeof bookmark.id === "string"
        ? bookmark.id.trim().slice(0, BOOKMARK_ID_LIMIT)
        : ""
    if (!id || !Number.isFinite(bookmark.time)) return null

    const maximumTime = Number.isFinite(sceneDuration) && sceneDuration > 0
        ? sceneDuration
        : Infinity
    const time = Math.round(Math.min(maximumTime, Math.max(0, bookmark.time)))
    const note = typeof bookmark.note === "string"
        ? bookmark.note.trim().slice(0, BOOKMARK_NOTE_LIMIT)
        : ""
    const color = typeof bookmark.color === "string" && HEX_COLOR_PATTERN.test(bookmark.color)
        ? bookmark.color.toLowerCase()
        : DEFAULT_BOOKMARK_COLOR

    const normalized = { id, time, note, color }
    if (Number.isFinite(bookmark.duration) && bookmark.duration > 0) {
        const maximumDuration = Number.isFinite(maximumTime)
            ? Math.max(0, maximumTime - time)
            : bookmark.duration
        const duration = Math.round(Math.min(bookmark.duration, maximumDuration))
        if (duration > 0) normalized.duration = duration
    }

    return normalized
}

export function normalizeBookmarks(bookmarks, sceneDuration = 0) {
    if (!Array.isArray(bookmarks)) return []

    const ids = new Set()
    const normalized = []
    for (const candidate of bookmarks) {
        const bookmark = normalizeBookmark(candidate, sceneDuration)
        if (!bookmark || ids.has(bookmark.id)) continue
        ids.add(bookmark.id)
        normalized.push(bookmark)
    }
    return normalized
}

export function createDefaultScene({
    id = DEFAULT_SCENE_ID,
    name = "Scene 1",
    duration = 0,
} = {}) {
    return {
        id: normalizeSceneId(id),
        name: typeof name === "string" && name.trim() ? name.trim() : "Scene 1",
        duration: Math.max(0, finiteNumber(duration, 0)),
        nativeRecording: true,
        trackOrder: [],
        tracks: {},
        elements: {},
        bookmarks: [],
        timelineView: {
            pxPerMs: null,
            scrollLeft: 0,
            playhead: 0,
        },
    }
}

function normalizeScene(scene, fallback = {}) {
    const base = createDefaultScene({
        id: scene?.id ?? fallback.id,
        name: scene?.name ?? fallback.name,
        duration: scene?.duration ?? fallback.duration,
    })
    const trackOrder = Array.isArray(scene?.trackOrder)
        ? [...new Set(scene.trackOrder.filter(id => typeof id === "string"))]
        : []

    return {
        ...base,
        ...cloneSerializable(scene ?? {}),
        id: base.id,
        name: base.name,
        duration: base.duration,
        nativeRecording: scene?.nativeRecording !== false,
        trackOrder,
        tracks: scene?.tracks && typeof scene.tracks === "object"
            ? cloneSerializable(scene.tracks)
            : {},
        elements: scene?.elements && typeof scene.elements === "object"
            ? cloneSerializable(scene.elements)
            : {},
        bookmarks: normalizeBookmarks(scene?.bookmarks, base.duration),
        timelineView: {
            pxPerMs: finiteNumber(scene?.timelineView?.pxPerMs, null),
            scrollLeft: Math.max(0, finiteNumber(scene?.timelineView?.scrollLeft, 0)),
            playhead: Math.max(0, finiteNumber(scene?.timelineView?.playhead, 0)),
        },
    }
}

function normalizeEntityCollection(value) {
    if (Array.isArray(value)) {
        const entities = {}
        const ids = []
        for (const entity of value) {
            if (!entity || typeof entity.id !== "string" || !entity.id.trim()) continue
            const id = entity.id.trim()
            if (entities[id]) continue
            ids.push(id)
            entities[id] = { ...cloneSerializable(entity), id }
        }
        return { ids, entities }
    }

    const entities = value?.entities && typeof value.entities === "object"
        ? cloneSerializable(value.entities)
        : {}
    const preferredIds = Array.isArray(value?.ids) ? value.ids : Object.keys(entities)
    const ids = [...new Set(preferredIds.filter(id => typeof id === "string" && entities[id]))]
    for (const id of Object.keys(entities)) {
        if (!ids.includes(id)) ids.push(id)
    }
    return { ids, entities }
}

export function normalizeEditorDomain(domain, {
    projectId = null,
    duration = 0,
} = {}) {
    const incomingScenes = Array.isArray(domain?.scenes)
        ? Object.fromEntries(domain.scenes
            .filter(scene => scene && typeof scene.id === "string")
            .map(scene => [scene.id, scene]))
        : (domain?.scenes && typeof domain.scenes === "object" ? domain.scenes : {})

    const sceneEntries = Object.entries(incomingScenes)
    const fallbackId = projectId ? `scene-${projectId}` : DEFAULT_SCENE_ID
    if (sceneEntries.length === 0) {
        const scene = createDefaultScene({ id: fallbackId, duration })
        sceneEntries.push([scene.id, scene])
    }

    const scenes = {}
    for (const [key, scene] of sceneEntries) {
        const hasAuthoritativeRecordingDuration = scene?.nativeRecording !== false
            && Number.isFinite(duration)
            && duration > 0
        const normalized = normalizeScene(
            hasAuthoritativeRecordingDuration
                ? { ...scene, duration }
                : scene,
            {
            id: key || fallbackId,
            duration,
            }
        )
        scenes[normalized.id] = normalized
    }

    const requestedOrder = Array.isArray(domain?.sceneOrder) ? domain.sceneOrder : []
    const sceneOrder = [...new Set(requestedOrder.filter(id => scenes[id]))]
    for (const id of Object.keys(scenes)) {
        if (!sceneOrder.includes(id)) sceneOrder.push(id)
    }

    const requestedActiveSceneId = domain?.activeSceneId
    const activeSceneId = scenes[requestedActiveSceneId]
        ? requestedActiveSceneId
        : sceneOrder[0]

    const requestedFps = positiveInteger(domain?.settings?.fps, DEFAULT_PROJECT_FPS)
    const fps = Math.min(240, requestedFps)
    const canvas = domain?.settings?.canvas ?? {}

    return {
        schemaVersion: EDITOR_SCHEMA_VERSION,
        activeSceneId,
        sceneOrder,
        scenes,
        media: normalizeEntityCollection(domain?.media),
        settings: {
            fps,
            canvas: {
                width: positiveInteger(canvas.width),
                height: positiveInteger(canvas.height),
            },
        },
    }
}

export function createEditorDomain(options = {}) {
    return normalizeEditorDomain(null, options)
}

function migrateV0ToV1(document, context) {
    return {
        ...document,
        editorDomain: normalizeEditorDomain(document.editorDomain, context),
    }
}

const MIGRATIONS = {
    0: migrateV0ToV1,
}

export function migrateProjectDocument(document, context = {}) {
    if (!document || typeof document !== "object" || Array.isArray(document)) {
        throw new TypeError("Project document must be an object")
    }

    let migrated = cloneSerializable(document)
    let version = Number.isInteger(migrated.editorDomain?.schemaVersion)
        ? migrated.editorDomain.schemaVersion
        : 0

    if (version > EDITOR_SCHEMA_VERSION) {
        throw new Error(`This project uses editor schema ${version}, but this build supports up to ${EDITOR_SCHEMA_VERSION}`)
    }

    while (version < EDITOR_SCHEMA_VERSION) {
        const migration = MIGRATIONS[version]
        if (!migration) throw new Error(`Missing editor schema migration from version ${version}`)
        migrated = migration(migrated, context)
        version = migrated.editorDomain.schemaVersion
    }

    migrated.editorDomain = normalizeEditorDomain(migrated.editorDomain, context)
    return migrated
}
