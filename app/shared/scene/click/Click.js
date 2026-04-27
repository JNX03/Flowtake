import {
    easeBackOut,
    easeCubicIn,
    easeCubicOut
} from "d3-ease"
import { interpolate } from "../../sceneHelpers.js"
import Animation from "../Animation.js"

const clamp01 = value => Math.min(Math.max(value, 0), 1)

export default class Click extends Animation {
    constructor(config, deps) {
        super(config.start, config.end)
        this.configure(config, deps)
    }

    computeFrame(timestamp) {
        if (!this.config.isActive || timestamp < this.start || timestamp > this.end)
            return this.computeIdleFrame()

        const elapsed = timestamp - this.start
        const scaleAmount = this.config.scaleAmount ?? 0.82
        const pressedScale = this.deps.cursorScale * scaleAmount
        const releaseProgress = clamp01((elapsed - this.pressDuration) / this.releaseDuration)
        const ringProgress = clamp01(elapsed / this.ringDuration)

        const scale = elapsed < this.pressDuration
            ? interpolate(this.deps.cursorScale, pressedScale, clamp01(elapsed / this.pressDuration), easeCubicOut)
            : interpolate(pressedScale, this.deps.cursorScale, releaseProgress, easeBackOut)

        return {
            scale,
            ringProgress,
            ringConfig: this.getRingConfig(ringProgress)
        }
    }

    computeIdleFrame() {
        return { scale: this.deps.cursorScale, ringProgress: 0 }
    }

    getRingConfig(progress) {
        return {
            enabled: this.config.ringEnabled ?? true,
            color: this.config.ringColor ?? "#FFCC00",
            size: this.config.ringSize ?? 52,
            opacity: this.config.ringOpacity ?? 0.72,
            radiusProgress: easeCubicOut(progress),
            alphaProgress: 1 - easeCubicIn(progress),
        }
    }

    configure(config, deps) {
        this.config = config
        this.deps = deps
        this.start = config.start
        this.end = config.end
        this.intro = this.getAdjustedIntro(config.intro)
        this.outro = this.getAdjustedOutro(config.outro)
        const duration = Math.max(this.end - this.start, 1)
        this.pressDuration = Math.min(this.intro || 80, duration * 0.45)
        this.releaseDuration = Math.min(this.outro || 180, Math.max(duration - this.pressDuration, 1))
        this.ringDuration = Math.max(this.end - this.start, 1)
    }
}
