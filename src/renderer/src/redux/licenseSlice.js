import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    hasLicense: false,
    isChecking: false,
    email: null
}

export const licenseSlice = createSlice({
    name: 'license',
    initialState,
    reducers: {
        setHasLicense: (state, action) => {
            state.hasLicense = action.payload
        },
        setIsChecking: (state, action) => {
            state.isChecking = action.payload
        },
        setEmail: (state, action) => {
            state.email = action.payload
        }
    },
})

export const selectHasLicense = state => state.license.hasLicense
export const selectIsChecking = state => state.license.isChecking
export const selectEmail = state => state.license.email

// Action creators are generated for each case reducer function
export const {
    setHasLicense,
    setIsChecking,
    setEmail
} = licenseSlice.actions

export default licenseSlice.reducer
