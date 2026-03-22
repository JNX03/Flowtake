import { easeSinInOut } from "d3-ease"
import { interpolate } from "../../helpers"
import Animation from "../Animation"

export default class Click extends Animation {
    constructor(config, deps) {
        super(config.start, config.end)
        this.configure(config, deps)
    }

    onIntro(interpolator) {
        const scaleAmount = this.config.scaleAmount ?? 0.75
        if (this.config.isActive)
            return {
                scale: interpolate(this.deps.cursorScale, this.deps.cursorScale * scaleAmount, interpolator, easeSinInOut),
                ringProgress: interpolator,
                ringConfig: this.getRingConfig()
            }
        else
            return { scale: this.deps.cursorScale, ringProgress: 0 }
    }

    onOutro(interpolator) {
        const scaleAmount = this.config.scaleAmount ?? 0.75
        if (this.config.isActive)
            return {
                scale: interpolate(this.deps.cursorScale * scaleAmount, this.deps.cursorScale, interpolator, easeSinInOut),
                ringProgress: 1 - interpolator,
                ringConfig: this.getRingConfig()
            }
        else
            return { scale: this.deps.cursorScale, ringProgress: 0 }
    }

    onBetweenIntroAndOutro() {
        const scaleAmount = this.config.scaleAmount ?? 0.75
        if (this.config.isActive)
            return {
                scale: this.deps.cursorScale * scaleAmount,
                ringProgress: 1,
                ringConfig: this.getRingConfig()
            }
        else
            return { scale: this.deps.cursorScale, ringProgress: 0 }
    }

    getRingConfig() {
        return {
            enabled: this.config.ringEnabled ?? true,
            color: this.config.ringColor ?? "#FFCC00",
            size: this.config.ringSize ?? 40,
            opacity: this.config.ringOpacity ?? 0.6,
        }
    }

    configure(config, deps) {
        this.config = config
        this.deps = deps
        this.start = config.start
        this.end = config.end
        this.intro = this.getAdjustedIntro(config.intro)
        this.outro = this.getAdjustedOutro(config.outro)
    }
}