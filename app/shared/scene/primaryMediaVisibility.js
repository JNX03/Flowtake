export function setPrimaryMediaRenderGate(scene, renderable) {
    const containers = [
        scene?.screen?.container,
        scene?.camera?.outerContainer,
        ...(scene?.extraVideos ?? []).map(video => video?.outerContainer),
    ].filter(Boolean)

    for (const container of containers) container.renderable = Boolean(renderable)
}
