import { createSlice } from '@reduxjs/toolkit'
import { renderAdapter, selectAll, selectById, selectTotal } from "./renderAdapter"

const initialState = renderAdapter.getInitialState({
    progress: 0,
    projectState: null,
    toasts: []
})

export const renderSlice = createSlice({
    name: 'render',
    initialState,
    reducers: {
        setProgress: (state, action) => {
            state.progress = action.payload
        },
        setProjectState: (state, action) => {
            state.projectState = action.payload
        },
        addToast: (state, action) => {
            state.toasts = [...state.toasts, { autoDismiss: true, ...action.payload, id: `toast-${crypto.randomUUID()}` }]
        },
        dismissToast: (state, action) => {
            state.toasts = state.toasts.filter(({ id }) => id !== action.payload)
        },
        addRender: renderAdapter.addOne,
        updateRender: renderAdapter.updateOne,
        removeRender: renderAdapter.removeOne,
        removeRenders: renderAdapter.removeMany
    },
})

// Action creators are generated for each case reducer function
export const {
    setProgress,
    setProjectState,
    addToast,
    dismissToast,
    addRender,
    updateRender,
    removeRender,
    removeRenders
} = renderSlice.actions

export const selectProgress = state => state.render.progress
export const selectProjectState = state => state.render.projectState
export const selectToasts = state => state.render.toasts
export const selectAllRenders = state => selectAll(state.render)
export const selectRenderById = (state, id) => selectById(state.render, id)
export const selectTotalRenders = state => selectTotal(state.render)
export default renderSlice.reducer
