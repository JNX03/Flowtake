import { isEqual } from "lodash-es"
import { shallowEqual } from "react-redux"

export default class Animator {

    constructor() {
        this.frames = null
        this.anims = []
        this.configs = null
    }

    setState() { }

    update() { }

    getAnim(timestamp, anims) {
        return anims.find(anim => timestamp >= anim.start && timestamp <= anim.end)
    }

    computeFrame(timestamp) {
        const anim = this.getAnim(timestamp, this.anims)
        if (anim) return this.computeAnimFrame(timestamp, anim)
        else return this.computeIdleFrame(timestamp)
    }

    computeAnimFrame(timestamp, anim) {
        return anim.computeFrame(timestamp, this.frames?.at(-1))
    }

    computeIdleFrame() {
        return {}
    }

    getAnimsToAdd() {
        if (!this.anims) return this.configs
        return this.configs.filter(({ id }) => !this.anims.some(anim => anim.config.id === id))
    }

    getAnimsToRemove() {
        if (!this.anims) return []
        return this.anims.filter(anim => !this.configs.some(({ id }) => id === anim.config.id))
    }

    getPrev(start) {
        return this.configs.reduce((acc, config) => {
            if (config.end <= start && config.end > (acc?.end || 0)) {
                return config
            }
            return acc
        }, undefined)
    }

    getNext(end) {
        return this.configs.reduce((acc, config) => {
            if (config.start >= end && config.start < (acc?.start || Infinity)) {
                return config
            }
            return acc
        }, undefined)
    }

    getAnimsToConfigure(deps, addPrevConfig = false, addNextConfig = false) {
        if (!this.anims) return []
        return this.anims
            .filter(anim =>
                this.configs.some(config => {
                    const d = { ...deps }
                    if (addPrevConfig) d.prevConfig = this.getPrev(config.start)
                    if (addNextConfig) d.nextConfig = this.getNext(config.end)
                    return anim.config.id === config.id
                        && (!shallowEqual(anim.config, config) || !isEqual(anim.deps, d))
                })
            )
            .map(anim => ({ anim, config: this.configs.find(config => config.id === anim.config.id) }))
    }

    addAnims(anims, Class, deps, staticDeps = null, addPrevConfig = false, addNextConfig = false) {
        anims.forEach(config => {
            const d = { ...deps }
            if (addPrevConfig) d.prevConfig = this.getPrev(config.start)
            if (addNextConfig) d.nextConfig = this.getNext(config.end)
            this.anims.push(new Class(config, d, staticDeps))
        })
    }

    removeAnims(anims) {
        anims.forEach(anim => {
            anim.destroy()
            this.anims.splice(this.anims.indexOf(anim), 1)
        })
    }

    configureAnims(anims, deps, addPrevConfig = false, addNextConfig = false) {
        anims.forEach(({ anim, config }) => {
            const d = { ...deps }
            if (addPrevConfig) d.prevConfig = this.getPrev(config.start)
            if (addNextConfig) d.nextConfig = this.getNext(config.end)
            anim.configure(config, d)
        })
    }
}
