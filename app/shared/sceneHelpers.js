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

export const applyInertia = (coords, duration, inertia = 400) => {
    const coordsWithInertia = []
    const frameDuration = 1000 / INERTIA_FPS

    if (coords.length > 0) {
        // Exponential moving average smoothing with velocity-aware adaptation.
        // tau controls the time constant: higher inertia = more smoothing.
        // alpha = 1 - exp(-frameDuration / tau) gives framerate-independent decay.
        const SMOOTHING_SCALE = 0.5
        const tau = inertia * SMOOTHING_SCALE
        const baseAlpha = 1 - Math.exp(-frameDuration / tau)

        let position = { x: coords[0].x, y: coords[0].y }
        const velocity = { x: 0, y: 0 }
        const c = [...coords]
        let current = c.shift()
        let prevCurrent = current

        for (let timestamp = 0; timestamp <= duration / frameDuration; timestamp += 1) {
            // Advance to the latest mouse event at or before this frame
            prevCurrent = current
            while (c.length > 0 && c[0].timestamp <= timestamp * frameDuration) {
                current = c.shift()
            }

            const dx = current.x - position.x
            const dy = current.y - position.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            // Compute raw mouse velocity from input events
            const inputDx = current.x - prevCurrent.x
            const inputDy = current.y - prevCurrent.y
            const inputSpeed = Math.sqrt(inputDx * inputDx + inputDy * inputDy)

            // Adaptive alpha: blends distance-based and velocity-based factors.
            // Distance factor prevents falling behind on large movements.
            // Velocity factor makes the cursor more responsive during fast motion.
            const MAX_DIST = 150
            const distFactor = Math.min(dist / MAX_DIST, 1.0)
            const MAX_SPEED = 100
            const speedFactor = Math.min(inputSpeed / MAX_SPEED, 1.0)
            const adaptiveFactor = Math.max(distFactor, speedFactor)
            const alpha = baseAlpha + (1 - baseAlpha) * adaptiveFactor * 0.6

            // Velocity-blended smoothing: mix EMA with a small velocity prediction
            // to reduce lag when the cursor changes direction quickly.
            const VELOCITY_DECAY = 0.8
            velocity.x = velocity.x * VELOCITY_DECAY + dx * alpha * (1 - VELOCITY_DECAY)
            velocity.y = velocity.y * VELOCITY_DECAY + dy * alpha * (1 - VELOCITY_DECAY)

            const predictFactor = Math.min(adaptiveFactor * 0.3, 0.25)

            position = {
                x: position.x + dx * alpha + velocity.x * predictFactor,
                y: position.y + dy * alpha + velocity.y * predictFactor,
            }

            // Snap when very close to avoid infinite asymptotic approach
            if (dist < 1.0) {
                position.x = current.x
                position.y = current.y
            }

            position.timestamp = timestamp * frameDuration
            position.t = timestamp
            coordsWithInertia.push(position)
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

export const getCoords = (screenVideoDimensions, videoDetails, timestamp, map, normalize = false) => {
    // Linearly interpolate between adjacent cursor frames instead of rounding to
    // the nearest one. Rounding quantizes the output to 16.67ms steps which
    // shows up as horizontal stepping under zoom magnification.
    const clamped = Math.min(timestamp, videoDetails.end)
    const frameTime = clamped / (1000 / INERTIA_FPS)
    const f0 = Math.max(0, Math.floor(frameTime))
    const t = frameTime - f0

    let a = map.get(f0)
    if (!a) a = map.get("last")
    const b = map.get(f0 + 1) || a

    const x = a.x + (b.x - a.x) * t
    const y = a.y + (b.y - a.y) * t

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
