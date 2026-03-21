import AnimConfig from "../AnimConfig"

export default class MaskConfig extends AnimConfig {
    constructor(args, defaultBlurStrength, defaultAlpha, defaultBorderRadius, defaultFill) {
        super(args, "mask")

        this.left = args.left ?? 0
        this.right = args.right ?? 0
        this.top = args.top ?? 0
        this.bottom = args.bottom ?? 0

        this.blurStrength = args.blurStrength ?? defaultBlurStrength
        this.alpha = args.alpha ?? defaultAlpha
        this.borderRadius = args.borderRadius ?? defaultBorderRadius
        this.fill = args.fill ?? defaultFill

        this.row = args.row ?? 0
    }
}