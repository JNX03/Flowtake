import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    hasProject: false,
    toasts: [],
    loaderMessage: null,
    capturers: [],
    encoders: [],
    openSettings: null,
    renderQueueProgress: -1,
    isProjectClosing: false,
    hasExports: false,
    isCloseRequested: false
}

export const appSlice = createSlice({
    name: 'app',
    initialState,
    reducers: {
        reset: () => initialState,
        setHasProject: (state, action) => {
            state.hasProject = action.payload
        },
        addToast: (state, action) => {
            state.toasts = [...state.toasts, { autoDismiss: true, ...action.payload, id: `toast-${crypto.randomUUID()}` }]
        },
        dismissToast: (state, action) => {
            state.toasts = state.toasts.filter(({ id }) => id !== action.payload)
        },
        dismissToastsByType: (state, action) => {
            state.toasts = state.toasts.filter(({ type }) => type !== action.payload)
        },
        setLoaderMessage: (state, action) => {
            state.loaderMessage = state.loaderMessage = action.payload
        },
        setCapturers: (state, action) => {
            state.capturers = action.payload
        },
        setEncoders: (state, action) => {
            state.encoders = action.payload
        },
        setOpenSettings: (state, action) => {
            state.openSettings = action.payload
        },
        setRenderQueueProgress: (state, action) => {
            state.renderQueueProgress = action.payload
        },
        setIsProjectClosing: (state, action) => {
            state.isProjectClosing = action.payload
        },
        setHasExports: (state, action) => {
            state.hasExports = action.payload
        },
        setIsCloseRequested: (state, action) => {
            state.isCloseRequested = action.payload
        }
    },
})

// Action creators are generated for each case reducer function
export const {
    reset,
    addToast,
    dismissToast,
    dismissToastsByType,
    setHasProject,
    setLoaderMessage,
    setEncoders,
    setCapturers,
    setOpenSettings,
    setRenderQueueProgress,
    setIsProjectClosing,
    setHasExports,
    setIsCloseRequested
} = appSlice.actions

export const selectHasProject = state => state.app.hasProject
export const selectCapturers = state => state.app.capturers
export const selectEncoders = state => state.app.encoders
export const selectLoaderMessage = state => state.app.loaderMessage
export const selectOpenSettings = state => state.app.openSettings
export const selectToasts = state => state.app.toasts
export const selectRenderQueueProgress = state => state.app.renderQueueProgress
export const selectIsProjectClosing = state => state.app.isProjectClosing
export const selectHasExports = state => state.app.hasExports
export const selectIsCloseRequested = state => state.app.isCloseRequested

export default appSlice.reducer
