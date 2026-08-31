const SNAP_THRESHOLD_PX = 10

const finiteNumber = (value, fallback = 0) =>
    Number.isFinite(value) ? value : fallback

const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum), maximum)

export function getBookmarkSnapPoints(bookmarks) {
    if (!Array.isArray(bookmarks)) return []
    const points = new Set()
    for (const bookmark of bookmarks) {
        if (!Number.isFinite(bookmark?.time)) continue
        points.add(bookmark.time)
        if (Number.isFinite(bookmark.duration) && bookmark.duration > 0) {
            points.add(bookmark.time + bookmark.duration)
        }
    }
    return [...points].sort((a, b) => a - b)
}

export function resolveBookmarkDragTime({
    initialTime,
    duration = 0,
    deltaMs,
    projectDuration,
    snappingLines = [],
    pxPerMs = 0.1,
    isSnappingEnabled = false,
}) {
    const rangeDuration = Math.max(0, finiteNumber(duration))
    const maximumTime = Math.max(0, finiteNumber(projectDuration) - rangeDuration)
    const originalTime = clamp(finiteNumber(initialTime), 0, maximumTime)
    let time = clamp(originalTime + finiteNumber(deltaMs), 0, maximumTime)
    let snapLine = null

    if (isSnappingEnabled && pxPerMs > 0 && Array.isArray(snappingLines)) {
        const ownEnd = originalTime + rangeDuration
        const thresholdPx = Math.max(
            SNAP_THRESHOLD_PX / Math.sqrt(pxPerMs / 0.1),
            5
        )
        const thresholdMs = thresholdPx / pxPerMs
        let closest = null

        for (const line of snappingLines) {
            if (!Number.isFinite(line) || line === originalTime || line === ownEnd) continue
            const startCandidate = line
            const startDifference = Math.abs(time - startCandidate)
            if (startCandidate >= 0 && startCandidate <= maximumTime
                && startDifference <= thresholdMs
                && (!closest || startDifference < closest.difference)) {
                closest = { time: startCandidate, line, difference: startDifference }
            }

            if (rangeDuration > 0) {
                const endCandidate = line - rangeDuration
                const endDifference = Math.abs(time - endCandidate)
                if (endCandidate >= 0 && endCandidate <= maximumTime
                    && endDifference <= thresholdMs
                    && (!closest || endDifference < closest.difference)) {
                    closest = { time: endCandidate, line, difference: endDifference }
                }
            }
        }

        if (closest) {
            time = closest.time
            snapLine = closest.line
        }
    }

    return { time: Math.round(time), snapLine }
}

export function formatBookmarkTime(value) {
    const milliseconds = Math.max(0, Math.round(finiteNumber(value)))
    const totalSeconds = Math.floor(milliseconds / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const remainder = milliseconds % 1000
    const time = String(minutes).padStart(2, "0")
        + ":" + String(seconds).padStart(2, "0")
        + "." + String(remainder).padStart(3, "0")
    return hours > 0 ? String(hours) + ":" + time : time
}
