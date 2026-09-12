import {
    combineReducers,
    configureStore,
    createListenerMiddleware,
    isAnyOf
} from '@reduxjs/toolkit'
import undoable, { ActionTypes, combineFilters } from 'redux-undo'
import { createProjectSaveCoordinator } from '../editor/projectSaveCoordinator'
import { closeProjectSafely } from '../editor/projectCloseCoordinator'
import {
    serializeEntitySlice,
    TOAST_ERROR
} from "../helpers"
import animatorReducer, { reset as resetAnimator } from './animatorSlice'
import appReducer, {
    addToast,
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
    SAVE_STATUS_ERROR,
    SAVE_STATUS_IDLE,
    SAVE_STATUS_PENDING,
    SAVE_STATUS_SAVED,
    SAVE_STATUS_SAVING,
    selectIsCleaningUpSceneDone,
    selectIsCleaningUpVideosDone,
    setIsCleaningUpScene,
    setIsCleaningUpVideos,
    setIsPlaying,
    setSaveStatus
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
import editorDomainReducer, {
    editorDomainSlice,
    reset as resetEditorDomain
} from './sceneSlice'
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
import keyboardLayoutAnimsReducer, {
    keyboardLayoutSlice,
    reset as resetKeyboardLayoutAnims
} from './keyboardLayoutSlice'
import mouseStyleAnimsReducer, {
    mouseStyleAnimSlice,
    reset as resetMouseStyleAnims
} from './mouseStyleAnimSlice'
import drawnMouseAnimsReducer, {
    drawnMouseAnimSlice,
    reset as resetDrawnMouseAnims
} from './drawnMouseAnimSlice'
import appSceneAnimsReducer, {
    appSceneAnimSlice,
    reset as resetAppSceneAnims
} from './appSceneAnimSlice'
import liveReducer from './liveSlice'
import pluginReducer from './pluginSlice'

// Create the middleware instance and methods
const saveListenerMiddleware = createListenerMiddleware()
const closeListenerMiddleware = createListenerMiddleware()
const projectSaveCoordinator = createProjectSaveCoordinator()
const EDITOR_CLEANUP_TIMEOUT_MS = 10_000

// Create matcher for all actions from saveable slices
const filterSlices = isAnyOf(
    ...Object.values(projectSlice.actions),
    ...Object.values(editorDomainSlice.actions),
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
    ...Object.values(spatialSlice.actions),
    ...Object.values(keyboardLayoutSlice.actions),
    ...Object.values(mouseStyleAnimSlice.actions),
    ...Object.values(drawnMouseAnimSlice.actions),
    ...Object.values(appSceneAnimSlice.actions)
)

// History navigation changes the persisted present state without replaying the
// original slice action. Treat it as a saveable edit so an undo followed by an
// app close cannot restore the state the user explicitly discarded.
const HISTORY_ACTION_TYPES = new Set([
    ActionTypes.UNDO,
    ActionTypes.REDO,
    ActionTypes.JUMP_TO_PAST,
    ActionTypes.JUMP_TO_FUTURE,
])

const matchesSaveableChange = action =>
    filterSlices(action) || HISTORY_ACTION_TYPES.has(action.type)

// Set of excluded action types for O(1) lookup
const EXCLUDED_ACTION_TYPES = new Set([
    projectSlice.actions.setVideoDetails.type,
    projectSlice.actions.setMouseEvents.type,
    editorDomainSlice.actions.applyProperties.type,
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
    keyboardLayoutSlice.actions.setKeyboardLayouts.type,
    mouseStyleAnimSlice.actions.setMouseStyles.type,
    drawnMouseAnimSlice.actions.setDrawnMice.type,
    appSceneAnimSlice.actions.setAppScenes.type,
])

const filterActions = action => !EXCLUDED_ACTION_TYPES.has(action.type)

const filterPreventUndo = action => !action.meta?.preventUndo

// Add one or more listener entries that look for specific actions.
// They may contain any sync or async logic, similar to thunks.
saveListenerMiddleware.startListening({
    matcher: matchesSaveableChange,
    effect: (_action, { dispatch, getState }) => {
        // Reset/hydration actions can fire while no project is open. They do
        // not represent a pending disk write and should not light the save UI.
        if (!getState().undoableState.present.project.id) {
            dispatch(setSaveStatus(SAVE_STATUS_IDLE))
            return
        }

        dispatch(setSaveStatus(SAVE_STATUS_PENDING))
        projectSaveCoordinator.request(saveContext =>
            saveProject(dispatch, getState, saveContext)
        )
    },
})

closeListenerMiddleware.startListening({
    predicate: (action) => {
        return appSlice.actions.setIsProjectClosing.match(action) && action.payload === true
    },
    effect: async (_action, { dispatch, condition, getState }) => {
        dispatch(setLoaderMessage("Closing editor..."))

        try {
            const { teardownError, finalizeError } = await closeProjectSafely({
                // Cancel the debounce and wait for every requested revision.
                // If a write or native archive commit fails, the live editor is
                // deliberately left intact and can be retried.
                flushSaves: () => projectSaveCoordinator.flush(),
                commitNativeProject: async () => {
                    dispatch(setLoaderMessage("Finalizing project..."))
                    await window.electron.ipcRenderer.invoke("commit-project-close")
                },
                teardownEditorResources: async () => {
                    dispatch(setIsPlaying(false))
                    dispatch(setIsCleaningUpScene(true))

                    if (!selectIsCleaningUpSceneDone(getState())) {
                        const sceneWasCleaned = await condition(
                            (_action, currentState) => currentState.editor.isCleaningUpSceneDone,
                            EDITOR_CLEANUP_TIMEOUT_MS
                        )
                        if (!sceneWasCleaned) throw new Error("Editor scene cleanup timed out")
                    }

                    dispatch(setIsCleaningUpVideos(true))

                    if (!selectIsCleaningUpVideosDone(getState())) {
                        const videosWereCleaned = await condition(
                            (_action, currentState) => currentState.editor.isCleaningUpVideosDone,
                            EDITOR_CLEANUP_TIMEOUT_MS
                        )
                        if (!videosWereCleaned) throw new Error("Editor video cleanup timed out")
                    }
                },
                finalizeNativeProject: () =>
                    window.electron.ipcRenderer.invoke("finalize-project-close"),
            })

            if (teardownError) console.error("[closeProject:teardown]", teardownError)
            if (finalizeError) console.error("[closeProject:finalize]", finalizeError)

            // The archive is durable at this point. Reset even if bounded
            // resource cleanup timed out so the user is never stranded in a
            // half-destroyed editor.
            dispatch(setHasProject(false))
            dispatch(resetProject())
            dispatch(resetEditorDomain())
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
            dispatch(resetKeyboardLayoutAnims())
            dispatch(resetMouseStyleAnims())
            dispatch(resetDrawnMouseAnims())
            dispatch(resetAppSceneAnims())
            dispatch(resetAssets())

            if (teardownError || finalizeError) {
                dispatch(addToast({
                    type: TOAST_ERROR,
                    text: "Project saved and closed, but some editor resources needed forced cleanup. Restart Flowtake if playback does not recover.",
                    autoDismiss: false,
                }))
            }
        } catch (error) {
            console.error("[closeProject]", error)
            if (getState().editor.saveStatus !== SAVE_STATUS_ERROR) {
                dispatch(addToast({
                    type: TOAST_ERROR,
                    text: `Couldn't close project: ${error?.message || error}`,
                    autoDismiss: false,
                }))
            }
        } finally {
            dispatch(setIsProjectClosing(false))
            dispatch(setLoaderMessage(null))
        }
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
        live: liveReducer,
        plugin: pluginReducer,
        undoableState: undoable(
            combineReducers({
                project: projectReducer,
                editorDomain: editorDomainReducer,
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
                keyboardLayoutAnims: keyboardLayoutAnimsReducer,
                mouseStyleAnims: mouseStyleAnimsReducer,
                drawnMouseAnims: drawnMouseAnimsReducer,
                appSceneAnims: appSceneAnimsReducer,
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

const saveProject = async (dispatch, getState, { isLatest }) => {
    // Access the present state for all slices
    const {
        project,
        editorDomain,
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
        spatialAnims,
        keyboardLayoutAnims,
        mouseStyleAnims,
        drawnMouseAnims,
        appSceneAnims
    } = getState().undoableState.present

    // A project can disappear if an external native event closes it first.
    if (!project.id) {
        dispatch(setSaveStatus(SAVE_STATUS_IDLE))
        return
    }

    const slices = {
            project: { ...project },
            editorDomain: { ...editorDomain },
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
            keyboardLayoutAnims: serializeEntitySlice(keyboardLayoutAnims),
            mouseStyleAnims: serializeEntitySlice(mouseStyleAnims),
            drawnMouseAnims: serializeEntitySlice(drawnMouseAnims),
            appSceneAnims: serializeEntitySlice(appSceneAnims),
    }

    dispatch(setSaveStatus(SAVE_STATUS_SAVING))

    try {
        await window.electron.ipcRenderer.invoke("save-json", slices)
    } catch (error) {
        console.error("[saveProject]", error)
        const message = error?.message || String(error)
        dispatch(setSaveStatus({
            status: SAVE_STATUS_ERROR,
            error: message,
        }))
        dispatch(addToast({
            type: TOAST_ERROR,
            text: `Couldn't save project: ${message}`,
            autoDismiss: false,
        }))
        throw error
    }

    // A newer edit may have arrived while this IPC call was in flight. Keep
    // its pending status; the coordinator will immediately persist it next.
    if (isLatest()) dispatch(setSaveStatus(SAVE_STATUS_SAVED))
}
