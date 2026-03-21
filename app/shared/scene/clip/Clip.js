import {
    MODE_CAMERA_FULLSCREEN,
    MODE_CAMERA_OVERLAY,
    MODE_SCREEN_FULLSCREEN,
    MODE_SIDE_BY_SIDE
} from "../../constants"
import {
    cropToCenteredRect,
    interpolate,
    interpolateCoords,
    interpolateRect
} from "../../helpers"
import Animation from "../Animation"
import { CAMERA_OFFSET } from "./ClipAnimator"

const SIDE_BY_SIDE_SCREEN_SPACE = .7
const SIDE_BY_SIDE_CAMERA_SPACE = 1 - SIDE_BY_SIDE_SCREEN_SPACE
const SIDE_BY_SIDE_OFFSET = .05

export default class Clip extends Animation {
    constructor(config, deps, staticDeps) {
        super(config.start, config.end)
        this.staticDeps = staticDeps
        this.deps = null
        this.configure(config, deps)
    }

    configure(config, deps) {
        this.config = config
        this.deps = deps

        const { start, end, intro, layout } = config

        this.start = start
        this.end = end
        this.intro = this.deps.prevAnim ? this.getAdjustedIntro(intro) : 0

        this.layout = layout

        this.fromCameraAlpha = this.deps.prevAnim?.toCameraAlpha ?? 1

        const isCameraVisible = this.deps.prevAnim?.layoutMode !== MODE_SCREEN_FULLSCREEN

        // If transitioning from fullscreen-screen, use target scale right away
        this.fromCameraPosition = isCameraVisible
            ? { ...this.getTargetCameraPosition(), ...this.deps.prevAnim?.toCameraPosition }
            : this.getTargetCameraPosition()

        this.fromCameraMask = isCameraVisible
            ? { ...this.getTargetCameraMask(), ...this.deps.prevAnim?.toCameraMask }
            : this.getTargetCameraMask()

        this.fromCameraPivot = isCameraVisible
            ? { ...this.getTargetCameraPivot(), ...this.deps.prevAnim?.toCameraPivot }
            : this.getTargetCameraPivot()

        this.fromCameraFullscreenWeight = this.deps.prevAnim?.toCameraFullscreenWeight ?? this.getTargetCameraFullscreenWeight()

        this.fromCameraBaseScale = this.deps.prevAnim?.toCameraBaseScale ?? this.getTargetCameraBaseScale()

        this.fromScreenCell = this.deps.prevAnim?.toScreenCell ?? this.getTargetScreenCell()

        this.toCameraPosition = this.layout.mode === MODE_SCREEN_FULLSCREEN
            ? this.deps.prevAnim?.toCameraPosition ?? this.getTargetCameraPosition()
            : this.getTargetCameraPosition()

        this.toCameraPivot = this.layout.mode === MODE_SCREEN_FULLSCREEN
            ? this.deps.prevAnim?.toCameraPivot ?? this.getTargetCameraPivot()
            : this.getTargetCameraPivot()

        this.toCameraBaseScale = this.getTargetCameraBaseScale()

        this.toCameraMask = this.layout.mode === MODE_SCREEN_FULLSCREEN
            ? { ...this.getTargetCameraMask(), ...this.deps.prevAnim?.toCameraMask }
            : this.getTargetCameraMask()

        this.toCameraFullscreenWeight = this.getTargetCameraFullscreenWeight()

        this.toCameraAlpha = this.getTargetCameraAlpha()

        this.toScreenCell = this.getTargetScreenCell()
    }

    onIntro(interpolator) {
        return {
            cameraPosition: this.staticDeps.hasCameraVideo ? interpolateCoords(this.fromCameraPosition, this.toCameraPosition, interpolator) : null,
            cameraPivot: this.staticDeps.hasCameraVideo ? interpolateCoords(this.fromCameraPivot, this.toCameraPivot, interpolator) : null,
            cameraMask: this.staticDeps.hasCameraVideo ? interpolateRect(this.fromCameraMask, this.toCameraMask, interpolator) : null,
            cameraFullscreenWeight: interpolate(this.fromCameraFullscreenWeight, this.toCameraFullscreenWeight, interpolator),
            cameraBaseScale: this.staticDeps.hasCameraVideo ? interpolate(this.fromCameraBaseScale, this.toCameraBaseScale, interpolator) : null,
            cameraAlpha: this.staticDeps.hasCameraVideo ? interpolate(this.fromCameraAlpha, this.toCameraAlpha, interpolator) : null,
            screenCell: interpolateRect(this.fromScreenCell, this.toScreenCell, interpolator),
        }
    }

    onBetweenIntroAndOutro() {
        return {
            cameraPosition: this.staticDeps.hasCameraVideo ? this.toCameraPosition : null,
            cameraPivot: this.staticDeps.hasCameraVideo ? this.toCameraPivot : null,
            cameraMask: this.staticDeps.hasCameraVideo ? this.toCameraMask : null,
            cameraFullscreenWeight: this.toCameraFullscreenWeight,
            cameraBaseScale: this.staticDeps.hasCameraVideo ? this.toCameraBaseScale : null,
            cameraAlpha: this.staticDeps.hasCameraVideo ? this.toCameraAlpha : null,
            screenCell: this.toScreenCell,
        }
    }

    getTargetCameraPosition() {
        if (!this.staticDeps.hasCameraVideo) return null
        switch (this.layout.mode) {
            case MODE_CAMERA_OVERLAY: {
                const offset = this.deps.rendererDims.x * CAMERA_OFFSET
                return {
                    x: offset + this.layout.config.cameraPosition.x * (this.deps.rendererDims.x - offset * 2),
                    y: offset + this.layout.config.cameraPosition.y * (this.deps.rendererDims.y - offset * 2)
                }
            }
            case MODE_SIDE_BY_SIDE: {
                const box = this.getSideBySideCameraCell()
                switch (this.layout.config.cameraPosition) {
                    case "left": return { x: box.x, y: this.deps.rendererDims.y * .5 }
                    case "right": return { x: box.x + box.width, y: this.deps.rendererDims.y * .5 }
                    case "top": return { x: this.deps.rendererDims.x * .5, y: box.y }
                    case "bottom": return { x: this.deps.rendererDims.x * .5, y: box.y + box.height }
                }
                break
            }
            default: return { x: .5 * this.deps.rendererDims.x, y: .5 * this.deps.rendererDims.y }
        }
    }

    getTargetCameraPivot() {
        if (!this.staticDeps.hasCameraVideo) return null
        switch (this.layout.mode) {
            case MODE_CAMERA_OVERLAY: {
                const pivotOffset = (this.staticDeps.cameraVideoDims.x - this.staticDeps.cameraVideoDims.y) * .5
                return {
                    x: pivotOffset + this.layout.config.cameraPosition.x * (this.staticDeps.cameraVideoDims.x - pivotOffset * 2),
                    y: this.layout.config.cameraPosition.y * this.staticDeps.cameraVideoDims.y
                }
            }
            case MODE_SIDE_BY_SIDE: {
                const cropParams = cropToCenteredRect(
                    this.getSideBySideCameraCell(),
                    { width: this.staticDeps.cameraVideoDims.x, height: this.staticDeps.cameraVideoDims.y })
                switch (this.layout.config.cameraPosition) {
                    case "left": return { x: cropParams.x, y: .5 * cropParams.height }
                    case "right": return { x: cropParams.x + cropParams.width, y: .5 * cropParams.height }
                    case "top": return { x: cropParams.x + .5 * cropParams.width, y: cropParams.y }
                    case "bottom": return { x: cropParams.x + .5 * cropParams.width, y: cropParams.y + cropParams.height }
                }
                break
            }
            default: return { x: .5 * this.staticDeps.cameraVideoDims.x, y: .5 * this.staticDeps.cameraVideoDims.y }
        }
    }

    getTargetCameraMask() {
        if (!this.staticDeps.hasCameraVideo) return null
        switch (this.layout.mode) {
            case MODE_CAMERA_OVERLAY:
                return cropToCenteredRect(
                    { width: 1, height: 1 },
                    { width: this.staticDeps.cameraVideoDims.x, height: this.staticDeps.cameraVideoDims.y },
                    this.layout.config.cameraBorderRadius
                )
            case MODE_CAMERA_FULLSCREEN:
                return cropToCenteredRect(
                    { width: this.deps.rendererDims.x, height: this.deps.rendererDims.y },
                    { width: this.staticDeps.cameraVideoDims.x, height: this.staticDeps.cameraVideoDims.y },
                    0
                )
            case MODE_SCREEN_FULLSCREEN:
                return cropToCenteredRect(
                    { width: this.deps.rendererDims.x, height: this.deps.rendererDims.y },
                    { width: this.staticDeps.cameraVideoDims.x, height: this.staticDeps.cameraVideoDims.y },
                    0
                )
            case MODE_SIDE_BY_SIDE:
                return cropToCenteredRect(
                    this.getSideBySideCameraCell(),
                    { width: this.staticDeps.cameraVideoDims.x, height: this.staticDeps.cameraVideoDims.y },
                    this.layout.config.cameraBorderRadius
                )
        }
    }

    getTargetCameraFullscreenWeight() {
        switch (this.layout.mode) {
            case MODE_CAMERA_FULLSCREEN: return 1
            default: return 0
        }
    }

    getTargetCameraBaseScale() {
        if (!this.staticDeps.hasCameraVideo) return null
        switch (this.layout.mode) {
            case MODE_CAMERA_OVERLAY: {
                const { width: cameraMaskWidth, height: cameraMaskHeight } = cropToCenteredRect(
                    { width: 1, height: 1 },
                    { width: this.staticDeps.cameraVideoDims.x, height: this.staticDeps.cameraVideoDims.y },
                    this.layout.config.cameraBorderRadius
                )
                // scale so that camera mask fits fully into renderer (content fit)
                if (this.deps.rendererDims.x / this.deps.rendererDims.y > cameraMaskWidth / cameraMaskHeight)
                    return this.layout.config.cameraBaseScale * this.deps.rendererDims.y / cameraMaskHeight
                else
                    return this.layout.config.cameraBaseScale * this.deps.rendererDims.x / cameraMaskWidth
            }
            case MODE_CAMERA_FULLSCREEN: return 1
            case MODE_SCREEN_FULLSCREEN: return .2
            case MODE_SIDE_BY_SIDE: {
                const cell = this.getSideBySideCameraCell()
                const cameraMask = cropToCenteredRect(cell,
                    { width: this.staticDeps.cameraVideoDims.x, height: this.staticDeps.cameraVideoDims.y })

                return cell.width / cameraMask.width
            }
        }
    }

    getTargetCameraAlpha() {
        if (!this.staticDeps.hasCameraVideo) return null
        switch (this.layout.mode) {
            case MODE_SCREEN_FULLSCREEN: return 0
            default: return 1
        }
    }

    getTargetScreenCell() {
        switch (this.layout.mode) {
            case MODE_SIDE_BY_SIDE: return this.getSideBySideScreenCell()
            default: {
                return {
                    x: this.deps.rendererDims.x * (1 - this.deps.maxScale) * .5,
                    y: this.deps.rendererDims.y * (1 - this.deps.maxScale) * .5,
                    width: this.deps.rendererDims.x * this.deps.maxScale,
                    height: this.deps.rendererDims.y * this.deps.maxScale
                }
            }
        }
    }

    getSideBySideCameraCell() {
        // use shorter side as reference for even offset on each side
        const offsetPx = SIDE_BY_SIDE_OFFSET * Math.min(this.deps.rendererDims.x, this.deps.rendererDims.y)
        const gapPx = offsetPx * .5

        const { cameraPosition } = this.layout.config

        const cell = {}

        if (this.isHorizontalLayout()) {
            if (cameraPosition === "left")
                cell.x = offsetPx
            else if (cameraPosition === "right")
                cell.x = SIDE_BY_SIDE_SCREEN_SPACE * this.deps.rendererDims.x + gapPx
            cell.y = offsetPx
            cell.width = SIDE_BY_SIDE_CAMERA_SPACE * this.deps.rendererDims.x - gapPx - offsetPx
            cell.height = this.deps.rendererDims.y - cell.y - offsetPx
        } else {
            if (cameraPosition === "top")
                cell.y = offsetPx
            else if (cameraPosition === "bottom")
                cell.y = SIDE_BY_SIDE_SCREEN_SPACE * this.deps.rendererDims.y + gapPx
            cell.x = offsetPx
            cell.width = this.deps.rendererDims.x - cell.x - offsetPx
            cell.height = SIDE_BY_SIDE_CAMERA_SPACE * this.deps.rendererDims.y - gapPx - offsetPx
        }

        return cell
    }

    getSideBySideScreenCell() {
        // use height as reference for even offset on each side
        const offsetPx = SIDE_BY_SIDE_OFFSET * Math.min(this.deps.rendererDims.x, this.deps.rendererDims.y)
        const gapPx = offsetPx * .5
        const padding = (1 - this.deps.maxScale) * .5

        const { cameraPosition } = this.layout.config

        const cell = {}

        if (this.isHorizontalLayout()) {
            const full = {
                width: SIDE_BY_SIDE_SCREEN_SPACE * this.deps.rendererDims.x - gapPx - offsetPx,
                height: this.deps.rendererDims.y - gapPx - offsetPx
            }
            cell.width = full.width * this.deps.maxScale
            cell.height = full.height * this.deps.maxScale
            if (cameraPosition === "left")
                cell.x = SIDE_BY_SIDE_CAMERA_SPACE * this.deps.rendererDims.x + gapPx
            else if (cameraPosition === "right")
                cell.x = offsetPx
            cell.x += full.width * padding
            cell.y = offsetPx + full.height * padding
        } else {
            const full = {
                width: this.deps.rendererDims.x - gapPx - offsetPx,
                height: SIDE_BY_SIDE_SCREEN_SPACE * this.deps.rendererDims.y - gapPx - offsetPx
            }
            cell.width = full.width * this.deps.maxScale
            cell.height = full.height * this.deps.maxScale
            if (cameraPosition === "top")
                cell.y = SIDE_BY_SIDE_CAMERA_SPACE * this.deps.rendererDims.y + gapPx
            else if (cameraPosition === "bottom")
                cell.y = offsetPx
            cell.x = offsetPx + full.width * padding
            cell.y += full.height * padding
        }

        return cell
    }

    isHorizontalLayout() {
        const { mode, config } = this.layout
        return mode !== MODE_SIDE_BY_SIDE || config.cameraPosition === "left" || config.cameraPosition === "right"
    }
}
