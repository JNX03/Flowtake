const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum), maximum)

export const TIMELINE_EDIT_TAIL_MS = 5_000

export function getTimelineCanvasEnd(
    timelineEnd,
    editTail = TIMELINE_EDIT_TAIL_MS
) {
    const safeEnd = Number.isFinite(timelineEnd) ? Math.max(0, timelineEnd) : 0
    const safeTail = Number.isFinite(editTail) ? Math.max(0, editTail) : 0
    return safeEnd + safeTail
}

const isFiniteRange = item =>
    Number.isFinite(item?.start)
    && Number.isFinite(item?.end)
    && item.end > item.start

export function findClosestTimelineGap({
    targetStart,
    duration,
    items = [],
    itemId = null,
    timelineDuration,
}) {
    if (!Number.isFinite(targetStart)
        || !Number.isFinite(duration)
        || duration <= 0
        || !(Number.isFinite(timelineDuration) || timelineDuration === Infinity)
        || timelineDuration <= 0
        || duration > timelineDuration) {
        return null
    }

    const maximumStart = timelineDuration === Infinity
        ? Infinity
        : Math.max(0, timelineDuration - duration)
    const boundedTarget = clamp(targetStart, 0, maximumStart)
    const occupied = items
        .filter(item => item?.id !== itemId && isFiniteRange(item))
        .map(item => ({
            start: Math.max(0, item.start),
            end: Math.min(timelineDuration, item.end),
        }))
        .filter(item => item.end > item.start)
        .sort((a, b) => a.start - b.start || a.end - b.end)

    const targetEnd = boundedTarget + duration
    const targetIsFree = !occupied.some(item =>
        item.start < targetEnd && item.end > boundedTarget)
    if (targetIsFree) return boundedTarget

    const candidates = []
    let cursor = 0
    for (const item of occupied) {
        if (item.start - cursor >= duration) {
            candidates.push(clamp(boundedTarget, cursor, item.start - duration))
        }
        cursor = Math.max(cursor, item.end)
    }
    if (timelineDuration - cursor >= duration) {
        candidates.push(clamp(boundedTarget, cursor, timelineDuration - duration))
    }
    if (candidates.length === 0) return null

    return candidates.reduce((closest, candidate) => {
        const candidateDistance = Math.abs(candidate - boundedTarget)
        const closestDistance = Math.abs(closest - boundedTarget)
        if (candidateDistance < closestDistance) return candidate
        if (candidateDistance === closestDistance) return Math.min(candidate, closest)
        return closest
    })
}
