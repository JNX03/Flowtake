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

// Slice-level defaults — applied to any entity whose field is null/undefined.
const initialState = animsAdapter.getInitialState({
    color: "#3b82f6",
    showLabel: true,
    label: "Drawn",
    preset: "pointer",
    showTrail: true,
})

export const drawnMouseAnimSlice = createSlice({
    name: 'drawnMouseAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        setDrawnMice: (state, action) => {
            const items = action.payload
            const valid = Array.isArray(items)
                ? items.filter(validateAnim)
                : Object.values(items || {}).filter(validateAnim)
            animsAdapter.setAll(state, valid)
        },
        addDrawnMouse: (state, action) => {
            const item = action.payload
            if (!validateAnim(item)) return
            animsAdapter.addOne(state, action)
        },
        updateDrawnMouse: (state, action) => {
            const { id, changes } = action.payload
            const existing = state.entities[id]
            if (!existing) return
            const merged = { ...existing, ...changes }
            if (!validateAnim(merged)) return
            animsAdapter.updateOne(state, action)
        },
        removeDrawnMouse: animsAdapter.removeOne,
        upsertDrawnMice: (state, action) => {
            const items = action.payload
            const valid = items.filter(item => {
                const existing = state.entities[item.id]
                const final = existing ? { ...existing, ...item } : item
                return validateAnim(final)
            })
            if (valid.length === 0) return
            animsAdapter.upsertMany(state, valid)
        },
        setColor: (state, action) => { state.color = action.payload },
        setLabel: (state, action) => { state.label = action.payload },
        setShowLabel: (state, action) => { state.showLabel = action.payload },
        setPreset: (state, action) => { state.preset = action.payload },
        setShowTrail: (state, action) => { state.showTrail = action.payload },
    },
})

export const {
    reset,
    applyProperties,
    setDrawnMice,
    addDrawnMouse,
    updateDrawnMouse,
    removeDrawnMouse,
    upsertDrawnMice,
    setColor,
    setLabel,
    setShowLabel,
    setPreset,
    setShowTrail,
} = drawnMouseAnimSlice.actions

const slice = state => state.undoableState.present.drawnMouseAnims

export const selectAllDrawnMice = state => selectAll(slice(state))
export const selectDrawnMouseEntities = state => selectEntities(slice(state))
export const selectDrawnMouseById = (state, id) => selectById(slice(state), id)
export const selectDrawnMouseIds = state => selectIds(slice(state))
export const selectDrawnMouseColor = state => slice(state).color
export const selectDrawnMouseLabel = state => slice(state).label
export const selectDrawnMouseShowLabel = state => slice(state).showLabel
export const selectDrawnMousePreset = state => slice(state).preset
export const selectDrawnMouseShowTrail = state => slice(state).showTrail
export const selectDrawnMouseDefaults = state => ({
    color: slice(state).color,
    showLabel: slice(state).showLabel,
    label: slice(state).label,
    preset: slice(state).preset,
    showTrail: slice(state).showTrail,
})

export default drawnMouseAnimSlice.reducer
