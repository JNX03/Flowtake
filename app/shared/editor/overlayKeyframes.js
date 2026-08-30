import {
    easeBackOut,
    easeBounceOut,
    easeCubicInOut,
    easeElasticOut,
    easeExpOut,
    easeLinear,
} from "d3-ease"

const EASING_MAP = Object.freeze({
    linear: easeLinear,
    smooth: easeCubicInOut,
    expOut: easeExpOut,
    snap: easeBackOut,
    bounce: easeBounceOut,
    elastic: easeElasticOut,
})

const interpolate = (left, right, t) =>
    left != null && right != null
        ? left + (right - left) * t
        : (right ?? left)

export function resolveOverlayAtTime(overlay, time) {
    const keyframes = overlay?.keyframes
    if (!Array.isArray(keyframes) || keyframes.length === 0) return overlay

    const relativeTime = time - overlay.start
    if (keyframes.length === 1) return { ...overlay, ...keyframes[0] }

    let before = keyframes[0]
    let after = keyframes[keyframes.length - 1]
    for (const keyframe of keyframes) {
        if (keyframe.time <= relativeTime) before = keyframe
        if (keyframe.time >= relativeTime) {
            after = keyframe
            break
        }
    }

    if (before === after || before.time === after.time) {
        return { ...overlay, ...before }
    }

    const rawProgress = Math.max(0, Math.min(1,
        (relativeTime - before.time) / (after.time - before.time)))
    const easing = EASING_MAP[after.easing] ?? EASING_MAP.linear
    const progress = easing(rawProgress)

    return {
        ...overlay,
        position: {
            x: interpolate(
                before.position?.x ?? overlay.position?.x,
                after.position?.x ?? overlay.position?.x,
                progress
            ),
            y: interpolate(
                before.position?.y ?? overlay.position?.y,
                after.position?.y ?? overlay.position?.y,
                progress
            ),
        },
        rotation: interpolate(
            before.rotation ?? overlay.rotation ?? 0,
            after.rotation ?? overlay.rotation ?? 0,
            progress
        ),
        scale: interpolate(
            before.scale ?? overlay.scale ?? 1,
            after.scale ?? overlay.scale ?? 1,
            progress
        ),
        opacity: interpolate(
            before.opacity ?? overlay.opacity ?? 1,
            after.opacity ?? overlay.opacity ?? 1,
            progress
        ),
    }
}

export const OVERLAY_EASING_NAMES = Object.freeze(Object.keys(EASING_MAP))
