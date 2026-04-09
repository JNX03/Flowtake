import {
    combineReducers,
    configureStore,
    createListenerMiddleware,
    isAnyOf
} from '@reduxjs/toolkit'
import debounce from 'debounce'
import undoable, { combineFilters } from 'redux-undo'
import { serializeEntitySlice } from "../helpers"
import animatorReducer, { reset as resetAnimator } from './animatorSlice'
import appReducer, {
    appSlice,
    setHasProject,
    setIsProjectClosing,
    setLoaderMessage
} from './appSlice'
import assetReducer, { reset as resetAssets } from './assetSlice'
import audioTrackAnimsReducer, {
    audioTrackSlice,
    reset as resetAudioTrackAnims
} from './audioTrackSlice'
import overlayAnimsReducer, {
    overlaySlice,
    reset as resetOverlayAnims
} from './overlaySlice'
import cameraZoomAnimsReducer, {
    cameraSlice,
    reset as resetCameraZoomAnims
} from './cameraZoomSlice'
import clickAnimsReducer, {
    clickSlice,
    reset as resetClickAnims
} from './clickSlice'
import clipAnimsReducer, {
    clipSlice,
    reset as resetClipAnims
} from './clipSlice'
import contextMenuReducer, { reset as resetContextMenu } from './contextMenuSlice'
import cursorCoordsReducer, {
    cursorCoordsSlice,
    reset as resetCursorCoords
} from './cursorCoordsSlice'
import cursorTypeAnimsReducer, {
    cursorTypeSlice,
    reset as resetCursorTypeAnims
} from './cursorTypeSlice'
import editorReducer, {
    reset as resetEditor,
    selectIsCleaningUpSceneDone,
    selectIsCleaningUpVideosDone,
    setIsCleaningUpScene,
    setIsCleaningUpVideos,
    setIsPlaying,
    setIsSaving
} from './editorSlice'
import maskAnimsReducer, {
    maskSlice,
    reset as resetMaskAnims
} from "./maskSlice"
import panAnimsReducer, {
    panSlice,
    reset as resetPanAnims
} from './panSlice'
import projectReducer, {
    projectSlice,
    reset as resetProject
} from './projectSlice'
import recorderReducer, { reset as resetRecorder } from './recorderSlice'
import tutorialReducer from './tutorialSlice'
import subtitleAnimsReducer, {
    reset as resetSubtitleAnims,
    subtitleSlice
} from './subtitleSlice'
import timelineReducer, { reset as resetTimeline } from './timelineSlice'
import filterAnimsReducer, {
    filterSlice,
    reset as resetFilterAnims
} from './filterSlice'
import spatialAnimsReducer, {
    spatialSlice,
    reset as resetSpatialAnims
} from './spatialSlice'
import zoomAnimsReducer, {
    reset as resetZoomAnims,
    zoomSlice
} from './zoomSlice'

// Create the middleware instance and methods
const saveListenerMiddleware = createListenerMiddleware()
const closeListenerMiddleware = createListenerMiddleware()

// Create matcher for all actions from saveable slices
const filterSlices = isAnyOf(
    ...Object.values(projectSlice.actions),
    ...Object.values(clipSlice.actions),
    ...Object.values(clickSlice.actions),
    ...Object.values(cursorTypeSlice.actions),
    ...Object.values(subtitleSlice.actions),
    ...Object.values(panSlice.actions),
    ...Object.values(zoomSlice.actions),
    ...Object.values(cameraSlice.actions),
    ...Object.values(cursorCoordsSlice.actions),
    ...Object.values(maskSlice.actions),
    ...Object.values(audioTrackSlice.actions),
    ...Object.values(overlaySlice.actions),
    ...Object.values(filterSlice.actions),
    ...Object.values(spatialSlice.actions)
)

// Set of excluded action types for O(1) lookup
const EXCLUDED_ACTION_TYPES = new Set([
    projectSlice.actions.setVideoDetails.type,
    clipSlice.actions.setClips.type,
    zoomSlice.actions.setZooms.type,
    cameraSlice.actions.setCameraZooms.type,
    panSlice.actions.setPans.type,
    cursorTypeSlice.actions.setCursorTypes.type,
    clickSlice.actions.setClicks.type,
    subtitleSlice.actions.setSubtitles.type,
    maskSlice.actions.setMasks.type,
    audioTrackSlice.actions.setAudioClips.type,
    overlaySlice.actions.setOverlays.type,
    spatialSlice.actions.setSpatials.type,
])

const filterActions = action => !EXCLUDED_ACTION_TYPES.has(action.type)

const filterPreventUndo = action => !action.meta?.preventUndo

// Add one or more listener entries that look for specific actions.
// They may contain any sync or async logic, similar to thunks.
saveListenerMiddleware.startListening({
    matcher: filterSlices,
    effect: (_action, { dispatch, getState }) => {
        if (!getState().editor.isSaving) dispatch(setIsSaving(true))
        save(dispatch, getState)
    },
})

closeListenerMiddleware.startListening({
    predicate: (action) => {
        return appSlice.actions.setIsProjectClosing.match(action) && action.payload === true
    },
    effect: async (_action, { dispatch, condition, getState }) => {

        dispatch(setLoaderMessage("Closing editor..."))

        if (getState().editor.isSaving) await condition((_action, currentState) => !currentState.editor.isSaving)

        dispatch(setIsPlaying(false))
        dispatch(setIsCleaningUpScene(true))

        if (!selectIsCleaningUpSceneDone(getState()))
            await condition((_action, currentState) => currentState.editor.isCleaningUpSceneDone)

        dispatch(setIsCleaningUpVideos(true))

        // Only wait if not already done
        if (!selectIsCleaningUpVideosDone(getState()))
            await condition((_action, currentState) => currentState.editor.isCleaningUpVideosDone)

        dispatch(setHasProject(false))
        dispatch(resetProject())
        dispatch(resetRecorder())
        dispatch(resetEditor())
        dispatch(resetAnimator())
        dispatch(resetCameraZoomAnims())
        dispatch(resetClickAnims())
        dispatch(resetClipAnims())
        dispatch(resetCursorTypeAnims())
        dispatch(resetPanAnims())
        dispatch(resetSubtitleAnims())
        dispatch(resetTimeline())
        dispatch(resetContextMenu())
        dispatch(resetZoomAnims())
        dispatch(resetCursorCoords())
        dispatch(resetMaskAnims())
        dispatch(resetAudioTrackAnims())
        dispatch(resetOverlayAnims())
        dispatch(resetFilterAnims())
        dispatch(resetSpatialAnims())
        dispatch(resetAssets())
        dispatch(setLoaderMessage("Saving project..."))
        await window.electron.ipcRenderer.invoke("close-project")
        dispatch(setIsProjectClosing(false))
        dispatch(setLoaderMessage(null))
    },
})

export default configureStore({
    reducer: {
        animator: animatorReducer,
        app: appReducer,
        editor: editorReducer,
        recorder: recorderReducer,
        tutorial: tutorialReducer,
        timeline: timelineReducer,
        contextMenu: contextMenuReducer,
        assets: assetReducer,
        undoableState: undoable(
            combineReducers({
                project: projectReducer,
                cursorCoords: cursorCoordsReducer,
                clipAnims: clipAnimsReducer,
                clickAnims: clickAnimsReducer,
                cursorTypeAnims: cursorTypeAnimsReducer,
                subtitleAnims: subtitleAnimsReducer,
                panAnims: panAnimsReducer,
                zoomAnims: zoomAnimsReducer,
                cameraZoomAnims: cameraZoomAnimsReducer,
                maskAnims: maskAnimsReducer,
                audioTrackAnims: audioTrackAnimsReducer,
                overlayAnims: overlayAnimsReducer,
                filterAnims: filterAnimsReducer,
                spatialAnims: spatialAnimsReducer,
            }),
            {
                limit: 50,
                filter: combineFilters(filterSlices, filterActions, filterPreventUndo),
                groupBy: ({ meta }) => meta?.group ?? null
            }
        )
    },
    middleware: getDefaultMiddleware =>
        getDefaultMiddleware()
            .prepend(closeListenerMiddleware.middleware)
            .prepend(saveListenerMiddleware.middleware)
})

const save = debounce(async (dispatch, getState) => {
    // Access the present state for all slices
    const {
        project,
        clipAnims,
        clickAnims,
        cursorTypeAnims,
        subtitleAnims,
        panAnims,
        zoomAnims,
        cameraZoomAnims,
        cursorCoords,
        maskAnims,
        audioTrackAnims,
        overlayAnims,
        filterAnims,
        spatialAnims
    } = getState().undoableState.present

    // Only save if a project is currently opened
    if (project.id) {
        const slices = {
            project: { ...project },
            clipAnims: serializeEntitySlice(clipAnims),
            clickAnims: serializeEntitySlice(clickAnims),
            cursorTypeAnims: serializeEntitySlice(cursorTypeAnims),
            subtitleAnims: serializeEntitySlice(subtitleAnims),
            panAnims: serializeEntitySlice(panAnims),
            zoomAnims: serializeEntitySlice(zoomAnims),
            cameraZoomAnims: serializeEntitySlice(cameraZoomAnims),
            cursorCoords: serializeEntitySlice(cursorCoords, false),
            maskAnims: serializeEntitySlice(maskAnims),
            audioTrackAnims: serializeEntitySlice(audioTrackAnims),
            overlayAnims: serializeEntitySlice(overlayAnims),
            filterAnims: { ...filterAnims },
            spatialAnims: serializeEntitySlice(spatialAnims),
        }

        await window.electron.ipcRenderer.invoke("save-json", slices)

        dispatch(setIsSaving(false))
    }
}, 3000)