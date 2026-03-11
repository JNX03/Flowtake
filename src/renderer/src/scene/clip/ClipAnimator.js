import { isEqual } from "lodash-es"
import Animator from "../Animator"
import Clip from "./Clip"

export const CAMERA_OFFSET = 0.03

export default class ClipAnimator extends Animator {
    constructor(outerContainer, cameraVideoDims, hasCameraVideo) {
        super()

        this.rendererDims = null
        this.padding = null

        this.outerContainer = outerContainer
        this.cameraVideoDims = cameraVideoDims
        this.hasCameraVideo = hasCameraVideo
    }

    update(timestamp) {
        if (this.anims.length === 0) return

        const frame = this.computeFrame(timestamp)

        if (frame.cameraPosition != null) this.outerContainer.position.set(frame.cameraPosition.x, frame.cameraPosition.y)
        if (frame.cameraPivot != null) this.outerContainer.pivot.set(frame.cameraPivot.x, frame.cameraPivot.y)
        if (frame.cameraAlpha != null) this.outerContainer.alpha = frame.cameraAlpha

        if (frame.cameraMask != null) {
            const container = this.outerContainer.children[0]
            container.mask.clear()
            container.mask.roundRect(
                frame.cameraMask.x,
                frame.cameraMask.y,
                frame.cameraMask.width,
                frame.cameraMask.height,
                frame.cameraMask.radius
            )
            container.mask.fill({ color: 0x000000 })
        }
        return frame
    }

    setState({ padding, configs, rendererDims }) {
        if (padding !== undefined) this.padding = padding
        if (configs !== undefined) this.configs = configs
        if (rendererDims !== undefined) this.rendererDims = rendererDims
        this.configure()
    }

    configure() {
        if (!this.configs || !this.rendererDims || this.padding === null) return

        const deps = { rendererDims: this.rendererDims, maxScale: this.padding }
        const staticDeps = { cameraVideoDims: this.cameraVideoDims, hasCameraVideo: this.hasCameraVideo }

        const animsToAdd = this.getAnimsToAdd()
        this.addAnims(animsToAdd, deps, staticDeps)

        const animsToRemove = this.getAnimsToRemove()
        this.removeAnims(animsToRemove)

        this.anims.sort((a, b) => a.start - b.start)

        const animsToConfigure = this.getAnimsToConfigure(deps)
        this.configureAnims(animsToConfigure, deps)
    }

    getPrevAnim(start) {
        return this.anims.reduce((acc, anim) => {
            if (anim.end <= start && anim.end > (acc?.end || 0)) {
                return anim
            }
            return acc
        }, undefined)
    }

    getNextAnim(end) {
        return this.anims.reduce((acc, anim) => {
            if (anim.start >= end && anim.start < (acc?.start || Infinity)) {
                return anim
            }
            return acc
        }, undefined)
    }

    getDepsWithPrevAnim(config, deps) {
        const prevAnim = this.getPrevAnim(config.start)
        return {
            ...deps,
            prevAnim: prevAnim
                ? {
                    toCameraAlpha: prevAnim?.toCameraAlpha,
                    layoutMode: prevAnim?.layout.mode,
                    toCameraPosition: prevAnim?.toCameraPosition,
                    toCameraMask: prevAnim?.toCameraMask,
                    toCameraPivot: prevAnim?.toCameraPivot,
                    toCameraFullscreenWeight: prevAnim?.toCameraFullscreenWeight,
                    toCameraBaseScale: prevAnim?.toCameraBaseScale,
                    toScreenCell: prevAnim?.toScreenCell
                }
                : null
        }
    }

    getAnimsToConfigure(deps) {
        if (!this.anims) return []
        
        const animsToConfigure = this.anims
        .filter(anim =>
            this.configs.some(config => {
                const d = this.getDepsWithPrevAnim(config, deps)
                return anim.config.id === config.id
                && (!isEqual(anim.config, config) || !isEqual(anim.deps, d))
            })
        )
        
        // Because of prevAnim dependency, need to also reconfigure next anims
        const dependantAnims = []
        animsToConfigure.forEach(anim => {
            const nextAnim = this.getNextAnim(anim.end)
            if (nextAnim && !animsToConfigure.includes(nextAnim)) {
                dependantAnims.push(nextAnim)
            }
        })

        animsToConfigure.push(...dependantAnims)
        animsToConfigure.sort((a, b) => a.start - b.start)

        return animsToConfigure.map(anim => ({ anim, config: this.configs.find(config => config.id === anim.config.id) }))
    }

    addAnims(configs, deps, staticDeps) {
        configs.forEach(config => {
            const d = this.getDepsWithPrevAnim(config, deps)
            this.anims.push(new Clip(config, d, staticDeps))
        })
    }

    configureAnims(anims, deps) {
        anims.forEach(({ anim, config }) => {
            const d = this.getDepsWithPrevAnim(config, deps)
            anim.configure(config, d)
        })
    }

    computeIdleFrame(timestamp) {
        const prevAnim = this.anims.reduce((prev, curr) => curr.end > prev.end && curr.end < timestamp ? curr : prev)
        return this.computeAnimFrame(timestamp < prevAnim.start ? prevAnim.start : prevAnim.end, prevAnim)
    }
}