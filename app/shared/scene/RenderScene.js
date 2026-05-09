import {
    RenderTexture
} from "pixi.js"
import Scene from "./Scene"

export default class RenderScene extends Scene {
    constructor(state) {
        super(state)

        this.state = state

        this.renderTexture = null
    }

    async createApp() {
        await super.createApp(null, console.error)
    }

    async init(args, duration) {
        await super.init(args, duration)

        const {
            clipAnims,
            clickAnims,
            pans,
            zooms,
            subtitleAnims,
            cursorTypeAnims,
            cameraZooms,
            masks,
            videoDetails,
            inertia,
            cursorShadowAlpha,
            background,
            isCursorStatic,
            subtitleBackgroundColor,
            subtitleTextColor,
            subtitleWidth,
            subtitleShadowAlpha,
            subtitlePosition,
            trim,
            borderRadius,
            cursorCutOff,
            cursorIsLoop,
            cursorBlurStrength,
            cursorMovementRotation,
            cursorScale,
            showSpotlight,
            spotlightRadius,
            spotlightOpacity,
            spotlightFeather,
            padding,
            shadowAlpha,
            cameraVideoShadowAlpha,
            hasCameraVideoBackgroundBlur,
            cameraVideoBackgroundBlurAmount,
            isCameraVideoMirrored,
            rendererDims
        } = args

        this.clipAnimator.setState({ padding, configs: clipAnims })

        this.clickAnimator.setState({ cursorScale, configs: clickAnims, showClickRing: args.showClickRing ?? true })

        this.cursorAnimator.setState({
            videoDetails,
            inertia,
            cutOff: cursorCutOff,
            blurStrength: cursorBlurStrength,
            rotationStrength: cursorMovementRotation,
            isLoop: cursorIsLoop
        })

        if (args.pluginMouseStyle) {
            this.cursorAnimator.setPluginStyle(args.pluginMouseStyle)
        }

        this.spotlightAnimator.setState({
            showSpotlight,
            radius: spotlightRadius,
            opacity: spotlightOpacity,
            feather: spotlightFeather,
            leftTrim: trim.left,
            rightTrim: trim.right,
            topTrim: trim.top,
            bottomTrim: trim.bottom,
            borderRadius
        })

        this.panAnimator.setState({
            videoDetails,
            cursorCoords: this.cursorAnimator.coords,
            configs: pans,
            leftTrim: trim.left,
            rightTrim: trim.right,
            topTrim: trim.top,
            bottomTrim: trim.bottom
        })

        this.zoomAnimator.setState({
            leftTrim: trim.left,
            rightTrim: trim.right,
            topTrim: trim.top,
            bottomTrim: trim.bottom,
            configs: zooms
        })

        this.subtitleAnimator.setState({
            backgroundColor: subtitleBackgroundColor,
            textColor: subtitleTextColor,
            width: subtitleWidth,
            shadowAlpha: subtitleShadowAlpha,
            position: subtitlePosition,
            configs: subtitleAnims
        })

        this.cursorTypeAnimator.setState({
            isStatic: isCursorStatic,
            videoDetails: videoDetails,
            configs: cursorTypeAnims
        })

        this.cameraZoomAnimator?.setState({ configs: cameraZooms })

        this.maskAnimator.setState({ configs: masks })

        if (args.overlayAnims) {
            this.overlayAnimator.setState({ configs: args.overlayAnims, rendererDims })
        }

        if (args.spatials) {
            this.spatialAnimator?.setState({ configs: args.spatials })
        }

        this.cursorShadow.alpha = cursorShadowAlpha

        await this.background.setState({ config: background })

        this.screen.setState({
            shadowAlpha,
            leftTrim: trim.left,
            rightTrim: trim.right,
            topTrim: trim.top,
            bottomTrim: trim.bottom,
            borderRadius
        })

        this.camera?.setState({
            shadowAlpha: cameraVideoShadowAlpha,
            hasBlur: hasCameraVideoBackgroundBlur,
            blurAmount: cameraVideoBackgroundBlurAmount,
            isMirrored: isCameraVideoMirrored
        })

        this.rendererDims = rendererDims
        this.resize()
    }

    renderToPixelBuffer() {
        const renderer = this.app.renderer
        if (!this.renderTexture)
            this.renderTexture = RenderTexture.create({
                width: renderer.width,
                height: renderer.height,
            })
        renderer.render({ container: this.app.stage, target: this.renderTexture })
        const { pixels } = renderer.extract.pixels(this.renderTexture)
        return pixels.buffer
    }
}
