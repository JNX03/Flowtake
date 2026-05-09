import {
    Container,
    Graphics,
    Text,
    TextStyle
} from "pixi.js"
import {
    applyInertia,
    getCoords,
    getGroupedMouseEvents,
    INERTIA_FPS,
    interpolateCoords
} from "../../sceneHelpers"
import shallowEqual from "../../shallowEqual"
import Animator from "../Animator"
import Drag from "./Drag"

const MOTION_ROTATION_FRAMES = 10
const MOTION_ROTATION_MAX_STRENGTH = Math.PI / 4
const MOTION_ROTATION_FACTOR = 0.05

export default class CursorAnimator extends Animator {
    constructor(
        cursor,
        motionBlur,
        mouseEvents,
        screenVideoDimensions,
        duration
    ) {
        super()

        this.videoDetails = null
        this.coords = null
        this.inertia = null
        this.blurStrength = null
        this.rotationStrength = null
        this.cutOff = null
        this.isLoop = null

        this.cursor = cursor
        this.motionBlur = motionBlur

        this.mouseEvents = mouseEvents
        this.screenVideoDimensions = screenVideoDimensions
        this.duration = duration

        this.pluginStyle = null
        this.styleEntities = []      // [{id, start, end, color?, showLabel?, label?, preset?}]
        this.styleDefaults = null    // { color, showLabel, label, preset }
        this.styleEnabled = false    // global plugin toggle
        this.tagContainer = null
        this.tagBg = null
        this.tagText = null
        this.presetGraphics = null
        this._lastResolvedStyleKey = null
        this._activePreset = "default"
    }


    update(timestamp) {
        if (!this.coords || !this.videoDetails || this.blurStrength === null || this.rotationStrength === null || this.cutOff === null || this.isLoop === null) return

        // Show cursor container once we have valid coords
        if (!this.cursor.visible) this.cursor.visible = true

        let coords = this.getCoords(timestamp)
        let prevCoords = this.getCoords(Math.max(timestamp - 1000 / INERTIA_FPS, 0))

        this.cursor.position.set(coords.x, coords.y)

        // Adaptive motion blur: scale with velocity
        const dx = prevCoords.x - coords.x
        const dy = prevCoords.y - coords.y
        const speed = Math.sqrt(dx * dx + dy * dy)
        const blurScale = Math.min(speed * 0.005, 1.0) * this.blurStrength

        this.motionBlur.velocity.set(dx * blurScale, dy * blurScale)
        this.motionBlur.kernelSize = Math.min(Math.max(Math.round(speed * 0.3), 3), 25)

        if (this.rotationStrength > 0) {
            let rotation = Math.min(this.calculateAveragedStrength(timestamp, coords, MOTION_ROTATION_FRAMES) * MOTION_ROTATION_FACTOR, MOTION_ROTATION_MAX_STRENGTH)
            this.cursor.rotation = rotation * this.rotationStrength
        }

        // Counter-rotate the plugin tag so it stays axis-aligned even when the
        // cursor container rotates from motion-based rotation.
        if (this.tagContainer && this.tagContainer.visible) {
            this.tagContainer.rotation = -(this.cursor.rotation || 0)
        }

        // Resolve plugin mouse style at the current playback time. Runs every
        // frame but only re-applies tint/label when the resolved values change.
        this.applyResolvedStyle(timestamp)
    }

    /** Mouse style block list (entity adapter entries). */
    setStyleEntities(entities) {
        this.styleEntities = Array.isArray(entities) ? entities : []
        this._lastResolvedStyleKey = null
    }

    /** Slice-level defaults — used when no entity is active. */
    setStyleDefaults(defaults) {
        this.styleDefaults = defaults || null
        this._lastResolvedStyleKey = null
    }

    /** Master plugin on/off. When off, the cursor reverts to default. */
    setStyleEnabled(enabled) {
        this.styleEnabled = !!enabled
        this._lastResolvedStyleKey = null
    }

    /** Resolve which { color, showLabel, label, preset } applies at `time`. */
    resolveStyleAt(time) {
        if (!this.styleEnabled) return null
        // Find active entity by start/end window; entities are sorted by start
        // (the adapter does this) so a linear scan from the back catches the
        // last-added overlapping entity if multiple overlap.
        let active = null
        for (let i = this.styleEntities.length - 1; i >= 0; i--) {
            const e = this.styleEntities[i]
            if (time >= e.start && time <= e.end) { active = e; break }
        }
        const d = this.styleDefaults || {}
        return {
            color: active?.color ?? d.color ?? "#ffffff",
            showLabel: active?.showLabel ?? d.showLabel ?? false,
            label: active?.label ?? d.label ?? "",
            preset: active?.preset ?? d.preset ?? "default",
        }
    }

    applyResolvedStyle(time) {
        const resolved = this.resolveStyleAt(time)
        const style = resolved
            ? { enabled: true, color: resolved.color, showLabel: resolved.showLabel, label: resolved.label, preset: resolved.preset }
            : { enabled: false, preset: "default" }
        const key = `${style.enabled ? 1 : 0}|${style.color || ''}|${style.showLabel ? 1 : 0}|${style.label || ''}|${style.preset || 'default'}`
        if (key === this._lastResolvedStyleKey) return
        this._lastResolvedStyleKey = key
        this.setPluginStyle(style)
        this.applyPreset(style.preset || "default", style.color || "#ffffff", !!style.enabled)
    }

    /** Swap the cursor sprite between system bitmap and a built-in preset shape. */
    applyPreset(preset, colorHex, enabled) {
        const want = enabled ? preset : "default"
        if (this._activePreset === want && this.presetGraphics) {
            // Just retint
            if (want !== "default") this.redrawPreset(want, colorHex)
            return
        }
        this._activePreset = want

        if (want === "default") {
            // Show system cursor sprites again, hide preset graphics.
            if (this.cursorImageContainer) this.cursorImageContainer.visible = true
            if (this.presetGraphics) this.presetGraphics.visible = false
            return
        }

        // Hide the system cursor sprites; render the chosen preset shape.
        if (this.cursorImageContainer) this.cursorImageContainer.visible = false
        if (!this.presetGraphics) {
            this.presetGraphics = new Graphics()
            this.presetGraphics.label = "plugin-cursor-preset"
            this.cursor.addChildAt(this.presetGraphics, 0)
        }
        this.presetGraphics.visible = true
        this.redrawPreset(want, colorHex)
    }

    redrawPreset(preset, colorHex) {
        const g = this.presetGraphics
        if (!g) return
        const color = hexStringToInt(colorHex)
        g.clear()
        // Sizes here are in scene-pixel units (the cursorContainer is positioned
        // in scene coords; we draw small enough that cursorScale still applies).
        switch (preset) {
            case "arrow":
                g.poly([0, 0, 0, 28, 8, 22, 13, 32, 17, 30, 12, 21, 20, 21])
                    .fill({ color, alpha: 1 })
                    .stroke({ color: 0xffffff, alpha: 0.85, width: 1.2 })
                break
            case "pointer":
                g.poly([4, 0, 4, 22, 8, 19, 12, 28, 16, 26, 12, 18, 18, 18])
                    .fill({ color, alpha: 1 })
                    .stroke({ color: 0xffffff, alpha: 0.85, width: 1.2 })
                g.circle(11, 11, 3).stroke({ color: 0xffffff, alpha: 0.6, width: 1 })
                break
            case "dot":
                g.circle(0, 0, 8).fill({ color, alpha: 0.9 })
                g.circle(0, 0, 8).stroke({ color: 0xffffff, alpha: 0.85, width: 1.5 })
                break
            case "ring":
                g.circle(0, 0, 12).stroke({ color, alpha: 1, width: 3 })
                g.circle(0, 0, 4).fill({ color, alpha: 0.9 })
                break
            case "target":
                g.circle(0, 0, 14).stroke({ color, alpha: 0.9, width: 2 })
                g.moveTo(-18, 0).lineTo(-6, 0).stroke({ color, alpha: 0.9, width: 2 })
                g.moveTo(6, 0).lineTo(18, 0).stroke({ color, alpha: 0.9, width: 2 })
                g.moveTo(0, -18).lineTo(0, -6).stroke({ color, alpha: 0.9, width: 2 })
                g.moveTo(0, 6).lineTo(0, 18).stroke({ color, alpha: 0.9, width: 2 })
                g.circle(0, 0, 2).fill({ color, alpha: 1 })
                break
            case "agent":
                // Concentric ring with subtle inner dot — meant to read as
                // "AI cursor" in screencasts.
                g.circle(0, 0, 18).stroke({ color, alpha: 0.45, width: 2 })
                g.circle(0, 0, 12).stroke({ color, alpha: 0.85, width: 2.5 })
                g.circle(0, 0, 4).fill({ color, alpha: 1 })
                break
            default:
                break
        }
    }

    setState({ videoDetails, inertia, cutOff, blurStrength, rotationStrength, isLoop }) {
        let areCoordsDirty = false
        let isCutOffDirty = false
        let isConfigureDirty = false

        if (inertia !== undefined && this.inertia !== inertia) {
            this.inertia = inertia
            areCoordsDirty = true
            isCutOffDirty = true
            isConfigureDirty = true
        }

        if (videoDetails !== undefined && !shallowEqual(this.videoDetails, videoDetails)) {
            this.videoDetails = videoDetails
            isCutOffDirty = true
        }

        if (cutOff !== undefined && this.cutOff !== cutOff) {
            this.cutOff = cutOff
            isCutOffDirty = true
        }

        if (isLoop !== undefined && this.isLoop !== isLoop) {
            this.isLoop = isLoop
            isCutOffDirty = true
        }

        if (blurStrength !== undefined && this.blurStrength !== blurStrength)
            this.blurStrength = blurStrength

        if (rotationStrength !== undefined && this.rotationStrength !== rotationStrength)
            this.rotationStrength = rotationStrength

        if (areCoordsDirty) this.configureCoords()
        if (isConfigureDirty) this.configure()
        if (isCutOffDirty) {
            // Ensure coords are computed before configuring cutoff
            if (!this.coords && this.inertia !== null) this.configureCoords()
            this.configureCutOffCoords()
        }
    }

    configureCoords() {
        if (this.inertia === null) return

        this.coords = applyInertia(this.mouseEvents, this.duration, this.inertia)
    }

    configureCutOffCoords() {
        if (!this.videoDetails || !this.coords || this.cutOff === null || this.isLoop === null) return

        this.cutOffFrom = getCoords(this.screenVideoDimensions, this.videoDetails, this.videoDetails.end - this.cutOff, this.coords)
        this.cutOffTo = getCoords(this.screenVideoDimensions, this.videoDetails, this.videoDetails.start, this.coords)
    }

    configure() {
        if (!this.coords) return

        const groupedEvents = getGroupedMouseEvents(this.mouseEvents)
        const groups = [[]]
        let wasMouseDown = false

        this.mouseEvents
            .filter(({ type }) => type === "mousemove")
            .forEach(event => {
                const isMouseDown = groupedEvents.some(({ mousedown, mouseup }) =>
                    event.timestamp >= mousedown.timestamp && event.timestamp <= mouseup.timestamp)

                if (!isMouseDown) {
                    if (wasMouseDown) groups.push([])
                    groups[groups.length - 1].push(event)
                }
                wasMouseDown = isMouseDown
            })

        // filter out mousedown and mouseup events and mousemove events that aren't part of drags
        const drags = groupedEvents
            .map(({ mousedown, mouseup }) =>
                this.mouseEvents.filter(({ type, timestamp }) =>
                    type === "mousemove" && timestamp > mousedown.timestamp && timestamp < mouseup.timestamp))
            // require at least 2 events for a drag
            .filter(mousemoves => mousemoves.length > 1)

        this.anims = drags.map(events => new Drag({ events }, this.coords))
    }

    computeIdleFrame(timestamp) {
        return { position: getCoords(this.screenVideoDimensions, this.videoDetails, timestamp, this.coords) }
    }

    getCoords(timestamp) {
        if (timestamp < this.videoDetails.end - this.cutOff) {
            const frame = this.computeFrame(timestamp)
            return frame.position
        } else if (this.isLoop) {
            const interpolator = Math.max(timestamp - (this.videoDetails.end - this.cutOff), 0) / this.cutOff
            return interpolateCoords(this.cutOffFrom, this.cutOffTo, interpolator)
        } else return this.cutOffFrom
    }

    /**
     * Apply plugin-driven cursor styling.
     * @param {{enabled:boolean, color:string, label:string|null, showLabel:boolean}} style
     */
    setPluginStyle(style) {
        this.pluginStyle = style || null

        const enabled = !!style?.enabled
        const tintHex = enabled && style.color ? hexStringToInt(style.color) : 0xFFFFFF

        // Tint cursor sprite children only — skip the tag container AND the
        // preset graphics so their own colored fills aren't double-multiplied.
        if (this.cursor?.children) {
            for (const child of this.cursor.children) {
                if (child === this.tagContainer) continue
                if (child === this.presetGraphics) continue
                if ('tint' in child) child.tint = tintHex
            }
        }

        const wantTag = enabled && style?.showLabel && !!style?.label
        if (wantTag) {
            this.ensureTag()
            if (this.tagText.text !== style.label) this.tagText.text = style.label
            this.tagBg.clear()
                .roundRect(-6, -3, this.tagText.width + 12, this.tagText.height + 6, 999)
                .fill({ color: tintHex, alpha: 0.95 })
            this.tagContainer.visible = true
        } else if (this.tagContainer) {
            this.tagContainer.visible = false
        }
    }

    ensureTag() {
        if (this.tagContainer) return
        const c = new Container()
        c.label = "plugin-cursor-tag"
        // Anchor the tag below-right of the cursor hot-spot. Coords are local to cursorContainer
        // and unaffected by the container's rotation animation since we keep the tag off the
        // rotated child.
        c.position.set(28, 24)
        const bg = new Graphics()
        const text = new Text({
            text: "",
            style: new TextStyle({
                fontFamily: "Inter, sans-serif",
                fontSize: 22,
                fontWeight: "600",
                fill: 0xFFFFFF,
            }),
        })
        text.position.set(0, 0)
        c.addChild(bg)
        c.addChild(text)
        this.cursor.addChild(c)
        this.tagContainer = c
        this.tagBg = bg
        this.tagText = text
    }

    calculateAveragedStrength(timestamp, coords, numPreviousFrames) {
        let totalStrength = 0
        let prevCoords = coords

        for (let i = 1; i <= numPreviousFrames; i++) {
            const frameTimestamp = Math.max(timestamp - (i * 1000 / INERTIA_FPS), 0)
            const currentCoords = this.getCoords(frameTimestamp)

            const strength = (prevCoords.x - currentCoords.x)
            totalStrength += strength

            prevCoords = currentCoords
        }

        return totalStrength / numPreviousFrames
    }
}

function hexStringToInt(hex) {
    if (typeof hex !== "string") return 0xFFFFFF
    const stripped = hex.startsWith("#") ? hex.slice(1) : hex
    const n = parseInt(stripped, 16)
    return Number.isFinite(n) ? n : 0xFFFFFF
}
