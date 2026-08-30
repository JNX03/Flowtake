const asFiniteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const asPositiveNumber = value => {
    const number = asFiniteNumber(value)
    return number !== null && number > 0 ? number : null
}

const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum), maximum)

const validTimelineRange = clip => {
    const start = asFiniteNumber(clip?.start)
    const end = asFiniteNumber(clip?.end)
    return start !== null && end !== null && end > start
        ? { start, end }
        : null
}

/**
 * Audio assets always start at source time zero unless a trim explicitly
 * records another in-point. This intentionally differs from the screen-video
 * clock, whose legacy fallback maps source time to its timeline position.
 */
export function getAudioClipSourceRange(clip) {
    const timeline = validTimelineRange(clip)
    const sourceStart = Math.max(0, asFiniteNumber(clip?.sourceStart) ?? 0)
    const playbackRate = asPositiveNumber(clip?.playbackRate) ?? 1
    const requestedSourceEnd = asFiniteNumber(clip?.sourceEnd)
        ?? sourceStart + ((timeline?.end ?? 0) - (timeline?.start ?? 0)) * playbackRate
    const sourceDuration = asPositiveNumber(clip?.sourceDuration)
    const sourceEnd = Math.max(
        sourceStart,
        sourceDuration === null
            ? requestedSourceEnd
            : Math.min(requestedSourceEnd, sourceDuration)
    )

    return { sourceStart, sourceEnd }
}

export function getAudioClipPlaybackRate(clip) {
    const timeline = validTimelineRange(clip)
    if (!timeline) return 1
    const { sourceStart, sourceEnd } = getAudioClipSourceRange(clip)
    const sourceSpan = sourceEnd - sourceStart
    return sourceSpan > 0
        ? sourceSpan / (timeline.end - timeline.start)
        : (asPositiveNumber(clip?.playbackRate) ?? 1)
}

export function timelineTimeToAudioSourceMs(clip, time) {
    const timeline = validTimelineRange(clip)
    const timelineTime = asFiniteNumber(time)
    const { sourceStart, sourceEnd } = getAudioClipSourceRange(clip)
    if (!timeline || timelineTime === null) return sourceStart

    const progress = clamp(
        (timelineTime - timeline.start) / (timeline.end - timeline.start),
        0,
        1
    )
    return sourceStart + (sourceEnd - sourceStart) * progress
}

export function resolveAudioClipTimingChange(clip, nextStart, nextEnd) {
    const timeline = validTimelineRange(clip)
    const start = asFiniteNumber(nextStart)
    const end = asFiniteNumber(nextEnd)
    if (!timeline || start === null || end === null) {
        return { start: nextStart, end: nextEnd }
    }

    const { sourceStart, sourceEnd } = getAudioClipSourceRange(clip)
    const sourcePerTimelineMs = (sourceEnd - sourceStart) / (timeline.end - timeline.start)
    const startDelta = start - timeline.start
    const endDelta = end - timeline.end
    const isMove = Math.abs(startDelta - endDelta) < 0.001
    const sourceDuration = asPositiveNumber(clip?.sourceDuration)

    return {
        start,
        end,
        sourceStart: isMove
            ? sourceStart
            : clamp(sourceStart + startDelta * sourcePerTimelineMs, 0, sourceDuration ?? Infinity),
        sourceEnd: isMove
            ? sourceEnd
            : clamp(sourceEnd + endDelta * sourcePerTimelineMs, 0, sourceDuration ?? Infinity),
    }
}

export function getAudioClipSplitTiming(clip, splitTime) {
    const sourceSplit = timelineTimeToAudioSourceMs(clip, splitTime)
    const { sourceStart, sourceEnd } = getAudioClipSourceRange(clip)
    return {
        left: {
            end: splitTime,
            sourceStart,
            sourceEnd: sourceSplit,
        },
        right: {
            start: splitTime,
            sourceStart: sourceSplit,
            sourceEnd,
        },
    }
}

export function getEffectiveAudioVolume(clip, track) {
    if (clip?.muted || track?.muted) return 0
    const clipVolume = Math.max(0, asFiniteNumber(clip?.volume) ?? 1)
    const trackVolume = Math.max(0, asFiniteNumber(track?.volume) ?? 1)
    return clamp(clipVolume * trackVolume, 0, 4)
}

export function findActiveAudioClip(clips, trackId, time) {
    const timelineTime = asFiniteNumber(time)
    if (timelineTime === null) return null

    return (Array.isArray(clips) ? clips : []).find(clip => {
        const timeline = validTimelineRange(clip)
        return timeline
            && clip.trackIndex === trackId
            && timelineTime >= timeline.start
            && timelineTime < timeline.end
    }) ?? null
}

export function resolveAudioClipRuntimeSource(clip, assets = []) {
    if (typeof clip?.src === "string" && clip.src) return clip.src
    if (!clip?.mediaId) return null

    const asset = Array.isArray(assets)
        ? assets.find(candidate => candidate?.id === clip.mediaId)
        : assets?.[clip.mediaId]
    return typeof asset?.src === "string" && asset.src ? asset.src : null
}

export function hasAudibleTimelineAudio(clips, tracks, {
    requireProjectPath = false,
} = {}) {
    const tracksById = new Map((Array.isArray(tracks) ? tracks : [])
        .map(track => [track.id, track]))

    return (Array.isArray(clips) ? clips : []).some(clip => {
        if (!validTimelineRange(clip)) return false
        if (requireProjectPath && !(typeof clip.relativePath === "string" && clip.relativePath)) {
            return false
        }
        return getEffectiveAudioVolume(clip, tracksById.get(clip.trackIndex)) > 0
    })
}

export function buildCustomAudioExportClips({
    clips,
    tracks,
    timelineStart = 0,
    timelineEnd,
}) {
    const start = asFiniteNumber(timelineStart) ?? 0
    const end = asFiniteNumber(timelineEnd)
    if (end === null || end <= start) return []

    const tracksById = new Map((Array.isArray(tracks) ? tracks : [])
        .map(track => [track.id, track]))

    return (Array.isArray(clips) ? clips : [])
        .flatMap(clip => {
            const timeline = validTimelineRange(clip)
            const relativePath = typeof clip?.relativePath === "string"
                ? clip.relativePath.trim()
                : ""
            if (!timeline || !relativePath) return []

            const volume = getEffectiveAudioVolume(
                clip,
                tracksById.get(clip.trackIndex)
            )
            if (volume <= 0) return []

            const clippedStart = Math.max(start, timeline.start)
            const clippedEnd = Math.min(end, timeline.end)
            if (clippedEnd <= clippedStart) return []

            const sourceStart = timelineTimeToAudioSourceMs(clip, clippedStart)
            const sourceEnd = timelineTimeToAudioSourceMs(clip, clippedEnd)
            if (sourceEnd <= sourceStart) return []

            return [{
                relativePath,
                start: clippedStart,
                end: clippedEnd,
                sourceStart,
                sourceEnd,
                playbackRate: getAudioClipPlaybackRate(clip),
                volume,
            }]
        })
        .sort((left, right) =>
            left.start - right.start
            || left.end - right.end
            || left.relativePath.localeCompare(right.relativePath)
        )
}
