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

const initialState = animsAdapter.getInitialState({
    blurStrength: 0.5,
    targetScale: 2,
    intro: 700,
    outro: 700,
})

export const zoomSlice = createSlice({
    name: 'zoomAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        setZooms: (state, action) => {
            const zooms = action.payload
            const validZooms = Array.isArray(zooms)
                ? zooms.filter(validateAnim)
                : Object.values(zooms).filter(validateAnim)
            if (validZooms.length === 0) return
            animsAdapter.setAll(state, validZooms)
        },
        updateZoom: (state, action) => {
            const { id, changes } = action.payload
            const existingZoom = state.entities[id]
            if (!existingZoom) return

            const mergedZoom = { ...existingZoom, ...changes }
            if (!validateAnim(mergedZoom)) return

            animsAdapter.updateOne(state, action)
        },
        updateZooms: (state, action) => {
            const updates = action.payload
            const validUpdates = updates.filter(({ id, changes }) => {
                const existingZoom = state.entities[id]
                if (!existingZoom) return false

                const mergedZoom = { ...existingZoom, ...changes }
                return validateAnim(mergedZoom)
            })
            if (validUpdates.length === 0) return
            animsAdapter.updateMany(state, validUpdates)
        },
        addZoom: (state, action) => {
            const zoom = action.payload
            if (!validateAnim(zoom)) return
            animsAdapter.addOne(state, action)
        },
        updateAllZooms: (state, action) => {
            const { changes } = action.payload
            const ids = Object.keys(state.entities)
            const updates = ids
                .map(id => ({ id, changes }))
                .filter(({ id, changes }) => {
                    const existingZoom = state.entities[id]
                    const mergedZoom = { ...existingZoom, ...changes }
                    return validateAnim(mergedZoom)
                })
            if (updates.length === 0) return
            animsAdapter.updateMany(state, updates)
        },
        removeZoom: animsAdapter.removeOne,
        removeZooms: animsAdapter.removeMany,
        upsertZooms: (state, action) => {
            const zooms = action.payload
            const validZooms = zooms.filter(zoom => {
                const existingZoom = state.entities[zoom.id]
                const finalZoom = existingZoom ? { ...existingZoom, ...zoom } : zoom
                return validateAnim(finalZoom)
            })
            if (validZooms.length === 0) return
            animsAdapter.upsertMany(state, validZooms)
        },
        setBlurStrength: (state, action) => { state.blurStrength = action.payload },
        setTargetScale: (state, action) => { state.targetScale = action.payload },
        setIntro: (state, action) => { state.intro = action.payload },
        setOutro: (state, action) => { state.outro = action.payload },
    },
})

// Action creators are generated for each case reducer function
export const {
    reset,
    applyProperties,
    setZooms,
    updateZoom,
    updateZooms,
    addZoom,
    updateAllZooms,
    removeZoom,
    removeZooms,
    upsertZooms,
    setBlurStrength,
    setTargetScale,
    setIntro,
    setOutro
} = zoomSlice.actions

export const selectAllZooms = state => selectAll(state.undoableState.present.zoomAnims)
export const selectZoomEntities = state => selectEntities(state.undoableState.present.zoomAnims)
export const selectTargetScale = state => state.undoableState.present.zoomAnims.targetScale
export const selectBlurStrength = state => state.undoableState.present.zoomAnims.blurStrength
export const selectIntro = state => state.undoableState.present.zoomAnims.intro
export const selectOutro = state => state.undoableState.present.zoomAnims.outro
export const selectZoomById = (state, id) => selectById(state.undoableState.present.zoomAnims, id)
export const selectZoomIds = state => selectIds(state.undoableState.present.zoomAnims)

export default zoomSlice.reducer
