import { shallowEqual } from "react-redux"
import Animator from "../Animator"
import CursorType from "./CursorType"
import CursorTypeConfig from "./CursorTypeConfig"

export default class CursorTypeAnimator extends Animator {
    constructor(container) {
        super()

        this.videoDetails = null
        this.isStatic = null

        this.container = container
    }

    update(timestamp) {
        if (this.anims.length === 0) return

        const frame = this.computeFrame(timestamp)
        const cursor = this.container.children.find(({ label }) => label === frame.type)
        cursor.alpha = frame.alpha
        cursor.visible = frame.visible
        this.container.children
            .filter(({ label }) => label !== frame.type)
            .forEach(cursor => {
                cursor.alpha = .5
                cursor.visible = false
            })
    }

    setState({ isStatic, videoDetails, configs }) {
        let isConfigureDirty = false

        if (configs !== undefined && !shallowEqual(this.configs, configs)) {
            this.configs = configs
            isConfigureDirty = true
        }

        if (videoDetails !== undefined && !shallowEqual(this.videoDetails, videoDetails)) {
            this.videoDetails = videoDetails
            isConfigureDirty = true
        }

        if (isStatic !== undefined && this.isStatic !== isStatic) {
            this.isStatic = isStatic
            isConfigureDirty = true
        }

        if (isConfigureDirty) this.configure()
    }

    configure() {
        if (!this.configs || this.isStatic === null || !this.videoDetails) return

        if (this.isStatic)
            this.anims = [
                new CursorType(new CursorTypeConfig({ start: 0, end: this.videoDetails.end, intro: 0, outro: 0 }))
            ]
        else
            this.anims = this.configs.map(config => new CursorType(config))
    }

    computeIdleFrame() {
        return { alpha: .5, visible: false, type: "default" }
    }
}