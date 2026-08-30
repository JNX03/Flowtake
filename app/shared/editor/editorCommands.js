import {
    createClipboardPayload,
    planDelete,
    planDuplicate,
    planPaste,
    planRetainLeft,
    planRetainRight,
    planSplit,
} from "./commandPlanner.js"
import {
    getGroup,
    withGroup,
} from "../redux/actionEnhancers.js"
import {
    addClip,
    removeClip,
    updateClip,
} from "../redux/clipSlice.js"
import {
    addSubtitle,
    removeSubtitle,
    updateSubtitle,
} from "../redux/subtitleSlice.js"
import {
    addAudioClip,
    removeAudioClip,
    updateAudioClip,
} from "../redux/audioTrackSlice.js"
import {
    addOverlay,
    removeOverlay,
    updateOverlay,
} from "../redux/overlaySlice.js"
import {
    addMask,
    removeMask,
    updateMask,
} from "../redux/maskSlice.js"
import { selectDuration } from "../redux/editorSlice.js"
import {
    setSelectedIds,
    setSelectedRow,
} from "../redux/timelineSlice.js"

// These keys intentionally mirror CLIPS, SUBTITLES, AUDIO_TRACKS,
// OVERLAY_TRACKS, and MASKS from shared/helpers without importing that
// heavyweight project-hydration module into the command layer.
const ROW_CONFIG = Object.freeze({
    "clips": {
        sliceKey: "clipAnims",
        idPrefix: "clip",
        add: addClip,
        update: updateClip,
        remove: removeClip,
    },
    "subtitles": {
        sliceKey: "subtitleAnims",
        idPrefix: "subtitle",
        add: addSubtitle,
        update: updateSubtitle,
        remove: removeSubtitle,
    },
    "audio-tracks": {
        sliceKey: "audioTrackAnims",
        idPrefix: "audio",
        add: addAudioClip,
        update: updateAudioClip,
        remove: removeAudioClip,
        hasTracks: true,
    },
    "overlay-tracks": {
        sliceKey: "overlayAnims",
        idPrefix: "overlay",
        add: addOverlay,
        update: updateOverlay,
        remove: removeOverlay,
        hasTracks: true,
    },
    "masks": {
        sliceKey: "maskAnims",
        idPrefix: "mask",
        add: addMask,
        update: updateMask,
        remove: removeMask,
    },
})

export const isEditorCommandRow = row => Object.hasOwn(ROW_CONFIG, row)

let editorClipboard = null

const fail = (kind, row, reason, details = {}) => ({
    ok: false,
    kind,
    row,
    reason,
    ...details,
})

function cloneSerializable(value) {
    if (value === null || value === undefined) return value
    if (typeof structuredClone === "function") return structuredClone(value)
    return JSON.parse(JSON.stringify(value))
}

function createDefaultId({ row }) {
    const prefix = ROW_CONFIG[row]?.idPrefix ?? "entity"
    return prefix + "-" + crypto.randomUUID()
}

function getEditorContext(state, overrides = {}) {
    const row = overrides.row ?? state.timeline?.selectedRow ?? null
    const config = ROW_CONFIG[row]
    const slice = config
        ? state.undoableState?.present?.[config.sliceKey]
        : null
    const duration = selectDuration(state)

    return {
        row,
        entities: slice ?? [],
        selectedIds: overrides.selectedIds ?? state.timeline?.selectedIds ?? [],
        tracks: config?.hasTracks ? (slice?.tracks ?? []) : [],
        timelineStart: overrides.timelineStart ?? 0,
        timelineEnd: overrides.timelineEnd ?? (
            typeof duration === "number" && Number.isFinite(duration)
                ? duration
                : Infinity
        ),
        editingMode: overrides.editingMode ?? state.timeline?.editingMode ?? "normal",
    }
}

function actionForOperation(operation) {
    const config = ROW_CONFIG[operation.row]
    const creator = config?.[operation.op]
    if (!creator) return null

    switch (operation.op) {
        case "add":
            return creator(operation.entity)
        case "update":
            return creator({ id: operation.id, changes: operation.changes })
        case "remove":
            return creator(operation.id)
        default:
            return null
    }
}

function applyEditorPlan({ dispatch, plan, groupFactory = getGroup }) {
    if (!plan?.ok) return plan
    if (!Array.isArray(plan.operations) || !Array.isArray(plan.selection)) {
        return fail(plan.kind ?? "execute", plan.row ?? null, "invalid-editor-plan")
    }

    // Resolve every action before dispatching any of them so an unsupported
    // operation cannot leave a partially applied command.
    const actions = []
    for (const operation of plan.operations) {
        const action = actionForOperation(operation)
        if (!action) {
            return fail(plan.kind, plan.row, "unsupported-plan-operation", { operation })
        }
        actions.push(action)
    }

    const group = groupFactory("editor-" + plan.kind)
    for (const action of actions) dispatch(withGroup(action, group))

    // Timeline selection is transient, but carries the same group metadata so
    // consumers can treat the complete command as one transaction.
    if (plan.selection.length > 0) {
        dispatch(withGroup(setSelectedRow(plan.row), group))
    }
    dispatch(withGroup(setSelectedIds(plan.selection), group))

    return { ...plan, group }
}

export const executeEditorPlan = (plan, options = {}) => dispatch =>
    applyEditorPlan({ dispatch, plan, groupFactory: options.groupFactory })

function executeSelectionPlan({ dispatch, getState, planner, options }) {
    const state = getState()
    const context = getEditorContext(state, options)
    const plan = planner({
        ...context,
        ...options,
        createId: options.createId ?? createDefaultId,
    })
    return applyEditorPlan({
        dispatch,
        plan,
        groupFactory: options.groupFactory,
    })
}

export const splitEditorSelection = (options = {}) => (dispatch, getState) => {
    const state = getState()
    return executeSelectionPlan({
        dispatch,
        getState: () => state,
        planner: planSplit,
        options: {
            ...options,
            splitTime: options.splitTime ?? state.timeline?.time,
        },
    })
}

export const retainLeftEditorSelection = (options = {}) => (dispatch, getState) => {
    const state = getState()
    return executeSelectionPlan({
        dispatch,
        getState: () => state,
        planner: planRetainLeft,
        options: {
            ...options,
            splitTime: options.splitTime ?? state.timeline?.time,
        },
    })
}

export const retainRightEditorSelection = (options = {}) => (dispatch, getState) => {
    const state = getState()
    return executeSelectionPlan({
        dispatch,
        getState: () => state,
        planner: planRetainRight,
        options: {
            ...options,
            splitTime: options.splitTime ?? state.timeline?.time,
        },
    })
}

export const deleteEditorSelection = (options = {}) => (dispatch, getState) =>
    executeSelectionPlan({
        dispatch,
        getState,
        planner: planDelete,
        options,
    })

export const duplicateEditorSelection = (options = {}) => (dispatch, getState) =>
    executeSelectionPlan({
        dispatch,
        getState,
        planner: planDuplicate,
        options,
    })

export const copyEditorSelection = (options = {}) => (_dispatch, getState) => {
    const context = getEditorContext(getState(), options)
    const result = createClipboardPayload({
        ...context,
        // Copying is non-destructive and remains allowed on a locked track.
        tracks: [],
    })

    if (result.ok) editorClipboard = cloneSerializable(result.clipboard)
    return result
}

export const pasteEditorClipboard = (options = {}) => (dispatch, getState) => {
    if (!editorClipboard) return fail("paste", null, "empty-editor-clipboard")

    const state = getState()
    const context = getEditorContext(state, {
        ...options,
        row: editorClipboard.row,
    })
    const plan = planPaste({
        clipboard: cloneSerializable(editorClipboard),
        entities: context.entities,
        tracks: context.tracks,
        at: options.at ?? state.timeline?.time,
        createId: options.createId ?? createDefaultId,
        timelineStart: context.timelineStart,
        timelineEnd: context.timelineEnd,
        editingMode: context.editingMode,
    })

    return applyEditorPlan({
        dispatch,
        plan,
        groupFactory: options.groupFactory,
    })
}

export function getEditorClipboard() {
    return cloneSerializable(editorClipboard)
}

export function clearEditorClipboard() {
    editorClipboard = null
}
