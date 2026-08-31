export const DEFAULT_VIDEO_OVERLAY_DURATION_MS = 4000
export const VIDEO_OVERLAY_TYPE = "video"

const positiveNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? number : null
}

export function isVideoOverlay(config) {
    return config?.overlayType === VIDEO_OVERLAY_TYPE
}

export function isVideoOverlayActive(config, editorTime) {
    return isVideoOverlay(config)
        && config.visible !== false
        && Number(editorTime) >= Number(config.start)
        && Number(editorTime) <= Number(config.end)
}

export function clampVideoOverlayEnd({
    start,
    projectDuration,
    sourceDuration,
    sourceStart = 0,
    playbackRate = 1,
    requestedDuration,
    fallbackDuration = DEFAULT_VIDEO_OVERLAY_DURATION_MS,
}) {
    const normalizedStart = Math.max(0, Number(start) || 0)
    const normalizedRate = positiveNumber(playbackRate) || 1
    const normalizedSourceStart = Math.max(0, Number(sourceStart) || 0)
    const normalizedSourceDuration = positiveNumber(sourceDuration)
    const sourceRemaining = normalizedSourceDuration === null
        ? null
        : Math.max(0, normalizedSourceDuration - normalizedSourceStart) / normalizedRate
    const requested = positiveNumber(requestedDuration)
        || sourceRemaining
        || positiveNumber(fallbackDuration)
        || DEFAULT_VIDEO_OVERLAY_DURATION_MS
    const projectRemaining = positiveNumber(projectDuration) === null
        ? requested
        : Math.max(0, Number(projectDuration) - normalizedStart)

    const candidates = [requested, projectRemaining]
    if (sourceRemaining !== null) candidates.push(sourceRemaining)
    const duration = Math.max(0, Math.min(...candidates))
    return normalizedStart + duration
}

export function getVideoOverlaySourceTime(config, editorTime) {
    const sourceStart = Math.max(0, Number(config?.sourceStart) || 0)
    const playbackRate = positiveNumber(config?.playbackRate) || 1
    const localTime = Math.max(0, Number(editorTime) - Number(config?.start || 0))
    const sourceDuration = positiveNumber(config?.sourceDuration)
    let sourceTime = sourceStart + localTime * playbackRate

    if (config?.loop === true && sourceDuration !== null) {
        const loopDuration = Math.max(0, sourceDuration - sourceStart)
        if (loopDuration > 0) sourceTime = sourceStart + (sourceTime - sourceStart) % loopDuration
    } else if (sourceDuration !== null) {
        sourceTime = Math.min(sourceTime, sourceDuration)
    }

    return Math.max(0, sourceTime)
}

export function createVideoOverlaySourceTimestamps(config, renderTimestamps) {
    if (!isVideoOverlay(config) || !Array.isArray(renderTimestamps)) return []

    return renderTimestamps
        .filter(timestamp => {
            const editorTime = timestamp.sceneTimestamp
                ?? timestamp.timelineTimestamp
                ?? timestamp.rendererTimestamp
            return isVideoOverlayActive(config, editorTime)
        })
        .map(timestamp => {
            const editorTime = timestamp.sceneTimestamp
                ?? timestamp.timelineTimestamp
                ?? timestamp.rendererTimestamp
            return {
                ...timestamp,
                sourceTimestamp: getVideoOverlaySourceTime(config, editorTime),
            }
        })
}
