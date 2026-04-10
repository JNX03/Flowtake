import {
    getCoords,
    interpolateCoords
} from "../../sceneHelpers"
import Animation from "../Animation"

export default class Pan extends Animation {
    constructor(config, deps, staticDeps) {
        super(config.start, config.end)

        this.staticDeps = staticDeps
        this.configure(config, deps)
    }

    onIntro(interpolator) {
        return { focus: interpolateCoords(this.introFrom, this.introTo, interpolator) }
    }

    onBetweenIntroAndOutro(timestamp) {
        if (this.config.isManual) {
            return { focus: { ...this.introTo } }
        } else {
            return { focus: getCoords(this.staticDeps.screenVideoDimensions, this.deps.videoDetails, timestamp, this.deps.coords, true) }
        }
    }

    onOutro() {
        return { focus: { ...this.outroFrom } }
    }

    configure(config, deps) {
        this.config = config
        this.deps = deps

        this.start = config.start
        this.end = config.end
        this.intro = this.getAdjustedIntro(config.intro)
        this.outro = config.end === this.deps.nextConfig?.start ? 0 : this.getAdjustedOutro(config.outro)

        if (config.isManual) {
            this.introTo = this.config.focus
        } else {
            this.introTo = getCoords(this.staticDeps.screenVideoDimensions, this.deps.videoDetails, this.start + this.intro, this.deps.coords, true)
        }

        if (config.start === this.deps.prevConfig?.end) {
            this.introFrom = this.deps.prevConfig.isManual
                ? this.deps.prevConfig.focus
                : getCoords(this.staticDeps.screenVideoDimensions, this.deps.videoDetails, this.config.start, this.deps.coords, true)
        } else {
            this.introFrom = this.introTo
        }

        if (config.isManual) {
            this.outroFrom = this.introTo
        } else {
            this.outroFrom = getCoords(this.staticDeps.screenVideoDimensions, this.deps.videoDetails, this.end - this.outro, this.deps.coords, true)
        }
    }
}