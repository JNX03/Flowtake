import { shallowEqual } from "react-redux"
import { applyInertia } from "../../helpers"
import Animator from "../Animator"
import Pan from "./Pan"

export default class PanAnimator extends Animator {
    constructor(videoContainer, blur, screenVideoDimensions, screenVideoDuration) {
        super()

        this.coords = null
        this.videoDetails = null
        this.trim = {
            left: null,
            right: null,
            top: null,
            bottom: null
        }
        this.cursorCoords = null

        this.videoContainer = videoContainer
        this.blur = blur
        this.screenVideoDimensions = screenVideoDimensions
        this.duration = screenVideoDuration
    }

    update(timestamp, clipFrame) {
        if (this.trim.left === null || this.trim.right === null || this.trim.top === null || this.trim.bottom === null || !clipFrame) return

        const frame = this.computeFrame(timestamp)

        const focus = this.getWeightedFocus(frame.focus)

        // Store focus for velocity computation in next frame
        this.prevFocus = frame.focus

        const pivot = this.getPivot(focus)
        const position = this.getPosition(focus, clipFrame)

        this.videoContainer.pivot.set(pivot.x, pivot.y)
        this.videoContainer.position.set(position.x, position.y)

        const { x, y } = this.videoContainer.toGlobal({ x: 0, y: 0 })

        // Pivot already has trim subtracted -> doesn't need to be normalized
        // To get x and y of pivot as percentage, it needs to be divided by the texture (video) size
        // For that, videoDims needs to be normalized -> trims need to be subtracted to get real size

        const videoWidth = this.screenVideoDimensions.x - this.trim.left - this.trim.right
        const videoHeight = this.screenVideoDimensions.y - this.trim.top - this.trim.bottom

        this.blur.center = [
            x + this.videoContainer.width * (pivot.x / videoWidth),
            y + this.videoContainer.height * (pivot.y / videoHeight)
        ]
    }

    getWeightedFocus(focus) {
        const cursor = {
            x: focus.x * this.screenVideoDimensions.x - this.trim.left,
            y: focus.y * this.screenVideoDimensions.y - this.trim.top
        }

        const videoDims = {
            x: this.screenVideoDimensions.x - this.trim.left - this.trim.right,
            y: this.screenVideoDimensions.y - this.trim.top - this.trim.bottom
        }

        const videoCenter = this.getVideoCenter()

        // Velocity-based camera leading: lookahead increases with speed
        let lookahead = 0.2
        if (this.prevFocus) {
            const vx = (focus.x - this.prevFocus.x) * 60 // per-second velocity (normalized coords)
            const vy = (focus.y - this.prevFocus.y) * 60
            const speed = Math.sqrt(vx * vx + vy * vy)
            lookahead = Math.min(0.2 + speed * 0.8, 0.6)
        }

        return {
            x: (cursor.x + (cursor.x - videoCenter.x) * lookahead) / videoDims.x,
            y: (cursor.y + (cursor.y - videoCenter.y) * lookahead) / videoDims.y
        }
    }

    setState({ videoDetails, cursorCoords, configs, leftTrim, rightTrim, topTrim, bottomTrim }) {
        if (cursorCoords !== undefined && !shallowEqual(this.cursorCoords, cursorCoords)) {
            this.cursorCoords = cursorCoords
            this.configureCoords()
        }

        if (videoDetails !== undefined) this.videoDetails = videoDetails

        if (configs !== undefined) this.configs = configs

        if (leftTrim !== undefined) this.trim.left = leftTrim
        if (rightTrim !== undefined) this.trim.right = rightTrim
        if (topTrim !== undefined) this.trim.top = topTrim
        if (bottomTrim !== undefined) this.trim.bottom = bottomTrim

        this.configure()
    }

    configureCoords() {
        if (!this.cursorCoords) return

        const cursorCoordsArray = Array.from(this.cursorCoords.values())
        cursorCoordsArray.pop() // remove "last" key

        this.coords = applyInertia(cursorCoordsArray, this.duration)
    }

    configure() {
        if (!this.configs || !this.coords || !this.videoDetails) return

        const deps = { videoDetails: this.videoDetails, coords: this.coords }
        const staticDeps = { screenVideoDimensions: this.screenVideoDimensions }

        const animsToAdd = this.getAnimsToAdd()
        this.addAnims(animsToAdd, Pan, deps, staticDeps, true, true)

        const animsToRemove = this.getAnimsToRemove()
        this.removeAnims(animsToRemove)

        this.anims.sort((a, b) => a.start - b.start)

        const animsToConfigure = this.getAnimsToConfigure(deps, true, true)
        this.configureAnims(animsToConfigure, deps, true, true)
    }

    computeIdleFrame() {
        return { focus: { x: .5, y: .5 } }
    }

    getPosition(focus, clipFrame) {
        const videoDims = {
            x: this.screenVideoDimensions.x - this.trim.left - this.trim.right,
            y: this.screenVideoDimensions.y - this.trim.top - this.trim.bottom
        }

        const { screenCell } = clipFrame

        if (screenCell.width / screenCell.height > videoDims.x / videoDims.y) {
            // video container is narrower than renderer
            const containerWidth = videoDims.x / videoDims.y * screenCell.height
            const containerHeight = screenCell.height
            const spacer = (screenCell.width - containerWidth) / 2
            return {
                x: screenCell.x + spacer + containerWidth * focus.x,
                y: screenCell.y + containerHeight * focus.y
            }
        } else {
            // video container is wider than renderer
            const containerWidth = screenCell.width
            const containerHeight = videoDims.y / videoDims.x * screenCell.width
            const spacer = (screenCell.height - containerHeight) / 2
            return {
                x: screenCell.x + containerWidth * focus.x,
                y: screenCell.y + spacer + containerHeight * focus.y
            }
        }
    }

    getPivot(focus) {
        return this.getVideoPoint(this.screenVideoDimensions, focus)
    }

    getVideoCenter() {
        return this.getVideoPoint(this.screenVideoDimensions, { x: .5, y: .5 })
    }

    getVideoPoint(videoDims, { x, y }) {
        return {
            x: this.trim.left + (videoDims.x - this.trim.left - this.trim.right) * x,
            y: this.trim.top + (videoDims.y - this.trim.top - this.trim.bottom) * y
        }
    }
}