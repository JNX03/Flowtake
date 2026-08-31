import { createSlice } from "@reduxjs/toolkit"
import {
    createDefaultScene,
    createEditorDomain,
    normalizeBookmark,
    normalizeEditorDomain,
} from "../editor/projectSchema.js"
import {
    normalizeProjectMediaCollection,
    normalizeProjectMediaMetadata,
} from "../editor/projectMedia.js"

const makeInitialState = () => createEditorDomain()

function syncSceneDuration(scene, projectDuration) {
    if (Number.isFinite(projectDuration) && projectDuration >= 0) {
        scene.duration = projectDuration
    }
    return scene.duration
}

export function createBookmarkId() {
    const uuid = globalThis.crypto?.randomUUID?.()
    if (uuid) return `bookmark-${uuid}`
    return `bookmark-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const editorDomainSlice = createSlice({
    name: "editorDomain",
    initialState: makeInitialState(),
    reducers: {
        reset: () => makeInitialState(),
        applyProperties: (_state, action) => {
            const domain = normalizeEditorDomain(action.payload)
            domain.media = normalizeProjectMediaCollection(domain.media)
            return domain
        },
        setActiveScene: (state, action) => {
            if (state.scenes[action.payload]) state.activeSceneId = action.payload
        },
        addScene: (state, action) => {
            const payload = action.payload ?? {}
            if (typeof payload.id !== "string" || !payload.id.trim()) return
            const scene = createDefaultScene(payload)
            if (state.scenes[scene.id]) return
            scene.nativeRecording = payload.nativeRecording === true
            state.scenes[scene.id] = scene
            state.sceneOrder.push(scene.id)
            state.activeSceneId = scene.id
        },
        renameScene: (state, action) => {
            const { id, name } = action.payload ?? {}
            const scene = state.scenes[id]
            if (scene && typeof name === "string" && name.trim()) scene.name = name.trim()
        },
        removeScene: (state, action) => {
            const id = action.payload
            if (!state.scenes[id] || state.sceneOrder.length <= 1) return
            delete state.scenes[id]
            state.sceneOrder = state.sceneOrder.filter(sceneId => sceneId !== id)
            if (state.activeSceneId === id) state.activeSceneId = state.sceneOrder[0]
        },
        reorderScenes: (state, action) => {
            if (!Array.isArray(action.payload)) return
            const requested = [...new Set(action.payload.filter(id => state.scenes[id]))]
            for (const id of state.sceneOrder) {
                if (!requested.includes(id)) requested.push(id)
            }
            state.sceneOrder = requested
        },
        updateTimelineView: (state, action) => {
            const { sceneId = state.activeSceneId, changes = {} } = action.payload ?? {}
            const view = state.scenes[sceneId]?.timelineView
            if (!view) return
            if (changes.pxPerMs === null || (Number.isFinite(changes.pxPerMs) && changes.pxPerMs > 0)) {
                view.pxPerMs = changes.pxPerMs
            }
            if (Number.isFinite(changes.scrollLeft)) view.scrollLeft = Math.max(0, changes.scrollLeft)
            if (Number.isFinite(changes.playhead)) view.playhead = Math.max(0, changes.playhead)
        },
        setProjectFps: (state, action) => {
            if (!Number.isInteger(action.payload) || action.payload <= 0) return
            state.settings.fps = Math.min(240, action.payload)
        },
        setCanvasSize: (state, action) => {
            const { width = null, height = null } = action.payload ?? {}
            state.settings.canvas.width = Number.isInteger(width) && width > 0 ? width : null
            state.settings.canvas.height = Number.isInteger(height) && height > 0 ? height : null
        },
        upsertMedia: (state, action) => {
            const items = Array.isArray(action.payload) ? action.payload : [action.payload]
            for (const item of items) {
                if (!item || typeof item.id !== "string" || !item.id.trim()) continue
                const id = item.id.trim()
                const metadata = normalizeProjectMediaMetadata({
                    ...state.media.entities[id],
                    ...item,
                    id,
                })
                if (!metadata) continue
                if (!state.media.entities[id]) state.media.ids.push(id)
                state.media.entities[id] = metadata
            }
        },
        removeMedia: (state, action) => {
            const requestedIds = Array.isArray(action.payload) ? action.payload : [action.payload]
            const ids = new Set(requestedIds.filter(id => state.media.entities[id]))
            if (ids.size === 0) return
            state.media.ids = state.media.ids.filter(id => !ids.has(id))
            for (const id of ids) delete state.media.entities[id]
        },
        addBookmark: (state, action) => {
            const scene = state.scenes[state.activeSceneId]
            if (!scene) return
            const payload = action.payload ?? {}
            const bookmarkPayload = payload.bookmark ?? payload
            const sceneDuration = syncSceneDuration(scene, payload.projectDuration)
            const bookmark = normalizeBookmark(bookmarkPayload, sceneDuration)
            if (!bookmark || scene.bookmarks.some(item => item.id === bookmark.id)) return
            scene.bookmarks.push(bookmark)
        },
        updateBookmark: (state, action) => {
            const scene = state.scenes[state.activeSceneId]
            const { id, changes, projectDuration } = action.payload ?? {}
            if (!scene || typeof id !== "string" || !changes
                || typeof changes !== "object" || Array.isArray(changes)) return
            const index = scene.bookmarks.findIndex(bookmark => bookmark.id === id)
            if (index < 0) return
            const sceneDuration = syncSceneDuration(scene, projectDuration)
            const bookmark = normalizeBookmark({
                ...scene.bookmarks[index],
                ...changes,
                id,
            }, sceneDuration)
            if (bookmark) scene.bookmarks[index] = bookmark
        },
        removeBookmark: (state, action) => {
            const scene = state.scenes[state.activeSceneId]
            if (!scene) return
            const ids = new Set(Array.isArray(action.payload) ? action.payload : [action.payload])
            if (!scene.bookmarks.some(bookmark => ids.has(bookmark.id))) return
            scene.bookmarks = scene.bookmarks.filter(bookmark => !ids.has(bookmark.id))
        },
    },
})

export const {
    reset,
    applyProperties,
    setActiveScene,
    addScene,
    renameScene,
    removeScene,
    reorderScenes,
    updateTimelineView,
    setProjectFps,
    setCanvasSize,
    upsertMedia,
    removeMedia,
    addBookmark,
    updateBookmark,
    removeBookmark,
} = editorDomainSlice.actions

const selectDomain = state => state.undoableState.present.editorDomain

export const selectEditorSchemaVersion = state => selectDomain(state).schemaVersion
export const selectActiveSceneId = state => selectDomain(state).activeSceneId
export const selectSceneOrder = state => selectDomain(state).sceneOrder
export const selectScenes = state => selectDomain(state).scenes
export const selectActiveScene = state => {
    const domain = selectDomain(state)
    return domain.scenes[domain.activeSceneId]
}
export const selectProjectFps = state => selectDomain(state).settings.fps
export const selectProjectCanvas = state => selectDomain(state).settings.canvas
export const selectProjectMedia = state => selectDomain(state).media
export const selectActiveSceneBookmarks = state => selectActiveScene(state)?.bookmarks ?? []

export default editorDomainSlice.reducer
