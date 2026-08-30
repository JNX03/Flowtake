export const DEFAULT_PREVIEW_SNAP_THRESHOLD_PX = 8

const clampUnit = value => Math.max(0, Math.min(1, value))

const findAxisSnap = ({
    value,
    movingOffsets,
    targets,
    pixels,
    thresholdPx,
}) => {
    let best = null
    for (const moving of movingOffsets) {
        for (const target of targets) {
            const delta = target.value - (value + moving.offset)
            const distancePx = Math.abs(delta * pixels)
            if (distancePx > thresholdPx || (best && distancePx >= best.distancePx)) continue
            best = {
                distancePx,
                delta,
                target,
                moving: moving.kind,
            }
        }
    }
    return best
}

export function snapPreviewPosition({
    position,
    movingSize,
    containerSize,
    otherBounds = [],
    thresholdPx = DEFAULT_PREVIEW_SNAP_THRESHOLD_PX,
}) {
    const width = Math.max(1, Number(containerSize?.width) || 1)
    const height = Math.max(1, Number(containerSize?.height) || 1)
    const halfWidth = Math.max(0, Number(movingSize?.width) || 0) / width / 2
    const halfHeight = Math.max(0, Number(movingSize?.height) || 0) / height / 2
    const xTargets = [
        { value: 0, source: "canvas-left" },
        { value: 0.5, source: "canvas-center" },
        { value: 1, source: "canvas-right" },
    ]
    const yTargets = [
        { value: 0, source: "canvas-top" },
        { value: 0.5, source: "canvas-center" },
        { value: 1, source: "canvas-bottom" },
    ]

    for (const bounds of otherBounds) {
        xTargets.push(
            { value: bounds.left, source: bounds.id },
            { value: bounds.centerX, source: bounds.id },
            { value: bounds.right, source: bounds.id },
        )
        yTargets.push(
            { value: bounds.top, source: bounds.id },
            { value: bounds.centerY, source: bounds.id },
            { value: bounds.bottom, source: bounds.id },
        )
    }

    const xSnap = findAxisSnap({
        value: position.x,
        movingOffsets: [
            { offset: -halfWidth, kind: "left" },
            { offset: 0, kind: "center" },
            { offset: halfWidth, kind: "right" },
        ],
        targets: xTargets,
        pixels: width,
        thresholdPx,
    })
    const ySnap = findAxisSnap({
        value: position.y,
        movingOffsets: [
            { offset: -halfHeight, kind: "top" },
            { offset: 0, kind: "center" },
            { offset: halfHeight, kind: "bottom" },
        ],
        targets: yTargets,
        pixels: height,
        thresholdPx,
    })

    return {
        position: {
            x: clampUnit(position.x + (xSnap?.delta || 0)),
            y: clampUnit(position.y + (ySnap?.delta || 0)),
        },
        guides: [
            ...(xSnap ? [{
                axis: "x",
                value: xSnap.target.value,
                source: xSnap.target.source,
                moving: xSnap.moving,
            }] : []),
            ...(ySnap ? [{
                axis: "y",
                value: ySnap.target.value,
                source: ySnap.target.source,
                moving: ySnap.moving,
            }] : []),
        ],
    }
}
