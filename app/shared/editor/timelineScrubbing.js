const DEFAULT_KEYBOARD_STEP_MS = 100
const DEFAULT_LARGE_KEYBOARD_STEP_MS = 1000
export const MAX_VISIBLE_TIMELINE_LABELS = 512

function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback
}

export function clampTimelineTime(time, start = 0, end = start) {
    const safeStart = finiteOr(start, 0)
    const safeEnd = Math.max(safeStart, finiteOr(end, safeStart))
    const safeTime = finiteOr(time, safeStart)
    return Math.min(safeEnd, Math.max(safeStart, safeTime))
}

export function timelineTimeFromClientX({
    clientX,
    contentLeft,
    pxPerMs,
    start = 0,
    end = start,
    pointerOffsetPx = 0,
}) {
    if (!Number.isFinite(clientX) || !Number.isFinite(contentLeft) ||
        !Number.isFinite(pxPerMs) || pxPerMs <= 0) {
        return clampTimelineTime(start, start, end)
    }

    const localX = clientX - contentLeft - finiteOr(pointerOffsetPx, 0)
    return clampTimelineTime(localX / pxPerMs, start, end)
}

export function timelineTimeFromKeyboard({
    key,
    time,
    start = 0,
    end = start,
    shiftKey = false,
    stepMs = DEFAULT_KEYBOARD_STEP_MS,
    largeStepMs = DEFAULT_LARGE_KEYBOARD_STEP_MS,
}) {
    const currentTime = clampTimelineTime(time, start, end)
    const smallStep = Math.max(1, finiteOr(stepMs, DEFAULT_KEYBOARD_STEP_MS))
    const largeStep = Math.max(smallStep, finiteOr(largeStepMs, DEFAULT_LARGE_KEYBOARD_STEP_MS))
    const arrowStep = shiftKey ? largeStep : smallStep

    switch (key) {
        case "ArrowLeft":
            return clampTimelineTime(currentTime - arrowStep, start, end)
        case "ArrowRight":
            return clampTimelineTime(currentTime + arrowStep, start, end)
        case "PageDown":
            return clampTimelineTime(currentTime - largeStep, start, end)
        case "PageUp":
            return clampTimelineTime(currentTime + largeStep, start, end)
        case "Home":
            return clampTimelineTime(start, start, end)
        case "End":
            return clampTimelineTime(end, start, end)
        default:
            return null
    }
}

export function shouldResumeTimelinePlayback({ wasPlaying, time, end }) {
    return Boolean(wasPlaying) &&
        Number.isFinite(time) &&
        Number.isFinite(end) &&
        time < end
}

export function getVisibleTimelineLabels({
    duration,
    intervalMs,
    pxPerMs,
    scrollLeft = 0,
    viewportWidth = 0,
    overscanPx
}) {
    if (!Number.isFinite(duration) || duration < 0 ||
        !Number.isFinite(intervalMs) || intervalMs <= 0 ||
        !Number.isFinite(pxPerMs) || pxPerMs <= 0) {
        return []
    }

    const safeScrollLeft = Math.max(0, finiteOr(scrollLeft, 0))
    const safeViewportWidth = Math.max(1, finiteOr(viewportWidth, 1200) || 1200)
    const safeOverscan = Math.max(0, finiteOr(overscanPx, safeViewportWidth / 2))
    const durationPx = duration * pxPerMs
    const visibleStartPx = Math.max(0, safeScrollLeft - safeOverscan)
    const visibleEndPx = Math.min(durationPx, safeScrollLeft + safeViewportWidth + safeOverscan)
    const firstIndex = Math.max(0, Math.floor(visibleStartPx / pxPerMs / intervalMs) - 1)
    const lastIndex = Math.min(
        Math.floor(duration / intervalMs),
        Math.ceil(visibleEndPx / pxPerMs / intervalMs) + 1
    )
    const visibleLabelCount = Math.max(0, lastIndex - firstIndex + 1)
    const indexStep = Math.max(1, Math.ceil(visibleLabelCount / MAX_VISIBLE_TIMELINE_LABELS))
    const labels = []

    for (let index = firstIndex; index <= lastIndex; index += indexStep) {
        const ms = index * intervalMs
        labels.push({ ms, px: ms * pxPerMs })
    }

    if (labels.length > 0 && labels.at(-1).ms < lastIndex * intervalMs) {
        const ms = lastIndex * intervalMs
        if (labels.length === MAX_VISIBLE_TIMELINE_LABELS) labels[labels.length - 1] = { ms, px: ms * pxPerMs }
        else labels.push({ ms, px: ms * pxPerMs })
    }
    return labels
}

export function formatTimelineTime(time) {
    const milliseconds = Math.max(0, Math.round(finiteOr(time, 0)))
    const hours = Math.floor(milliseconds / 3600000)
    const minutes = Math.floor(milliseconds % 3600000 / 60000)
    const seconds = Math.floor(milliseconds % 60000 / 1000)
    const millis = milliseconds % 1000
    const base = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`
    return hours > 0 ? `${String(hours).padStart(2, "0")}:${base}` : base
}
