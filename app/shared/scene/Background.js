import {
    CanvasSource,
    ImageSource,
    Sprite,
    Texture
} from "pixi.js"
import { shallowEqual } from "react-redux"
import { drawGradient } from "../sceneHelpers"
import { IMAGE_SCHEME_PREFIX } from "../constants"
import { LOAD_IMAGE, postAsync } from "../workers/helpers"

export default class Background {
    constructor(onError) {
        this.sprite = new Sprite()
        this.isUpdating = false
        this.config = null
        this.rendererDims = null
        this.onError = onError
        this.renderId = null
    }

    async setState({ config, rendererDims }) {
        let isConfigureDirty = false
        let isResizeDirty = false

        if (config !== undefined && !shallowEqual(this.config, config)) {
            this.config = config
            isConfigureDirty = true
            isResizeDirty = true
        }

        if (rendererDims !== undefined && !shallowEqual(this.rendererDims, rendererDims)) {
            this.rendererDims = rendererDims
            isResizeDirty = true
            isConfigureDirty = true
        }

        if (isConfigureDirty) await this.configure()
        if (isResizeDirty) this.resize()
    }

    async configure() {
        if (this.isUpdating || !this.rendererDims) return

        this.isUpdating = true
        try {
            if (this.config?.type === "wallpaper" || this.config?.type === "image") await this.setImage()
            if (this.config?.type === "color") this.setColor()
            if (this.config?.type === "gradient") this.setGradient()
        } catch (e) {
            this.onError(e)
        } finally {
            this.isUpdating = false
        }
    }

    resize() {
        if (!this.rendererDims) return

        this.sprite.position.set(this.rendererDims.x * 0.5, this.rendererDims.y * 0.5)
        if (this.sprite.texture.width / this.sprite.texture.height > this.rendererDims.x / this.rendererDims.y)
            this.sprite.scale.set(this.rendererDims.y / this.sprite.texture.height)
        else
            this.sprite.scale.set(this.rendererDims.x / this.sprite.texture.width)
    }

    async setImage() {
        this.sprite.tint = 0xffffff
        const { bmp, error } = await postAsync(self, LOAD_IMAGE, `${IMAGE_SCHEME_PREFIX}background?renderId=${this.renderId}`)
        if (error) throw new Error(error)
        this.destroyTexture()
        this.sprite.texture = new Texture({ source: new ImageSource({ resource: bmp }) })
        this.sprite.pivot.set(this.sprite.texture.width * 0.5, this.sprite.texture.height * 0.5)
    }

    setColor() {
        this.destroyTexture()
        this.sprite.texture = Texture.WHITE
        this.sprite.tint = this.config.value
        this.sprite.pivot.set(this.sprite.texture.width * 0.5, this.sprite.texture.height * 0.5)
    }

    setGradient() {
        if (this.rendererDims.x > 0 && this.rendererDims.y > 0) {
            this.isUpdating = true
            const { direction, color1, color2, color3 } = this.config.config
            const canvas = new OffscreenCanvas(this.rendererDims.x, this.rendererDims.y)
            drawGradient(canvas, direction, color1, color2, color3)
            this.destroyTexture()
            this.sprite.tint = 0xffffff
            this.sprite.texture = new Texture({ source: new CanvasSource({ resource: canvas }) })
            this.sprite.pivot.set(this.sprite.texture.width * 0.5, this.sprite.texture.height * 0.5)
        }
    }

    destroyTexture() {
        this.sprite.texture.source.options.resource?.close?.()
        this.sprite.texture?.destroy(true)
    }
}
