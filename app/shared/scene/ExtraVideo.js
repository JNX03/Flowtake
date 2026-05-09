import {
    CanvasSource,
    Container,
    Graphics,
    Sprite,
    Texture
} from "pixi.js"
import CanvasWrapper from "./CanvasWrapper"

const PIP_WIDTH_RATIO = 0.25       // each extra video ~25% of stage width
const MARGIN = 16                  // px from edges
const STACK_GAP = 12               // px between stacked PiPs

/**
 * A picture-in-picture overlay for one extra-N.mp4 captured by the individual
 * app recording plugin. Each instance owns its own canvas + Pixi sprite, and
 * positions itself in the top-right stack based on its `index`.
 */
export default class ExtraVideo extends CanvasWrapper {
    constructor(dims, index) {
        super(dims)
        this.index = index
        this.rendererDims = null

        // Canvas → Pixi texture pipeline
        this.texture = new Texture({ source: new CanvasSource({ resource: this.canvas }) })

        this.sprite = new Sprite(this.texture)

        // Border + subtle outline so the PiP reads as its own surface
        this.border = new Graphics()
            .rect(0, 0, dims.x, dims.y)
            .stroke({ color: 0xFFFFFF, alpha: 0.12, width: 2 })

        this.outerContainer = new Container()
        this.outerContainer.label = `extra-video-${index}`
        this.outerContainer.zIndex = 50 + index   // above main screen, below camera (which is ~100+)
        this.outerContainer.visible = true

        // Inner container holds the sprite at native dims; outer container scales/positions.
        this.inner = new Container()
        this.inner.addChild(this.sprite)
        this.inner.addChild(this.border)
        this.outerContainer.addChild(this.inner)
    }

    drawFrame() {
        if (!this.content) return
        super.drawContent()
        this.texture.source.update()
    }

    setVisible(visible) {
        this.outerContainer.visible = !!visible
    }

    /** Lay this PiP out in the top-right of the renderer. */
    setRendererDims(rendererDims) {
        this.rendererDims = rendererDims
        if (!rendererDims) return
        const targetWidth = rendererDims.x * PIP_WIDTH_RATIO
        const scale = targetWidth / this.dims.x
        const scaledHeight = this.dims.y * scale

        this.inner.scale.set(scale)

        const x = rendererDims.x - targetWidth - MARGIN
        const y = MARGIN + this.index * (scaledHeight + STACK_GAP)
        this.outerContainer.position.set(x, y)
    }

    destroy() {
        this.outerContainer.removeFromParent?.()
        this.outerContainer.destroy({ children: true })
    }
}
