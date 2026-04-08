import { DropShadowFilter } from "pixi-filters/drop-shadow"
import { MotionBlurFilter } from "pixi-filters/motion-blur"
import { ZoomBlurFilter } from "pixi-filters/zoom-blur"
import {
    Application,
    Assets,
    Container,
    DOMAdapter,
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
import FilterAnimator from "./filter/FilterAnimator"
import MaskAnimator from "./mask/MaskAnimator"
import OverlayAnimator from "./overlay/OverlayAnimator"
import PanAnimator from "./pan/PanAnimator"
import Screen from "./Screen"
import SpatialAnimator from "./spatial/SpatialAnimator"
import SubtitleAnimator from "./subtitle/SubtitleAnimator"
import TransitionAnimator from "./transition/TransitionAnimator"
import ZoomAnimator from "./zoom/ZoomAnimator"

export default class Scene {
    constructor() {
        DOMAdapter.set(WebWorkerAdapter)

        Assets.add([{ src: Roboto, alias: "roboto" }])

        this.isDestroyed = false

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
        this.app = new Application()
        await this.app.init({
            canvas,
            background: '#000',
            autoStart: false,
            antialias: true,
            accessibilityOptions: { activateOnTab: false },
            preference: "webgl", // TODO: at the moment webgl is faster in web workers. Do benchmarking after electron updates
            useBackBuffer: true
        })

        this.app.stage.sortableChildren = true

        this.container = new Container()
        this.container.label = "main-container"
        this.zoomBlur = new ZoomBlurFilter({ strength: 0 })
        this.container.filters = [this.zoomBlur]
        this.container.zIndex = 0

        this.cursorShadow = new DropShadowFilter({ offsetX: 0, offsetY: 0, blur: 10, quality: 10 })
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
    }

    async init({ mouseEvents, hasCameraVideo, cursorFill, cursorStroke }, duration) {

        this.clipAnimator = new ClipAnimator(this.camera?.outerContainer, this.camera?.dims, hasCameraVideo)

        this.clickAnimator = new ClickAnimator(this.cursorImageContainer, this.cursorContainer)

        this.cursorAnimator = new CursorAnimator(this.cursorContainer, this.motionBlur, mouseEvents, this.screen.dims, duration)

        this.panAnimator = new PanAnimator(this.screen.container, this.zoomBlur, this.screen.dims, duration)

        this.zoomAnimator = new ZoomAnimator(this.screen.fg, this.screen.container, this.zoomBlur, this.screen.dims)

        const { family } = await Assets.load("roboto")
        this.subtitleAnimator = new SubtitleAnimator(this.subtitleContainer, family)

        this.cursorTypeAnimator = new CursorTypeAnimator(this.cursorImageContainer)

        if (this.camera)
            this.cameraZoomAnimator = new CameraZoomAnimator(this.camera.outerContainer, this.camera.dims)

        this.maskAnimator = new MaskAnimator(this.screen.maskContainer, this.screen.dims, this.screen.container)

        this.filterAnimator = new FilterAnimator(this.screen.container)

        this.overlayAnimator = new OverlayAnimator(this.app.stage)

        this.spatialAnimator = new SpatialAnimator(this.container, this.app)

        this.transitionAnimator = new TransitionAnimator(this.container)

        this.cursorFill = cursorFill
        this.cursorStroke = cursorStroke
        await this.createCursorSprites()
    }

    initScreenVideo(dims, content = null) {
        this.screen = new Screen(dims, this.app.screen, this.cursorContainer)
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
        this.subtitleAnimator?.update(this.time)
        this.cursorTypeAnimator?.update(this.time)
        const clipFrame = this.clipAnimator?.update(this.time)
        this.panAnimator?.update(this.time, clipFrame)
        this.zoomAnimator?.update(this.time, clipFrame)
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
