const finiteOr = (value, fallback = 0) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export function buildTimelineMinimapSegments(
    entities,
    duration,
    maxSegments = 96
) {
    const safeDuration = Math.max(0, finiteOr(duration))
    const safeLimit = clamp(Math.floor(finiteOr(maxSegments, 96)), 1, 512)
    if (!Array.isArray(entities) || safeDuration === 0) return []

    const ranges = entities
        .map(entity => ({
            start: clamp(finiteOr(entity?.start), 0, safeDuration),
            end: clamp(finiteOr(entity?.end), 0, safeDuration),
        }))
        .filter(range => range.end > range.start)
        .sort((left, right) => left.start - right.start || left.end - right.end)

    if (ranges.length === 0) return []

    const merged = []
    for (const range of ranges) {
        const previous = merged.at(-1)
        if (previous && range.start <= previous.end) {
            previous.end = Math.max(previous.end, range.end)
        } else {
            merged.push({ ...range })
        }
    }

    const toSegment = range => ({
        leftRatio: range.start / safeDuration,
        widthRatio: (range.end - range.start) / safeDuration,
    })
    if (merged.length <= safeLimit) return merged.map(toSegment)

    // Two bins per allowed segment guarantee that even an alternating occupancy
    // pattern cannot create more DOM nodes than the requested cap.
    const binCount = safeLimit * 2
    const occupied = new Uint8Array(binCount)
    for (const range of merged) {
        const firstBin = Math.min(
            binCount - 1,
            Math.floor((range.start / safeDuration) * binCount)
        )
        const lastBinExclusive = Math.min(
            binCount,
            Math.max(
                firstBin + 1,
                Math.ceil((range.end / safeDuration) * binCount)
            )
        )
        occupied.fill(1, firstBin, lastBinExclusive)
    }

    const segments = []
    let segmentStart = null
    for (let index = 0; index <= binCount; index++) {
        const isOccupied = index < binCount && occupied[index] === 1
        if (isOccupied && segmentStart === null) segmentStart = index
        if (!isOccupied && segmentStart !== null) {
            segments.push({
                leftRatio: segmentStart / binCount,
                widthRatio: (index - segmentStart) / binCount,
            })
            segmentStart = null
        }
    }
    return segments
}

export function clampTimelineScrollLeft({
    scrollLeft,
    scrollWidth,
    clientWidth,
}) {
    const safeScrollWidth = Math.max(0, finiteOr(scrollWidth))
    const safeClientWidth = Math.max(0, finiteOr(clientWidth))
    const maxScrollLeft = Math.max(0, safeScrollWidth - safeClientWidth)

    return clamp(finiteOr(scrollLeft), 0, maxScrollLeft)
}

export function getTimelineMinimapGeometry({
    duration,
    pxPerMs,
    clientWidth,
    scrollWidth,
    scrollLeft,
}) {
    const safeDuration = Math.max(0, finiteOr(duration))
    const safeScale = Math.max(0, finiteOr(pxPerMs))
    const safeClientWidth = Math.max(0, finiteOr(clientWidth))
    const timelineWidth = safeDuration * safeScale
    const safeScrollWidth = Math.max(
        safeClientWidth,
        timelineWidth,
        finiteOr(scrollWidth)
    )
    const maxScrollLeft = Math.max(0, safeScrollWidth - safeClientWidth)
    const clampedScrollLeft = clampTimelineScrollLeft({
        scrollLeft,
        scrollWidth: safeScrollWidth,
        clientWidth: safeClientWidth,
    })
    const viewportWidthRatio = safeScrollWidth > 0
        ? clamp(safeClientWidth / safeScrollWidth, 0, 1)
        : 1
    const maxViewportLeftRatio = Math.max(0, 1 - viewportWidthRatio)
    const viewportLeftRatio = safeScrollWidth > 0
        ? clamp(clampedScrollLeft / safeScrollWidth, 0, maxViewportLeftRatio)
        : 0

    const viewportDuration = safeScale > 0
        ? clamp(safeClientWidth / safeScale, 0, safeDuration)
        : safeDuration * viewportWidthRatio
    const maxStartMs = Math.max(0, safeDuration - viewportDuration)
    const startMs = safeScale > 0
        ? clamp(clampedScrollLeft / safeScale, 0, maxStartMs)
        : maxStartMs * (
            maxScrollLeft > 0 ? clampedScrollLeft / maxScrollLeft : 0
        )

    return {
        scrollWidth: safeScrollWidth,
        clientWidth: safeClientWidth,
        scrollLeft: clampedScrollLeft,
        maxScrollLeft,
        viewportLeftRatio,
        viewportWidthRatio,
        startMs,
        endMs: Math.min(safeDuration, startMs + viewportDuration),
        maxStartMs,
    }
}

export function getMinimapScrollLeftFromPointer({
    clientX,
    barLeft,
    barWidth,
    scrollWidth,
    clientWidth,
    grabOffsetPx,
    centerViewport = false,
}) {
    const safeBarWidth = Math.max(0, finiteOr(barWidth))
    const safeScrollWidth = Math.max(0, finiteOr(scrollWidth))
    const safeClientWidth = Math.max(0, finiteOr(clientWidth))
    const maxScrollLeft = Math.max(0, safeScrollWidth - safeClientWidth)

    if (safeBarWidth === 0 || safeScrollWidth === 0 || maxScrollLeft === 0)
        return 0

    const viewportWidthPx = clamp(
        (safeClientWidth / safeScrollWidth) * safeBarWidth,
        0,
        safeBarWidth
    )
    const maxViewportLeftPx = Math.max(0, safeBarWidth - viewportWidthPx)
    const pointerX = finiteOr(clientX) - finiteOr(barLeft)
    const offset = centerViewport
        ? viewportWidthPx / 2
        : clamp(finiteOr(grabOffsetPx), 0, viewportWidthPx)
    const viewportLeftPx = clamp(
        pointerX - offset,
        0,
        maxViewportLeftPx
    )

    return maxViewportLeftPx > 0
        ? (viewportLeftPx / maxViewportLeftPx) * maxScrollLeft
        : 0
}

export function getMinimapScrollLeftFromKeyboard({
    key,
    scrollLeft,
    scrollWidth,
    clientWidth,
    shiftKey = false,
}) {
    const safeScrollWidth = Math.max(0, finiteOr(scrollWidth))
    const safeClientWidth = Math.max(0, finiteOr(clientWidth))
    const maxScrollLeft = Math.max(0, safeScrollWidth - safeClientWidth)
    const current = clampTimelineScrollLeft({
        scrollLeft,
        scrollWidth: safeScrollWidth,
        clientWidth: safeClientWidth,
    })
    const arrowStep = Math.max(40, safeClientWidth * 0.1)
        * (shiftKey ? 4 : 1)

    let next
    switch (key) {
        case "ArrowLeft":
            next = current - arrowStep
            break
        case "ArrowRight":
            next = current + arrowStep
            break
        case "PageUp":
            next = current - safeClientWidth
            break
        case "PageDown":
            next = current + safeClientWidth
            break
        case "Home":
            next = 0
            break
        case "End":
            next = maxScrollLeft
            break
        default:
            return null
    }

    return clamp(next, 0, maxScrollLeft)
}

const formatTime = value => {
    const totalSeconds = Math.max(0, Math.floor(finiteOr(value) / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`

    return hours > 0 ? `${hours}:${clock}` : clock
}

export function formatMinimapViewportRange({ startMs, endMs }) {
    return `${formatTime(startMs)} to ${formatTime(endMs)}`
}
