import { createSlice } from '@reduxjs/toolkit'
import {
    animsAdapter,
    applyAnimProperties,
    selectAll,
    selectById,
    selectEntities,
    selectIds,
    selectTotal,
    validateAnim
} from "./animsAdapter"

const initialState = animsAdapter.getInitialState({
    borderRadius: 8,
    blurStrength: .5,
    fill: "#ffffff",
    alpha: .2
})

export const maskSlice = createSlice({
    name: 'maskAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        addMask: (state, action) => {
            const mask = action.payload
            if (!validateAnim(mask)) return
            animsAdapter.addOne(state, action)
        },
        setMasks: (state, action) => {
            const masks = action.payload
            const validMasks = Array.isArray(masks)
                ? masks.filter(validateAnim)
                : Object.values(masks).filter(validateAnim)
            if (validMasks.length === 0) return
            animsAdapter.setAll(state, validMasks)
        },
        updateMask: (state, action) => {
            const { id, changes } = action.payload
            const existingMask = state.entities[id]
            if (!existingMask) return

            const mergedMask = { ...existingMask, ...changes }
            if (!validateAnim(mergedMask)) return

            animsAdapter.updateOne(state, action)
        },
        updateMasks: (state, action) => {
            const updates = action.payload
            const validUpdates = updates.filter(({ id, changes }) => {
                const existingMask = state.entities[id]
                if (!existingMask) return false

                const mergedMask = { ...existingMask, ...changes }
                return validateAnim(mergedMask)
            })
            if (validUpdates.length === 0) return
            animsAdapter.updateMany(state, validUpdates)
        },
        updateAllMasks: (state, action) => {
            const { changes } = action.payload
            const ids = Object.keys(state.entities)
            const updates = ids
                .map(id => ({ id, changes }))
                .filter(({ id, changes }) => {
                    const existingMask = state.entities[id]
                    const mergedMask = { ...existingMask, ...changes }
                    return validateAnim(mergedMask)
                })
            if (updates.length === 0) return
            animsAdapter.updateMany(state, updates)
        },
        removeMask: animsAdapter.removeOne,
        removeMasks: animsAdapter.removeMany,
        upsertMasks: (state, action) => {
            const masks = action.payload
            const validMasks = masks.filter(mask => {
                const existingMask = state.entities[mask.id]
                const finalMask = existingMask ? { ...existingMask, ...mask } : mask
                return validateAnim(finalMask)
            })
            if (validMasks.length === 0) return
            animsAdapter.upsertMany(state, validMasks)
        },
        setBorderRadius: (state, action) => {
            state.borderRadius = action.payload
        },
        setBlurStrength: (state, action) => {
            state.blurStrength = action.payload
        },
        setFill: (state, action) => {
            state.fill = action.payload
        },
        setAlpha: (state, action) => {
            state.alpha = action.payload
        }
    },
})

export const selectMaskEntities = state => selectEntities(state.undoableState.present.maskAnims)
export const selectMaskById = (state, id) => selectById(state.undoableState.present.maskAnims, id)
export const selectAllMasks = state => selectAll(state.undoableState.present.maskAnims)
export const selectMaskIds = state => selectIds(state.undoableState.present.maskAnims)
export const selectTotalMasks = state => selectTotal(state.undoableState.present.maskAnims)
export const selectBorderRadius = state => state.undoableState.present.maskAnims.borderRadius
export const selectBlurStrength = state => state.undoableState.present.maskAnims.blurStrength
export const selectFill = state => state.undoableState.present.maskAnims.fill
export const selectAlpha = state => state.undoableState.present.maskAnims.alpha

// Action creators are generated for each case reducer function
export const {
    reset,
    applyProperties,
    addMask,
    setMasks,
    updateMask,
    updateMasks,
    updateAllMasks,
    removeMask,
    removeMasks,
    upsertMasks,
    setBorderRadius,
    setBlurStrength,
    setFill,
    setAlpha
} = maskSlice.actions

export default maskSlice.reducer