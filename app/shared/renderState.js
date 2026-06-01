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
        // The render worker reads plugin selectors (mouse style, keyboard overlay) which
        // expect a top-level `plugin` slice. Without it, selectIsFeatureEnabled crashes with
        // "Cannot read properties of undefined (reading 'enabled')". Fall back to an inert
        // slice so a missing plugin state just disables plugins instead of failing the render.
        plugin: state.plugin ?? { enabled: {}, config: {} },
        undoableState: {
            present: state.undoableState.present
        }
    }
}
