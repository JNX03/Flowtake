import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    position: null,
    time: null,
    isClipMenuOpen: false,
    isClickMenuOpen: false,
    clickId: null,
    mousedownEventId: null,
    mouseupEventId: null,
    isZoomMenuOpen: false,
    isSubtitleMenuOpen: false,
    isNewClipMenuOpen: false,
    isNewZoomMenuOpen: false,
    isNewSubtitleMenuOpen: false,
    isMaskMenuOpen: false,
    isNewMaskMenuOpen: false,
    isSpatialMenuOpen: false,
    isNewSpatialMenuOpen: false,
    isKeyboardLayoutMenuOpen: false,
    isNewKeyboardLayoutMenuOpen: false,
    keyboardLayoutId: null,
    isMouseStyleMenuOpen: false,
    isNewMouseStyleMenuOpen: false,
    mouseStyleId: null,
    isAppSceneMenuOpen: false,
    isNewAppSceneMenuOpen: false,
    appSceneId: null,
    selectedMaskRow: null,
}

export const contextMenuSlice = createSlice({
    name: 'contextMenu',
    initialState,
    reducers: {
        reset: () => initialState,
        setPosition: (state, action) => {
            state.position = action.payload
        },
        setTime: (state, action) => {
            state.time = action.payload
        },
        setClickId: (state, action) => {
            state.clickId = action.payload
        },
        setMousedownEventId: (state, action) => {
            state.mousedownEventId = action.payload
        },
        setMouseupEventId: (state, action) => {
            state.mouseupEventId = action.payload
        },
        setSelectedMaskRow: (state, action) => {
            state.selectedMaskRow = action.payload
        },
        setKeyboardLayoutId: (state, action) => {
            state.keyboardLayoutId = action.payload
        },
        setMouseStyleId: (state, action) => {
            state.mouseStyleId = action.payload
        },
        setAppSceneId: (state, action) => {
            state.appSceneId = action.payload
        },
        closeAllContextMenus: state => {
            state.isClipMenuOpen = false
            state.isClickMenuOpen = false
            state.isZoomMenuOpen = false
            state.isSubtitleMenuOpen = false
            state.isNewClipMenuOpen = false
            state.isNewZoomMenuOpen = false
            state.isNewSubtitleMenuOpen = false
            state.isMaskMenuOpen = false
            state.isNewMaskMenuOpen = false
            state.isSpatialMenuOpen = false
            state.isNewSpatialMenuOpen = false
            state.isKeyboardLayoutMenuOpen = false
            state.isNewKeyboardLayoutMenuOpen = false
            state.isMouseStyleMenuOpen = false
            state.isNewMouseStyleMenuOpen = false
            state.isAppSceneMenuOpen = false
            state.isNewAppSceneMenuOpen = false
        },
        setIsClipMenuOpen: (state, action) => {
            state.isClipMenuOpen = action.payload
            state.isClickMenuOpen = false
            state.isZoomMenuOpen = false
            state.isSubtitleMenuOpen = false
            state.isNewClipMenuOpen = false
            state.isNewZoomMenuOpen = false
            state.isNewSubtitleMenuOpen = false
            state.isMaskMenuOpen = false
            state.isNewMaskMenuOpen = false
            state.isSpatialMenuOpen = false
            state.isNewSpatialMenuOpen = false
        },
        setIsClickMenuOpen: (state, action) => {
            state.isClipMenuOpen = false
            state.isClickMenuOpen = action.payload
            state.isZoomMenuOpen = false
            state.isSubtitleMenuOpen = false
            state.isNewClipMenuOpen = false
            state.isNewZoomMenuOpen = false
            state.isNewSubtitleMenuOpen = false
            state.isMaskMenuOpen = false
            state.isNewMaskMenuOpen = false
            state.isSpatialMenuOpen = false
            state.isNewSpatialMenuOpen = false
        },
        setIsZoomMenuOpen: (state, action) => {
            state.isClipMenuOpen = false
            state.isClickMenuOpen = false
            state.isZoomMenuOpen = action.payload
            state.isSubtitleMenuOpen = false
            state.isNewClipMenuOpen = false
            state.isNewZoomMenuOpen = false
            state.isNewSubtitleMenuOpen = false
            state.isMaskMenuOpen = false
            state.isNewMaskMenuOpen = false
            state.isSpatialMenuOpen = false
            state.isNewSpatialMenuOpen = false
        },
        setIsSubtitleMenuOpen: (state, action) => {
            state.isClipMenuOpen = false
            state.isClickMenuOpen = false
            state.isZoomMenuOpen = false
            state.isSubtitleMenuOpen = action.payload
            state.isNewClipMenuOpen = false
            state.isNewZoomMenuOpen = false
            state.isNewSubtitleMenuOpen = false
            state.isMaskMenuOpen = false
            state.isNewMaskMenuOpen = false
            state.isSpatialMenuOpen = false
            state.isNewSpatialMenuOpen = false
        },
        setIsNewClipMenuOpen: (state, action) => {
            state.isClipMenuOpen = false
            state.isClickMenuOpen = false
            state.isZoomMenuOpen = false
            state.isSubtitleMenuOpen = false
            state.isNewClipMenuOpen = action.payload
            state.isNewZoomMenuOpen = false
            state.isNewSubtitleMenuOpen = false
            state.isMaskMenuOpen = false
            state.isNewMaskMenuOpen = false
            state.isSpatialMenuOpen = false
            state.isNewSpatialMenuOpen = false
        },
        setIsNewZoomMenuOpen: (state, action) => {
            state.isClipMenuOpen = false
            state.isClickMenuOpen = false
            state.isZoomMenuOpen = false
            state.isSubtitleMenuOpen = false
            state.isNewClipMenuOpen = false
            state.isNewZoomMenuOpen = action.payload
            state.isNewSubtitleMenuOpen = false
            state.isMaskMenuOpen = false
            state.isNewMaskMenuOpen = false
            state.isSpatialMenuOpen = false
            state.isNewSpatialMenuOpen = false
        },
        setIsNewSubtitleMenuOpen: (state, action) => {
            state.isClipMenuOpen = false
            state.isClickMenuOpen = false
            state.isZoomMenuOpen = false
            state.isSubtitleMenuOpen = false
            state.isNewClipMenuOpen = false
            state.isNewZoomMenuOpen = false
            state.isNewSubtitleMenuOpen = action.payload
            state.isMaskMenuOpen = false
            state.isNewMaskMenuOpen = false
            state.isSpatialMenuOpen = false
            state.isNewSpatialMenuOpen = false
        },
        setIsMaskMenuOpen: (state, action) => {
            state.isClipMenuOpen = false
            state.isClickMenuOpen = false
            state.isZoomMenuOpen = false
            state.isSubtitleMenuOpen = false
            state.isNewClipMenuOpen = false
            state.isNewZoomMenuOpen = false
            state.isNewSubtitleMenuOpen = false
            state.isMaskMenuOpen = action.payload
            state.isNewMaskMenuOpen = false
            state.isSpatialMenuOpen = false
            state.isNewSpatialMenuOpen = false
        },
        setIsNewMaskMenuOpen: (state, action) => {
            state.isClipMenuOpen = false
            state.isClickMenuOpen = false
            state.isZoomMenuOpen = false
            state.isSubtitleMenuOpen = false
            state.isNewClipMenuOpen = false
            state.isNewZoomMenuOpen = false
            state.isNewSubtitleMenuOpen = false
            state.isMaskMenuOpen = false
            state.isNewMaskMenuOpen = action.payload
            state.isSpatialMenuOpen = false
            state.isNewSpatialMenuOpen = false
        },
        setIsSpatialMenuOpen: (state, action) => {
            state.isClipMenuOpen = false
            state.isClickMenuOpen = false
            state.isZoomMenuOpen = false
            state.isSubtitleMenuOpen = false
            state.isNewClipMenuOpen = false
            state.isNewZoomMenuOpen = false
            state.isNewSubtitleMenuOpen = false
            state.isMaskMenuOpen = false
            state.isNewMaskMenuOpen = false
            state.isSpatialMenuOpen = action.payload
            state.isNewSpatialMenuOpen = false
        },
        setIsNewSpatialMenuOpen: (state, action) => {
            state.isClipMenuOpen = false
            state.isClickMenuOpen = false
            state.isZoomMenuOpen = false
            state.isSubtitleMenuOpen = false
            state.isNewClipMenuOpen = false
            state.isNewZoomMenuOpen = false
            state.isNewSubtitleMenuOpen = false
            state.isMaskMenuOpen = false
            state.isNewMaskMenuOpen = false
            state.isSpatialMenuOpen = false
            state.isNewSpatialMenuOpen = action.payload
        },
        setIsKeyboardLayoutMenuOpen: (state, action) => {
            state.isClipMenuOpen = false
            state.isClickMenuOpen = false
            state.isZoomMenuOpen = false
            state.isSubtitleMenuOpen = false
            state.isNewClipMenuOpen = false
            state.isNewZoomMenuOpen = false
            state.isNewSubtitleMenuOpen = false
            state.isMaskMenuOpen = false
            state.isNewMaskMenuOpen = false
            state.isSpatialMenuOpen = false
            state.isNewSpatialMenuOpen = false
            state.isKeyboardLayoutMenuOpen = action.payload
            state.isNewKeyboardLayoutMenuOpen = false
        },
        setIsNewKeyboardLayoutMenuOpen: (state, action) => {
            state.isClipMenuOpen = false
            state.isClickMenuOpen = false
            state.isZoomMenuOpen = false
            state.isSubtitleMenuOpen = false
            state.isNewClipMenuOpen = false
            state.isNewZoomMenuOpen = false
            state.isNewSubtitleMenuOpen = false
            state.isMaskMenuOpen = false
            state.isNewMaskMenuOpen = false
            state.isSpatialMenuOpen = false
            state.isNewSpatialMenuOpen = false
            state.isKeyboardLayoutMenuOpen = false
            state.isNewKeyboardLayoutMenuOpen = action.payload
        },
        setIsMouseStyleMenuOpen: (state, action) => {
            state.isMouseStyleMenuOpen = action.payload
            state.isNewMouseStyleMenuOpen = false
        },
        setIsNewMouseStyleMenuOpen: (state, action) => {
            state.isMouseStyleMenuOpen = false
            state.isNewMouseStyleMenuOpen = action.payload
        },
        setIsAppSceneMenuOpen: (state, action) => {
            state.isAppSceneMenuOpen = action.payload
            state.isNewAppSceneMenuOpen = false
        },
        setIsNewAppSceneMenuOpen: (state, action) => {
            state.isAppSceneMenuOpen = false
            state.isNewAppSceneMenuOpen = action.payload
        }
    },
})

// Action creators are generated for each case reducer function
export const {
    reset,
    setPosition,
    setTime,
    setClickId,
    setMousedownEventId,
    setMouseupEventId,
    setSelectedMaskRow,
    closeAllContextMenus,
    setIsClipMenuOpen,
    setIsClickMenuOpen,
    setIsZoomMenuOpen,
    setIsSubtitleMenuOpen,
    setIsNewClipMenuOpen,
    setIsNewZoomMenuOpen,
    setIsNewSubtitleMenuOpen,
    setIsMaskMenuOpen,
    setIsNewMaskMenuOpen,
    setIsSpatialMenuOpen,
    setIsNewSpatialMenuOpen,
    setIsKeyboardLayoutMenuOpen,
    setIsNewKeyboardLayoutMenuOpen,
    setKeyboardLayoutId,
    setIsMouseStyleMenuOpen,
    setIsNewMouseStyleMenuOpen,
    setMouseStyleId,
    setIsAppSceneMenuOpen,
    setIsNewAppSceneMenuOpen,
    setAppSceneId,
} = contextMenuSlice.actions

export const selectPosition = state => state.contextMenu.position
export const selectTime = state => state.contextMenu.time
export const selectClickId = state => state.contextMenu.clickId
export const selectMousedownEventId = state => state.contextMenu.mousedownEventId
export const selectMouseupEventId = state => state.contextMenu.mouseupEventId
export const selectSelectedMaskRow = state => state.contextMenu.selectedMaskRow
export const selectIsClipMenuOpen = state => state.contextMenu.isClipMenuOpen
export const selectIsClickMenuOpen = state => state.contextMenu.isClickMenuOpen
export const selectIsZoomMenuOpen = state => state.contextMenu.isZoomMenuOpen
export const selectIsSubtitleMenuOpen = state => state.contextMenu.isSubtitleMenuOpen
export const selectIsNewClipMenuOpen = state => state.contextMenu.isNewClipMenuOpen
export const selectIsNewZoomMenuOpen = state => state.contextMenu.isNewZoomMenuOpen
export const selectIsNewSubtitleMenuOpen = state => state.contextMenu.isNewSubtitleMenuOpen
export const selectIsMaskMenuOpen = state => state.contextMenu.isMaskMenuOpen
export const selectIsNewMaskMenuOpen = state => state.contextMenu.isNewMaskMenuOpen
export const selectIsSpatialMenuOpen = state => state.contextMenu.isSpatialMenuOpen
export const selectIsNewSpatialMenuOpen = state => state.contextMenu.isNewSpatialMenuOpen
export const selectIsKeyboardLayoutMenuOpen = state => state.contextMenu.isKeyboardLayoutMenuOpen
export const selectIsNewKeyboardLayoutMenuOpen = state => state.contextMenu.isNewKeyboardLayoutMenuOpen
export const selectKeyboardLayoutId = state => state.contextMenu.keyboardLayoutId
export const selectIsMouseStyleMenuOpen = state => state.contextMenu.isMouseStyleMenuOpen
export const selectIsNewMouseStyleMenuOpen = state => state.contextMenu.isNewMouseStyleMenuOpen
export const selectMouseStyleId = state => state.contextMenu.mouseStyleId
export const selectIsAppSceneMenuOpen = state => state.contextMenu.isAppSceneMenuOpen
export const selectIsNewAppSceneMenuOpen = state => state.contextMenu.isNewAppSceneMenuOpen
export const selectAppSceneId = state => state.contextMenu.appSceneId

export default contextMenuSlice.reducer