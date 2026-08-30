import { createSlice } from '@reduxjs/toolkit'
import {
    animsAdapter,
    applyAnimProperties,
    selectAll,
    selectById,
    selectIds,
    selectTotal,
    validateAnim
} from "./animsAdapter"

const initialState = animsAdapter.getInitialState({
    tracks: [
        { id: 0, name: "Audio 1", muted: false, locked: false, volume: 1 }
    ],
    nextTrackId: 1
})

export const audioTrackSlice = createSlice({
    name: 'audioTrackAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        addAudioClip: (state, action) => {
            const clip = action.payload
            if (!validateAnim(clip)) return
            animsAdapter.addOne(state, action)
        },
        setAudioClips: (state, action) => {
            const clips = action.payload
            const valid = Array.isArray(clips)
                ? clips.filter(validateAnim)
                : Object.values(clips).filter(validateAnim)
            if (valid.length === 0) return
            animsAdapter.setAll(state, valid)
        },
        updateAudioClip: (state, action) => {
            const { id, changes } = action.payload
            const existing = state.entities[id]
            if (!existing) return
            const merged = { ...existing, ...changes }
            if (!validateAnim(merged)) return
            animsAdapter.updateOne(state, action)
        },
        removeAudioClip: animsAdapter.removeOne,
        removeAudioClips: animsAdapter.removeMany,
        upsertAudioClips: (state, action) => {
            const clips = action.payload
            const valid = clips.filter(clip => {
                const existing = state.entities[clip.id]
                const final = existing ? { ...existing, ...clip } : clip
                return validateAnim(final)
            })
            if (valid.length === 0) return
            animsAdapter.upsertMany(state, valid)
        },
        addTrack: (state) => {
            const id = state.nextTrackId
            state.tracks.push({ id, name: `Audio ${id + 1}`, muted: false, locked: false, volume: 1 })
            state.nextTrackId = id + 1
        },
        removeTrack: (state, action) => {
            const trackId = action.payload
            state.tracks = state.tracks.filter(t => t.id !== trackId)
            // Remove all clips on that track
            const idsToRemove = selectAll(state).filter(c => c.trackIndex === trackId).map(c => c.id)
            animsAdapter.removeMany(state, idsToRemove)
        },
        updateTrack: (state, action) => {
            const { id, changes } = action.payload
            const track = state.tracks.find(t => t.id === id)
            if (track) Object.assign(track, changes)
        },
        toggleTrackMute: (state, action) => {
            const track = state.tracks.find(t => t.id === action.payload)
            if (track) track.muted = !track.muted
        },
        toggleTrackLock: (state, action) => {
            const track = state.tracks.find(t => t.id === action.payload)
            if (track) track.locked = !track.locked
        },
    },
})

export const {
    reset,
    applyProperties,
    addAudioClip,
    setAudioClips,
    updateAudioClip,
    removeAudioClip,
    removeAudioClips,
    upsertAudioClips,
    addTrack,
    removeTrack,
    updateTrack,
    toggleTrackMute,
    toggleTrackLock,
} = audioTrackSlice.actions

export const selectAllAudioClips = state => selectAll(state.undoableState.present.audioTrackAnims)
export const selectAudioClipById = (state, id) => selectById(state.undoableState.present.audioTrackAnims, id)
export const selectAudioClipIds = state => selectIds(state.undoableState.present.audioTrackAnims)
export const selectTotalAudioClips = state => selectTotal(state.undoableState.present.audioTrackAnims)
export const selectAudioTracks = state => state.undoableState.present.audioTrackAnims.tracks
export const selectNextAudioTrackId = state =>
    state.undoableState.present.audioTrackAnims.nextTrackId
export const selectAudioClipsByTrack = (state, trackId) =>
    selectAll(state.undoableState.present.audioTrackAnims).filter(c => c.trackIndex === trackId)

export default audioTrackSlice.reducer
