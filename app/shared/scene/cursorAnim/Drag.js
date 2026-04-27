import {
    getInertiaCoords,
    interpolateCoords
} from "../../sceneHelpers.js"
import Animation from "../Animation.js"

export default class Drag extends Animation {
    constructor(config, cursorCoordsMap) {
        super(config.events[0].timestamp, config.events.at(-1).timestamp)
        this.intro = this.getAdjustedIntro(500)
        this.outro = this.getAdjustedOutro(500)
        this.events = config.events
        this.cursorCoordsMap = cursorCoordsMap

        this.introFrom = getInertiaCoords(this.start, cursorCoordsMap)
        this.outroTo = getInertiaCoords(this.end, cursorCoordsMap)
    }

    onIntro(interpolator, timestamp) {
        const to = this.getCoords(timestamp)
        return { position: interpolateCoords(this.introFrom, to, interpolator) }
    }

    onBetweenIntroAndOutro(timestamp) {
        const coords = this.getCoords(timestamp)
        return { position: { x: coords.x, y: coords.y } }
    }

    onOutro(interpolator, timestamp) {
        const from = this.getCoords(timestamp)
        return { position: interpolateCoords(from, this.outroTo, interpolator) }
    }

    getCoords(timestamp) {
        return getInertiaCoords(timestamp, this.cursorCoordsMap)
    }
}
