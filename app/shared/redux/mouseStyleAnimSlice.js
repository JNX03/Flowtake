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

// Slice-level defaults — apply when no entity is active for a given time.
// preset values: 'default' (system cursor sprites) | 'arrow' | 'pointer' | 'dot' | 'ring' | 'target' | 'agent'
const initialState = animsAdapter.getInitialState({
    color: "#ff3b30",
    showLabel: true,
    label: "FlowTake Agent",
    preset: "default",
})

export const mouseStyleAnimSlice = createSlice({
    name: 'mouseStyleAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        setMouseStyles: (state, action) => {
            const items = action.payload
            const valid = Array.isArray(items)
                ? items.filter(validateAnim)
                : Object.values(items || {}).filter(validateAnim)
            animsAdapter.setAll(state, valid)
        },
        addMouseStyle: (state, action) => {
            const item = action.payload
            if (!validateAnim(item)) return
            animsAdapter.addOne(state, action)
        },
        updateMouseStyle: (state, action) => {
            const { id, changes } = action.payload
            const existing = state.entities[id]
            if (!existing) return
            const merged = { ...existing, ...changes }
            if (!validateAnim(merged)) return
            animsAdapter.updateOne(state, action)
        },
        removeMouseStyle: animsAdapter.removeOne,
        upsertMouseStyles: (state, action) => {
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
    },
})

export const {
    reset,
    applyProperties,
    setMouseStyles,
    addMouseStyle,
    updateMouseStyle,
    removeMouseStyle,
    upsertMouseStyles,
    setColor,
    setLabel,
    setShowLabel,
    setPreset,
} = mouseStyleAnimSlice.actions

const slice = state => state.undoableState.present.mouseStyleAnims

export const selectAllMouseStyles = state => selectAll(slice(state))
export const selectMouseStyleEntities = state => selectEntities(slice(state))
export const selectMouseStyleById = (state, id) => selectById(slice(state), id)
export const selectMouseStyleIds = state => selectIds(slice(state))
export const selectMouseStyleColor = state => slice(state).color
export const selectMouseStyleLabel = state => slice(state).label
export const selectMouseStyleShowLabel = state => slice(state).showLabel
export const selectMouseStylePreset = state => slice(state).preset
export const selectMouseStyleDefaults = state => ({
    color: slice(state).color,
    showLabel: slice(state).showLabel,
    label: slice(state).label,
    preset: slice(state).preset,
})

export default mouseStyleAnimSlice.reducer
