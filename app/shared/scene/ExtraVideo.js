import {
    CanvasSource,
    Container,
    Graphics,
    Sprite,
    Texture
} from "pixi.js"
import CanvasWrapper from "./CanvasWrapper"

const CORNER_PIP_RATIO = 0.22      // PiP size when used as a corner secondary in a scene
const MARGIN = 16                  // px from edges

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
        //   "default" — hidden (no scene block active = show only the main screen recording)
        //   "main"    — fills the canvas (focus-record mode)
        //   "corner"  — small PiP in one of 4 corners (for hybrid scenes)
        //   "hidden"  — explicitly hidden by a scene block
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
        // Either the user hid the track via Sources panel, or the role is
        // hidden/default — in both cases hide the container.
        const sceneVisible = this.role === "main" || this.role === "corner"
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
            // Focus-record: fill the entire canvas, preserving aspect ratio
            // (letterbox or pillarbox). Centered.
            const scaleX = r.x / this.dims.x
            const scaleY = r.y / this.dims.y
            const scale = Math.min(scaleX, scaleY)
            const w = this.dims.x * scale
            const h = this.dims.y * scale
            this.inner.scale.set(scale)
            this.outerContainer.position.set((r.x - w) / 2, (r.y - h) / 2)
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
        }
        // role === "default" or "hidden": no positioning needed, container is hidden
    }

    destroy() {
        this.outerContainer.removeFromParent?.()
        this.outerContainer.destroy({ children: true })
    }
}
