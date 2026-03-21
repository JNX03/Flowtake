import {
    Container,
    Graphics,
    Sprite,
    Text,
    TextStyle,
    Texture
} from "pixi.js"

/**
 * Renders overlay elements (text, shapes, images) onto the pixi.js scene.
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

        if (config.overlayType === "text") {
            const style = new TextStyle({
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: config.fontSize || 32,
                fontWeight: config.fontWeight >= 600 ? "bold" : "normal",
                fill: config.color || "#ffffff",
                wordWrap: true,
                wordWrapWidth: 800,
                dropShadow: {
                    alpha: 0.5,
                    blur: 4,
                    distance: 1,
                },
            })
            const text = new Text({ text: config.text || "Text", style })
            text.anchor.set(0.5, 0.5)
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
        }

        return wrapper
    }

    update(time) {
        if (!this.rendererDims || this.configs.length === 0) return

        const canvasW = this.rendererDims.x
        const canvasH = this.rendererDims.y

        for (const config of this.configs) {
            const el = this.elements.get(config.id)
            if (!el) continue

            const visible = time >= config.start && time <= config.end
            el.visible = visible
            if (!visible) continue

            // Interpolate keyframes
            const resolved = lerpKeyframes(config, time)

            const pos = resolved.position || { x: 0.5, y: 0.5 }
            const rotation = (resolved.rotation || 0) * Math.PI / 180
            const scale = resolved.scale || 1
            const opacity = resolved.opacity ?? 1

            el.position.set(pos.x * canvasW, pos.y * canvasH)
            el.rotation = rotation
            el.scale.set(scale)
            el.alpha = opacity
        }
    }

    destroy() {
        for (const [, el] of this.elements) {
            el.destroy({ children: true })
        }
        this.elements.clear()
        this.container.destroy({ children: true })
    }
}

function lerpKeyframes(overlay, time) {
    const kf = overlay.keyframes
    if (!kf || kf.length === 0) return overlay
    const relTime = time - overlay.start
    if (kf.length === 1) return { ...overlay, ...kf[0] }

    let before = kf[0], after = kf[kf.length - 1]
    for (let i = 0; i < kf.length; i++) {
        if (kf[i].time <= relTime) before = kf[i]
        if (kf[i].time >= relTime) { after = kf[i]; break }
    }
    if (before === after || before.time === after.time) return { ...overlay, ...before }

    const t = (relTime - before.time) / (after.time - before.time)
    const lerp = (a, b) => a != null && b != null ? a + (b - a) * t : (b ?? a)

    return {
        ...overlay,
        position: {
            x: lerp(before.position?.x ?? overlay.position?.x, after.position?.x ?? overlay.position?.x),
            y: lerp(before.position?.y ?? overlay.position?.y, after.position?.y ?? overlay.position?.y),
        },
        rotation: lerp(before.rotation ?? overlay.rotation ?? 0, after.rotation ?? overlay.rotation ?? 0),
        scale: lerp(before.scale ?? overlay.scale ?? 1, after.scale ?? overlay.scale ?? 1),
        opacity: lerp(before.opacity ?? overlay.opacity ?? 1, after.opacity ?? overlay.opacity ?? 1),
    }
}
