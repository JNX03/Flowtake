import Animator from "../Animator"
import Click from "./Click"

export default class ClickAnimator extends Animator {
    constructor(cursor) {
        super()

        this.cursorScale = null
        this.cursor = cursor
    }

    update(timestamp) {
        const frame = this.computeFrame(timestamp)
        this.cursor.scale.set(frame.scale)
    }

    setState({ cursorScale, configs }) {
        if (cursorScale !== undefined) this.cursorScale = cursorScale
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