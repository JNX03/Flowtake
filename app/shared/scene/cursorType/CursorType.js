import { easeExpIn } from "d3-ease"
import { interpolate } from "../../sceneHelpers"
import Animation from "../Animation"

export default class CursorType extends Animation {
    constructor(config) {
        super(config.start, config.end)

        this.configure(config)
    }

    onIntro(interpolator) {
        return { alpha: interpolate(.5, 1, interpolator, easeExpIn), visible: true, type: this.config.type }
    }

    onOutro(interpolator) {
        return { alpha: interpolate(1, .5, interpolator), visible: true, type: this.config.type }
    }

    onBetweenIntroAndOutro() {
        return { alpha: 1, visible: true, type: this.config.type }
    }

    configure(config) {
        this.config = config
        this.start = config.start
        this.end = config.end
        this.intro = this.getAdjustedIntro(config.intro)
        this.outro = this.getAdjustedOutro(config.outro)
    }
}