import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    inertia: 650,
    cutOff: 0,
    isLoop: false,
    blurStrength: .3,
    showClickRing: true,
    showSpotlight: false,
    spotlightRadius: 160,
    spotlightOpacity: .55,
    spotlightFeather: 80
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
        setBlurStrength: (state, action) => { state.blurStrength = action.payload },
        setShowClickRing: (state, action) => { state.showClickRing = action.payload },
        setShowSpotlight: (state, action) => { state.showSpotlight = action.payload },
        setSpotlightRadius: (state, action) => { state.spotlightRadius = action.payload },
        setSpotlightOpacity: (state, action) => { state.spotlightOpacity = action.payload },
        setSpotlightFeather: (state, action) => { state.spotlightFeather = action.payload }
    },
})

// Action creators are generated for each case reducer function
export const {
    reset,
    applyProperties,
    setInertia,
    setCutOff,
    setIsLoop,
    setBlurStrength,
    setShowClickRing,
    setShowSpotlight,
    setSpotlightRadius,
    setSpotlightOpacity,
    setSpotlightFeather
} = cursorCoordsSlice.actions

export const selectInertia = state => state.undoableState.present.cursorCoords.inertia
export const selectCutOff = state => state.undoableState.present.cursorCoords.cutOff
export const selectIsLoop = state => state.undoableState.present.cursorCoords.isLoop
export const selectBlurStrength = state => state.undoableState.present.cursorCoords.blurStrength
export const selectShowClickRing = state => state.undoableState.present.cursorCoords.showClickRing
export const selectShowSpotlight = state => state.undoableState.present.cursorCoords.showSpotlight
export const selectSpotlightRadius = state => state.undoableState.present.cursorCoords.spotlightRadius
export const selectSpotlightOpacity = state => state.undoableState.present.cursorCoords.spotlightOpacity
export const selectSpotlightFeather = state => state.undoableState.present.cursorCoords.spotlightFeather

export default cursorCoordsSlice.reducer
