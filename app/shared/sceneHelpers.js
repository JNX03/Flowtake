/**
 * Worker-safe scene helpers.
 *
 * These used to live in app/shared/helpers.js, but that file transitively
 * pulls in every Redux slice, react-redux, d3-ease (via other re-exports),
 * tauriBridge, etc. When the preview web worker loaded
 *   previewWorker → PreviewScene → Scene → Background → helpers.js
 * at module-evaluation time, something in that chain silently failed to
 * parse in the worker context, leaving the worker in a "dead on arrival"
 * state where postAsync(INIT_PREVIEW, ...) would hang forever and the
 * Editor stayed stuck on "Opening editor...".
 *
 * To isolate the worker from helpers.js, every helper function that the
 * scene/animator layer needs lives here. This file's only import is
 * `d3-ease`, which is worker-safe. helpers.js re-exports everything below
 * so main-thread consumers that still `import ... from "@shared/helpers"`
 * continue to work unchanged.
 */

import { easeBackOut, easeBounceOut, easeCubicInOut, easeElasticOut, easeExpOut, easeLinear } from "d3-ease"

export const INERTIA_FPS = 60

export const drawGradient = (canvas, direction, color1, color2, color3) => {
    if (!canvas) return

    const ctx = canvas.getContext("2d")

    const gradient = ctx.createLinearGradient(
        direction.from.x * canvas.width,
        direction.from.y * canvas.height,
        direction.to.x * canvas.width,
        direction.to.y * canvas.height
    )

    gradient.addColorStop(0, color1)
    gradient.addColorStop(0.5, color2)
    gradient.addColorStop(1, color3)

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
}

export const getGroupedMouseEvents = (mouseEvents) => {
    const clickEvents = mouseEvents.filter(
        ({ type }) => type === "mousedown" || type === "mouseup"
    )
    const groups = []
    clickEvents.forEach((event) => {
        switch (event.type) {
            case "mousedown":
                groups.push({ mousedown: event })
                break
            case "mouseup":
                // handles the case where the first event is mouseup without mousedown
                if (groups.length > 0) {
                    groups[groups.length - 1].mouseup = event
                }
                break
        }
    })

    return groups.filter((group) => group.mousedown && group.mouseup)
}

export const interpolate = (from, to, interpolator, easingFunction = easeExpOut) => {
    return from + easingFunction(interpolator) * (to - from)
}

export const interpolateCoords = (from, to, interpolator, easingFunction = easeExpOut) => {
    return {
        x: interpolate(from.x, to.x, interpolator, easingFunction),
        y: interpolate(from.y, to.y, interpolator, easingFunction),
    }
}

export const interpolateRect = (from, to, interpolator, easingFunction = easeExpOut) => {
    const rect = {
        x: interpolate(from.x, to.x, interpolator, easingFunction),
        y: interpolate(from.y, to.y, interpolator, easingFunction),
        width: interpolate(from.width, to.width, interpolator, easingFunction),
        height: interpolate(from.height, to.height, interpolator, easingFunction),
    }
    if (from.radius != null && to.radius != null) {
        rect.radius = interpolate(from.radius, to.radius, interpolator, easingFunction)
    }
    return rect
}

const EASING_MAP = {
    linear: easeLinear,
    smooth: easeCubicInOut,
    expOut: easeExpOut,
    snap: easeBackOut,
    bounce: easeBounceOut,
    elastic: easeElasticOut,
}

export const EASING_OPTIONS = [
    { id: "linear", name: "Linear" },
    { id: "smooth", name: "Smooth" },
    { id: "expOut", name: "Exponential" },
    { id: "snap", name: "Snap" },
    { id: "bounce", name: "Bounce" },
    { id: "elastic", name: "Elastic" },
]

export const getEasingFunction = (name) => EASING_MAP[name] || easeExpOut

const normalizeCursorCoords = (coords = []) => coords
    .filter(event => event && Number.isFinite(event.x) && Number.isFinite(event.y) && Number.isFinite(event.timestamp))
    .map(({ x, y, timestamp }) => ({ x, y, timestamp }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .reduce((events, event) => {
        if (events.at(-1)?.timestamp === event.timestamp) events[events.length - 1] = event
        else events.push(event)
        return events
    }, [])

export const applyInertia = (coords, duration, inertia = 400) => {
    const coordsWithInertia = []
    const frameDuration = 1000 / INERTIA_FPS
    const input = normalizeCursorCoords(coords)

    if (input.length > 0) {
        // Interpolate between captured mouse events before applying inertia.
        // This keeps motion smooth even when OS tracking delivers uneven samples.
        const SMOOTHING_SCALE = 0.25
        const tau = Math.max(inertia * SMOOTHING_SCALE, frameDuration)
        const baseAlpha = 1 - Math.exp(-frameDuration / tau)

        let position = { x: input[0].x, y: input[0].y }
        const velocity = { x: 0, y: 0 }
        let nextIndex = 1
        let prevTarget = input[0]

        for (let timestamp = 0; timestamp <= duration / frameDuration; timestamp += 1) {
            const frameTime = timestamp * frameDuration

            while (nextIndex < input.length - 1 && input[nextIndex].timestamp < frameTime) {
                nextIndex += 1
            }

            let target
            if (frameTime <= input[0].timestamp) target = input[0]
            else if (frameTime >= input.at(-1).timestamp) target = input.at(-1)
            else {
                const from = input[nextIndex - 1]
                const to = input[nextIndex]
                const span = Math.max(to.timestamp - from.timestamp, 1)
                const interpolator = (frameTime - from.timestamp) / span
                target = {
                    x: from.x + (to.x - from.x) * interpolator,
                    y: from.y + (to.y - from.y) * interpolator,
                    timestamp: frameTime,
                }
            }

            const dx = target.x - position.x
            const dy = target.y - position.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            const inputDx = target.x - prevTarget.x
            const inputDy = target.y - prevTarget.y
            const inputSpeed = Math.sqrt(inputDx * inputDx + inputDy * inputDy)

            const MAX_DIST = 180
            const distFactor = Math.min(dist / MAX_DIST, 1.0)
            const MAX_SPEED = 60
            const speedFactor = Math.min(inputSpeed / MAX_SPEED, 1.0)
            const adaptiveFactor = Math.max(distFactor, speedFactor)
            const alpha = baseAlpha + (1 - baseAlpha) * adaptiveFactor * 0.45

            const VELOCITY_DECAY = 0.72
            velocity.x = velocity.x * VELOCITY_DECAY + dx * alpha * (1 - VELOCITY_DECAY)
            velocity.y = velocity.y * VELOCITY_DECAY + dy * alpha * (1 - VELOCITY_DECAY)

            const predictFactor = Math.min(adaptiveFactor * 0.18, 0.16)

            position = {
                x: position.x + dx * alpha + velocity.x * predictFactor,
                y: position.y + dy * alpha + velocity.y * predictFactor,
            }

            // Snap when very close to avoid infinite asymptotic approach
            if (dist < 1.0) {
                position.x = target.x
                position.y = target.y
            }

            position.timestamp = timestamp * frameDuration
            position.t = timestamp
            coordsWithInertia.push(position)
            prevTarget = target
        }
    } else {
        for (let timestamp = 0; timestamp <= duration / frameDuration; timestamp += 1) {
            coordsWithInertia.push({ x: 0, y: 0, timestamp: timestamp * frameDuration, t: timestamp })
        }
    }

    const map = new Map()
    let lastCoord = { t: 0, timestamp: 0, x: 0, y: 0 }
    for (const coord of coordsWithInertia) {
        map.set(coord.t, coord)
        lastCoord = coord
    }
    map.set("last", lastCoord)

    return map
}

export const getInertiaCoords = (timestamp, map) => {
    const frameTime = Math.max(timestamp, 0) / (1000 / INERTIA_FPS)
    const f0 = Math.max(0, Math.floor(frameTime))
    const interpolator = frameTime - f0

    let a = map.get(f0)
    if (!a) a = map.get("last")
    const b = map.get(f0 + 1) || a

    return {
        x: a.x + (b.x - a.x) * interpolator,
        y: a.y + (b.y - a.y) * interpolator,
    }
}

export const getCoords = (screenVideoDimensions, videoDetails, timestamp, map, normalize = false) => {
    // Linearly interpolate between adjacent cursor frames instead of rounding to
    // the nearest one. Rounding quantizes the output to 16.67ms steps which
    // shows up as horizontal stepping under zoom magnification.
    const clamped = Math.max(0, Math.min(timestamp, videoDetails.end))
    const { x, y } = getInertiaCoords(clamped, map)

    if (normalize) return { x: x / screenVideoDimensions.x, y: y / screenVideoDimensions.y }
    return { x, y }
}

export const cropToCenteredRect = (outputRect, inputRect, borderRadius = 0) => {
    let cropParams
    if (outputRect.width / outputRect.height > inputRect.width / inputRect.height) {
        // video container is narrower than box
        const height = (inputRect.width * outputRect.height) / outputRect.width
        cropParams = {
            x: 0,
            y: (inputRect.height - height) * 0.5,
            width: inputRect.width,
            height,
        }
    } else {
        // video container is wider than box
        const width = (inputRect.height * outputRect.width) / outputRect.height
        cropParams = {
            x: (inputRect.width - width) * 0.5,
            y: 0,
            width,
            height: inputRect.height,
        }
    }
    if (typeof borderRadius === "number") {
        cropParams.radius = Math.min(cropParams.width, cropParams.height) * borderRadius
    }
    return cropParams
}

export const getFullScreenScale = (cameraVideoDimensions, rendererDims) => {
    const cameraMask = cropToCenteredRect(
        { width: rendererDims.x, height: rendererDims.y },
        { width: cameraVideoDimensions.x, height: cameraVideoDimensions.y }
    )

    if (rendererDims.x / rendererDims.y > cameraMask.width / cameraMask.height)
        return rendererDims.x / cameraMask.width
    return rendererDims.y / cameraMask.height
}
