import { computeTransitionIn, computeTransitionOut } from "./transitions"

/**
 * TransitionAnimator applies transition effects to the main container.
 * It reads clip configs with transitionIn/transitionOut fields and
 * modifies container alpha, position, and scale during transition periods.
 */
export default class TransitionAnimator {
    constructor(container) {
        this.container = container
        this.configs = []
        this.rendererDims = null
    }

    setState({ configs, rendererDims }) {
        if (configs !== undefined) this.configs = configs
        if (rendererDims !== undefined) this.rendererDims = rendererDims
    }

    update(timestamp) {
        if (!this.configs?.length || !this.container) {
            this.resetContainer()
            return
        }

        // Find the active clip at this timestamp
        const activeClip = this.configs.find(c => timestamp >= c.start && timestamp <= c.end)
        if (!activeClip) {
            this.resetContainer()
            return
        }

        const width = this.rendererDims?.x || 1920
        const height = this.rendererDims?.y || 1080

        let result = {}

        // Check transition in
        const transIn = activeClip.transitionIn
        if (transIn && transIn.type !== "none" && transIn.duration > 0) {
            const transEnd = activeClip.start + transIn.duration
            if (timestamp < transEnd) {
                const t = (timestamp - activeClip.start) / transIn.duration
                result = computeTransitionIn(transIn.type, Math.max(0, Math.min(1, t)), width, height)
            }
        }

        // Check transition out (only if not already in a transitionIn)
        const transOut = activeClip.transitionOut
        if (transOut && transOut.type !== "none" && transOut.duration > 0 && !Object.keys(result).length) {
            const transStart = activeClip.end - transOut.duration
            if (timestamp > transStart) {
                const t = (timestamp - transStart) / transOut.duration
                result = computeTransitionOut(transOut.type, Math.max(0, Math.min(1, t)), width, height)
            }
        }

        // Apply results to container
        this.applyToContainer(result)
    }

    applyToContainer(result) {
        if (result.alpha !== undefined) {
            this.container.alpha = result.alpha
        } else {
            this.container.alpha = 1
        }

        if (result.x !== undefined || result.y !== undefined) {
            this.container.position.set(result.x || 0, result.y || 0)
        } else {
            this.container.position.set(0, 0)
        }

        if (result.scaleX !== undefined || result.scaleY !== undefined) {
            this.container.scale.set(result.scaleX || 1, result.scaleY || 1)
        } else {
            this.container.scale.set(1, 1)
        }
    }

    resetContainer() {
        if (!this.container) return
        this.container.alpha = 1
        this.container.position.set(0, 0)
        this.container.scale.set(1, 1)
    }
}
