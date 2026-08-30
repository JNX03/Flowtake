import { createTimelineMediaReference } from "./projectMedia.js"

export const DEFAULT_LANE_INSERT_DURATION_MS = 4000

const asFiniteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const positiveNumber = value => {
    const number = asFiniteNumber(value)
    return number !== null && number > 0 ? number : null
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const overlaps = (left, right) =>
    left.start < right.end && left.end > right.start

function rejected(reason) {
    return { ok: false, reason }
}

/**
 * Plans one atomic insert into an explicit timeline lane.
 *
 * The requested time is treated as the preferred start. If that exact span is
 * occupied, the closest gap that can hold the complete item is selected.
 * Existing entities are never moved or shortened.
 */
export function planTimelineLaneInsert({
    requestedStart,
    requestedDuration,
    projectDuration,
    track,
    items = [],
    isPlaying = false,
}) {
    if (isPlaying) return rejected("playback-active")
    if (!track) return rejected("missing-track")
    if (track.locked) return rejected("locked-track")

    const projectEnd = positiveNumber(projectDuration)
    if (projectEnd === null) return rejected("invalid-project-duration")

    const desiredDuration = positiveNumber(requestedDuration)
    if (desiredDuration === null) return rejected("invalid-duration")

    const insertDuration = Math.min(desiredDuration, projectEnd)
    if (!(insertDuration > 0)) return rejected("invalid-duration")

    const rawStart = asFiniteNumber(requestedStart) ?? 0
    const pointerTime = clamp(rawStart, 0, projectEnd)
    const latestStart = projectEnd - insertDuration
    const preferredStart = clamp(pointerTime, 0, latestStart)

    const occupied = items
        .filter(item =>
            item
            && (item.trackIndex == null || item.trackIndex === track.id)
            && asFiniteNumber(item.start) !== null
            && asFiniteNumber(item.end) !== null
            && Number(item.end) > Number(item.start)
        )
        .map(item => ({
            start: clamp(Number(item.start), 0, projectEnd),
            end: clamp(Number(item.end), 0, projectEnd),
        }))
        .filter(item => item.end > item.start)

    const candidates = new Set([
        preferredStart,
        0,
        latestStart,
    ])
    for (const item of occupied) {
        candidates.add(clamp(item.end, 0, latestStart))
        candidates.add(clamp(item.start - insertDuration, 0, latestStart))
    }

    const orderedCandidates = [...candidates]
        .filter(Number.isFinite)
        .sort((left, right) =>
            Math.abs(left - pointerTime) - Math.abs(right - pointerTime)
            || left - right
        )

    for (const start of orderedCandidates) {
        const end = start + insertDuration
        if (!(start >= 0 && end <= projectEnd && start < end)) continue
        if (occupied.some(item => overlaps({ start, end }, item))) continue

        return {
            ok: true,
            start,
            end,
            pointerTime,
        }
    }

    return rejected("no-available-space")
}

function createBaseItem({ id, trackId, start, end }) {
    if (!id || trackId == null) return null
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return null
    return { id, start, end, trackIndex: trackId }
}

export function createAudioLaneItem({
    id,
    trackId,
    start,
    end,
    asset = {},
}) {
    const base = createBaseItem({ id, trackId, start, end })
    if (!base) return null

    const timelineDuration = end - start
    const sourceDuration = positiveNumber(asset.sourceDuration ?? asset.duration)
    const sourceStart = Math.max(0, asFiniteNumber(asset.sourceStart) ?? 0)
    const playbackRate = positiveNumber(asset.playbackRate) ?? 1
    const sourceEnd = Math.min(
        sourceDuration ?? Infinity,
        sourceStart + timelineDuration * playbackRate
    )

    return {
        ...base,
        name: asset.name || "Audio",
        volume: 1,
        sourceStart,
        sourceEnd,
        playbackRate,
        ...createTimelineMediaReference(asset),
        ...(sourceDuration !== null
            ? { sourceDuration }
            : {}),
    }
}

export function getOverlayLaneInsertDuration(asset = {}) {
    if (asset.type !== "video") return DEFAULT_LANE_INSERT_DURATION_MS

    const sourceDuration = positiveNumber(asset.sourceDuration ?? asset.duration)
    const sourceStart = Math.max(0, asFiniteNumber(asset.sourceStart) ?? 0)
    const playbackRate = positiveNumber(asset.playbackRate ?? asset.rate) ?? 1
    if (sourceDuration === null || asset.loop === true) {
        return sourceDuration ?? DEFAULT_LANE_INSERT_DURATION_MS
    }

    return Math.max(
        0,
        (sourceDuration - Math.min(sourceStart, sourceDuration)) / playbackRate
    )
}

export function createOverlayLaneItem({
    id,
    trackId,
    start,
    end,
    asset = {},
    position = { x: 0.5, y: 0.5 },
}) {
    const baseItem = createBaseItem({ id, trackId, start, end })
    if (!baseItem) return null

    const base = {
        ...baseItem,
        opacity: 1,
        position,
    }

    if (asset.type === "text") {
        return {
            ...base,
            overlayType: "text",
            text: asset.config?.text || "Text",
            fontSize: asset.config?.fontSize ?? 32,
            fontWeight: asset.config?.fontWeight ?? 600,
            color: asset.config?.color || "#ffffff",
        }
    }

    if (asset.type === "shape") {
        return {
            ...base,
            overlayType: "shape",
            shapeType: asset.config?.shapeType || "rect",
            fill: asset.config?.fill || "#6C5CE7",
            stroke: asset.config?.stroke || "none",
            strokeWidth: asset.config?.strokeWidth ?? 0,
            width: asset.config?.width ?? 200,
            height: asset.config?.height ?? 100,
            borderRadius: asset.config?.borderRadius ?? 0,
            radius: asset.config?.radius ?? 0,
        }
    }

    if (asset.type === "image") {
        return {
            ...base,
            overlayType: "image",
            name: asset.name || "Image",
            ...createTimelineMediaReference(asset),
            width: asset.width ?? 320,
            height: asset.height ?? 240,
        }
    }

    if (asset.type === "video") {
        const sourceDuration = positiveNumber(asset.sourceDuration ?? asset.duration)
        const sourceStart = Math.max(0, asFiniteNumber(asset.sourceStart) ?? 0)
        const playbackRate = positiveNumber(asset.playbackRate ?? asset.rate) ?? 1
        return {
            ...base,
            overlayType: "video",
            name: asset.name || "Video",
            ...createTimelineMediaReference(asset),
            sourceStart,
            sourceDuration,
            durationEstimated: sourceDuration === null,
            playbackRate,
            loop: asset.loop === true,
            width: asset.width ?? 320,
            height: asset.height ?? 240,
        }
    }

    return null
}
