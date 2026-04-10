import { interpolateCoords } from "../../sceneHelpers"
import Animation from "../Animation"

export default class Drag extends Animation {
    constructor(config, cursorCoordsMap) {
        super(config.events[0].timestamp, config.events.at(-1).timestamp)
        this.intro = this.getAdjustedIntro(500)
        this.outro = this.getAdjustedOutro(500)
        this.events = config.events

        this.introFrom = cursorCoordsMap.get(Math.floor(this.start / (1000 / 60)))
        this.outroTo = cursorCoordsMap.get(Math.floor(this.end / (1000 / 60)))
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
        return this.events.reduce(
            (prev, curr) => curr.timestamp > prev.timestamp && curr.timestamp <= timestamp ? curr : prev)
    }
}