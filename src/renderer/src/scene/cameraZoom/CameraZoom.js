import { easeLinear } from "d3-ease"
import {
    getFullScreenScale,
    interpolate
} from "../../helpers"
import Animation from "../Animation"

export default class CameraZoom extends Animation {
    constructor(config, deps, staticDeps) {
        super(config.start, config.end)

        this.staticDeps = staticDeps
        this.fromScale = null

        this.configure(config, deps)
    }

    onIntro(interpolator, _timestamp, clipFrame) {
        const { cameraFullscreenWeight, cameraBaseScale } = clipFrame
        const scale = interpolate(this.startScale, this.targetScale, interpolator) * cameraBaseScale
        const fullScreenScale = getFullScreenScale(this.staticDeps.cameraVideoDims, this.deps.rendererDims)
        return { scale: interpolate(scale, fullScreenScale, cameraFullscreenWeight, easeLinear) }
    }

    onBetweenIntroAndOutro(_timestamp, clipFrame) {
        const { cameraFullscreenWeight, cameraBaseScale } = clipFrame
        const scale = this.targetScale * cameraBaseScale
        const fullScreenScale = getFullScreenScale(this.staticDeps.cameraVideoDims, this.deps.rendererDims)
        return { scale: interpolate(scale, fullScreenScale, cameraFullscreenWeight, easeLinear) }
    }

    onOutro(interpolator, _timestamp, clipFrame) {
        const { cameraFullscreenWeight, cameraBaseScale } = clipFrame
        const scale = interpolate(this.targetScale, 1, interpolator) * cameraBaseScale
        const fullScreenScale = getFullScreenScale(this.staticDeps.cameraVideoDims, this.deps.rendererDims)
        return { scale: interpolate(scale, fullScreenScale, cameraFullscreenWeight, easeLinear) }
    }

    computeFrame(timestamp, _prevFrame, clipFrame) {
        if (this.isIntro(timestamp)) return this.onIntro(this.interpolatorIntro(timestamp), timestamp, clipFrame)
        if (this.isBetweenIntroAndOutro(timestamp)) return this.onBetweenIntroAndOutro(timestamp, clipFrame)
        if (this.isOutro(timestamp)) return this.onOutro(this.interpolatorOutro(timestamp), timestamp, clipFrame)
    }

    configure(config, deps) {
        this.config = config
        this.deps = deps
        this.start = config.start
        this.end = config.end
        this.intro = this.getAdjustedIntro(config.intro)
        this.outro = config.end === deps.nextConfig?.start ? 0 : this.getAdjustedOutro(config.outro)
        this.startScale = config.start === deps.prevConfig?.end ? deps.prevConfig.targetScale : 1
        this.targetScale = config.targetScale
    }
}