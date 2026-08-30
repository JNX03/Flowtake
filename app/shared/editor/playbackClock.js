const finiteNumber = value => Number.isFinite(Number(value))

export const DEFAULT_PLAYBACK_RATE = 1
export const MIN_PLAYBACK_PUBLISH_DELTA_MS = 8

const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum), maximum)

export function getClipSourceRange(clip) {
    const timelineStart = finiteNumber(clip?.start) ? Number(clip.start) : 0
    const timelineEnd = finiteNumber(clip?.end)
        ? Math.max(timelineStart, Number(clip.end))
        : timelineStart
    const sourceStart = finiteNumber(clip?.sourceStart)
        ? Math.max(0, Number(clip.sourceStart))
        : timelineStart
    const sourceEnd = finiteNumber(clip?.sourceEnd)
        ? Math.max(sourceStart, Number(clip.sourceEnd))
        : sourceStart + (timelineEnd - timelineStart)

    return { sourceStart, sourceEnd }
}

export function timelineTimeToClipMediaMs(clip, time) {
    if (!clip || !finiteNumber(time)) return 0

    const timelineStart = Number(clip.start)
    const timelineEnd = Math.max(timelineStart, Number(clip.end))
    const { sourceStart, sourceEnd } = getClipSourceRange(clip)
    if (isFreezePlaybackRate(clip.playbackRate) || timelineEnd === timelineStart)
        return sourceStart

    const progress = clamp(
        (Number(time) - timelineStart) / (timelineEnd - timelineStart),
        0,
        1
    )
    return sourceStart + (sourceEnd - sourceStart) * progress
}

export function mediaTimeToClipTimelineMs(clip, mediaTimeSeconds) {
    if (!clip || !finiteNumber(mediaTimeSeconds)) return Number(clip?.start) || 0

    const timelineStart = Number(clip.start)
    const timelineEnd = Math.max(timelineStart, Number(clip.end))
    const { sourceStart, sourceEnd } = getClipSourceRange(clip)
    if (isFreezePlaybackRate(clip.playbackRate) || sourceEnd === sourceStart)
        return timelineStart

    const mediaTimeMs = Number(mediaTimeSeconds) * 1000
    const progress = clamp(
        (mediaTimeMs - sourceStart) / (sourceEnd - sourceStart),
        0,
        1
    )
    return timelineStart + (timelineEnd - timelineStart) * progress
}

export function getClipSplitSourceTime(clip, splitTime) {
    return timelineTimeToClipMediaMs(clip, splitTime)
}

export function getClipSplitTiming(clip, splitTime) {
    const sourceSplit = getClipSplitSourceTime(clip, splitTime)
    const { sourceStart, sourceEnd } = getClipSourceRange(clip)
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

export function resolveClipTimingChange(clip, nextStart, nextEnd) {
    if (!clip || !finiteNumber(nextStart) || !finiteNumber(nextEnd))
        return { start: nextStart, end: nextEnd }

    const start = Number(nextStart)
    const end = Number(nextEnd)
    const previousStart = Number(clip.start)
    const previousEnd = Number(clip.end)
    const { sourceStart, sourceEnd } = getClipSourceRange(clip)
    const previousDuration = previousEnd - previousStart
    const sourceDuration = sourceEnd - sourceStart
    const sourcePerTimelineMs = previousDuration > 0
        ? sourceDuration / previousDuration
        : 1
    const startDelta = start - previousStart
    const endDelta = end - previousEnd
    const isMove = Math.abs(startDelta - endDelta) < 0.001

    return {
        start,
        end,
        sourceStart: isMove
            ? sourceStart
            : Math.max(0, sourceStart + startDelta * sourcePerTimelineMs),
        sourceEnd: isMove
            ? sourceEnd
            : Math.max(0, sourceEnd + endDelta * sourcePerTimelineMs),
    }
}

export function normalizePlaybackRate(value, fallback = DEFAULT_PLAYBACK_RATE) {
    const rate = Number(value)
    return finiteNumber(rate) && rate > 0 ? rate : fallback
}

export function isFreezePlaybackRate(value) {
    return finiteNumber(value) && Number(value) === 0
}

export function mediaTimeToTimelineMs(mediaTimeSeconds, start = 0, end = Infinity) {
    const safeStart = finiteNumber(start) ? Number(start) : 0
    const safeEnd = finiteNumber(end) && Number(end) >= safeStart
        ? Number(end)
        : Infinity
    const mediaTimeMs = finiteNumber(mediaTimeSeconds)
        ? Math.round(Number(mediaTimeSeconds) * 1000)
        : safeStart

    return Math.min(Math.max(mediaTimeMs, safeStart), safeEnd)
}

export function shouldPublishPlaybackTime(
    nextTime,
    previousTime,
    minimumDelta = MIN_PLAYBACK_PUBLISH_DELTA_MS
) {
    if (!finiteNumber(nextTime)) return false
    if (!finiteNumber(previousTime)) return true
    return Math.abs(Number(nextTime) - Number(previousTime)) >= Math.max(0, minimumDelta)
}

export function findActivePlaybackClip(clips, time, timelineEnd = Infinity) {
    if (!Array.isArray(clips) || !finiteNumber(time)) return null

    return clips.find(clip => {
        if (!finiteNumber(clip?.start) || !finiteNumber(clip?.end)) return false
        const isFinalBoundary = Number(time) === Number(timelineEnd)
            && Number(clip.end) === Number(timelineEnd)
        return Number(time) >= Number(clip.start)
            && (Number(time) < Number(clip.end) || isFinalBoundary)
    }) ?? null
}

export function findNextPlaybackClip(clips, time) {
    if (!Array.isArray(clips) || !finiteNumber(time)) return null

    return clips.reduce((next, clip) => {
        if (!finiteNumber(clip?.start) || Number(clip.start) <= Number(time)) return next
        if (!next || Number(clip.start) < Number(next.start)) return clip
        return next
    }, null)
}

export function timelineTimeToMediaMs(clips, time, timelineEnd = Infinity) {
    if (!finiteNumber(time)) return 0
    const activeClip = findActivePlaybackClip(clips, time, timelineEnd)
    return activeClip
        ? timelineTimeToClipMediaMs(activeClip, time)
        : Number(time)
}

export function buildRenderTimelineFrames({
    clips,
    timelineStart = 0,
    timelineEnd,
    fps,
}) {
    const start = finiteNumber(timelineStart) ? Number(timelineStart) : 0
    const end = finiteNumber(timelineEnd) ? Number(timelineEnd) : start
    const framesPerSecond = Number(fps)
    if (end <= start || !Number.isFinite(framesPerSecond) || framesPerSecond <= 0)
        return []

    const orderedClips = (Array.isArray(clips) ? clips : [])
        .filter(clip => finiteNumber(clip?.start)
            && finiteNumber(clip?.end)
            && Number(clip.end) > Number(clip.start))
        .toSorted((left, right) => Number(left.start) - Number(right.start))
    const segments = []
    let timelineCursor = start

    for (const clip of orderedClips) {
        const clipStart = Math.max(start, Number(clip.start))
        const clipEnd = Math.min(end, Number(clip.end))
        if (clipEnd <= timelineCursor) continue

        if (clipStart > timelineCursor) {
            segments.push({
                kind: "gap",
                timelineStart: timelineCursor,
                timelineEnd: clipStart,
                outputDuration: clipStart - timelineCursor,
            })
        }

        const segmentStart = Math.max(timelineCursor, clipStart)
        if (clipEnd > segmentStart) {
            const playbackRate = isFreezePlaybackRate(clip.playbackRate)
                ? 0
                : normalizePlaybackRate(clip.playbackRate)
            const timelineDuration = clipEnd - segmentStart
            segments.push({
                kind: playbackRate === 0 ? "freeze" : "clip",
                clip,
                timelineStart: segmentStart,
                timelineEnd: clipEnd,
                outputDuration: playbackRate === 0
                    ? timelineDuration
                    : timelineDuration / playbackRate,
                playbackRate,
            })
            timelineCursor = clipEnd
        }
    }

    if (timelineCursor < end) {
        segments.push({
            kind: "gap",
            timelineStart: timelineCursor,
            timelineEnd: end,
            outputDuration: end - timelineCursor,
        })
    }
    if (segments.length === 0) return []

    let outputCursor = 0
    for (const segment of segments) {
        segment.outputStart = outputCursor
        outputCursor += segment.outputDuration
        segment.outputEnd = outputCursor
    }

    const msPerFrame = 1000 / framesPerSecond
    const frameCount = Math.max(1, Math.ceil(outputCursor / msPerFrame))
    const frames = []
    let segmentIndex = 0

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const outputTimestamp = frameIndex * msPerFrame
        while (
            segmentIndex < segments.length - 1
            && outputTimestamp >= segments[segmentIndex].outputEnd
        ) {
            segmentIndex += 1
        }

        const segment = segments[segmentIndex]
        const localOutputTime = Math.max(0, outputTimestamp - segment.outputStart)
        const timelineTimestamp = Math.min(
            segment.timelineEnd,
            segment.timelineStart + (
                segment.kind === "clip"
                    ? localOutputTime * segment.playbackRate
                    : localOutputTime
            )
        )
        const sourceTimestamp = segment.kind === "gap"
            ? null
            : timelineTimeToClipMediaMs(segment.clip, timelineTimestamp)

        frames.push({
            outputTimestamp,
            timelineTimestamp,
            sourceTimestamp,
            isGap: segment.kind === "gap",
            isFreeze: segment.kind === "freeze",
        })
    }

    return frames
}
