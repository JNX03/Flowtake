import { createSlice } from '@reduxjs/toolkit'

const tutorialSlice = createSlice({
    name: 'tutorial',
    initialState: {
        status: 'idle', // 'idle' | 'active' | 'completed' | 'skipped'
        currentStep: 0,
    },
    reducers: {
        startTutorial(state) {
            state.status = 'active'
            state.currentStep = 0
        },
        advanceStep(state) {
            state.currentStep += 1
        },
        skipTutorial(state) {
            state.status = 'skipped'
        },
        completeTutorial(state) {
            state.status = 'completed'
        },
        resetTutorial(state) {
            state.status = 'idle'
            state.currentStep = 0
        },
    },
})

export const {
    startTutorial,
    advanceStep,
    skipTutorial,
    completeTutorial,
    resetTutorial,
} = tutorialSlice.actions

export const selectTutorialStatus = state => state.tutorial.status
export const selectCurrentStep = state => state.tutorial.currentStep
export const selectIsTutorialActive = state => state.tutorial.status === 'active'

export default tutorialSlice.reducer
