// Shared cursor preset drawing for CursorAnimator and DrawnMouseAnimator.
// Sizes are in scene-pixel units; callers control scale via their own container.

export function hexStringToInt(hex) {
    if (typeof hex !== "string") return 0xFFFFFF
    const stripped = hex.startsWith("#") ? hex.slice(1) : hex
    const n = parseInt(stripped, 16)
    return Number.isFinite(n) ? n : 0xFFFFFF
}

export function drawPreset(g, preset, colorHex) {
    if (!g) return
    const color = hexStringToInt(colorHex)
    g.clear()
    switch (preset) {
        case "arrow":
            g.poly([0, 0, 0, 28, 8, 22, 13, 32, 17, 30, 12, 21, 20, 21])
                .fill({ color, alpha: 1 })
                .stroke({ color: 0xffffff, alpha: 0.85, width: 1.2 })
            break
        case "pointer":
            g.poly([4, 0, 4, 22, 8, 19, 12, 28, 16, 26, 12, 18, 18, 18])
                .fill({ color, alpha: 1 })
                .stroke({ color: 0xffffff, alpha: 0.85, width: 1.2 })
            g.circle(11, 11, 3).stroke({ color: 0xffffff, alpha: 0.6, width: 1 })
            break
        case "dot":
            g.circle(0, 0, 8).fill({ color, alpha: 0.9 })
            g.circle(0, 0, 8).stroke({ color: 0xffffff, alpha: 0.85, width: 1.5 })
            break
        case "ring":
            g.circle(0, 0, 12).stroke({ color, alpha: 1, width: 3 })
            g.circle(0, 0, 4).fill({ color, alpha: 0.9 })
            break
        case "target":
            g.circle(0, 0, 14).stroke({ color, alpha: 0.9, width: 2 })
            g.moveTo(-18, 0).lineTo(-6, 0).stroke({ color, alpha: 0.9, width: 2 })
            g.moveTo(6, 0).lineTo(18, 0).stroke({ color, alpha: 0.9, width: 2 })
            g.moveTo(0, -18).lineTo(0, -6).stroke({ color, alpha: 0.9, width: 2 })
            g.moveTo(0, 6).lineTo(0, 18).stroke({ color, alpha: 0.9, width: 2 })
            g.circle(0, 0, 2).fill({ color, alpha: 1 })
            break
        case "agent":
            g.circle(0, 0, 18).stroke({ color, alpha: 0.45, width: 2 })
            g.circle(0, 0, 12).stroke({ color, alpha: 0.85, width: 2.5 })
            g.circle(0, 0, 4).fill({ color, alpha: 1 })
            break
        default:
            break
    }
}
