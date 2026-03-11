import { easeSinInOut } from "d3-ease"
import { interpolate } from "../../helpers"
import Animation from "../Animation"

export default class Click extends Animation {
    constructor(config, deps) {
        super(config.start, config.end)
        this.configure(config, deps)
    }

    onIntro(interpolator) {
        if (this.config.isActive)
            return { scale: interpolate(this.deps.cursorScale, this.deps.cursorScale * .75, interpolator, easeSinInOut) }
        else
            return { scale: this.deps.cursorScale }
    }

    onOutro(interpolator) {
        if (this.config.isActive)
            return { scale: interpolate(this.deps.cursorScale * .75, this.deps.cursorScale, interpolator, easeSinInOut) }
        else
            return { scale: this.deps.cursorScale }
    }

    onBetweenIntroAndOutro() {
        if (this.config.isActive)
            return { scale: this.deps.cursorScale * .75 }
        else
            return { scale: this.deps.cursorScale }
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