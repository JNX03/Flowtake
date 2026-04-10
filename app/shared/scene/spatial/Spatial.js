import { getEasingFunction, interpolate } from "../../sceneHelpers"
import Animation from "../Animation"

export default class Spatial extends Animation {
    constructor(config, deps) {
        super(config.start, config.end)
        this.configure(config, deps)
    }

    onIntro(interpolator) {
        const rotateX = interpolate(this.startRotateX, this.targetRotateX, interpolator, this.easingFn)
        const rotateY = interpolate(this.startRotateY, this.targetRotateY, interpolator, this.easingFn)
        const rotateZ = interpolate(this.startRotateZ, this.targetRotateZ, interpolator, this.easingFn)
        return { rotateX, rotateY, rotateZ, perspective: this.perspective, cameraDistance: this.cameraDistance, eyeContactEnabled: this.eyeContactEnabled }
    }

    onBetweenIntroAndOutro() {
        return { rotateX: this.targetRotateX, rotateY: this.targetRotateY, rotateZ: this.targetRotateZ,
            perspective: this.perspective, cameraDistance: this.cameraDistance, eyeContactEnabled: this.eyeContactEnabled }
    }

    onOutro(interpolator) {
        const rotateX = interpolate(this.targetRotateX, 0, interpolator, this.easingFn)
        const rotateY = interpolate(this.targetRotateY, 0, interpolator, this.easingFn)
        const rotateZ = interpolate(this.targetRotateZ, 0, interpolator, this.easingFn)
        return { rotateX, rotateY, rotateZ, perspective: this.perspective, cameraDistance: this.cameraDistance, eyeContactEnabled: this.eyeContactEnabled }
    }

    computeFrame(timestamp) {
        if (this.isIntro(timestamp))
            return this.onIntro(this.interpolatorIntro(timestamp))
        if (this.isBetweenIntroAndOutro(timestamp))
            return this.onBetweenIntroAndOutro()
        if (this.isOutro(timestamp))
            return this.onOutro(this.interpolatorOutro(timestamp))
    }

    configure(config, deps) {
        this.config = config
        this.deps = deps
        this.start = config.start
        this.end = config.end
        this.intro = this.getAdjustedIntro(config.intro)
        this.outro = config.end === this.deps.nextConfig?.start ? 0 : this.getAdjustedOutro(config.outro)
        this.startRotateX = config.start === this.deps.prevConfig?.end ? this.deps.prevConfig.rotateX : 0
        this.startRotateY = config.start === this.deps.prevConfig?.end ? this.deps.prevConfig.rotateY : 0
        this.startRotateZ = config.start === this.deps.prevConfig?.end ? this.deps.prevConfig.rotateZ : 0
        this.targetRotateX = config.rotateX
        this.targetRotateY = config.rotateY
        this.targetRotateZ = config.rotateZ
        this.perspective = config.perspective
        this.cameraDistance = config.cameraDistance
        this.eyeContactEnabled = config.eyeContactEnabled
        this.easingFn = getEasingFunction(config.easing)
    }
}
