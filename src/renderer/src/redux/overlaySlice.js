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
        { id: 0, name: "Overlay 1", muted: false, locked: false, visible: true }
    ],
    nextTrackId: 1
})

export const overlaySlice = createSlice({
    name: 'overlayAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        addOverlay: (state, action) => {
            const overlay = action.payload
            if (!validateAnim(overlay)) return
            animsAdapter.addOne(state, action)
        },
        setOverlays: (state, action) => {
            const overlays = action.payload
            const valid = Array.isArray(overlays)
                ? overlays.filter(validateAnim)
                : Object.values(overlays).filter(validateAnim)
            if (valid.length === 0) return
            animsAdapter.setAll(state, valid)
        },
        updateOverlay: (state, action) => {
            const { id, changes } = action.payload
            const existing = state.entities[id]
            if (!existing) return
            const merged = { ...existing, ...changes }
            if (!validateAnim(merged)) return
            animsAdapter.updateOne(state, action)
        },
        removeOverlay: animsAdapter.removeOne,
        removeOverlays: animsAdapter.removeMany,
        upsertOverlays: (state, action) => {
            const overlays = action.payload
            const valid = overlays.filter(o => {
                const existing = state.entities[o.id]
                const final = existing ? { ...existing, ...o } : o
                return validateAnim(final)
            })
            if (valid.length === 0) return
            animsAdapter.upsertMany(state, valid)
        },
        addOverlayTrack: (state) => {
            const id = state.nextTrackId
            state.tracks.push({ id, name: `Overlay ${id + 1}`, muted: false, locked: false, visible: true })
            state.nextTrackId = id + 1
        },
        removeOverlayTrack: (state, action) => {
            const trackId = action.payload
            state.tracks = state.tracks.filter(t => t.id !== trackId)
            const idsToRemove = selectAll(state).filter(o => o.trackIndex === trackId).map(o => o.id)
            animsAdapter.removeMany(state, idsToRemove)
        },
        updateOverlayTrack: (state, action) => {
            const { id, changes } = action.payload
            const track = state.tracks.find(t => t.id === id)
            if (track) Object.assign(track, changes)
        },
        toggleOverlayTrackVisibility: (state, action) => {
            const track = state.tracks.find(t => t.id === action.payload)
            if (track) track.visible = !track.visible
        },
        toggleOverlayTrackLock: (state, action) => {
            const track = state.tracks.find(t => t.id === action.payload)
            if (track) track.locked = !track.locked
        },
    },
})

export const {
    reset,
    applyProperties,
    addOverlay,
    setOverlays,
    updateOverlay,
    removeOverlay,
    removeOverlays,
    upsertOverlays,
    addOverlayTrack,
    removeOverlayTrack,
    updateOverlayTrack,
    toggleOverlayTrackVisibility,
    toggleOverlayTrackLock,
} = overlaySlice.actions

export const selectAllOverlays = state => selectAll(state.undoableState.present.overlayAnims)
export const selectOverlayById = (state, id) => selectById(state.undoableState.present.overlayAnims, id)
export const selectOverlayIds = state => selectIds(state.undoableState.present.overlayAnims)
export const selectTotalOverlays = state => selectTotal(state.undoableState.present.overlayAnims)
export const selectOverlayTracks = state => state.undoableState.present.overlayAnims.tracks
export const selectOverlaysByTrack = (state, trackId) =>
    selectAll(state.undoableState.present.overlayAnims).filter(o => o.trackIndex === trackId)

export default overlaySlice.reducer
