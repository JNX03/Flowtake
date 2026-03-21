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
    targetScale: .7
})

export const cameraSlice = createSlice({
    name: 'cameraZoomAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        setCameraZooms: (state, action) => {
            const cameraZooms = action.payload
            const validCameraZooms = Array.isArray(cameraZooms)
                ? cameraZooms.filter(validateAnim)
                : Object.values(cameraZooms).filter(validateAnim)
            if (validCameraZooms.length === 0) return
            animsAdapter.setAll(state, validCameraZooms)
        },
        updateCameraZoom: (state, action) => {
            const { id, changes } = action.payload
            const existingCameraZoom = state.entities[id]
            if (!existingCameraZoom) return

            const mergedCameraZoom = { ...existingCameraZoom, ...changes }
            if (!validateAnim(mergedCameraZoom)) return

            animsAdapter.updateOne(state, action)
        },
        updateCameraZooms: (state, action) => {
            const updates = action.payload
            const validUpdates = updates.filter(({ id, changes }) => {
                const existingCameraZoom = state.entities[id]
                if (!existingCameraZoom) return false

                const mergedCameraZoom = { ...existingCameraZoom, ...changes }
                return validateAnim(mergedCameraZoom)
            })
            if (validUpdates.length === 0) return
            animsAdapter.updateMany(state, validUpdates)
        },
        addCameraZoom: (state, action) => {
            const cameraZoom = action.payload
            if (!validateAnim(cameraZoom)) return
            animsAdapter.addOne(state, action)
        },
        updateAllCameraZooms: (state, action) => {
            const { changes } = action.payload
            const ids = Object.keys(state.entities)
            const updates = ids
                .map(id => ({ id, changes }))
                .filter(({ id, changes }) => {
                    const existingCameraZoom = state.entities[id]
                    const mergedCameraZoom = { ...existingCameraZoom, ...changes }
                    return validateAnim(mergedCameraZoom)
                })
            if (updates.length === 0) return
            animsAdapter.updateMany(state, updates)
        },
        removeCameraZoom: animsAdapter.removeOne,
        removeCameraZooms: animsAdapter.removeMany,
        upsertCameraZooms: (state, action) => {
            const cameraZooms = action.payload
            const validCameraZooms = cameraZooms.filter(cameraZoom => {
                const existingCameraZoom = state.entities[cameraZoom.id]
                const finalCameraZoom = existingCameraZoom ? { ...existingCameraZoom, ...cameraZoom } : cameraZoom
                return validateAnim(finalCameraZoom)
            })
            if (validCameraZooms.length === 0) return
            animsAdapter.upsertMany(state, validCameraZooms)
        },
        setTargetScale: (state, action) => { state.targetScale = action.payload },
    },
})

export const selectAllCameraZooms = state => selectAll(state.undoableState.present.cameraZoomAnims)
export const selectCameraZoomEntities = state => selectEntities(state.undoableState.present.cameraZoomAnims)
export const selectTargetScale = state => state.undoableState.present.cameraZoomAnims.targetScale
export const selectCameraZoomById = (state, id) => selectById(state.undoableState.present.cameraZoomAnims, id)
export const selectCameraZoomIds = state => selectIds(state.undoableState.present.cameraZoomAnims)

// Action creators are generated for each case reducer function
export const {
    reset,
    applyProperties,
    setCameraZooms,
    updateCameraZoom,
    updateCameraZooms,
    addCameraZoom,
    updateAllCameraZooms,
    removeCameraZoom,
    removeCameraZooms,
    upsertCameraZooms,
    setTargetScale
} = cameraSlice.actions

export default cameraSlice.reducer