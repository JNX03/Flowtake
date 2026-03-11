import { createSlice } from '@reduxjs/toolkit'
import {
    animsAdapter,
    applyAnimProperties,
    selectAll,
    validateAnim
} from "./animsAdapter"

const initialState = animsAdapter.getInitialState({
    isStatic: false
})

export const cursorTypeSlice = createSlice({
    name: 'cursorTypeAnims',
    initialState,
    reducers: {
        reset: () => initialState,
        applyProperties: applyAnimProperties,
        setCursorTypes: (state, action) => {
            const cursorTypes = action.payload
            const validCursorTypes = Array.isArray(cursorTypes)
                ? cursorTypes.filter(validateAnim)
                : Object.values(cursorTypes).filter(validateAnim)
            if (validCursorTypes.length === 0) return
            animsAdapter.setAll(state, validCursorTypes)
        },
        setIsStatic: (state, action) => { state.isStatic = action.payload },
    },
})

// Action creators are generated for each case reducer function
export const {
    reset,
    applyProperties,
    setCursorTypes,
    setIsStatic
} = cursorTypeSlice.actions

export const selectIsStatic = state => state.undoableState.present.cursorTypeAnims.isStatic
export const selectAllCursorTypes = state => selectAll(state.undoableState.present.cursorTypeAnims)

export default cursorTypeSlice.reducer