import { DropShadowFilter } from "pixi-filters/drop-shadow"
import {
    BlurFilter,
    CanvasSource,
    Container,
    Geometry,
    GlProgram,
    GpuProgram,
    Graphics,
    Mesh,
    Shader,
    Sprite,
    Texture,
    UniformGroup
} from "pixi.js"
import { shallowEqual } from "react-redux"
import CanvasWrapper from "./CanvasWrapper"
import { applyEyeContactCorrection } from "./spatial/eyeContact"
import fragment from "./shaders/selfieSegmentation.frag?raw"
import vertex from "./shaders/selfieSegmentation.vert?raw"
import source from "./shaders/selfieSegmentation.wgsl?raw"

export default class Camera extends CanvasWrapper {
    constructor(dims) {
        super(dims)

        this.hasBlur = false
        this.blurAmount = 0
        this.isMirrored = false
        this.rendererDims = null
        this.eyeContactEnabled = false
        this.eyeContactLandmarks = null

        this.texture = new Texture({ source: new CanvasSource({ resource: this.canvas }) })

        this.fgMaskCanvas = new OffscreenCanvas(dims.x, dims.y)
        this.fgMaskCanvas.context = this.fgMaskCanvas.getContext('2d')
        this.fgMaskCanvas.context.fillStyle = 'black'
        this.fgMaskCanvas.context.fillRect(0, 0, dims.x, dims.y)

        this.fgMaskTexture = new Texture({ source: new CanvasSource({ resource: this.fgMaskCanvas }) })

        const geometry = new Geometry({
            attributes: {
                aPosition: [0, 0, dims.x, 0, dims.x, dims.y, 0, dims.y],
                aUV: [0, 0, 1, 0, 1, 1, 0, 1],
            },
            indexBuffer: [0, 1, 2, 0, 2, 3],
        })

        const shader = new Shader({
            glProgram: new GlProgram({ vertex, fragment }),
            gpuProgram: new GpuProgram({
                vertex: { entryPoint: 'mainVert', source },
                fragment: { entryPoint: 'mainFrag', source },
            }),
            resources: {
                uTexture: this.texture.source,
                uSampler: this.texture.source.style,
                uMaskTexture: this.fgMaskTexture.source,
                uMaskSampler: this.fgMaskTexture.source.style,
                segmentationUniforms: new UniformGroup({
                    uAlpha: { value: 1, type: "f32" },
                    uIsEnabled: { value: 1, type: "i32" }
                })
            }
        })

        this.fg = new Mesh({ geometry, shader })

        this.bg = new Sprite(this.texture)
        this.bgContainer = new Container()
        this.bgBlur = new BlurFilter({ quality: 10 })
        this.bgContainer.filters = [this.bgBlur]
        this.bgBlur.repeatEdgePixels = true

        this.container = new Container()
        this.outerContainer = new Container()
        this.outerContainer.label = "camera-video"
        this.outerContainer.visible = true
        this.outerContainer.zIndex = 1
        this.shadow = new DropShadowFilter({ offsetX: 0, offsetY: 0, quality: 10 })
        this.outerContainer.filters = [this.shadow]
        this.container.mask = new Graphics()
        this.bgContainer.addChild(this.bg)
        this.container.addChild(this.container.mask)
        this.container.addChild(this.bgContainer)
        this.container.addChild(this.fg)
        this.outerContainer.addChild(this.container)
    }

    drawFrame() {
        if (this.content) this.drawContent()
        if (this.blurMask) this.drawBlurMask()
    }

    update() {
        this.bgBlur.strength = this.getBlurAmount() * this.outerContainer.height / 200
        this.fg.shader.resources.segmentationUniforms.uniforms.uAlpha = this.outerContainer.alpha
    }

    setState({ shadowAlpha, hasBlur, blurAmount, isMirrored, rendererDims }) {
        let isBlurDirty = false
        let isMirrorDirty = false

        if (shadowAlpha !== undefined) this.shadow.alpha = shadowAlpha

        if (hasBlur !== undefined && this.hasBlur !== hasBlur) {
            this.hasBlur = hasBlur
            isBlurDirty = true
        }

        if (blurAmount !== undefined && this.blurAmount !== blurAmount) {
            this.blurAmount = blurAmount
            isBlurDirty = true
        }

        if (isMirrored !== undefined && this.isMirrored !== isMirrored) {
            this.isMirrored = isMirrored
            isMirrorDirty = true
        }

        if (rendererDims !== undefined && !shallowEqual(this.rendererDims, rendererDims)) {
            this.rendererDims = rendererDims
            this.shadow.blur = this.rendererDims.y * 0.02
            this.shadow.padding = this.rendererDims.y * 0.1
        }

        if (isBlurDirty) this.configureBlur()
        if (isMirrorDirty) this.configureMirror()
    }

    configureBlur() {
        const amount = this.getBlurAmount()
        this.bgContainer.visible = amount > 0
        this.fg.shader.resources.segmentationUniforms.uniforms.uIsEnabled = amount > 0 ? 1 : 0
    }

    configureMirror() {
        this.fg.scale.x = this.isMirrored ? -1 : 1
        this.fg.pivot.x = this.isMirrored ? this.dims.x : 0
        this.bg.scale.x = this.isMirrored ? -1 : 1
        this.bg.pivot.x = this.isMirrored ? this.dims.x : 0
    }

    setEyeContactData(landmarks, enabled) {
        this.eyeContactLandmarks = landmarks
        this.eyeContactEnabled = enabled
    }

    drawContent() {
        super.drawContent()
        if (this.eyeContactEnabled && this.eyeContactLandmarks) {
            applyEyeContactCorrection(this.canvas.context, this.eyeContactLandmarks, this.dims.x, this.dims.y)
        }
        this.texture.source.update()
    }

    drawBlurMask() {
        this.fgMaskCanvas.context.drawImage(this.blurMask, 0, 0)
        this.fgMaskTexture.source.update()
        this.blurMask.close()
        this.blurMask = null
        this.bg.texture.source.update()
    }

    getBlurAmount() {
        if (!this.hasBlur) return 0
        return this.blurAmount * 20
    }
}
