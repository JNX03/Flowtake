/**
 * Pure transition functions. Each returns { alpha, scaleX, scaleY, x, y, maskProgress }
 * where t is the transition progress from 0 (start) to 1 (complete).
 * For "in" transitions: t=0 means fully transitioned out, t=1 means fully visible.
 * For "out" transitions: t=0 means fully visible, t=1 means fully transitioned out.
 */

export const TRANSITION_TYPES = [
    { id: "none", name: "None" },
    { id: "fade", name: "Fade" },
    { id: "dissolve", name: "Dissolve" },
    { id: "wipe-left", name: "Wipe Left" },
    { id: "wipe-right", name: "Wipe Right" },
    { id: "wipe-up", name: "Wipe Up" },
    { id: "wipe-down", name: "Wipe Down" },
    { id: "slide-left", name: "Slide Left" },
    { id: "slide-right", name: "Slide Right" },
    { id: "zoom-in", name: "Zoom In" },
    { id: "zoom-out", name: "Zoom Out" },
]

export const DEFAULT_TRANSITION = { type: "none", duration: 500 }

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function computeTransitionIn(type, t, width, height) {
    const et = easeInOutCubic(t)
    switch (type) {
        case "fade":
            return { alpha: et }
        case "dissolve":
            return { alpha: et * et } // slightly different curve
        case "wipe-left":
            return { maskProgress: et, maskDirection: "left" }
        case "wipe-right":
            return { maskProgress: et, maskDirection: "right" }
        case "wipe-up":
            return { maskProgress: et, maskDirection: "up" }
        case "wipe-down":
            return { maskProgress: et, maskDirection: "down" }
        case "slide-left":
            return { x: width * (1 - et), alpha: et }
        case "slide-right":
            return { x: -width * (1 - et), alpha: et }
        case "zoom-in":
            return { scaleX: 0.5 + 0.5 * et, scaleY: 0.5 + 0.5 * et, alpha: et }
        case "zoom-out":
            return { scaleX: 1.5 - 0.5 * et, scaleY: 1.5 - 0.5 * et, alpha: et }
        default:
            return {}
    }
}

export function computeTransitionOut(type, t, width, height) {
    const et = easeInOutCubic(t)
    switch (type) {
        case "fade":
            return { alpha: 1 - et }
        case "dissolve":
            return { alpha: (1 - et) * (1 - et) }
        case "wipe-left":
            return { maskProgress: 1 - et, maskDirection: "left" }
        case "wipe-right":
            return { maskProgress: 1 - et, maskDirection: "right" }
        case "wipe-up":
            return { maskProgress: 1 - et, maskDirection: "up" }
        case "wipe-down":
            return { maskProgress: 1 - et, maskDirection: "down" }
        case "slide-left":
            return { x: -width * et, alpha: 1 - et }
        case "slide-right":
            return { x: width * et, alpha: 1 - et }
        case "zoom-in":
            return { scaleX: 1 - 0.5 * et, scaleY: 1 - 0.5 * et, alpha: 1 - et }
        case "zoom-out":
            return { scaleX: 1 + 0.5 * et, scaleY: 1 + 0.5 * et, alpha: 1 - et }
        default:
            return {}
    }
}
