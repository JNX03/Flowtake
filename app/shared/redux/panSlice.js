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

const initialState = animsAdapter.getInitialState()

export const panSlice = createSlice({
    name: 'panAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        setPans: (state, action) => {
            const pans = action.payload
            const validPans = Array.isArray(pans)
                ? pans.filter(validateAnim)
                : Object.values(pans).filter(validateAnim)
            if (validPans.length === 0) return
            animsAdapter.setAll(state, validPans)
        },
        updatePan: (state, action) => {
            const { id, changes } = action.payload
            const existingPan = state.entities[id]
            if (!existingPan) return

            const mergedPan = { ...existingPan, ...changes }
            if (!validateAnim(mergedPan)) return

            animsAdapter.updateOne(state, action)
        },
        updatePans: (state, action) => {
            const updates = action.payload
            const validUpdates = updates.filter(({ id, changes }) => {
                const existingPan = state.entities[id]
                if (!existingPan) return false

                const mergedPan = { ...existingPan, ...changes }
                return validateAnim(mergedPan)
            })
            if (validUpdates.length === 0) return
            animsAdapter.updateMany(state, validUpdates)
        },
        addPan: (state, action) => {
            const pan = action.payload
            if (!validateAnim(pan)) return
            animsAdapter.addOne(state, action)
        },
        updateAllPans: (state, action) => {
            const { changes } = action.payload
            const ids = Object.keys(state.entities)
            const updates = ids
                .map(id => ({ id, changes }))
                .filter(({ id, changes }) => {
                    const existingPan = state.entities[id]
                    const mergedPan = { ...existingPan, ...changes }
                    return validateAnim(mergedPan)
                })
            if (updates.length === 0) return
            animsAdapter.updateMany(state, updates)
        },
        removePan: animsAdapter.removeOne,
        removePans: animsAdapter.removeMany,
        upsertPans: (state, action) => {
            const pans = action.payload
            const validPans = pans.filter(pan => {
                const existingPan = state.entities[pan.id]
                const finalPan = existingPan ? { ...existingPan, ...pan } : pan
                return validateAnim(finalPan)
            })
            if (validPans.length === 0) return
            animsAdapter.upsertMany(state, validPans)
        }
    },
})

// Action creators are generated for each case reducer function
export const {
    reset,
    applyProperties,
    setPans,
    updatePan,
    updatePans,
    addPan,
    updateAllPans,
    removePan,
    removePans,
    upsertPans
} = panSlice.actions

export const selectAllPans = state => selectAll(state.undoableState.present.panAnims)
export const selectPanEntities = state => selectEntities(state.undoableState.present.panAnims)
export const selectPanById = (state, id) => selectById(state.undoableState.present.panAnims, id)
export const selectPanIds = state => selectIds(state.undoableState.present.panAnims)

export default panSlice.reducer
