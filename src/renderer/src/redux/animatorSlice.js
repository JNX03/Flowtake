import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    rendererDims: null
}

export const animatorSlice = createSlice({
    name: 'animator',
    initialState,
    reducers: {
        reset: () => initialState,
        setRendererDims: (state, action) => {
            state.rendererDims = action.payload
        }
    },
})

// Action creators are generated for each case reducer function
export const {
    reset,
    setRendererDims
} = animatorSlice.actions

// Selectors
export const selectRendererDims = state => state.animator.rendererDims

export default animatorSlice.reducer
