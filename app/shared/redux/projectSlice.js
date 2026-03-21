import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    name: null,
    id: null,
    mouseEvents: null,
    hasCameraVideo: false,
    hasMicrophoneAudio: false,
    hasSystemAudio: false,
    videoDetails: null,
    background: null,
    padding: .9,
    shadowAlpha: .5,
    cursorScale: .02,
    cursorFill: "#fff",
    cursorStroke: "#000",
    cursorShadowAlpha: .5,
    cursorMovementRotation: 0,
    cameraVideoShadowAlpha: .5,
    hasCameraVideoBackgroundBlur: false,
    cameraVideoBackgroundBlurAmount: .15,
    isCameraVideoMirrored: false,
    leftTrim: 0,
    rightTrim: 0,
    topTrim: 0,
    bottomTrim: 0,
    borderRadius: 8,
    aspectRatio: "16x9"
}

export const projectSlice = createSlice({
    name: 'project',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: (state, action) => {
            Object.entries(action.payload).forEach(([key, value]) => { if (key in initialState && value != null) state[key] = value })
        },
        setName: (state, action) => {
            state.name = action.payload
        },
        setId: (state, action) => {
            state.id = action.payload
        },
        setMouseEvents: (state, action) => {
            state.mouseEvents = action.payload
        },
        setVideoDetails: (state, action) => {
            state.videoDetails = action.payload
        },
        setBackground: (state, action) => {
            state.background = action.payload
        },
        setPadding: (state, action) => {
            state.padding = action.payload
        },
        setShadowAlpha: (state, action) => {
            state.shadowAlpha = action.payload
        },
        setCursorScale: (state, action) => {
            state.cursorScale = action.payload
        },
        setCursorFill: (state, action) => {
            state.cursorFill = action.payload
        },
        setCursorStroke: (state, action) => {
            state.cursorStroke = action.payload
        },
        setCameraVideoShadowAlpha: (state, action) => {
            state.cameraVideoShadowAlpha = action.payload
        },
        setHasCameraVideoBackgroundBlur: (state, action) => {
            state.hasCameraVideoBackgroundBlur = action.payload
        },
        setCameraVideoBackgroundBlurAmount: (state, action) => {
            state.cameraVideoBackgroundBlurAmount = action.payload
        },
        resetCameraVideoBackgroundBlurAmount: state => {
            state.cameraVideoBackgroundBlurAmount = initialState.cameraVideoBackgroundBlurAmount
        },
        setIsCameraVideoMirrored: (state, action) => {
            state.isCameraVideoMirrored = action.payload
        },
        setLeftTrim: (state, action) => {
            state.leftTrim = action.payload
        },
        setRightTrim: (state, action) => {
            state.rightTrim = action.payload
        },
        setTopTrim: (state, action) => {
            state.topTrim = action.payload
        },
        setBottomTrim: (state, action) => {
            state.bottomTrim = action.payload
        },
        setBorderRadius: (state, action) => {
            state.borderRadius = action.payload
        },
        setCursorBlurStrength: (state, action) => {
            state.cursorBlurStrength = action.payload
        },
        setCursorShadowAlpha: (state, action) => {
            state.cursorShadowAlpha = action.payload
        },
        setCursorMovementRotation: (state, action) => {
            state.cursorMovementRotation = action.payload
        },
        setAspectRatio: (state, action) => {
            state.aspectRatio = action.payload
        }
    },
})

// Action creators are generated for each case reducer function
export const {
    reset,
    applyProperties,
    setName,
    setId,
    setMouseEvents,
    setVideoDetails,
    setBackground,
    setPadding,
    setLeftTrim,
    setRightTrim,
    setTopTrim,
    setBottomTrim,
    setBorderRadius,
    setCursorBlurStrength,
    setCursorScale,
    setCursorFill,
    setCursorStroke,
    setCursorShadowAlpha,
    setCursorMovementRotation,
    setIsCameraVideoMirrored,
    setShadowAlpha,
    setCameraVideoShadowAlpha,
    setHasCameraVideoBackgroundBlur,
    setCameraVideoBackgroundBlurAmount,
    resetCameraVideoBackgroundBlurAmount,
    setAspectRatio
} = projectSlice.actions

export const selectId = state => state.undoableState.present.project.id
export const selectName = state => state.undoableState.present.project.name
export const selectBackground = state => state.undoableState.present.project.background
export const selectAspectRatio = state => state.undoableState.present.project.aspectRatio
export const selectMouseEvents = state => state.undoableState.present.project.mouseEvents
export const selectHasCameraVideo = state => state.undoableState.present.project.hasCameraVideo
export const selectHasMicrophoneAudio = state => state.undoableState.present.project.hasMicrophoneAudio
export const selectHasSystemAudio = state => state.undoableState.present.project.hasSystemAudio
export const selectVideoDetails = state => state.undoableState.present.project.videoDetails
export const selectCameraVideoShadowAlpha = state => state.undoableState.present.project.cameraVideoShadowAlpha
export const selectHasCameraVideoBackgroundBlur = state => state.undoableState.present.project.hasCameraVideoBackgroundBlur
export const selectCameraVideoBackgroundBlurAmount = state => state.undoableState.present.project.cameraVideoBackgroundBlurAmount
export const selectIsCameraVideoMirrored = state => state.undoableState.present.project.isCameraVideoMirrored
export const selectLeftTrim = state => state.undoableState.present.project.leftTrim
export const selectRightTrim = state => state.undoableState.present.project.rightTrim
export const selectTopTrim = state => state.undoableState.present.project.topTrim
export const selectBottomTrim = state => state.undoableState.present.project.bottomTrim
export const selectCursorScale = state => state.undoableState.present.project.cursorScale
export const selectCursorFill = state => state.undoableState.present.project.cursorFill
export const selectCursorStroke = state => state.undoableState.present.project.cursorStroke
export const selectCursorShadowAlpha = state => state.undoableState.present.project.cursorShadowAlpha
export const selectCursorMovementRotation = state => state.undoableState.present.project.cursorMovementRotation
export const selectPadding = state => state.undoableState.present.project.padding
export const selectBorderRadius = state => state.undoableState.present.project.borderRadius
export const selectShadowAlpha = state => state.undoableState.present.project.shadowAlpha

export default projectSlice.reducer
