import { createSlice } from '@reduxjs/toolkit'
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

const initialState = animsAdapter.getInitialState({
    transcript: null,
    backgroundColor: 0xffffff,
    textColor: 0x000000,
    position: { x: .5, y: .8 },
    width: .6,
    shadowAlpha: .5
})

export const subtitleSlice = createSlice({
    name: 'subtitleAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        setSubtitles: (state, action) => {
            const subtitles = action.payload
            const validSubtitles = Array.isArray(subtitles)
                ? subtitles.filter(validateAnim)
                : Object.values(subtitles).filter(validateAnim)
            if (validSubtitles.length === 0) return
            animsAdapter.setAll(state, validSubtitles)
        },
        addSubtitle: (state, action) => {
            const subtitle = action.payload
            if (!validateAnim(subtitle)) return
            animsAdapter.addOne(state, action)
        },
        updateSubtitle: (state, action) => {
            const { id, changes } = action.payload
            const existingSubtitle = state.entities[id]
            if (!existingSubtitle) return

            const mergedSubtitle = { ...existingSubtitle, ...changes }
            if (!validateAnim(mergedSubtitle)) return

            animsAdapter.updateOne(state, action)
        },
        removeSubtitle: animsAdapter.removeOne,
        removeSubtitles: animsAdapter.removeMany,
        removeAllSubtitles: animsAdapter.removeAll,
        upsertSubtitles: (state, action) => {
            const subtitles = action.payload
            const validSubtitles = subtitles.filter(subtitle => {
                const existingSubtitle = state.entities[subtitle.id]
                const finalSubtitle = existingSubtitle ? { ...existingSubtitle, ...subtitle } : subtitle
                return validateAnim(finalSubtitle)
            })
            if (validSubtitles.length === 0) return
            animsAdapter.upsertMany(state, validSubtitles)
        },
        setTranscript: (state, action) => { state.transcript = action.payload },
        setBackgroundColor: (state, action) => { state.backgroundColor = action.payload },
        setTextColor: (state, action) => { state.textColor = action.payload },
        setPosition: (state, action) => { state.position = action.payload },
        setWidth: (state, action) => { state.width = action.payload },
        setShadowAlpha: (state, action) => { state.shadowAlpha = action.payload },
    },
})

// Action creators are generated for each case reducer function
export const {
    reset,
    applyProperties,
    setSubtitles,
    addSubtitle,
    updateSubtitle,
    removeSubtitle,
    removeSubtitles,
    removeAllSubtitles,
    upsertSubtitles,
    setTranscript,
    setBackgroundColor,
    setTextColor,
    setPosition,
    setWidth,
    setShadowAlpha
} = subtitleSlice.actions

export const selectTotalSubtitles = state => selectTotal(state.undoableState.present.subtitleAnims)
export const selectTranscript = state => state.undoableState.present.subtitleAnims.transcript
export const selectAllSubtitles = state => selectAll(state.undoableState.present.subtitleAnims)
export const selectSubtitleById = (state, id) => selectById(state.undoableState.present.subtitleAnims, id)
export const selectSubtitleEntities = state => selectEntities(state.undoableState.present.subtitleAnims)
export const selectSubtitleIds = state => selectIds(state.undoableState.present.subtitleAnims)
export const selectBackgroundColor = state => state.undoableState.present.subtitleAnims.backgroundColor
export const selectTextColor = state => state.undoableState.present.subtitleAnims.textColor
export const selectPosition = state => state.undoableState.present.subtitleAnims.position
export const selectWidth = state => state.undoableState.present.subtitleAnims.width
export const selectShadowAlpha = state => state.undoableState.present.subtitleAnims.shadowAlpha

export default subtitleSlice.reducer