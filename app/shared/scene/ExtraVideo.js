import {
    CanvasSource,
    Container,
    Graphics,
    Sprite,
    Texture
} from "pixi.js"
import CanvasWrapper from "./CanvasWrapper"

const PIP_WIDTH_RATIO = 0.25       // each extra video ~25% of stage width
const CORNER_PIP_RATIO = 0.22      // PiP size when used as a corner secondary in a scene
const MAIN_WIDTH_RATIO = 0.78      // main app fills ~78% of canvas width
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

        // Scene role for the multi-app plugin's scene-block system.
        //   "default" — legacy top-right stack (positioned by index)
        //   "main"    — centered, large
        //   "corner"  — small PiP in one of 4 corners
        //   "hidden"  — visible = false
        this.role = "default"
        this.corner = "tr"
        this.userVisible = true   // global Sources panel toggle

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
        this.userVisible = !!visible
        this.applyVisibility()
    }

    applyVisibility() {
        // Either the user hid the track via Sources panel, or the active scene
        // block marked it hidden — in both cases hide the container.
        const sceneVisible = this.role !== "hidden"
        this.outerContainer.visible = this.userVisible && sceneVisible
    }

    setSceneRole(role, opts = {}) {
        this.role = role || "default"
        if (opts.corner) this.corner = opts.corner
        // Higher zIndex when "main" so it sits above corners.
        if (this.role === "main") this.outerContainer.zIndex = 80 + this.index
        else if (this.role === "corner") this.outerContainer.zIndex = 60 + this.index
        else this.outerContainer.zIndex = 50 + this.index
        this.layout()
        this.applyVisibility()
    }

    setRendererDims(rendererDims) {
        this.rendererDims = rendererDims
        this.layout()
    }

    layout() {
        const r = this.rendererDims
        if (!r) return
        const role = this.role
        if (role === "main") {
            const targetWidth = r.x * MAIN_WIDTH_RATIO
            const scale = targetWidth / this.dims.x
            const scaledHeight = this.dims.y * scale
            this.inner.scale.set(scale)
            const x = (r.x - targetWidth) / 2
            const y = (r.y - scaledHeight) / 2
            this.outerContainer.position.set(x, y)
        } else if (role === "corner") {
            const targetWidth = r.x * CORNER_PIP_RATIO
            const scale = targetWidth / this.dims.x
            const scaledHeight = this.dims.y * scale
            this.inner.scale.set(scale)
            const left = this.corner.endsWith("l")
            const top = this.corner.startsWith("t")
            const x = left ? MARGIN : r.x - targetWidth - MARGIN
            const y = top ? MARGIN : r.y - scaledHeight - MARGIN
            this.outerContainer.position.set(x, y)
        } else {
            // default: legacy top-right stack
            const targetWidth = r.x * PIP_WIDTH_RATIO
            const scale = targetWidth / this.dims.x
            const scaledHeight = this.dims.y * scale
            this.inner.scale.set(scale)
            const x = r.x - targetWidth - MARGIN
            const y = MARGIN + this.index * (scaledHeight + STACK_GAP)
            this.outerContainer.position.set(x, y)
        }
    }

    destroy() {
        this.outerContainer.removeFromParent?.()
        this.outerContainer.destroy({ children: true })
    }
}
