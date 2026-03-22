import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    // Global filter settings (applied to active clip)
    brightness: 1,    // 0-2, default 1 (no change)
    contrast: 1,      // 0-2, default 1
    saturation: 1,    // 0-2, default 1
    gamma: 1,         // 0-2, default 1
    hue: 0,           // -180 to 180 degrees
    temperature: 0,   // -1 to 1 (cool to warm)
    vignette: 0,      // 0-1 strength
    blur: 0,          // 0-20 px
}

export const filterSlice = createSlice({
    name: 'filterAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        setBrightness: (state, action) => { state.brightness = action.payload },
        setContrast: (state, action) => { state.contrast = action.payload },
        setSaturation: (state, action) => { state.saturation = action.payload },
        setGamma: (state, action) => { state.gamma = action.payload },
        setHue: (state, action) => { state.hue = action.payload },
        setTemperature: (state, action) => { state.temperature = action.payload },
        setVignette: (state, action) => { state.vignette = action.payload },
        setBlur: (state, action) => { state.blur = action.payload },
        applyFilterPreset: (state, action) => {
            const preset = action.payload
            Object.assign(state, preset)
        },
        resetFilters: () => initialState,
    },
})

export const {
    reset,
    setBrightness,
    setContrast,
    setSaturation,
    setGamma,
    setHue,
    setTemperature,
    setVignette,
    setBlur,
    applyFilterPreset,
    resetFilters,
} = filterSlice.actions

export const selectBrightness = state => state.undoableState.present.filterAnims.brightness
export const selectContrast = state => state.undoableState.present.filterAnims.contrast
export const selectSaturation = state => state.undoableState.present.filterAnims.saturation
export const selectGamma = state => state.undoableState.present.filterAnims.gamma
export const selectHue = state => state.undoableState.present.filterAnims.hue
export const selectTemperature = state => state.undoableState.present.filterAnims.temperature
export const selectVignette = state => state.undoableState.present.filterAnims.vignette
export const selectBlur = state => state.undoableState.present.filterAnims.blur
export const selectAllFilters = state => state.undoableState.present.filterAnims

export default filterSlice.reducer
