import { Graphics } from "pixi.js"
import Animator from "../Animator.js"
import Click from "./Click.js"

export default class ClickAnimator extends Animator {
    constructor(cursor, cursorContainer) {
        super()

        this.cursorScale = null
        this.showClickRing = true
        this.cursor = cursor
        this.ringGraphic = new Graphics()
        this.ringGraphic.visible = false
        if (cursorContainer) cursorContainer.addChild(this.ringGraphic)
    }

    update(timestamp) {
        const frame = this.computeFrame(timestamp)
        this.cursor.scale.set(frame.scale)

        // Render click ring (respects global toggle)
        if (this.showClickRing && frame.ringProgress > 0 && frame.ringConfig?.enabled) {
            const { color, size, opacity, radiusProgress, alphaProgress } = frame.ringConfig
            const progress = frame.ringProgress
            const radius = size * (radiusProgress ?? progress)
            const alpha = opacity * (alphaProgress ?? (1 - progress))
            const strokeWidth = Math.max(1.5, 4 * (1 - progress))

            this.ringGraphic.clear()
            this.ringGraphic.circle(0, 0, radius)
            this.ringGraphic.stroke({ color, width: strokeWidth, alpha })
            this.ringGraphic.circle(0, 0, Math.max(2, size * 0.08) * (1 - progress))
            this.ringGraphic.fill({ color, alpha: alpha * 0.22 })
            this.ringGraphic.visible = alpha > 0.01
        } else {
            this.ringGraphic.visible = false
        }
    }

    setState({ cursorScale, configs, showClickRing }) {
        if (cursorScale !== undefined) this.cursorScale = cursorScale
        if (showClickRing !== undefined) this.showClickRing = showClickRing
        if (configs !== undefined) this.configs = configs
        this.configure()
    }

    configure() {
        if (!this.configs || this.cursorScale === null) return

        const deps = { cursorScale: this.cursorScale }

        const animsToAdd = this.getAnimsToAdd()
        this.addAnims(animsToAdd, Click, deps)

        const animsToRemove = this.getAnimsToRemove()
        this.removeAnims(animsToRemove)

        this.anims.sort((a, b) => a.start - b.start)

        const animsToConfigure = this.getAnimsToConfigure(deps)
        this.configureAnims(animsToConfigure, deps)
    }

    computeIdleFrame() {
        return { scale: this.cursorScale }
    }
}
