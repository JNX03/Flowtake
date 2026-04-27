import { DropShadowFilter } from "pixi-filters/drop-shadow"
import { CanvasSource, Container, Graphics, Sprite, Texture } from "pixi.js"
import shallowEqual from "../shallowEqual"
import CanvasWrapper from "./CanvasWrapper"

export default class Screen extends CanvasWrapper {

    constructor(dims, screen, cursorContainer) {
        super(dims)

        this.trim = { left: null, right: null, top: null, bottom: null }
        this.borderRadius = null
        this.rendererDims = null

        this.fg = new Sprite(new Texture({ source: new CanvasSource({ resource: this.canvas }) }))

        this.fg.position.set(screen.width * 0.5, screen.height * 0.5)
        this.fg.mask = new Graphics()

        this.fg.pivot.set(dims.x * 0.5, dims.y * 0.5)
        this.fg.position.set(dims.x * 0.5, dims.y * 0.5)
        this.fg.width = dims.x
        this.fg.height = dims.y

        this.container = new Container()
        this.container.label = "screen-video"
        this.container.zIndex = 1
        this.shadow = new DropShadowFilter({ offsetX: 0, offsetY: 0, blur: 10, quality: 10 })
        this.shadow.padding = 50
        this.container.filters = [this.shadow]
        
        this.maskContainer = new Container()

        this.container.addChild(this.fg)
        this.container.addChild(this.maskContainer)
        this.container.addChild(cursorContainer)
        this.container.addChild(this.fg.mask)
    }

    drawFrame() {
        if (this.content) {
            this.drawContent()
            this.fg.texture.source.update()
        }
    }

    setState({ rendererDims, leftTrim, rightTrim, topTrim, bottomTrim, borderRadius, shadowAlpha }) {
        let isMaskDirty = false

        if (shadowAlpha !== undefined) this.shadow.alpha = shadowAlpha

        if (rendererDims !== undefined && !shallowEqual(this.rendererDims, rendererDims)) {
            this.rendererDims = rendererDims
            this.shadow.blur = this.rendererDims.y * 0.02
            this.shadow.padding = this.rendererDims.y * 0.1
        }

        if (leftTrim !== undefined && this.trim.left !== leftTrim) {
            this.trim.left = leftTrim
            isMaskDirty = true
        }

        if (rightTrim !== undefined && this.trim.right !== rightTrim) {
            this.trim.right = rightTrim
            isMaskDirty = true
        }

        if (topTrim !== undefined && this.trim.top !== topTrim) {
            this.trim.top = topTrim
            isMaskDirty = true
        }

        if (bottomTrim !== undefined && this.trim.bottom !== bottomTrim) {
            this.trim.bottom = bottomTrim
            isMaskDirty = true
        }

        if (borderRadius !== undefined && this.borderRadius !== borderRadius) {
            this.borderRadius = borderRadius
            isMaskDirty = true
        }

        if (isMaskDirty) this.configureMask()
    }

    configureMask() {
        const width = this.dims.x - this.trim.left - this.trim.right
        const height = this.dims.y - this.trim.top - this.trim.bottom
        this.fg.mask.clear()
        this.fg.mask.roundRect(this.trim.left, this.trim.top, width, height, this.borderRadius)
        this.fg.mask.fill({ color: 0x000000 })
    }
}
