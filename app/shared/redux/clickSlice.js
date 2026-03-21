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

export const clickSlice = createSlice({
    name: 'clickAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        setClicks: (state, action) => {
            const clicks = action.payload
            const validClicks = Array.isArray(clicks)
                ? clicks.filter(validateAnim)
                : Object.values(clicks).filter(validateAnim)
            if (validClicks.length === 0) return
            animsAdapter.setAll(state, validClicks)
        },
        updateClick: (state, action) => {
            const { id, changes } = action.payload
            const existingClick = state.entities[id]
            if (!existingClick) return

            const mergedClick = { ...existingClick, ...changes }
            if (!validateAnim(mergedClick)) return

            animsAdapter.updateOne(state, action)
        },
        updateClicks: (state, action) => {
            const updates = action.payload
            const validUpdates = updates.filter(({ id, changes }) => {
                const existingClick = state.entities[id]
                if (!existingClick) return false

                const mergedClick = { ...existingClick, ...changes }
                return validateAnim(mergedClick)
            })
            if (validUpdates.length === 0) return
            animsAdapter.updateMany(state, validUpdates)
        }
    },
})

export const selectClickEntities = state => selectEntities(state.undoableState.present.clickAnims)
export const selectClickById = (state, id) => selectById(state.undoableState.present.clickAnims, id)
export const selectAllClicks = state => selectAll(state.undoableState.present.clickAnims)
export const selectClickIds = state => selectIds(state.undoableState.present.clickAnims)

// Action creators are generated for each case reducer function
export const {
    reset,
    applyProperties,
    setClicks,
    updateClick,
    updateClicks
} = clickSlice.actions

export default clickSlice.reducer
