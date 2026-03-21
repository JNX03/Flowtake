import MouseEventAnimConfig from "../MouseEventAnimConfig"

export default class ZoomConfig extends MouseEventAnimConfig {
    constructor(args, defaultIntro, defaultOutro, defaultTargetScale, defaultBlurStrength) {
        super(args, defaultIntro, defaultOutro, defaultTargetScale, "zoom")
        this.blurStrength = args.blurStrength ?? defaultBlurStrength
    }
}