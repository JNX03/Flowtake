import {
    setIsCleaningUpSceneDone
} from "../redux/editorSlice"
import {
    setBackground
} from "../redux/projectSlice"
import {
    postDispatch
} from "../workers/helpers"
import Scene from "./Scene"

export default class PreviewScene extends Scene {
    constructor() {
        super()

        this.cursorFill = null
        this.cursorStroke = null

        this.rendererDims = null
    }

    createApp(canvas = null) {
        return super.createApp(canvas, () => postDispatch(setBackground({ type: "color", value: "#000000" })))
    }

    render() {
        if (this.isDestroyed) return
        this.app?.render()
    }

    destroy() {
        super.destroy()
        postDispatch(setIsCleaningUpSceneDone(true))
    }

    async onReduxUpdate({ type, payload }) {
        switch (type) {
            case 'project.cursorShadowAlpha':
                this.cursorShadow.alpha = payload
                break
            case 'project.background':
                await this.background.setState({config: payload})
                break
            case 'cursorTypeAnims.isStatic':
                this.cursorTypeAnimator.setState({ isStatic: payload })
                break
            case 'project.videoDetails': {
                this.cursorTypeAnimator.setState({ videoDetails: payload })
                this.panAnimator.setState({ videoDetails: payload })
                this.cursorAnimator.setState({ videoDetails: payload })
                break
            }
            case 'subtitleAnims.backgroundColor':
                this.subtitleAnimator.setState({ backgroundColor: payload })
                break
            case 'subtitleAnims.textColor':
                this.subtitleAnimator.setState({ textColor: payload })
                break
            case 'subtitleAnims.width':
                this.subtitleAnimator.setState({ width: payload })
                break
            case 'subtitleAnims.shadowAlpha':
                this.subtitleAnimator.setState({ shadowAlpha: payload })
                break
            case 'subtitleAnims.position':
                this.subtitleAnimator.setState({ position: payload })
                break
            case 'animator.rendererDims':
                this.rendererDims = payload
                this.resize()
                break
            case 'project.leftTrim':
                this.screen.setState({ leftTrim: payload })
                this.zoomAnimator.setState({ leftTrim: payload })
                this.panAnimator.setState({ leftTrim: payload })
                this.spotlightAnimator.setState({ leftTrim: payload })
                break
            case 'project.rightTrim':
                this.screen.setState({ rightTrim: payload })
                this.zoomAnimator.setState({ rightTrim: payload })
                this.panAnimator.setState({ rightTrim: payload })
                this.spotlightAnimator.setState({ rightTrim: payload })
                break
            case 'project.topTrim':
                this.screen.setState({ topTrim: payload })
                this.zoomAnimator.setState({ topTrim: payload })
                this.panAnimator.setState({ topTrim: payload })
                this.spotlightAnimator.setState({ topTrim: payload })
                break
            case 'project.bottomTrim':
                this.screen.setState({ bottomTrim: payload })
                this.zoomAnimator.setState({ bottomTrim: payload })
                this.panAnimator.setState({ bottomTrim: payload })
                this.spotlightAnimator.setState({ bottomTrim: payload })
                break
            case 'project.borderRadius':
                this.screen.setState({ borderRadius: payload })
                this.spotlightAnimator.setState({ borderRadius: payload })
                break
            case 'plugin.mouseStyle.enabled':
                this.cursorAnimator?.setStyleEnabled(payload)
                break
            case 'plugin.mouseStyle.defaults':
                this.cursorAnimator?.setStyleDefaults(payload)
                break
            case 'plugin.mouseStyle.entities':
                this.cursorAnimator?.setStyleEntities(payload)
                break
            case 'plugin.keyboardOverlay.enabled':
                this.keyboardOverlay?.setEnabled(payload)
                break
            case 'plugin.keyboardOverlay.events':
                this.keyboardOverlay?.setEvents(payload)
                break
            case 'plugin.keyboardLayout.entities':
                this.keyboardOverlay?.setEntities(payload)
                break
            case 'plugin.keyboardLayout.defaults':
                this.keyboardOverlay?.setDefaults(payload)
                break
            case 'cursorCoords.inertia':
                this.cursorAnimator.setState({ inertia: payload })
                this.panAnimator.setState({ cursorCoords: this.cursorAnimator.coords })
                break
            case 'cursorCoords.cutOff':
                this.cursorAnimator.setState({ cutOff: payload })
                break
            case 'cursorCoords.isLoop':
                this.cursorAnimator.setState({ isLoop: payload })
                break
            case 'cursorCoords.blurStrength':
                this.cursorAnimator.setState({ blurStrength: payload })
                break
            case 'cursorCoords.showClickRing':
                this.clickAnimator.setState({ showClickRing: payload })
                break
            case 'cursorCoords.showSpotlight':
                this.spotlightAnimator.setState({ showSpotlight: payload })
                break
            case 'cursorCoords.spotlightRadius':
                this.spotlightAnimator.setState({ radius: payload })
                break
            case 'cursorCoords.spotlightOpacity':
                this.spotlightAnimator.setState({ opacity: payload })
                break
            case 'cursorCoords.spotlightFeather':
                this.spotlightAnimator.setState({ feather: payload })
                break
            case 'project.cursorMovementRotation':
                this.cursorAnimator.setState({ rotationStrength: payload })
                break
            case 'project.cursorScale':
                this.clickAnimator.setState({ cursorScale: payload })
                break
            case 'project.padding':
                this.clipAnimator.setState({ padding: payload })
                break
            case 'project.cursorStroke':
                this.cursorStroke = payload
                await this.createCursorSprites()
                break
            case 'project.cursorFill':
                this.cursorFill = payload
                await this.createCursorSprites()
                break
            case 'project.shadowAlpha':
                this.screen.setState({ shadowAlpha: payload })
                break
            case 'project.cameraVideoShadowAlpha':
                this.camera.setState({ shadowAlpha: payload })
                break
            case 'project.hasCameraVideoBackgroundBlur':
                this.camera.setState({ hasBlur: payload })
                break
            case 'project.cameraVideoBackgroundBlurAmount':
                this.camera.setState({ blurAmount: payload })
                break
            case 'project.isCameraVideoMirrored':
                this.camera.setState({ isMirrored: payload })
                break
            case 'cameraZoomAnims':
                this.cameraZoomAnimator?.setState({ configs: payload })
                break
            case 'cursorTypeAnims':
                this.cursorTypeAnimator.setState({ configs: payload })
                break
            case 'subtitleAnims':
                this.subtitleAnimator.setState({ configs: payload })
                break
            case 'zoomAnims':
                this.zoomAnimator.setState({ configs: payload })
                break
            case 'panAnims':
                this.panAnimator.setState({ configs: payload })
                break
            case 'clickAnims':
                this.clickAnimator.setState({ configs: payload })
                break
            case 'clipAnims':
                this.clipAnimator.setState({ configs: payload })
                this.transitionAnimator?.setState({ configs: payload })
                break
            case 'maskAnims':
                this.maskAnimator.setState({ configs: payload })
                break
            case 'overlayAnims':
                this.overlayAnimator?.setState({ configs: payload })
                break
            case 'spatialAnims':
                this.spatialAnimator?.setState({ configs: payload })
                break
            case 'filterAnims':
            case 'filterAnims.brightness':
            case 'filterAnims.contrast':
            case 'filterAnims.saturation':
            case 'filterAnims.gamma':
            case 'filterAnims.blur':
            case 'filterAnims.hue':
            case 'filterAnims.temperature':
            case 'filterAnims.vignette':
                this.filterAnimator?.setState({ filterConfig: payload })
                break
            case 'isCleaningUpScene':
                this.destroy()
                break
            default:
                console.warn(`Unhandled redux update type: ${type}`)
        }
        this.update()
        this.render()
    }
}
