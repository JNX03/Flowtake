import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { selectHasProject } from "@shared/redux/appSlice"
import { selectIsRecording } from "@shared/redux/recorderSlice"
import { selectSource } from "@shared/redux/recorderSlice"
import { selectIsInitialized } from "@shared/redux/editorSlice"
import {
    advanceStep,
    completeTutorial,
    selectCurrentStep,
    selectIsTutorialActive,
    skipTutorial,
    startTutorial,
} from "@shared/redux/tutorialSlice"
import { TUTORIAL_STEPS } from "./steps"
import TutorialOverlay from "./TutorialOverlay"
import TutorialTooltip from "./TutorialTooltip"
import TutorialWaiting from "./TutorialWaiting"

const TutorialContext = createContext(null)

export function useTutorial() {
    return useContext(TutorialContext)
}

export default function TutorialProvider({ children }) {
    const dispatch = useDispatch()
    const isActive = useSelector(selectIsTutorialActive)
    const currentStepIndex = useSelector(selectCurrentStep)
    const source = useSelector(selectSource)
    const isRecording = useSelector(selectIsRecording)
    const hasProject = useSelector(selectHasProject)
    const isInitialized = useSelector(selectIsInitialized)

    const [shouldRender, setShouldRender] = useState(false)
    const [targetReady, setTargetReady] = useState(false)
    const prevSourceRef = useRef(source)
    const autoAdvanceRef = useRef(null)
    const mutationObserverRef = useRef(null)

    // Check on mount whether tutorial should start
    useEffect(() => {
        const check = async () => {
            try {
                const done = await window.electron.ipcRenderer.invoke("store-get", "hasCompletedTutorial")
                if (done) {
                    setShouldRender(false)
                } else {
                    setShouldRender(true)
                }
            } catch {
                setShouldRender(false)
            }
        }
        check()
    }, [])

    // Start tutorial when shouldRender flips and setup is done
    useEffect(() => {
        if (shouldRender && !isActive && !hasProject && !isRecording) {
            dispatch(startTutorial())
        }
    }, [shouldRender, isActive, hasProject, isRecording, dispatch])

    const currentStep = TUTORIAL_STEPS[currentStepIndex]

    // Wait for target element to appear in DOM (handles lazy-loaded components)
    useEffect(() => {
        if (!isActive || !currentStep?.targetSelector) {
            setTargetReady(!currentStep?.targetSelector) // waiting steps are always "ready"
            return
        }

        const check = () => {
            const el = document.querySelector(currentStep.targetSelector)
            if (el) {
                setTargetReady(true)
                mutationObserverRef.current?.disconnect()
                return true
            }
            return false
        }

        if (check()) return

        // Poll via MutationObserver until element appears
        setTargetReady(false)
        mutationObserverRef.current = new MutationObserver(() => {
            if (check()) mutationObserverRef.current?.disconnect()
        })
        mutationObserverRef.current.observe(document.body, { childList: true, subtree: true })

        return () => mutationObserverRef.current?.disconnect()
    }, [isActive, currentStepIndex, currentStep?.targetSelector])

    // Step 1: Detect source selection change
    useEffect(() => {
        if (!isActive || currentStep?.id !== 'select-source') {
            prevSourceRef.current = source
            return
        }
        if (source && source !== prevSourceRef.current && source.type) {
            prevSourceRef.current = source
            dispatch(advanceStep())
        }
    }, [isActive, currentStep?.id, source, dispatch])

    // Step 2: Detect recording started
    useEffect(() => {
        if (!isActive || currentStep?.id !== 'start-recording') return
        if (isRecording) {
            dispatch(advanceStep())
        }
    }, [isActive, currentStep?.id, isRecording, dispatch])

    // Step 3: Detect recording stopped → project created
    useEffect(() => {
        if (!isActive || currentStep?.id !== 'stop-recording') return
        if (hasProject) {
            dispatch(advanceStep())
        }
    }, [isActive, currentStep?.id, hasProject, dispatch])

    // Step 4: Auto-advance after timer once editor is initialized
    useEffect(() => {
        if (!isActive || !currentStep?.autoAdvanceMs) return
        if (currentStep.id === 'explore-editor' && !isInitialized) return

        autoAdvanceRef.current = setTimeout(() => {
            dispatch(advanceStep())
        }, currentStep.autoAdvanceMs)

        return () => clearTimeout(autoAdvanceRef.current)
    }, [isActive, currentStep?.id, currentStep?.autoAdvanceMs, isInitialized, dispatch])

    // Step 5: Detect export button click
    useEffect(() => {
        if (!isActive || currentStep?.id !== 'try-export') return

        const handleClick = (e) => {
            const btn = e.target.closest('[data-tutorial="export-button"]')
            if (btn) {
                handleComplete()
            }
        }

        document.addEventListener('click', handleClick, true)
        return () => document.removeEventListener('click', handleClick, true)
    }, [isActive, currentStep?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleSkip = useCallback(async () => {
        dispatch(skipTutorial())
        await window.electron.ipcRenderer.invoke("store-set", "hasCompletedTutorial", true)
    }, [dispatch])

    const handleComplete = useCallback(async () => {
        dispatch(completeTutorial())
        await window.electron.ipcRenderer.invoke("store-set", "hasCompletedTutorial", true)
    }, [dispatch])

    const contextValue = { isActive, currentStepIndex }

    if (!isActive) {
        return (
            <TutorialContext.Provider value={contextValue}>
                {children}
            </TutorialContext.Provider>
        )
    }

    // Waiting step (recording in progress)
    if (currentStep?.isWaiting) {
        return (
            <TutorialContext.Provider value={contextValue}>
                {children}
                <TutorialWaiting onSkip={handleSkip} />
            </TutorialContext.Provider>
        )
    }

    // Don't show overlay until target is in DOM
    if (!targetReady) {
        return (
            <TutorialContext.Provider value={contextValue}>
                {children}
            </TutorialContext.Provider>
        )
    }

    return (
        <TutorialContext.Provider value={contextValue}>
            {children}
            <TutorialOverlay targetSelector={currentStep?.targetSelector}>
                {(rect, padding) => (
                    <TutorialTooltip
                        stepIndex={currentStepIndex}
                        rect={rect}
                        padding={padding}
                        placement={currentStep?.placement}
                        onSkip={handleSkip}
                    />
                )}
            </TutorialOverlay>
        </TutorialContext.Provider>
    )
}
