import {
    selectDuration,
    selectSourceDuration,
} from "./redux/editorSlice.js"

const DEFAULT_PROJECT_NAME = "Recording"

export const getRenderProjectName = state =>
    state?.undoableState?.present?.project?.name || DEFAULT_PROJECT_NAME

export const createRenderableProjectState = (state, rendererDims = null) => {
    if (!state?.undoableState?.present) return null

    const sourcePresent = state.undoableState.present
    const sourceVideoDetails = sourcePresent.project?.videoDetails
    const timelineEnd = selectDuration(state)
    const sourceDuration = selectSourceDuration(state)
    const present = sourceVideoDetails && Number.isFinite(timelineEnd)
        ? {
            ...sourcePresent,
            project: {
                ...sourcePresent.project,
                videoDetails: {
                    ...sourceVideoDetails,
                    start: 0,
                    end: timelineEnd,
                    duration: Number.isFinite(sourceDuration)
                        ? sourceDuration
                        : sourceVideoDetails.duration,
                },
            },
        }
        : sourcePresent

    return {
        animator: {
            ...(state.animator ?? {}),
            ...(rendererDims ? { rendererDims } : {})
        },
        panCoords: state.panCoords,
        // The render worker reads plugin selectors (mouse style, keyboard overlay) which
        // expect a top-level `plugin` slice. Without it, selectIsFeatureEnabled crashes with
        // "Cannot read properties of undefined (reading 'enabled')". Fall back to an inert
        // slice so a missing plugin state just disables plugins instead of failing the render.
        plugin: state.plugin ?? { enabled: {}, config: {} },
        undoableState: {
            present
        }
    }
}
