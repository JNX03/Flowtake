import {
    Container,
    Graphics,
    Text,
    TextStyle
} from "pixi.js"
import Animator from "../Animator"
import { drawPreset, hexStringToInt } from "../cursorAnim/presetShapes"

// Visual scale applied to preset shapes (which are drawn in small scene-pixel
// units). The shapes themselves are ~18px; this multiplier brings them to
// roughly the same on-screen footprint as the recorded cursor sprite.
const PRESET_SCALE = 4

export default class DrawnMouseAnimator extends Animator {
    constructor(parentContainer) {
        super()

        this.parentContainer = parentContainer
        this.container = new Container()
        this.container.label = "drawn-mouse"
        this.container.zIndex = 3
        if (this.parentContainer) this.parentContainer.addChild(this.container)

        this.configs = []
        this.defaults = {
            color: "#3b82f6",
            showLabel: true,
            label: "Drawn",
            preset: "pointer",
            showTrail: true,
        }
        this.videoDetails = null
        this.nodes = new Map()   // id -> { container, cursor, presetGraphics, trail, tagContainer, tagBg, tagText, _styleKey }
    }

    setState({ configs, defaults, videoDetails }) {
        if (configs !== undefined) this.configs = Array.isArray(configs) ? configs : []
        if (defaults !== undefined && defaults) this.defaults = { ...this.defaults, ...defaults }
        if (videoDetails !== undefined) this.videoDetails = videoDetails
        this.syncNodes()
    }

    syncNodes() {
        const valid = new Set(this.configs.map(c => c.id))
        for (const id of Array.from(this.nodes.keys())) {
            if (!valid.has(id)) this.destroyNode(id)
        }
        for (const config of this.configs) {
            if (!this.nodes.has(config.id)) this.createNode(config.id)
        }
    }

    createNode(id) {
        const node = {
            container: new Container(),
            cursor: new Container(),
            presetGraphics: new Graphics(),
            trail: new Graphics(),
            tagContainer: new Container(),
            tagBg: new Graphics(),
            tagText: new Text({
                text: "",
                style: new TextStyle({
                    fontFamily: "Inter, sans-serif",
                    fontSize: 22,
                    fontWeight: "600",
                    fill: 0xFFFFFF,
                }),
            }),
            _styleKey: null,
        }
        node.container.label = `drawn-mouse-${id}`
        node.container.visible = false

        node.cursor.scale.set(PRESET_SCALE)
        node.cursor.addChild(node.presetGraphics)

        node.tagContainer.position.set(28, 24)
        node.tagContainer.addChild(node.tagBg)
        node.tagContainer.addChild(node.tagText)
        node.cursor.addChild(node.tagContainer)

        node.container.addChild(node.trail)
        node.container.addChild(node.cursor)

        this.container.addChild(node.container)
        this.nodes.set(id, node)
    }

    destroyNode(id) {
        const node = this.nodes.get(id)
        if (!node) return
        this.container.removeChild(node.container)
        try { node.container.destroy({ children: true }) } catch (_e) { /* ignore */ }
        this.nodes.delete(id)
    }

    /** Linearly interpolate (x, y) from `points` at logical time `t` (ms from path start). */
    sampleAt(points, t) {
        if (!points || points.length === 0) return null
        if (t <= points[0].t) return { x: points[0].x, y: points[0].y }
        const last = points[points.length - 1]
        if (t >= last.t) return { x: last.x, y: last.y }
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1]
            const b = points[i]
            if (t <= b.t) {
                const span = Math.max(b.t - a.t, 1)
                const u = (t - a.t) / span
                return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }
            }
        }
        return { x: last.x, y: last.y }
    }

    update(timestamp) {
        if (this.configs.length === 0) return

        for (const config of this.configs) {
            const node = this.nodes.get(config.id)
            if (!node) continue

            const inRange = timestamp >= config.start && timestamp <= config.end
            if (!inRange) {
                if (node.container.visible) node.container.visible = false
                continue
            }
            const points = Array.isArray(config.points) ? config.points : []
            if (points.length === 0) {
                if (node.container.visible) node.container.visible = false
                continue
            }
            if (!node.container.visible) node.container.visible = true

            // Map segment-progress (start..end) to logical path time (points[0].t..points.last.t).
            const segDur = Math.max(config.end - config.start, 1)
            const u = (timestamp - config.start) / segDur
            const first = points[0]
            const last = points[points.length - 1]
            const pathSpan = last.t - first.t
            const t = first.t + u * pathSpan

            const color = config.color ?? this.defaults.color
            const preset = config.preset ?? this.defaults.preset
            const label = config.label ?? this.defaults.label
            const showLabel = config.showLabel ?? this.defaults.showLabel
            const showTrail = config.showTrail ?? this.defaults.showTrail

            const pos = this.sampleAt(points, t)
            if (pos) node.cursor.position.set(pos.x, pos.y)

            // Only re-draw style elements when style actually changes.
            const styleKey = `${preset}|${color}|${showLabel ? 1 : 0}|${label}|${showTrail ? 1 : 0}`
            if (styleKey !== node._styleKey) {
                node._styleKey = styleKey
                drawPreset(node.presetGraphics, preset, color)
                if (showLabel && label) {
                    if (node.tagText.text !== label) node.tagText.text = label
                    const colorInt = hexStringToInt(color)
                    node.tagBg.clear()
                        .roundRect(-6, -3, node.tagText.width + 12, node.tagText.height + 6, 999)
                        .fill({ color: colorInt, alpha: 0.95 })
                    node.tagContainer.visible = true
                } else {
                    node.tagContainer.visible = false
                }
            }

            if (showTrail) {
                node.trail.visible = true
                node.trail.clear()
                let started = false
                for (let i = 0; i < points.length; i++) {
                    const p = points[i]
                    if (p.t > t) break
                    if (!started) { node.trail.moveTo(p.x, p.y); started = true }
                    else node.trail.lineTo(p.x, p.y)
                }
                if (started && pos) node.trail.lineTo(pos.x, pos.y)
                if (started) {
                    const colorInt = hexStringToInt(color)
                    node.trail.stroke({
                        color: colorInt,
                        alpha: 0.35,
                        width: 6,
                        cap: "round",
                        join: "round",
                    })
                }
            } else if (node.trail.visible) {
                node.trail.visible = false
                node.trail.clear()
            }
        }
    }

    destroy() {
        for (const id of Array.from(this.nodes.keys())) this.destroyNode(id)
        if (this.parentContainer && this.container && this.parentContainer.children.includes(this.container)) {
            this.parentContainer.removeChild(this.container)
        }
        try { this.container.destroy({ children: true }) } catch (_e) { /* ignore */ }
    }
}
