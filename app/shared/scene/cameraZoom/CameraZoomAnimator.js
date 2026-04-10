import {
    getFullScreenScale,
    interpolate
} from "../../sceneHelpers"
import Animator from "../Animator"
import CameraZoom from "./CameraZoom"

export default class CameraZoomAnimator extends Animator {
    constructor(outerContainer, cameraVideoDims) {
        super()

        this.cameraVideoDims = null
        this.rendererDims = null

        this.outerContainer = outerContainer
        this.cameraVideoDims = cameraVideoDims
    }

    update(timestamp, clipFrame) {
        if (!clipFrame) return

        const frame = this.computeFrame(timestamp, clipFrame)
        this.outerContainer.scale.set(frame.scale)
    }

    setState({ configs, rendererDims }) {
        if (configs !== undefined) this.configs = configs
        if (rendererDims !== undefined) this.rendererDims = rendererDims
        this.configure()
    }

    configure() {
        if (!this.configs || !this.rendererDims) return

        const deps = { rendererDims: this.rendererDims }

        const animsToAdd = this.getAnimsToAdd()
        this.addAnims(animsToAdd, CameraZoom, deps, { cameraVideoDims: this.cameraVideoDims }, true, true)

        const animsToRemove = this.getAnimsToRemove()
        this.removeAnims(animsToRemove)

        this.anims.sort((a, b) => a.start - b.start)

        const animsToConfigure = this.getAnimsToConfigure(deps, true, true)
        this.configureAnims(animsToConfigure, deps, true, true)
    }

    computeIdleFrame(_timestamp, clipFrame) {
        const { cameraFullscreenWeight, cameraBaseScale } = clipFrame

        // scale so that camera mask covers renderer (content cover)
        const fullScreenScale = getFullScreenScale(this.cameraVideoDims, this.rendererDims)

        const scale = interpolate(cameraBaseScale, fullScreenScale, cameraFullscreenWeight)
        return { scale }
    }

    computeFrame(timestamp, clipFrame) {
        const anim = this.getAnim(timestamp, this.anims)
        if (anim) return this.computeAnimFrame(timestamp, anim, clipFrame)
        else return this.computeIdleFrame(timestamp, clipFrame)
    }

    computeAnimFrame(timestamp, anim, clipFrame) {
        return anim.computeFrame(timestamp, this.frames?.at(-1), clipFrame)
    }
}
