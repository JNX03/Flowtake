import { Container, Graphics, Text, TextStyle } from "pixi.js"

const FT_MOD_CTRL = 1
const FT_MOD_SHIFT = 2
const FT_MOD_ALT = 4
const FT_MOD_META = 8

const KEYBIND_WHITELIST = new Set([
    "Backspace", "Tab", "Enter", "Esc", "Delete", "Insert",
    "Home", "End", "PageUp", "PageDown",
    "←", "→", "↑", "↓",
    "Caps", "PrtSc", "Pause",
])

const SIZE_PRESETS = {
    sm: { font: 18, padX: 8, padY: 4, gap: 6, margin: 24 },
    md: { font: 26, padX: 12, padY: 6, gap: 9, margin: 32 },
    lg: { font: 36, padX: 16, padY: 9, gap: 12, margin: 40 },
}

const FADE_AFTER_MS = 1400
const FADE_DUR_MS = 350
const MAX_VISIBLE = 8

/**
 * Renders a transient overlay of recently-pressed keys at a chosen corner of the
 * scene, driven by the keyboardEvents captured during recording.
 */
export default class KeyboardOverlay {
    constructor(stage) {
        this.stage = stage
        if (stage) stage.sortableChildren = true
        this.container = new Container()
        this.container.label = "plugin-keyboard-overlay"
        this.container.zIndex = 1000
        this.stage.addChild(this.container)

        this.events = []
        this.defaults = { mode: "keybinds", position: "bottom-center", size: "md" }
        this.entities = []                  // [{id, start, end, mode?, position?, size?}]
        this.activeEntity = null            // currently-rendering entity (for resolved config)
        this.enabled = false
        this.sceneDims = { width: 1280, height: 720 }
    }

    setEnabled(enabled) {
        this.enabled = !!enabled
        this.container.visible = this.enabled
        this.lastFingerprint = null
    }

    setDefaults(defaults) {
        this.defaults = { ...this.defaults, ...(defaults || {}) }
        this.lastFingerprint = null
    }

    setEntities(entities) {
        this.entities = Array.isArray(entities) ? entities : []
        this.lastFingerprint = null
    }

    setEvents(events) {
        this.events = Array.isArray(events) ? events : []
        this.lastFingerprint = null
    }

    setDims(width, height) {
        this.sceneDims = { width, height }
        this.lastFingerprint = null
        this.layout(this.lastFrame || [])
    }

    /** Resolve which entity is active at `time`, returning the merged config. */
    resolveActiveConfig(time) {
        for (const ent of this.entities) {
            if (time >= ent.start && time <= ent.end) {
                return {
                    entity: ent,
                    mode: ent.mode ?? this.defaults.mode,
                    position: ent.position ?? this.defaults.position,
                    size: ent.size ?? this.defaults.size,
                }
            }
        }
        return null
    }

    /**
     * Compute which keys are visible at `time` (ms since recording start) and
     * lay them out as a row of kbd-style chips.
     */
    update(time) {
        if (!this.enabled || !this.events.length || this.entities.length === 0) {
            if (this.container.children.length) this.layout([])
            this.activeEntity = null
            return
        }
        const active = this.resolveActiveConfig(time)
        if (!active) {
            if (this.container.children.length) this.layout([])
            this.activeEntity = null
            return
        }
        this.activeEntity = active
        const visible = this.computeVisible(time, active)

        // Skip rebuild if the visible set + alphas haven't materially changed.
        const fp = `${active.position}|${active.size}|` +
            visible.map(v => `${v.label}|${Math.round(v.alpha * 20)}`).join("§")
        if (fp === this.lastFingerprint) return
        this.lastFingerprint = fp

        this.layout(visible, active)
    }

    computeVisible(time, active) {
        const out = []
        const isKeybinds = active.mode === "keybinds"

        // Walk events and accumulate keydown chips that are still within fade window.
        for (let i = 0; i < this.events.length; i++) {
            const ev = this.events[i]
            if (ev.timestamp > time) break
            if (ev.type !== "keydown") continue
            if (isKeybinds && !this.isKeybind(ev)) continue

            const age = time - ev.timestamp
            if (age > FADE_AFTER_MS + FADE_DUR_MS) continue

            const label = this.formatLabel(ev)
            const alpha = age <= FADE_AFTER_MS
                ? 1
                : Math.max(0, 1 - (age - FADE_AFTER_MS) / FADE_DUR_MS)
            out.push({ label, alpha })
            if (out.length > MAX_VISIBLE * 2) out.shift()
        }
        return out.slice(-MAX_VISIBLE)
    }

    isKeybind(ev) {
        if (!ev) return false
        if (ev.modifiers && ev.modifiers !== 0) return true
        if (ev.keyName && KEYBIND_WHITELIST.has(ev.keyName)) return true
        if (ev.keyName && /^F\d+$/.test(ev.keyName)) return true
        return false
    }

    formatLabel(ev) {
        const mods = ev.modifiers || 0
        const parts = []
        if (mods & FT_MOD_CTRL) parts.push("Ctrl")
        if (mods & FT_MOD_ALT) parts.push("Alt")
        if (mods & FT_MOD_META) parts.push("Win")
        if (mods & FT_MOD_SHIFT) parts.push("Shift")
        const k = ev.keyName || ""
        // If the key itself is a modifier and we already pushed it, skip.
        if (parts.includes(k)) return parts.join("+")
        if (k) parts.push(k)
        return parts.join("+") || "?"
    }

    layout(items, active = this.activeEntity) {
        this.lastFrame = items
        // Free GPU resources from the previous frame's chips before discarding.
        for (const child of this.container.removeChildren()) {
            child.destroy({ children: true })
        }

        if (!this.enabled || items.length === 0 || !active) return

        const preset = SIZE_PRESETS[active.size] || SIZE_PRESETS.md
        const style = new TextStyle({
            fontFamily: "Inter, sans-serif",
            fontSize: preset.font,
            fontWeight: "600",
            fill: 0xFFFFFF,
        })

        const chips = []
        let totalW = 0
        let maxH = 0

        for (const item of items) {
            const text = new Text({ text: item.label, style })
            const w = text.width + preset.padX * 2
            const h = text.height + preset.padY * 2

            const bg = new Graphics()
                .roundRect(0, 0, w, h, h * 0.25)
                .fill({ color: 0x111111, alpha: 0.85 })
                .roundRect(0, 0, w, h, h * 0.25)
                .stroke({ color: 0xFFFFFF, alpha: 0.18, width: 1 })

            text.position.set(preset.padX, preset.padY)

            const chip = new Container()
            chip.addChild(bg)
            chip.addChild(text)
            chip.alpha = item.alpha

            chips.push({ chip, w, h })
            totalW += w
            if (h > maxH) maxH = h
        }
        if (chips.length > 0) totalW += preset.gap * (chips.length - 1)

        const { width: sw, height: sh } = this.sceneDims
        const margin = preset.margin
        const pos = active.position || "bottom-center"
        let originX, originY

        if (pos.includes("left")) originX = margin
        else if (pos.includes("right")) originX = sw - totalW - margin
        else originX = (sw - totalW) / 2

        if (pos.startsWith("top")) originY = margin
        else originY = sh - maxH - margin

        let cursorX = originX
        for (const { chip, w } of chips) {
            chip.position.set(cursorX, originY)
            this.container.addChild(chip)
            cursorX += w + preset.gap
        }
    }

    destroy() {
        this.container.removeFromParent?.()
        this.container.destroy({ children: true })
    }
}
