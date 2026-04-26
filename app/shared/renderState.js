const DEFAULT_PROJECT_NAME = "Recording"

export const getRenderProjectName = state =>
    state?.undoableState?.present?.project?.name || DEFAULT_PROJECT_NAME

export const createRenderableProjectState = (state, rendererDims = null) => {
    if (!state?.undoableState?.present) return null

    return {
        animator: {
            ...(state.animator ?? {}),
            ...(rendererDims ? { rendererDims } : {})
        },
        panCoords: state.panCoords,
        undoableState: {
            present: state.undoableState.present
        }
    }
}
