const DEFAULT_EDGE_SIZE = 72
const DEFAULT_MIN_SPEED = 2
const DEFAULT_MAX_SPEED = 28

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

function normalizePointer(point) {
    if (!point || !Number.isFinite(point.clientX)) return null
    return {
        clientX: point.clientX,
        clientY: Number.isFinite(point.clientY) ? point.clientY : 0
    }
}

export function getTimelineAutoScrollDelta(clientX, rect, {
    edgeSize = DEFAULT_EDGE_SIZE,
    minSpeed = DEFAULT_MIN_SPEED,
    maxSpeed = DEFAULT_MAX_SPEED
} = {}) {
    if (!Number.isFinite(clientX) || !rect || !Number.isFinite(rect.left)
        || !Number.isFinite(rect.right) || edgeSize <= 0 || maxSpeed <= 0) {
        return 0
    }

    const leftDistance = clientX - rect.left
    const rightDistance = rect.right - clientX

    let direction = 0
    let proximity = 0
    if (leftDistance < edgeSize) {
        direction = -1
        proximity = clamp((edgeSize - leftDistance) / edgeSize, 0, 1)
    } else if (rightDistance < edgeSize) {
        direction = 1
        proximity = clamp((edgeSize - rightDistance) / edgeSize, 0, 1)
    }

    if (direction === 0 || proximity === 0) return 0

    const boundedMinSpeed = clamp(minSpeed, 0, maxSpeed)
    const speed = boundedMinSpeed + (maxSpeed - boundedMinSpeed) * proximity * proximity
    return direction * speed
}

export function createTimelineAutoScrollController({
    getContainer,
    onScrollFrame,
    requestFrame = callback => window.requestAnimationFrame(callback),
    cancelFrame = frameId => window.cancelAnimationFrame(frameId),
    edgeSize = DEFAULT_EDGE_SIZE,
    minSpeed = DEFAULT_MIN_SPEED,
    maxSpeed = DEFAULT_MAX_SPEED
}) {
    if (typeof getContainer !== "function")
        throw new TypeError("getContainer must be a function")

    let active = false
    let frameId = null
    let pointer = null

    const schedule = () => {
        if (!active || frameId !== null) return
        frameId = requestFrame(tick)
    }

    const tick = () => {
        frameId = null
        if (!active || !pointer) return

        const container = getContainer()
        if (!container) return

        const delta = getTimelineAutoScrollDelta(
            pointer.clientX,
            container.getBoundingClientRect(),
            { edgeSize, minSpeed, maxSpeed }
        )
        if (delta === 0) return

        const previousScrollLeft = Number(container.scrollLeft) || 0
        const maxScrollLeft = Math.max(
            0,
            (Number(container.scrollWidth) || 0) - (Number(container.clientWidth) || 0)
        )
        const nextScrollLeft = clamp(previousScrollLeft + delta, 0, maxScrollLeft)
        if (nextScrollLeft === previousScrollLeft) return

        container.scrollLeft = nextScrollLeft
        onScrollFrame?.({
            pointer: { ...pointer },
            container,
            delta: nextScrollLeft - previousScrollLeft,
            scrollLeft: nextScrollLeft
        })
        schedule()
    }

    return {
        start(point) {
            pointer = normalizePointer(point)
            if (!pointer) return
            active = true
            schedule()
        },
        update(point) {
            if (!active) return
            const nextPointer = normalizePointer(point)
            if (!nextPointer) return
            pointer = nextPointer
            schedule()
        },
        stop() {
            active = false
            pointer = null
            if (frameId !== null) cancelFrame(frameId)
            frameId = null
        },
        isActive() {
            return active
        }
    }
}
