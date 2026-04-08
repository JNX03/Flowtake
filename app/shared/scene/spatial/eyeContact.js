// MediaPipe Face Mesh landmark indices
const LEFT_EYE_CENTER = [468, 469, 470, 471, 472] // left iris landmarks
const RIGHT_EYE_CENTER = [473, 474, 475, 476, 477] // right iris landmarks
const LEFT_EYE_CONTOUR = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
const RIGHT_EYE_CONTOUR = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]

// Maximum iris shift in pixels (prevents unnatural looking correction)
const MAX_SHIFT_PX = 4
// Feather radius as fraction of eye region size
const FEATHER_RATIO = 0.3

/**
 * Get center point from a set of landmark indices
 */
function getLandmarkCenter(landmarks, indices) {
    let x = 0, y = 0
    for (const i of indices) {
        x += landmarks[i].x
        y += landmarks[i].y
    }
    return { x: x / indices.length, y: y / indices.length }
}

/**
 * Get bounding box from a set of landmark indices
 */
function getLandmarkBounds(landmarks, indices, width, height) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const i of indices) {
        const px = landmarks[i].x * width
        const py = landmarks[i].y * height
        if (px < minX) minX = px
        if (py < minY) minY = py
        if (px > maxX) maxX = px
        if (py > maxY) maxY = py
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Apply eye contact correction to a canvas context.
 * Shifts iris positions toward the eye center to simulate direct camera gaze.
 *
 * @param {OffscreenCanvasRenderingContext2D} ctx - Canvas 2D context with the camera frame drawn
 * @param {Array} landmarks - MediaPipe face landmarks array (478 landmarks, normalized 0-1)
 * @param {number} width - Canvas width in pixels
 * @param {number} height - Canvas height in pixels
 */
export function applyEyeContactCorrection(ctx, landmarks, width, height) {
    if (!landmarks || landmarks.length < 478) return

    correctEye(ctx, landmarks, LEFT_EYE_CENTER, LEFT_EYE_CONTOUR, width, height)
    correctEye(ctx, landmarks, RIGHT_EYE_CENTER, RIGHT_EYE_CONTOUR, width, height)
}

function correctEye(ctx, landmarks, irisIndices, contourIndices, width, height) {
    const irisCenter = getLandmarkCenter(landmarks, irisIndices)
    const eyeCenter = getLandmarkCenter(landmarks, contourIndices)
    const eyeBounds = getLandmarkBounds(landmarks, contourIndices, width, height)

    // Calculate how far the iris needs to shift toward center (in normalized coords)
    const deltaX = (eyeCenter.x - irisCenter.x) * width
    const deltaY = (eyeCenter.y - irisCenter.y) * height

    // Clamp shift to avoid artifacts
    const shiftX = Math.max(-MAX_SHIFT_PX, Math.min(MAX_SHIFT_PX, deltaX))
    const shiftY = Math.max(-MAX_SHIFT_PX, Math.min(MAX_SHIFT_PX, deltaY))

    if (Math.abs(shiftX) < 0.5 && Math.abs(shiftY) < 0.5) return

    // Define the iris region to copy and shift
    const irisPx = irisCenter.x * width
    const irisPy = irisCenter.y * height
    const regionRadius = Math.max(eyeBounds.width, eyeBounds.height) * 0.4
    const featherRadius = regionRadius * FEATHER_RATIO

    const sx = Math.round(irisPx - regionRadius)
    const sy = Math.round(irisPy - regionRadius)
    const sw = Math.round(regionRadius * 2)
    const sh = Math.round(regionRadius * 2)

    if (sw <= 0 || sh <= 0 || sx < 0 || sy < 0 || sx + sw > width || sy + sh > height) return

    // Extract iris region
    const imageData = ctx.getImageData(sx, sy, sw, sh)

    // Create a temporary canvas for feathered compositing
    const tempCanvas = new OffscreenCanvas(sw, sh)
    const tempCtx = tempCanvas.getContext('2d')
    tempCtx.putImageData(imageData, 0, 0)

    // Draw shifted iris region with radial gradient mask for feathering
    ctx.save()

    // Create circular clip with soft edges
    ctx.beginPath()
    ctx.arc(irisPx, irisPy, regionRadius - featherRadius, 0, Math.PI * 2)
    ctx.clip()

    // Draw the shifted iris
    ctx.globalAlpha = 0.85
    ctx.drawImage(tempCanvas, sx + shiftX, sy + shiftY)

    ctx.restore()
}
