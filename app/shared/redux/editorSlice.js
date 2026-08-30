import { createSelector, createSlice } from '@reduxjs/toolkit'

// Only content tracks define the sequence length. Source-synchronised effects
// such as click rings and cursor/zoom animations can contain noisy capture
// timestamps and must not create an invisible tail after the last clip.
const TIMELINE_DURATION_SLICE_KEYS = Object.freeze([
    'clipAnims',
    'audioTrackAnims',
    'overlayAnims',
])

const getMaximumEntityEnd = present => {
    let maximum = 0

    for (const key of TIMELINE_DURATION_SLICE_KEYS) {
        const entities = present?.[key]?.entities
        if (!entities) continue

        for (const entity of Object.values(entities)) {
            if (Number.isFinite(entity?.end)) maximum = Math.max(maximum, entity.end)
        }
    }

    return maximum
}

const initialState = {
    isPlaying: false,
    isStopped: true,
    playbackRate: 1,
    microphoneAudioVolume: 1,
    systemAudioVolume: 1,
    isMicrophoneMuted: false,
    isSystemAudioMuted: false,
    isInitialized: false,
    areVideosReady: false,
    isMuted: true,
    isCleaningUpVideos: false,
    isCleaningUpVideosDone: false,
    isCleaningUpScene: false,
    isCleaningUpSceneDone: false,
    areHotkeysEnabled: true,
    isSaving: false,
    areClickAnimEntitiesGenerated: false,
    areCursorTypeAnimEntitiesGenerated: false,
    arePanAnimEntitiesGenerated: false,
    areZoomAnimEntitiesGenerated: false,
    areCameraZoomAnimEntitiesGenerated: false,
    duration: null
}

export const editorSlice = createSlice({
    name: 'editor',
    initialState,
    reducers: {
        reset: () => initialState,
        setIsPlaying: (state, action) => {
            state.isPlaying = action.payload
        },
        setIsStopped: (state, action) => {
            state.isStopped = action.payload
        },
        setPlaybackRate: (state, action) => {
            state.playbackRate = action.payload
        },
        setMicrophoneAudioVolume: (state, action) => {
            state.microphoneAudioVolume = action.payload
        },
        setSystemAudioVolume: (state, action) => {
            state.systemAudioVolume = action.payload
        },
        setIsMicrophoneMuted: (state, action) => {
            state.isMicrophoneMuted = action.payload
        },
        setIsSystemAudioMuted: (state, action) => {
            state.isSystemAudioMuted = action.payload
        },
        setIsInitialized: (state, action) => {
            state.isInitialized = action.payload
        },
        setAreVideosReady: (state, action) => {
            state.areVideosReady = action.payload
        },
        setIsMuted: (state, action) => {
            state.isMuted = action.payload
        },
        setIsCleaningUpScene: (state, action) => {
            state.isCleaningUpScene = action.payload
        },
        setIsCleaningUpSceneDone: (state, action) => {
            state.isCleaningUpSceneDone = action.payload
        },
        setIsCleaningUpVideos: (state, action) => {
            state.isCleaningUpVideos = action.payload
        },
        setIsCleaningUpVideosDone: (state, action) => {
            state.isCleaningUpVideosDone = action.payload
        },
        setAreHotkeysEnabled: (state, action) => {
            state.areHotkeysEnabled = action.payload
        },
        setIsSaving: (state, action) => {
            state.isSaving = action.payload
        },
        setAreClickAnimEntitiesGenerated: (state, action) => {
            state.areClickAnimEntitiesGenerated = action.payload
        },
        setAreCursorTypeAnimEntitiesGenerated: (state, action) => {
            state.areCursorTypeAnimEntitiesGenerated = action.payload
        },
        setArePanAnimEntitiesGenerated: (state, action) => {
            state.arePanAnimEntitiesGenerated = action.payload
        },
        setAreZoomAnimEntitiesGenerated: (state, action) => {
            state.areZoomAnimEntitiesGenerated = action.payload
        },
        setAreCameraZoomAnimEntitiesGenerated: (state, action) => {
            state.areCameraZoomAnimEntitiesGenerated = action.payload
        },
        setDuration: (state, action) => {
            state.duration = action.payload
        }
    },
})

// Action creators are generated for each case reducer function
export const {
    setIsPlaying,
    setIsStopped,
    setPlaybackRate,
    setMicrophoneAudioVolume,
    setSystemAudioVolume,
    setIsMicrophoneMuted,
    setIsSystemAudioMuted,
    reset,
    setIsInitialized,
    setIsBuffering,
    setAreVideosReady,
    setIsMuted,
    setIsCleaningUpVideos,
    setIsCleaningUpVideosDone,
    setIsCleaningUpScene,
    setIsCleaningUpSceneDone,
    setAreHotkeysEnabled,
    setIsSaving,
    setAreClickAnimEntitiesGenerated,
    setAreCursorTypeAnimEntitiesGenerated,
    setArePanAnimEntitiesGenerated,
    setAreZoomAnimEntitiesGenerated,
    setAreCameraZoomAnimEntitiesGenerated,
    setDuration
} = editorSlice.actions

export const selectIsPlaying = state => state.editor.isPlaying
export const selectIsStopped = state => state.editor.isStopped
export const selectPlaybackRate = state => state.editor.playbackRate
export const selectMicrophoneAudioVolume = state => state.editor.microphoneAudioVolume
export const selectSystemAudioVolume = state => state.editor.systemAudioVolume
export const selectIsInitialized = state => state.editor.isInitialized
export const selectAreVideosReady = state => state.editor.areVideosReady
export const selectIsMuted = state => state.editor.isMuted
export const selectIsCleaningUpVideos = state => state.editor.isCleaningUpVideos
export const selectIsCleaningUpVideosDone = state => state.editor.isCleaningUpVideosDone
export const selectIsCleaningUpScene = state => state.editor.isCleaningUpScene
export const selectIsCleaningUpSceneDone = state => state.editor.isCleaningUpSceneDone
export const selectAreHotkeysEnabled = state => state.editor.areHotkeysEnabled
export const selectIsSaving = state => state.editor.isSaving
export const selectAreClickAnimEntitiesGenerated = state => state.editor.areClickAnimEntitiesGenerated
export const selectAreCursorTypeAnimEntitiesGenerated = state => state.editor.areCursorTypeAnimEntitiesGenerated
export const selectArePanAnimEntitiesGenerated = state => state.editor.arePanAnimEntitiesGenerated
export const selectAreZoomAnimEntitiesGenerated = state => state.editor.areZoomAnimEntitiesGenerated
export const selectAreCameraZoomAnimEntitiesGenerated = state => state.editor.areCameraZoomAnimEntitiesGenerated
// The source recording duration stays immutable in editor.duration. The
// timeline itself grows to the furthest item, so moving a split segment later
// creates real empty time instead of being clamped back to the source length.
export const selectSourceDuration = state => state.editor?.duration ?? null
export const selectDuration = createSelector(
    [
        selectSourceDuration,
        state => state.undoableState?.present,
    ],
    (sourceDuration, present) => {
        const safeSourceDuration = Number.isFinite(sourceDuration)
            ? Math.max(0, sourceDuration)
            : 0
        const timelineDuration = Math.max(
            safeSourceDuration,
            getMaximumEntityEnd(present)
        )

        return timelineDuration > 0 ? timelineDuration : null
    }
)
export const selectIsMicrophoneMuted = state => state.editor.isMicrophoneMuted
export const selectIsSystemAudioMuted = state => state.editor.isSystemAudioMuted

export default editorSlice.reducer
