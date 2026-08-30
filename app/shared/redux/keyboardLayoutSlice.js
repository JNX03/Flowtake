import { createSelector, createSlice } from '@reduxjs/toolkit'
import {
    animsAdapter,
    applyAnimProperties,
    selectAll,
    selectById,
    selectEntities,
    selectIds,
    validateAnim
} from "./animsAdapter.js"

// Slice-level defaults (the FALLBACK config when an entity has no override)
const initialState = animsAdapter.getInitialState({
    mode: "keybinds",       // "full" | "keybinds"
    position: "bottom-center",
    size: "md",             // "sm" | "md" | "lg"
})

export const keyboardLayoutSlice = createSlice({
    name: 'keyboardLayoutAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        setKeyboardLayouts: (state, action) => {
            const items = action.payload
            const valid = Array.isArray(items)
                ? items.filter(validateAnim)
                : Object.values(items || {}).filter(validateAnim)
            animsAdapter.setAll(state, valid)
        },
        addKeyboardLayout: (state, action) => {
            const item = action.payload
            if (!validateAnim(item)) return
            animsAdapter.addOne(state, action)
        },
        updateKeyboardLayout: (state, action) => {
            const { id, changes } = action.payload
            const existing = state.entities[id]
            if (!existing) return
            const merged = { ...existing, ...changes }
            if (!validateAnim(merged)) return
            animsAdapter.updateOne(state, action)
        },
        removeKeyboardLayout: animsAdapter.removeOne,
        upsertKeyboardLayouts: (state, action) => {
            const items = action.payload
            const valid = items.filter(item => {
                const existing = state.entities[item.id]
                const final = existing ? { ...existing, ...item } : item
                return validateAnim(final)
            })
            if (valid.length === 0) return
            animsAdapter.upsertMany(state, valid)
        },
        setMode: (state, action) => { state.mode = action.payload },
        setPosition: (state, action) => { state.position = action.payload },
        setSize: (state, action) => { state.size = action.payload },
    },
})

export const {
    reset,
    applyProperties,
    setKeyboardLayouts,
    addKeyboardLayout,
    updateKeyboardLayout,
    removeKeyboardLayout,
    upsertKeyboardLayouts,
    setMode,
    setPosition,
    setSize,
} = keyboardLayoutSlice.actions

const slice = state => state.undoableState.present.keyboardLayoutAnims

export const selectAllKeyboardLayouts = state => selectAll(slice(state))
export const selectKeyboardLayoutEntities = state => selectEntities(slice(state))
export const selectKeyboardLayoutById = (state, id) => selectById(slice(state), id)
export const selectKeyboardLayoutIds = state => selectIds(slice(state))
export const selectKeyboardLayoutMode = state => slice(state).mode
export const selectKeyboardLayoutPosition = state => slice(state).position
export const selectKeyboardLayoutSize = state => slice(state).size
export const selectKeyboardLayoutDefaults = createSelector(
    [
        selectKeyboardLayoutMode,
        selectKeyboardLayoutPosition,
        selectKeyboardLayoutSize,
    ],
    (mode, position, size) => ({
        mode,
        position,
        size,
    })
)

export default keyboardLayoutSlice.reducer
