import { DropShadowFilter } from "pixi-filters/drop-shadow"
import { MotionBlurFilter } from "pixi-filters/motion-blur"
import { ZoomBlurFilter } from "pixi-filters/zoom-blur"
import {
    AccessibilitySystem,
    Application,
    Assets,
    Container,
    DOMAdapter,
    DOMPipe,
    EventSystem,
    extensions,
    ImageSource,
    Point,
    Sprite,
    Texture,
    WebWorkerAdapter
} from "pixi.js"

import {
    CAMERA_VIDEO,
    SCREEN_VIDEO
} from "../constants"
import Roboto from "../assets/fonts/Roboto-Regular.ttf"
import { createPixiAppOptions } from "./pixiAppOptions"
import {
    CREATE_CURSORS,
    postAsync
} from "../workers/helpers"
import Background from "./Background"
import Camera from "./Camera"
import CameraZoomAnimator from "./cameraZoom/CameraZoomAnimator"
import ClickAnimator from "./click/ClickAnimator"
import ClipAnimator from "./clip/ClipAnimator"
import CursorAnimator from "./cursorAnim/CursorAnimator"
import CursorTypeAnimator from "./cursorType/CursorTypeAnimator"
import DrawnMouseAnimator from "./drawnMouse/DrawnMouseAnimator"
import FilterAnimator from "./filter/FilterAnimator"
import MaskAnimator from "./mask/MaskAnimator"
import OverlayAnimator from "./overlay/OverlayAnimator"
import KeyboardOverlay from "./overlays/KeyboardOverlay"
import ExtraVideo from "./ExtraVideo"
import PanAnimator from "./pan/PanAnimator"
import Screen from "./Screen"
import SpatialAnimator from "./spatial/SpatialAnimator"
import SpotlightAnimator from "./spotlight/SpotlightAnimator"
import SubtitleAnimator from "./subtitle/SubtitleAnimator"
import TransitionAnimator from "./transition/TransitionAnimator"
import ZoomAnimator from "./zoom/ZoomAnimator"

const SUBTITLE_FONT_FALLBACK = "Arial, Helvetica, sans-serif"

export default class Scene {
    constructor({ isPreview = false } = {}) {
        DOMAdapter.set(WebWorkerAdapter)
        extensions.remove(DOMPipe, AccessibilitySystem, EventSystem)

        Assets.add([{ src: Roboto, alias: "roboto" }])

        this.isDestroyed = false
        this.isPreview = isPreview
        this.isZoomBlurActive = false

        this.screen = null

        this.camera = null

        this.background = null

        this.time = 0

        this.subtitleContainer = null

        this.hasCameraVideoBackgroundBlur = false
        this.cameraVideoBackgroundBlurAmount = 0

        this.closeableResources = []
    }

    async createApp(canvas = null, onBackgroundError = null) {
        console.log("[Scene] createApp: creating Application")
        this.app = new Application()
        console.log("[Scene] createApp: calling app.init (preference=webgl)", { hasCanvas: !!canvas, canvasType: canvas?.constructor?.name })
        await this.app.init(createPixiAppOptions(canvas))
        console.log("[Scene] createApp: app.init resolved")

        this.app.stage.sortableChildren = true

        this.container = new Container()
        this.container.label = "main-container"
        this.zoomBlur = new ZoomBlurFilter({
            strength: 0,
            maxKernelSize: this.isPreview ? 8 : 32
        })
        this.container.filters = null
        this.container.zIndex = 0

        this.cursorShadow = new DropShadowFilter({
            offsetX: 0,
            offsetY: 0,
            blur: 10,
            quality: this.isPreview ? 3 : 10
        })
        this.cursorShadow.padding = 50
        this.cursorImageContainer = new Container()
        this.cursorContainer = new Container()
        this.cursorContainer.position.set(this.app.screen.width * 0.5, this.app.screen.height * 0.5)
        this.cursorContainer.visible = false // Hidden until cursor coords are initialized
        this.motionBlur = new MotionBlurFilter({ velocity: new Point(), kernelSize: 15 })
        this.cursorContainer.filters = [this.cursorShadow, this.motionBlur]

        this.background = new Background(onBackgroundError)

        this.subtitleContainer = new Container()
        this.subtitleContainer.zIndex = 2

        this.app.stage.addChild(this.container)
        this.container.addChild(this.background.sprite)
        this.app.stage.addChild(this.subtitleContainer)

        this.cursorContainer.addChild(this.cursorImageContainer)

        // Plugin overlays
        this.keyboardOverlay = new KeyboardOverlay(this.app.stage)

        // Extra videos for the individual app recording plugin (lazy-allocated)
        this.extraVideos = []
        this.sceneBlocks = []
        this.sceneTrackOrder = []
    }

    initExtraVideo(index, dims) {
        if (this.extraVideos[index]) return this.extraVideos[index]
        const ev = new ExtraVideo(dims, index)
        this.app.stage.addChild(ev.outerContainer)
        if (this.rendererDims) ev.setRendererDims(this.rendererDims)
        this.extraVideos[index] = ev
        return ev
    }

    /** Provide the scene block list and the track ordering so applySceneAtTime works. */
    setSceneBlocks(blocks, trackOrder) {
        this.sceneBlocks = Array.isArray(blocks) ? blocks : []
        this.sceneTrackOrder = Array.isArray(trackOrder) ? trackOrder : []
        this._lastSceneFingerprint = null
    }

    /** Resolve which scene applies at `time`, returning {mainTrackId, slots} or null. */
    resolveSceneAt(time) {
        if (!this.sceneBlocks || this.sceneBlocks.length === 0) return null
        for (let i = this.sceneBlocks.length - 1; i >= 0; i--) {
            const b = this.sceneBlocks[i]
            if (time >= b.start && time <= b.end) return b
        }
        return null
    }

    /** Apply scene roles to all extras based on the active block at `time`. */
    applySceneAtTime(time) {
        if (!this.extraVideos.length) return
        const active = this.resolveSceneAt(time)
        const layout = active?.layout || "pip"
        // Cheap fingerprint to avoid re-laying-out every frame.
        const fp = active
            ? `${active.id}|${layout}|${active.mainTrackId || ''}|${JSON.stringify(active.slots || {})}`
            : "default"
        if (fp === this._lastSceneFingerprint) return
        this._lastSceneFingerprint = fp

        if (!active) {
            // No scene active → legacy stack layout.
            for (const ev of this.extraVideos) ev?.setSceneRole("default")
            return
        }

        if (layout === "sidebyside") {
            this._applySideBySide(active)
            return
        }
        if (layout === "grid") {
            this._applyGrid(active)
            return
        }
        // Default: PiP — main fills, others go to corners or hidden.
        for (let i = 0; i < this.extraVideos.length; i++) {
            const ev = this.extraVideos[i]
            if (!ev) continue
            const trackId = this.sceneTrackOrder[i]
            if (!trackId) { ev.setSceneRole("default"); continue }
            if (trackId === active.mainTrackId) {
                ev.setSceneRole("main")
                continue
            }
            const slot = (active.slots || {})[trackId]
            if (!slot || slot === "hidden") {
                ev.setSceneRole("hidden")
            } else {
                ev.setSceneRole("corner", { corner: slot })
            }
        }
    }

    /** Side-by-side: main on the left, first visible non-main slot on the right. */
    _applySideBySide(active) {
        const slots = active.slots || {}
        // Pick the "right" track: first sceneTrackOrder entry that is not main and not hidden.
        let rightTrackId = null
        for (const trackId of this.sceneTrackOrder) {
            if (!trackId || trackId === active.mainTrackId) continue
            const slot = slots[trackId]
            if (slot && slot !== "hidden") { rightTrackId = trackId; break }
        }
        for (let i = 0; i < this.extraVideos.length; i++) {
            const ev = this.extraVideos[i]
            if (!ev) continue
            const trackId = this.sceneTrackOrder[i]
            if (!trackId) { ev.setSceneRole("default"); continue }
            if (trackId === active.mainTrackId) ev.setSceneRole("half-left")
            else if (trackId === rightTrackId) ev.setSceneRole("half-right")
            else ev.setSceneRole("hidden")
        }
    }

    /** Grid: tile every non-hidden track (main first at top-left). */
    _applyGrid(active) {
        const slots = active.slots || {}
        const visibleIds = []
        if (active.mainTrackId) visibleIds.push(active.mainTrackId)
        for (const trackId of this.sceneTrackOrder) {
            if (!trackId || trackId === active.mainTrackId) continue
            const slot = slots[trackId]
            if (slot && slot !== "hidden") visibleIds.push(trackId)
        }
        const total = visibleIds.length
        const cols = total <= 1 ? 1 : (total === 2 ? 2 : (total <= 4 ? 2 : Math.ceil(Math.sqrt(total))))
        const rows = Math.max(1, Math.ceil(total / cols))
        const positions = new Map()
        visibleIds.forEach((id, idx) => {
            positions.set(id, { row: Math.floor(idx / cols), col: idx % cols, rows, cols })
        })
        for (let i = 0; i < this.extraVideos.length; i++) {
            const ev = this.extraVideos[i]
            if (!ev) continue
            const trackId = this.sceneTrackOrder[i]
            const cell = trackId ? positions.get(trackId) : null
            if (cell) ev.setSceneRole("grid", { gridCell: cell })
            else ev.setSceneRole("hidden")
        }
    }

    setExtraFrame(index, content) {
        const ev = this.extraVideos[index]
        if (!ev) return
        ev.content = content
        ev.drawFrame()
    }

    setExtraVisibility(index, visible) {
        this.extraVideos[index]?.setVisible(visible)
    }

    destroyExtraVideos() {
        for (const ev of this.extraVideos) ev?.destroy()
        this.extraVideos = []
    }

    async init({ mouseEvents, hasCameraVideo, cursorFill, cursorStroke }, duration) {
        console.log("[Scene] init: constructing animators")

        this.clipAnimator = new ClipAnimator(this.camera?.outerContainer, this.camera?.dims, hasCameraVideo)

        this.clickAnimator = new ClickAnimator(this.cursorImageContainer, this.cursorContainer)

        this.cursorAnimator = new CursorAnimator(
            this.cursorContainer,
            this.motionBlur,
            mouseEvents,
            this.screen.dims,
            duration,
            this.isPreview ? 11 : 25
        )

        this.spotlightAnimator = new SpotlightAnimator(this.screen.spotlightContainer, this.cursorContainer, this.screen.dims)

        this.panAnimator = new PanAnimator(this.screen.container, this.zoomBlur, this.screen.dims, duration)

        this.zoomAnimator = new ZoomAnimator(this.screen.fg, this.screen.container, this.zoomBlur, this.screen.dims)

        this.subtitleAnimator = new SubtitleAnimator(this.subtitleContainer, await this.loadSubtitleFontFamily())

        this.cursorTypeAnimator = new CursorTypeAnimator(this.cursorImageContainer)

        if (this.camera)
            this.cameraZoomAnimator = new CameraZoomAnimator(this.camera.outerContainer, this.camera.dims)

        this.maskAnimator = new MaskAnimator(this.screen.maskContainer, this.screen.dims, this.screen.container)

        this.filterAnimator = new FilterAnimator(this.screen.container)

        this.overlayAnimator = new OverlayAnimator(this.app.stage)

        this.spatialAnimator = new SpatialAnimator(this.container, this.app)

        this.transitionAnimator = new TransitionAnimator(this.container)

        // Drawn-mouse paths render on top of everything; coords are renderer-pixel
        // so they map 1:1 to the on-canvas position where the user drew them.
        this.drawnMouseAnimator = new DrawnMouseAnimator(this.app.stage)

        this.cursorFill = cursorFill
        this.cursorStroke = cursorStroke
        console.log("[Scene] init: awaiting createCursorSprites")
        await this.createCursorSprites()
        console.log("[Scene] init: createCursorSprites done")
    }

    async loadSubtitleFontFamily() {
        console.log("[Scene] init: awaiting Assets.load('roboto')")
        try {
            const { family } = await Assets.load("roboto")
            console.log("[Scene] init: roboto loaded, family=", family)
            return family || SUBTITLE_FONT_FALLBACK
        } catch (e) {
            console.warn("[Scene] init: roboto failed to load; using fallback font", e?.message || String(e))
            return SUBTITLE_FONT_FALLBACK
        }
    }

    initScreenVideo(dims, content = null, textureDims = dims) {
        this.screen = new Screen(
            dims,
            this.app.screen,
            this.cursorContainer,
            textureDims,
            this.isPreview ? 3 : 10
        )
        this.container.addChild(this.screen.container)
        this.setFrame(SCREEN_VIDEO, content)
    }

    initCameraVideo(dims, content = null) {
        this.camera = new Camera(dims)
        this.app.stage.addChild(this.camera.outerContainer)
        this.setFrame(CAMERA_VIDEO, content)
    }

    setFrame(type, drawable, blurMask = null) {
        switch (type) {
            case SCREEN_VIDEO:
                this.screen.content = drawable
                this.screen.drawFrame()
                break
            case CAMERA_VIDEO:
                this.camera.content = drawable
                this.camera.blurMask = blurMask
                this.camera.drawFrame()
                break
            default:
                if (typeof type === "string" && type.startsWith("extra-")) {
                    const idx = parseInt(type.slice(6), 10)
                    if (Number.isFinite(idx)) this.setExtraFrame(idx, drawable)
                }
                break
        }
    }

    async createCursorSprites() {
        // Prevent sprites from being created twice when both fill and stroke change
        if (this.cursorFill !== this.cursorStroke) {

            const cursorBitmaps = await postAsync(self, CREATE_CURSORS, { stroke: this.cursorStroke, fill: this.cursorFill })

            this.closeableResources.push(...Object.values(cursorBitmaps))

            const sprites = Object.entries(cursorBitmaps).map(([label, bmp]) => {
                const sprite = new Sprite(new Texture({ source: new ImageSource({ resource: bmp }) }))
                sprite.label = label
                sprite.visible = false
                sprite.alpha = .5
                sprite.scale.set(20)
                return sprite
            })

            this.processCursorSprites(sprites)

            this.cursorImageContainer.children.forEach(s => s.texture.source.options.resource.close?.())
            this.cursorImageContainer.removeChildren()

            this.cursorImageContainer.addChild(...sprites)
        }
    }

    processCursorSprites(sprites) {
        sprites.forEach(sprite => {
            switch (sprite.label) {
                case "default":
                    sprite.anchor.set(0.18, 0.04)
                    break
                case "pointer":
                    sprite.anchor.set(0.42, 0.04)
                    break
                case "vertical-text":
                    sprite.anchor.set(0.5, 0.5)
                    sprite.rotation = Math.PI * 0.5
                    break
                case "text":
                case "wait":
                case "crosshair":
                case "nwse-resize":
                case "nesw-resize":
                case "ew-resize":
                case "ns-resize":
                case "move":
                    sprite.anchor.set(0.5, 0.5)
                    break
            }
        })
    }

    update() {
        if (this.isDestroyed) return

        this.clickAnimator?.update(this.time)
        this.cursorAnimator?.update(this.time)
        this.drawnMouseAnimator?.update(this.time)
        this.spotlightAnimator?.update()
        this.subtitleAnimator?.update(this.time)
        this.cursorTypeAnimator?.update(this.time)
        this.keyboardOverlay?.update(this.time)
        this.applySceneAtTime?.(this.time)
        const clipFrame = this.clipAnimator?.update(this.time)
        this.panAnimator?.update(this.time, clipFrame)
        this.zoomAnimator?.update(this.time, clipFrame)
        const shouldApplyZoomBlur = Math.abs(this.zoomBlur.strength) > 0.0001
        if (shouldApplyZoomBlur !== this.isZoomBlurActive) {
            this.isZoomBlurActive = shouldApplyZoomBlur
            this.container.filters = shouldApplyZoomBlur ? [this.zoomBlur] : null
        }
        this.cameraZoomAnimator?.update(this.time, clipFrame)
        this.maskAnimator?.update(this.time)
        this.overlayAnimator?.update(this.time)
        this.spatialAnimator?.update(this.time)
        this.transitionAnimator?.update(this.time)

        this.camera?.update()
    }

    async resize() {
        if (this.isDestroyed || !this.rendererDims || (this.app.renderer.width === this.rendererDims.x && this.app.renderer.height === this.rendererDims.y)) return

        this.app.renderer.resize(this.rendererDims.x, this.rendererDims.y)

        await this.background.setState({ rendererDims: this.rendererDims })

        this.camera?.setState({ rendererDims: this.rendererDims })

        this.zoomBlur.innerRadius = this.rendererDims.x * 0.2

        this.screen.setState({ rendererDims: this.rendererDims })

        this.cursorShadow.blur = this.rendererDims.y * 0.02
        this.cursorShadow.padding = this.rendererDims.y * 0.1

        this.subtitleAnimator.setState({ rendererDims: this.rendererDims })

        this.clipAnimator.setState({ rendererDims: this.rendererDims })

        this.cameraZoomAnimator?.setState({ rendererDims: this.rendererDims })

        this.maskAnimator.setState({ rendererDims: this.rendererDims })

        this.overlayAnimator?.setState({ rendererDims: this.rendererDims })

        this.spatialAnimator?.setState({ rendererDims: this.rendererDims })

        this.keyboardOverlay?.setDims(this.rendererDims.x, this.rendererDims.y)

        for (const ev of this.extraVideos) ev?.setRendererDims(this.rendererDims)

        this.transitionAnimator?.setState({ rendererDims: this.rendererDims })

        this.update()
        this.app?.render()
    }

    setTime(t) {
        this.time = t
    }

    destroy() {
        this.isDestroyed = true
        try {
            this.app?.destroy({ children: true, texture: true, textureSource: true, context: true, removeView: true })
            this.closeableResources.forEach(r => r.close())
        } catch (e) {
            console.log(e)
        }
    }
}
