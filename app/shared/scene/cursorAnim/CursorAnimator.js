import { shallowEqual } from "react-redux"
import {
    applyInertia,
    getCoords,
    getGroupedMouseEvents,
    INERTIA_FPS,
    interpolateCoords
} from "../../helpers"
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
    }


    update(timestamp) {
        if (!this.coords || !this.videoDetails || this.blurStrength === null || this.rotationStrength === null || this.cutOff === null || this.isLoop === null) return

        let coords = this.getCoords(timestamp)
        let prevCoords = this.getCoords(Math.max(timestamp - 1000 / INERTIA_FPS, 0))

        this.cursor.position.set(coords.x, coords.y)

        this.motionBlur.velocity.set(
            (prevCoords.x - coords.x) * this.blurStrength,
            (prevCoords.y - coords.y) * this.blurStrength
        )
        this.motionBlur.kernelSize = 15

        if (this.rotationStrength > 0) {
            let rotation = Math.min(this.calculateAveragedStrength(timestamp, coords, MOTION_ROTATION_FRAMES) * MOTION_ROTATION_FACTOR, MOTION_ROTATION_MAX_STRENGTH)
            this.cursor.rotation = rotation * this.rotationStrength
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
        if (isCutOffDirty) this.configureCutOffCoords()
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
