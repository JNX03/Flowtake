import { createSlice } from '@reduxjs/toolkit'
import {
    animsAdapter,
    applyAnimProperties,
    selectAll,
    selectById,
    selectEntities,
    selectIds,
    validateAnim
} from "./animsAdapter"

// Each entity: {id, start, end, mainTrackId, slots: { trackId: 'tl'|'tr'|'bl'|'br'|'hidden' }}
//
// Slice-level defaults apply when no entity is active. defaultMainTrackId=null
// means "no main, use legacy stack" (preserves the old top-right behavior).
const initialState = animsAdapter.getInitialState({
    defaultMainTrackId: null,
    defaultLayout: "stack",        // "stack" | "main-only"
})

export const appSceneAnimSlice = createSlice({
    name: 'appSceneAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        setAppScenes: (state, action) => {
            const items = action.payload
            const valid = Array.isArray(items)
                ? items.filter(validateAnim)
                : Object.values(items || {}).filter(validateAnim)
            animsAdapter.setAll(state, valid)
        },
        addAppScene: (state, action) => {
            const item = action.payload
            if (!validateAnim(item)) return
            animsAdapter.addOne(state, action)
        },
        updateAppScene: (state, action) => {
            const { id, changes } = action.payload
            const existing = state.entities[id]
            if (!existing) return
            const merged = { ...existing, ...changes }
            if (!validateAnim(merged)) return
            animsAdapter.updateOne(state, action)
        },
        removeAppScene: animsAdapter.removeOne,
        setDefaultMainTrackId: (state, action) => { state.defaultMainTrackId = action.payload },
        setDefaultLayout: (state, action) => { state.defaultLayout = action.payload },
    },
})

export const {
    reset,
    applyProperties,
    setAppScenes,
    addAppScene,
    updateAppScene,
    removeAppScene,
    setDefaultMainTrackId,
    setDefaultLayout,
} = appSceneAnimSlice.actions

const slice = state => state.undoableState.present.appSceneAnims

export const selectAllAppScenes = state => selectAll(slice(state))
export const selectAppSceneById = (state, id) => selectById(slice(state), id)
export const selectAppSceneIds = state => selectIds(slice(state))
export const selectAppSceneEntities = state => selectEntities(slice(state))
export const selectAppSceneDefaults = state => ({
    mainTrackId: slice(state).defaultMainTrackId,
    layout: slice(state).defaultLayout,
})

export default appSceneAnimSlice.reducer
