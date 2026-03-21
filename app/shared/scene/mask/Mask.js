import { BackdropBlurFilter } from "pixi-filters"
import {
    Container,
    Graphics,
    Rectangle,
    Sprite,
    Texture
} from "pixi.js"
import Animation from "../Animation"

export default class Mask extends Animation {
    constructor(config, deps, staticDeps) {
        super(config.start, config.end)

        this.staticDeps = staticDeps

        this.container = new Container()

        this.sprite = new Sprite({
            texture: Texture.WHITE,
            filters: [new BackdropBlurFilter({ quality: 12 })],
            width: this.staticDeps.screenVideoDimensions.x,
            height: this.staticDeps.screenVideoDimensions.y,
            mask: new Graphics(),
            // add a filterArea to fix behavior at the edges
            // https://github.com/pixijs/filters/pull/446#issuecomment-1982107101
            filterArea: new Rectangle(
                -this.staticDeps.screenVideoDimensions.x / 2,
                -this.staticDeps.screenVideoDimensions.y / 2,
                this.staticDeps.screenVideoDimensions.x,
                this.staticDeps.screenVideoDimensions.y
            )
        })

        this.configure(config, deps)

        this.container.addChild(this.sprite)
        this.container.addChild(this.sprite.mask)

        this.staticDeps.container.addChild(this.container)
    }

    onBeforeApply() {
        this.container.visible = false
    }

    onBetweenIntroAndOutro() {
        this.container.visible = true
        this.sprite.filters[0].strength =
            this.blurStrength * this.rendererDims.y * this.staticDeps.screenVideoContainer.height * 0.0001
    }

    configure(config, deps) {

        this.config = config
        this.deps = deps

        const { start, end, left, right, top, bottom, alpha, blurStrength, borderRadius, fill } = config

        this.rendererDims = this.deps.rendererDims
        this.blurStrength = blurStrength

        this.sprite.tint = fill
        this.sprite.alpha = alpha

        if (this.left !== left || this.right !== right || this.top !== top || this.bottom !== bottom
            || this.borderRadius !== borderRadius) {
            this.sprite.mask.clear()
            this.sprite.mask.roundRect(
                left,
                top,
                this.staticDeps.screenVideoDimensions.x - right - left,
                this.staticDeps.screenVideoDimensions.y - bottom - top,
                borderRadius
            )
            this.sprite.mask.fill({ color: 0x000000 })
        }

        this.start = start
        this.end = end
        this.left = left
        this.right = right
        this.top = top
        this.bottom = bottom
        this.borderRadius = borderRadius
    }

    destroy() {
        this.container.removeFromParent()
        this.container.destroy({ children: true, texture: true, textureSource: true, context: true })
    }
}