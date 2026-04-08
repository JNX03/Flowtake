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
    rotateX: 15,
    rotateY: 0,
    rotateZ: 0,
    perspective: 800,
    cameraDistance: 1.5,
    eyeContactEnabled: true,
    intro: 1500,
    outro: 1500,
})

export const spatialSlice = createSlice({
    name: 'spatialAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        setSpatials: (state, action) => {
            const spatials = action.payload
            const valid = Array.isArray(spatials)
                ? spatials.filter(validateAnim)
                : Object.values(spatials).filter(validateAnim)
            if (valid.length === 0) return
            animsAdapter.setAll(state, valid)
        },
        updateSpatial: (state, action) => {
            const { id, changes } = action.payload
            const existing = state.entities[id]
            if (!existing) return
            const merged = { ...existing, ...changes }
            if (!validateAnim(merged)) return
            animsAdapter.updateOne(state, action)
        },
        updateSpatials: (state, action) => {
            const updates = action.payload
            const valid = updates.filter(({ id, changes }) => {
                const existing = state.entities[id]
                if (!existing) return false
                const merged = { ...existing, ...changes }
                return validateAnim(merged)
            })
            if (valid.length === 0) return
            animsAdapter.updateMany(state, valid)
        },
        addSpatial: (state, action) => {
            const spatial = action.payload
            if (!validateAnim(spatial)) return
            animsAdapter.addOne(state, action)
        },
        updateAllSpatials: (state, action) => {
            const { changes } = action.payload
            const ids = Object.keys(state.entities)
            const updates = ids
                .map(id => ({ id, changes }))
                .filter(({ id, changes }) => {
                    const existing = state.entities[id]
                    const merged = { ...existing, ...changes }
                    return validateAnim(merged)
                })
            if (updates.length === 0) return
            animsAdapter.updateMany(state, updates)
        },
        removeSpatial: animsAdapter.removeOne,
        removeSpatials: animsAdapter.removeMany,
        upsertSpatials: (state, action) => {
            const spatials = action.payload
            const valid = spatials.filter(spatial => {
                const existing = state.entities[spatial.id]
                const final = existing ? { ...existing, ...spatial } : spatial
                return validateAnim(final)
            })
            if (valid.length === 0) return
            animsAdapter.upsertMany(state, valid)
        },
        setRotateX: (state, action) => { state.rotateX = action.payload },
        setRotateY: (state, action) => { state.rotateY = action.payload },
        setRotateZ: (state, action) => { state.rotateZ = action.payload },
        setPerspective: (state, action) => { state.perspective = action.payload },
        setCameraDistance: (state, action) => { state.cameraDistance = action.payload },
        setEyeContactEnabled: (state, action) => { state.eyeContactEnabled = action.payload },
        setIntro: (state, action) => { state.intro = action.payload },
        setOutro: (state, action) => { state.outro = action.payload },
    },
})

export const {
    reset,
    applyProperties,
    setSpatials,
    updateSpatial,
    updateSpatials,
    addSpatial,
    updateAllSpatials,
    removeSpatial,
    removeSpatials,
    upsertSpatials,
    setRotateX,
    setRotateY,
    setRotateZ,
    setPerspective,
    setCameraDistance,
    setEyeContactEnabled,
    setIntro,
    setOutro
} = spatialSlice.actions

export const selectAllSpatials = state => selectAll(state.undoableState.present.spatialAnims)
export const selectSpatialEntities = state => selectEntities(state.undoableState.present.spatialAnims)
export const selectSpatialById = (state, id) => selectById(state.undoableState.present.spatialAnims, id)
export const selectSpatialIds = state => selectIds(state.undoableState.present.spatialAnims)
export const selectSpatialRotateX = state => state.undoableState.present.spatialAnims.rotateX
export const selectSpatialRotateY = state => state.undoableState.present.spatialAnims.rotateY
export const selectSpatialRotateZ = state => state.undoableState.present.spatialAnims.rotateZ
export const selectSpatialPerspective = state => state.undoableState.present.spatialAnims.perspective
export const selectSpatialCameraDistance = state => state.undoableState.present.spatialAnims.cameraDistance
export const selectSpatialEyeContactEnabled = state => state.undoableState.present.spatialAnims.eyeContactEnabled
export const selectSpatialIntro = state => state.undoableState.present.spatialAnims.intro
export const selectSpatialOutro = state => state.undoableState.present.spatialAnims.outro

export default spatialSlice.reducer
