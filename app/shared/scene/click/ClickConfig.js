import { getGroupedMouseEvents } from "../../sceneHelpers"
import AnimConfig from "../AnimConfig"

export default class ClickConfig extends AnimConfig {
    constructor(args) {
        super(args, "click")
        this.isActive = args.isActive ?? true
        this.ringEnabled = args.ringEnabled ?? true
        this.ringColor = args.ringColor ?? "#FFCC00"
        this.ringSize = args.ringSize ?? 40
        this.ringOpacity = args.ringOpacity ?? 0.6
        this.scaleAmount = args.scaleAmount ?? 0.75
    }

    static createBulk(mouseEvents) {
        const DURATION = 100
        if (mouseEvents.length > 0) {

            const groups = getGroupedMouseEvents(mouseEvents)

            return groups.map((group, i) => {
                const prevGroup = groups[i - 1]
                const intro = prevGroup && group.mousedown.timestamp - prevGroup.mouseup.timestamp < DURATION * 2
                    ? (group.mousedown.timestamp - prevGroup.mouseup.timestamp) * .5
                    : Math.min(DURATION, group.mousedown.timestamp)
                const start = group.mousedown.timestamp - intro

                const nextGroup = groups[i + 1]
                const outro = nextGroup && nextGroup.mousedown.timestamp - group.mouseup.timestamp < DURATION * 2
                    ? (nextGroup.mousedown.timestamp - group.mouseup.timestamp) * .5
                    : DURATION
                const end = group.mouseup.timestamp + outro

                return new ClickConfig({ start, end, intro, outro }).serialize()
            })
        } else return []
    }
}