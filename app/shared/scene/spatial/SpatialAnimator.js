// NOTE: Mesh, MeshMaterial, Geometry, and Texture are not used in this file.
// MeshMaterial in particular was removed in PIXI v8 — importing it from
// pixi.js would throw a SyntaxError at module-link time in strict ESM
// (i.e. the preview web worker), killing the worker before any code runs,
// which is reported as a bare `error` Event with no details and leaves
// postAsync(INIT_PREVIEW, ...) hanging forever.
import { Container, RenderTexture, Sprite } from "pixi.js"
import Animator from "../Animator"
import Spatial from "./Spatial"

const DEG_TO_RAD = Math.PI / 180

export default class SpatialAnimator extends Animator {
    constructor(container, app) {
        super()
        this.mainContainer = container
        this.app = app
        this.rendererDims = null
        this.renderTexture = null
        this.perspectiveMesh = null
        this.meshContainer = null
        this.isActive = false
        this.currentFrame = null
    }

    setState({ configs, rendererDims }) {
        if (configs !== undefined) this.configs = configs
        if (rendererDims !== undefined) this.rendererDims = rendererDims

        if (this.rendererDims) this.ensureMesh()
        this.configure()
    }

    configure() {
        if (!this.configs) return

        const deps = {}

        const animsToAdd = this.getAnimsToAdd()
        this.addAnims(animsToAdd, Spatial, deps, null, true, true)

        const animsToRemove = this.getAnimsToRemove()
        this.removeAnims(animsToRemove)

        this.anims.sort((a, b) => a.start - b.start)

        const animsToConfigure = this.getAnimsToConfigure(deps, true, true)
        this.configureAnims(animsToConfigure, deps, true, true)
    }

    ensureMesh() {
        const w = this.rendererDims.x
        const h = this.rendererDims.y

        if (this.renderTexture) {
            if (this.renderTexture.width === w && this.renderTexture.height === h) return
            this.renderTexture.destroy(true)
        }

        this.renderTexture = RenderTexture.create({ width: w, height: h })

        if (!this.meshContainer) {
            this.meshContainer = new Container()
            this.meshContainer.label = "spatial-perspective"
            this.meshContainer.zIndex = 0
            this.app.stage.addChild(this.meshContainer)
        }

        if (this.perspectiveSprite) {
            this.perspectiveSprite.destroy()
        }

        this.perspectiveSprite = new Sprite(this.renderTexture)
        this.meshContainer.removeChildren()
        this.meshContainer.addChild(this.perspectiveSprite)
    }

    update(timestamp) {
        const frame = this.computeFrame(timestamp)
        this.currentFrame = frame

        if (!frame || (!frame.rotateX && !frame.rotateY && !frame.rotateZ)) {
            if (this.isActive) this.deactivate()
            return frame
        }

        if (!this.rendererDims || !this.renderTexture) return frame

        this.activate()
        this.applyPerspective(frame)
        return frame
    }

    activate() {
        if (this.isActive) return
        this.isActive = true
        this.mainContainer.visible = true
        this.meshContainer.visible = true
    }

    deactivate() {
        if (!this.isActive) return
        this.isActive = false
        if (this.meshContainer) this.meshContainer.visible = false
        this.mainContainer.visible = true
        // Reset sprite transform
        if (this.perspectiveSprite) {
            this.perspectiveSprite.anchor.set(0, 0)
            this.perspectiveSprite.position.set(0, 0)
            this.perspectiveSprite.scale.set(1, 1)
            this.perspectiveSprite.skew.set(0, 0)
        }
    }

    applyPerspective(frame) {
        const w = this.rendererDims.x
        const h = this.rendererDims.y
        const { rotateX, rotateY, rotateZ, perspective, cameraDistance } = frame

        // Render main container to texture
        this.mainContainer.visible = true
        this.app.renderer.render({
            container: this.mainContainer,
            target: this.renderTexture,
            clear: true
        })
        // Hide the original container so only the perspective version shows
        this.mainContainer.visible = false

        // Compute projected corners
        const corners = this.projectCorners(w, h, rotateX, rotateY, rotateZ, perspective, cameraDistance)

        // Apply perspective via sprite transform approximation
        // Use the projected corners to derive scale, position, and skew
        const cx = (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4
        const cy = (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4

        // Calculate scale from projected dimensions
        const topWidth = Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2))
        const bottomWidth = Math.sqrt(Math.pow(corners[2].x - corners[3].x, 2) + Math.pow(corners[2].y - corners[3].y, 2))
        const leftHeight = Math.sqrt(Math.pow(corners[3].x - corners[0].x, 2) + Math.pow(corners[3].y - corners[0].y, 2))
        const rightHeight = Math.sqrt(Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2))

        const avgWidth = (topWidth + bottomWidth) / 2
        const avgHeight = (leftHeight + rightHeight) / 2

        const scaleX = avgWidth / w
        const scaleY = avgHeight / h

        // Derive skew from corner positions
        const topAngle = Math.atan2(corners[1].y - corners[0].y, corners[1].x - corners[0].x)
        const leftAngle = Math.atan2(corners[3].y - corners[0].y, corners[3].x - corners[0].x) - Math.PI / 2

        this.perspectiveSprite.anchor.set(0.5, 0.5)
        this.perspectiveSprite.position.set(cx, cy)
        this.perspectiveSprite.scale.set(scaleX, scaleY)
        this.perspectiveSprite.skew.set(leftAngle, topAngle)
        this.perspectiveSprite.rotation = rotateZ * DEG_TO_RAD
    }

    projectCorners(w, h, rotateX, rotateY, rotateZ, perspective, cameraDistance) {
        const rx = rotateX * DEG_TO_RAD
        const ry = rotateY * DEG_TO_RAD
        const rz = rotateZ * DEG_TO_RAD
        const d = perspective * cameraDistance

        // Original corners centered at origin
        const raw = [
            { x: -w / 2, y: -h / 2, z: 0 },
            { x: w / 2, y: -h / 2, z: 0 },
            { x: w / 2, y: h / 2, z: 0 },
            { x: -w / 2, y: h / 2, z: 0 },
        ]

        const cosX = Math.cos(rx), sinX = Math.sin(rx)
        const cosY = Math.cos(ry), sinY = Math.sin(ry)
        const cosZ = Math.cos(rz), sinZ = Math.sin(rz)

        return raw.map(p => {
            // Rotate around Y axis
            let x = p.x * cosY + p.z * sinY
            let z = -p.x * sinY + p.z * cosY
            let y = p.y

            // Rotate around X axis
            const y2 = y * cosX - z * sinX
            const z2 = y * sinX + z * cosX
            y = y2
            z = z2

            // Rotate around Z axis
            const x3 = x * cosZ - y * sinZ
            const y3 = x * sinZ + y * cosZ
            x = x3
            y = y3

            // Perspective projection
            const scale = d / (d + z)
            return {
                x: x * scale + w / 2,
                y: y * scale + h / 2
            }
        })
    }

    computeIdleFrame() {
        return { rotateX: 0, rotateY: 0, rotateZ: 0, perspective: 800, cameraDistance: 1.5, eyeContactEnabled: false }
    }

    computeFrame(timestamp) {
        const anim = this.getAnim(timestamp, this.anims)
        if (anim) return this.computeAnimFrame(timestamp, anim)
        else return null
    }

    computeAnimFrame(timestamp, anim) {
        return anim.computeFrame(timestamp)
    }

    destroy() {
        this.renderTexture?.destroy(true)
        this.perspectiveSprite?.destroy()
        this.meshContainer?.destroy({ children: true })
        this.renderTexture = null
        this.perspectiveSprite = null
        this.meshContainer = null
    }
}
