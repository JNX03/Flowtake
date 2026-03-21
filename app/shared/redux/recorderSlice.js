import { createSlice } from '@reduxjs/toolkit'
import { SOURCE_TYPE_SCREEN } from "../constants"

const initialState = {
    source: { name: "Screen", type: SOURCE_TYPE_SCREEN, id: "screen" },
    isRecording: false
}

export const recorderSlice = createSlice({
    name: 'recorder',
    initialState,
    reducers: {
        reset: () => initialState,
        setSource: (state, action) => {
            state.source = action.payload
        },
        setIsRecording: (state, action) => {
            state.isRecording = action.payload
        }
    },
})

// Action creators are generated for each case reducer function
export const {
    setSource,
    setIsRecording,
    reset
} = recorderSlice.actions

export const selectSource = state => state.recorder.source
export const selectIsRecording = state => state.recorder.isRecording

export default recorderSlice.reducer
