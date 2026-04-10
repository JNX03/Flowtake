import { shallowEqual } from "react-redux"
import { applyInertia } from "../../sceneHelpers"
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

        // Smoothing state for cursor-follow. Reset on scrub/seek and configure.
        this.smoothedFocus = null
        this.smoothedVelocity = { x: 0, y: 0 }
        this.prevFocus = null
        this.lastUpdateMs = null
        this.lastTimelineTs = undefined
    }

    update(timestamp, clipFrame) {
        if (this.trim.left === null || this.trim.right === null || this.trim.top === null || this.trim.bottom === null || !clipFrame) return

        const frame = this.computeFrame(timestamp)

        // Detect scrub / seek — reset smoothing state on large timestamp jumps
        // so the cursor doesn't drag from an old position when the user scrubs.
        const nowMs = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()
        const timelineJumped =
            this.lastTimelineTs !== undefined &&
            Math.abs(timestamp - this.lastTimelineTs) > 120
        this.lastTimelineTs = timestamp

        if (timelineJumped) {
            this.smoothedFocus = null
            this.smoothedVelocity = { x: 0, y: 0 }
            this.prevFocus = null
            this.lastUpdateMs = null
        }

        // Framerate-independent dt, clamped to avoid divide-by-zero and large spikes
        // after tab suspension.
        const dt = this.lastUpdateMs
            ? Math.min(Math.max((nowMs - this.lastUpdateMs) / 1000, 1 / 240), 0.1)
            : 1 / 60
        this.lastUpdateMs = nowMs

        const rawFocus = this.getWeightedFocus(frame.focus, dt)

        // Keep raw previous focus for next frame's velocity calc inside getWeightedFocus.
        this.prevFocus = frame.focus

        // Framerate-independent EMA low-pass on the final focus. TAU is the time
        // constant (seconds) — larger = smoother but more lag on fast flicks.
        const FOCUS_TAU = 0.09
        const alpha = 1 - Math.exp(-dt / FOCUS_TAU)
        if (!this.smoothedFocus) {
            this.smoothedFocus = { x: rawFocus.x, y: rawFocus.y }
        } else {
            this.smoothedFocus.x += (rawFocus.x - this.smoothedFocus.x) * alpha
            this.smoothedFocus.y += (rawFocus.y - this.smoothedFocus.y) * alpha
        }

        const focus = this.smoothedFocus

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

    getWeightedFocus(focus, dt) {
        const cursor = {
            x: focus.x * this.screenVideoDimensions.x - this.trim.left,
            y: focus.y * this.screenVideoDimensions.y - this.trim.top
        }

        const videoDims = {
            x: this.screenVideoDimensions.x - this.trim.left - this.trim.right,
            y: this.screenVideoDimensions.y - this.trim.top - this.trim.bottom
        }

        const videoCenter = this.getVideoCenter()

        // Instantaneous normalized velocity (per-second), dt-correct.
        // The old code multiplied by a hard-coded 60 which assumed a fixed 60fps
        // render cadence — but the preview worker throttles renders and dt is
        // actually irregular, so velocity spiked on every frame boundary.
        let instVx = 0
        let instVy = 0
        if (this.prevFocus && dt > 0) {
            instVx = (focus.x - this.prevFocus.x) / dt
            instVy = (focus.y - this.prevFocus.y) / dt
        }

        // Low-pass the velocity itself so it doesn't spike on sample boundaries.
        const VEL_TAU = 0.15
        const velAlpha = 1 - Math.exp(-dt / VEL_TAU)
        this.smoothedVelocity.x += (instVx - this.smoothedVelocity.x) * velAlpha
        this.smoothedVelocity.y += (instVy - this.smoothedVelocity.y) * velAlpha

        const speed = Math.sqrt(
            this.smoothedVelocity.x * this.smoothedVelocity.x +
            this.smoothedVelocity.y * this.smoothedVelocity.y
        )

        // Softer lookahead than before (was 0.2 + speed*0.8 capped at 0.6).
        // Jitter gets magnified by the zoom scale, so we prioritize stability
        // over aggressive camera leading.
        const lookahead = Math.min(0.15 + speed * 0.35, 0.4)

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

        // Reset smoothing state so the first frame after a config change doesn't
        // ease from a stale position.
        this.smoothedFocus = null
        this.smoothedVelocity = { x: 0, y: 0 }
        this.prevFocus = null
        this.lastUpdateMs = null
        this.lastTimelineTs = undefined
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