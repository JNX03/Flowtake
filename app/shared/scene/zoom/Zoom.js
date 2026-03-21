import { interpolate } from "../../helpers"
import Animation from "../Animation"

export default class Zoom extends Animation {
    constructor(config, deps) {
        super(config.start, config.end)
        this.configure(config, deps)
    }

    onIntro(interpolator, _timestamp, prevInterpolator, idleScale) {
        const scale = interpolate(this.startScale, this.targetScale, interpolator)

        const prevScale = interpolate(this.startScale, this.targetScale, prevInterpolator)
        const blurStrength = Math.abs(scale - prevScale) * this.blurStrength

        return { scale: scale * idleScale, blurStrength }
    }

    onBetweenIntroAndOutro(_timestamp, idleScale) {
        const scale = this.targetScale
        return { scale: scale * idleScale, blurStrength: 0 }
    }

    onOutro(interpolator, _timestamp, prevInterpolator, idleScale) {
        const scale = interpolate(this.targetScale, 1, interpolator)

        const prevScale = interpolate(this.targetScale, 1, prevInterpolator)
        const blurStrength = Math.abs(prevScale - scale) * this.blurStrength

        return { scale: scale * idleScale, blurStrength }
    }

    computeFrame(timestamp, idleScale) {
        if (this.isIntro(timestamp))
            return this.onIntro(this.interpolatorIntro(timestamp), timestamp,
                this.interpolatorIntro(Math.max(timestamp - 1000 / 60, this.start)), idleScale)
        if (this.isBetweenIntroAndOutro(timestamp))
            return this.onBetweenIntroAndOutro(timestamp, idleScale)
        if (this.isOutro(timestamp))
            return this.onOutro(this.interpolatorOutro(timestamp), timestamp,
                this.interpolatorOutro(Math.max(timestamp - 1000 / 60, this.end - this.outro)), idleScale)
    }

    configure(config, deps) {
        this.config = config
        this.deps = deps
        this.start = config.start
        this.end = config.end
        this.intro = this.getAdjustedIntro(config.intro)
        this.outro = config.end === this.deps.nextConfig?.start ? 0 : this.getAdjustedOutro(config.outro)
        this.startScale = config.start === this.deps.prevConfig?.end ? this.deps.prevConfig.targetScale : 1
        this.targetScale = config.targetScale
        this.blurStrength = config.blurStrength
        this.scale = this.startScale
    }
}