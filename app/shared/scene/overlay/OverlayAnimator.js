import {
    CanvasSource,
    Container,
    Graphics,
    Sprite,
    Text,
    TextStyle,
    Texture
} from "pixi.js"
import { resolveOverlayAtTime } from "../../editor/overlayKeyframes.js"

const OVERLAY_BLEND_MODES = new Set([
    "normal",
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "difference",
])

const normalizeBlendMode = value =>
    OVERLAY_BLEND_MODES.has(value) ? value : "normal"

/**
 * Renders overlay elements (text, shapes, images, videos) onto the pixi.js scene.
 * Each overlay has position, rotation, scale, opacity, and optional keyframes.
 */
export default class OverlayAnimator {
    constructor(stage) {
        this.container = new Container()
        this.container.label = "overlay-container"
        this.container.zIndex = 3 // above subtitles (zIndex 2)
        this.container.sortableChildren = true
        stage.addChild(this.container)

        this.configs = []
        this.rendererDims = null
        this.elements = new Map() // id → pixi display object
    }

    setState({ configs, rendererDims }) {
        if (rendererDims !== undefined) this.rendererDims = rendererDims
        if (configs !== undefined) {
            this.configs = configs
            this.rebuild()
        }
    }

    rebuild() {
        // Remove old elements
        for (const [, el] of this.elements) {
            el.videoSurface?.texture?.destroy(true)
            el.destroy({ children: true })
        }
        this.elements.clear()
        this.container.removeChildren()

        if (!this.rendererDims) return

        for (const config of this.configs) {
            const el = this.createElement(config)
            if (el) {
                el.visible = false
                this.container.addChild(el)
                this.elements.set(config.id, el)
            }
        }
    }

    createElement(config) {
        const wrapper = new Container()
        wrapper.label = `overlay-${config.id}`
        wrapper.blendMode = normalizeBlendMode(config.blendMode)

        if (config.overlayType === "text") {
            const fontSize = config.fontSize || 32
            const style = new TextStyle({
                fontFamily: config.fontFamily || "Inter, Arial, Helvetica, sans-serif",
                fontSize,
                fontWeight: config.fontWeight || 400,
                fontStyle: config.fontStyle || "normal",
                align: config.textAlign || "center",
                letterSpacing: config.letterSpacing || 0,
                lineHeight: fontSize * (config.lineHeight || 1.3),
                fill: config.color || "#ffffff",
                wordWrap: true,
                wordWrapWidth: config.textMaxWidth || 800,
                dropShadow: {
                    alpha: 0.5,
                    blur: 4,
                    distance: 1,
                },
            })
            const text = new Text({ text: config.text || "Text", style })
            text.anchor.set(0.5, 0.5)
            if (config.textBackgroundEnabled) {
                const padding = config.textBackgroundPadding ?? 12
                const background = new Graphics()
                background.roundRect(
                    -text.width / 2 - padding,
                    -text.height / 2 - padding,
                    text.width + padding * 2,
                    text.height + padding * 2,
                    config.textBackgroundRadius ?? 8
                )
                background.fill(config.textBackgroundColor || "#000000")
                background.alpha = config.textBackgroundOpacity ?? 0.65
                wrapper.addChild(background)
            }
            wrapper.addChild(text)
        } else if (config.overlayType === "shape") {
            const g = new Graphics()
            const fillColor = config.fill !== "none" ? config.fill : null
            const strokeColor = config.stroke !== "none" ? config.stroke : null
            const w = config.width || 200
            const h = config.height || 100

            // pixi v8: draw shape, then fill/stroke
            if (config.shapeType === "circle") {
                const r = config.radius || 60
                g.circle(0, 0, r)
            } else if (config.shapeType === "arrow") {
                g.poly([
                    -w / 2, -h * 0.2,
                    w * 0.2, -h * 0.2,
                    w * 0.2, -h / 2,
                    w / 2, 0,
                    w * 0.2, h / 2,
                    w * 0.2, h * 0.2,
                    -w / 2, h * 0.2,
                ], true)
            } else {
                const br = config.borderRadius || 0
                if (br > 0) g.roundRect(-w / 2, -h / 2, w, h, br)
                else g.rect(-w / 2, -h / 2, w, h)
            }
            if (fillColor) g.fill(fillColor)
            if (strokeColor) g.stroke({ color: strokeColor, width: config.strokeWidth || 2 })

            wrapper.addChild(g)
        } else if (config.overlayType === "image" && config.src) {
            try {
                const texture = Texture.from(config.src)
                const sprite = new Sprite(texture)
                sprite.anchor.set(0.5, 0.5)
                const w = config.width || 320
                const h = config.height || 240
                sprite.width = w
                sprite.height = h
                wrapper.addChild(sprite)
            } catch {
                // fallback: colored rectangle
                const g = new Graphics()
                g.rect(-(config.width || 320) / 2, -(config.height || 240) / 2, config.width || 320, config.height || 240)
                g.fill(0x6c5ce7)
                wrapper.addChild(g)
            }
        } else if (config.overlayType === "video") {
            const canvas = new OffscreenCanvas(1, 1)
            const context = canvas.getContext("2d")
            const texture = new Texture({ source: new CanvasSource({ resource: canvas }) })
            const sprite = new Sprite(texture)
            sprite.anchor.set(0.5, 0.5)
            wrapper.videoSurface = {
                canvas,
                context,
                texture,
                sprite,
                width: config.width || 320,
                height: config.height || 240,
            }
            wrapper.addChild(sprite)
        }

        return wrapper
    }

    setVideoFrame(id, content) {
        const surface = this.elements.get(id)?.videoSurface
        if (!surface || !content) return false

        const sourceWidth = Math.max(1, Math.round(
            content.displayWidth || content.width || content.codedWidth || 1
        ))
        const sourceHeight = Math.max(1, Math.round(
            content.displayHeight || content.height || content.codedHeight || 1
        ))
        if (surface.canvas.width !== sourceWidth || surface.canvas.height !== sourceHeight) {
            surface.canvas.width = sourceWidth
            surface.canvas.height = sourceHeight
        }

        surface.context.clearRect(0, 0, sourceWidth, sourceHeight)
        surface.context.drawImage(content, 0, 0, sourceWidth, sourceHeight)
        content.close?.()
        surface.texture.source.update()

        const fitScale = Math.min(surface.width / sourceWidth, surface.height / sourceHeight)
        surface.sprite.width = sourceWidth * fitScale
        surface.sprite.height = sourceHeight * fitScale
        return true
    }

    update(time) {
        if (!this.rendererDims || this.configs.length === 0) return

        const canvasW = this.rendererDims.x
        const canvasH = this.rendererDims.y

        for (const config of this.configs) {
            const el = this.elements.get(config.id)
            if (!el) continue

            const visible = config.visible !== false && time >= config.start && time <= config.end
            el.visible = visible
            if (!visible) continue

            // Interpolate keyframes
            const resolved = resolveOverlayAtTime(config, time)

            const pos = resolved.position || { x: 0.5, y: 0.5 }
            const rotation = (resolved.rotation || 0) * Math.PI / 180
            const scale = resolved.scale || 1
            const opacity = resolved.opacity ?? 1

            el.position.set(pos.x * canvasW, pos.y * canvasH)
            el.rotation = rotation
            el.scale.set(scale)
            el.alpha = opacity
            el.blendMode = normalizeBlendMode(resolved.blendMode)
        }
    }

    destroy() {
        for (const [, el] of this.elements) {
            el.videoSurface?.texture?.destroy(true)
            el.destroy({ children: true })
        }
        this.elements.clear()
        this.container.destroy({ children: true })
    }
}
