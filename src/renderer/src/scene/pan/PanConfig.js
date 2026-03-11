import MouseEventAnimConfig from "../MouseEventAnimConfig"

export default class PanConfig extends MouseEventAnimConfig {
    constructor(args, defaultIntro, defaultOutro, defaultTargetScale) {
        super(args, defaultIntro, defaultOutro, defaultTargetScale, "pan")
        this.isManual = args.isManual ?? false
        this.focus = args.focus ?? { x: 0.5, y: 0.5 }
    }
}