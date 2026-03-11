import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    isSnappingEnabled: false,
    visibleRange: { start: 0, end: 0 },
    scrollLeft: 0,
    offset: 0,
    width: 0,
    snappingLines: [],
    pxPerMs: 0.1,
    lastSelectedAnim: null,
    selectedRow: null,
    selectedIds: [],
    openSection: "screen-recording",
    time: 0,
    isMaskingModeEnabled: false,
}

export const timelineSlice = createSlice({
    name: 'timeline',
    initialState,
    reducers: {
        reset: () => initialState,
        setIsSnappingEnabled: (state, action) => {
            state.isSnappingEnabled = action.payload
        },
        setVisibleRange: (state, action) => {
            state.visibleRange = action.payload
        },
        setScrollLeft: (state, action) => {
            state.scrollLeft = action.payload
        },
        setOffset: (state, action) => {
            state.offset = action.payload
        },
        setWidth: (state, action) => {
            state.width = action.payload
        },
        setSnappingLines: (state, action) => {
            state.snappingLines = action.payload
        },
        setPxPerMs: (state, action) => {
            state.pxPerMs = action.payload
        },
        setLastSelectedAnim: (state, action) => {
            state.lastSelectedAnim = action.payload
        },
        setSelectedRow: (state, action) => {
            state.selectedRow = action.payload
        },
        setSelectedIds: (state, action) => {
            state.selectedIds = action.payload
        },
        setOpenSection: (state, action) => {
            state.openSection = action.payload
        },
        setTime: (state, action) => {
            state.time = action.payload
        },
        setIsMaskingModeEnabled: (state, action) => {
            state.isMaskingModeEnabled = action.payload
        }
    },
})

// Action creators are generated for each case reducer function
export const {
    reset,
    setIsSnappingEnabled,
    setVisibleRange,
    setScrollLeft,
    setOffset,
    setWidth,
    setSnappingLines,
    setPxPerMs,
    setLastSelectedAnim,
    setSelectedRow,
    setSelectedIds,
    setOpenSection,
    setTime,
    setIsMaskingModeEnabled
} = timelineSlice.actions

export const selectIsSnappingEnabled = state => state.timeline.isSnappingEnabled
export const selectVisibleRange = state => state.timeline.visibleRange
export const selectScrollLeft = state => state.timeline.scrollLeft
export const selectOffset = state => state.timeline.offset
export const selectWidth = state => state.timeline.width
export const selectSnappingLines = state => state.timeline.snappingLines
export const selectPxPerMs = state => state.timeline.pxPerMs
export const selectlastSelectedAnim = state => state.timeline.lastSelectedAnim
export const selectSelectedRow = state => state.timeline.selectedRow
export const selectSelectedIds = state => state.timeline.selectedIds
export const selectOpenSection = state => state.timeline.openSection
export const selectTime = state => state.timeline.time
export const selectIsMaskingModeEnabled = state => state.timeline.isMaskingModeEnabled

export default timelineSlice.reducer
