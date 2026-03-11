import Animator from "../Animator"
import Mask from "./Mask"

export default class MaskAnimator extends Animator {
    constructor(container, screenVideoDimensions, screenContainer) {
        super()

        this.rendererDims = null
        this.container = container
        this.screenVideoDimensions = screenVideoDimensions
        this.screenContainer = screenContainer
    }

    update(timestamp) {
        this.computeFrame(timestamp)
    }

    setState({ configs, rendererDims }) {
        if (configs !== undefined) this.configs = configs
        if (rendererDims !== undefined) this.rendererDims = rendererDims
        this.configure()
    }

    configure() {
        if (!this.configs || !this.rendererDims) return

        const deps = { rendererDims: this.rendererDims }
        const staticDeps = {
            container: this.container,
            screenVideoDimensions: this.screenVideoDimensions,
            screenVideoContainer: this.screenContainer
        }

        const animsToAdd = this.getAnimsToAdd()
        this.addAnims(animsToAdd, Mask, deps, staticDeps)

        const animsToRemove = this.getAnimsToRemove()
        this.removeAnims(animsToRemove)

        this.anims.sort((a, b) => a.start - b.start)

        const animsToConfigure = this.getAnimsToConfigure(deps)
        this.configureAnims(animsToConfigure, deps)
    }

    computeFrame(timestamp) {
        this.anims.forEach(anim => anim.computeFrame(timestamp))
    }
}