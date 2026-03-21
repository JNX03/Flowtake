import Animator from "../Animator"
import Zoom from "./Zoom"

export default class ZoomAnimator extends Animator {
    constructor(sprite, container, blur, screenVideoDimensions) {
        super()

        this.trim = {
            left: null,
            right: null,
            top: null,
            bottom: null
        }

        this.sprite = sprite
        this.container = container
        this.blur = blur
        this.screenVideoDimensions = screenVideoDimensions
    }

    update(timestamp, clipFrame) {
        if (this.trim.left === null || this.trim.right === null || this.trim.top === null || this.trim.bottom === null || !clipFrame) return null

        const idleScale = this.getIdleScale(clipFrame)
        const frame = this.computeFrame(timestamp, idleScale)
        this.container.scale.set(frame.scale)
        this.blur.strength = frame.blurStrength
    }

    setState({ leftTrim, rightTrim, topTrim, bottomTrim, configs }) {
        if (configs !== undefined) this.configs = configs

        if (leftTrim !== undefined) this.trim.left = leftTrim
        if (rightTrim !== undefined) this.trim.right = rightTrim
        if (topTrim !== undefined) this.trim.top = topTrim
        if (bottomTrim !== undefined) this.trim.bottom = bottomTrim

        this.configure()
    }

    configure() {
        if (!this.configs) return

        const deps = {}

        const animsToAdd = this.getAnimsToAdd()
        this.addAnims(animsToAdd, Zoom, deps, null, true, true)

        const animsToRemove = this.getAnimsToRemove()
        this.removeAnims(animsToRemove)

        this.anims.sort((a, b) => a.start - b.start)

        const animsToConfigure = this.getAnimsToConfigure(deps, true, true)
        this.configureAnims(animsToConfigure, deps, true, true)
    }

    computeIdleFrame(_timestamp, idleScale) {
        return { scale: idleScale, blurStrength: 0 }
    }

    computeFrame(timestamp, idleScale) {
        const anim = this.getAnim(timestamp, this.anims)
        if (anim) return this.computeAnimFrame(timestamp, anim, idleScale)
        else return this.computeIdleFrame(timestamp, idleScale)
    }

    computeAnimFrame(timestamp, anim, idleScale) {
        return anim.computeFrame(timestamp, idleScale)
    }

    getIdleScale(clipFrame) {
        const { screenCell } = clipFrame

        const videoDims = {
            x: this.screenVideoDimensions.x - this.trim.left - this.trim.right,
            y: this.screenVideoDimensions.y - this.trim.top - this.trim.bottom
        }

        if (screenCell.width / screenCell.height > videoDims.x / videoDims.y)
            // trimmed video is narrower than screen cell
            return screenCell.height / videoDims.y
        else
            // trimmed video is wider than screen cell
            return screenCell.width / videoDims.x
    }
}