import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    inertia: 1000,
    cutOff: 0,
    isLoop: false,
    blurStrength: .5
}

export const cursorCoordsSlice = createSlice({
    name: 'cursorCoords',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: (state, action) => {
            Object.entries(action.payload).forEach(([key, value]) => { if (key in initialState && value != null) state[key] = value })
        },
        setInertia: (state, action) => { state.inertia = action.payload },
        setCutOff: (state, action) => { state.cutOff = action.payload },
        setIsLoop: (state, action) => { state.isLoop = action.payload },
        setBlurStrength: (state, action) => { state.blurStrength = action.payload }
    },
})

// Action creators are generated for each case reducer function
export const {
    reset,
    applyProperties,
    setInertia,
    setCutOff,
    setIsLoop,
    setBlurStrength
} = cursorCoordsSlice.actions

export const selectInertia = state => state.undoableState.present.cursorCoords.inertia
export const selectCutOff = state => state.undoableState.present.cursorCoords.cutOff
export const selectIsLoop = state => state.undoableState.present.cursorCoords.isLoop
export const selectBlurStrength = state => state.undoableState.present.cursorCoords.blurStrength

export default cursorCoordsSlice.reducer
