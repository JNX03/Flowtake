import { createSlice } from '@reduxjs/toolkit'
import { MODE_CAMERA_OVERLAY } from "../../../helpers"
import {
    animsAdapter,
    applyAnimProperties,
    selectAll,
    selectById,
    selectEntities,
    selectIds,
    selectTotal,
    validateAnim
} from "./animsAdapter"

export const CAMERA_OVERLAY_DEFAULT_CONFIG = {
    cameraPosition: { x: 0, y: 1 },
    cameraBaseScale: .5,
    cameraBorderRadius: .25
}

export const SIDE_BY_SIDE_DEFAULT_CONFIG = {
    cameraBorderRadius: .25, cameraPosition: "right"
}

const initialState = animsAdapter.getInitialState({
    layout: {
        mode: MODE_CAMERA_OVERLAY,
        config: CAMERA_OVERLAY_DEFAULT_CONFIG
    },
    playbackRate: 1,
    microphoneAudioVolume: 1,
    systemAudioVolume: 1
})

export const clipSlice = createSlice({
    name: 'clipAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        setLayout: (state, action) => { state.layout = action.payload },
        setPlaybackRate: (state, action) => { state.playbackRate = action.payload },
        setMicrophoneAudioVolume: (state, action) => { state.microphoneAudioVolume = action.payload },
        setSystemAudioVolume: (state, action) => { state.systemAudioVolume = action.payload },
        addClip: (state, action) => {
            const clip = action.payload
            if (!validateAnim(clip)) return
            animsAdapter.addOne(state, action)
        },
        setClips: (state, action) => {
            const clips = action.payload
            const validClips = Array.isArray(clips)
                ? clips.filter(validateAnim)
                : Object.values(clips).filter(validateAnim)
            if (validClips.length === 0) return
            animsAdapter.setAll(state, validClips)
        },
        updateClip: (state, action) => {
            const { id, changes } = action.payload
            const existingClip = state.entities[id]
            if (!existingClip) return

            const mergedClip = { ...existingClip, ...changes }
            if (!validateAnim(mergedClip)) return

            animsAdapter.updateOne(state, action)
        },
        updateClips: (state, action) => {
            const updates = action.payload
            const validUpdates = updates.filter(({ id, changes }) => {
                const existingClip = state.entities[id]
                if (!existingClip) return false

                const mergedClip = { ...existingClip, ...changes }
                return validateAnim(mergedClip)
            })
            if (validUpdates.length === 0) return
            animsAdapter.updateMany(state, validUpdates)
        },
        updateAllClips: (state, action) => {
            const { changes } = action.payload
            const ids = Object.keys(state.entities)
            const updates = ids
                .map(id => ({ id, changes }))
                .filter(({ id, changes }) => {
                    const existingClip = state.entities[id]
                    const mergedClip = { ...existingClip, ...changes }
                    return validateAnim(mergedClip)
                })
            if (updates.length === 0) return
            animsAdapter.updateMany(state, updates)
        },
        removeClip: animsAdapter.removeOne,
        removeClips: animsAdapter.removeMany,
        upsertClips: (state, action) => {
            const clips = action.payload
            const validClips = clips.filter(clip => {
                // For upsert, if clip exists, merge with existing
                const existingClip = state.entities[clip.id]
                const finalClip = existingClip ? { ...existingClip, ...clip } : clip
                return validateAnim(finalClip)
            })
            if (validClips.length === 0) return
            animsAdapter.upsertMany(state, validClips)
        },
    },
})

// Action creators are generated for each case reducer function
export const {
    reset,
    applyProperties,
    setLayout,
    setPlaybackRate,
    setMicrophoneAudioVolume,
    setSystemAudioVolume,
    addClip,
    setClips,
    updateClip,
    updateClips,
    updateAllClips,
    removeClip,
    removeClips,
    upsertClips
} = clipSlice.actions

export const selectPlaybackRate = state => state.undoableState.present.clipAnims.playbackRate
export const selectMicrophoneAudioVolume = state => state.undoableState.present.clipAnims.microphoneAudioVolume
export const selectSystemAudioVolume = state => state.undoableState.present.clipAnims.systemAudioVolume
export const selectLayout = state => state.undoableState.present.clipAnims.layout
export const selectAllClips = state => selectAll(state.undoableState.present.clipAnims)
export const selectClipEntities = state => selectEntities(state.undoableState.present.clipAnims)
export const selectTotalClips = state => selectTotal(state.undoableState.present.clipAnims)
export const selectClipById = (state, id) => selectById(state.undoableState.present.clipAnims, id)
export const selectClipIds = state => selectIds(state.undoableState.present.clipAnims)

export default clipSlice.reducer