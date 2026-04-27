import { getGroupedMouseEvents } from "../../sceneHelpers.js"
import AnimConfig from "../AnimConfig.js"

export default class ClickConfig extends AnimConfig {
    constructor(args) {
        super(args, "click")
        this.isActive = args.isActive ?? true
        this.ringEnabled = args.ringEnabled ?? true
        this.ringColor = args.ringColor ?? "#FFCC00"
        this.ringSize = args.ringSize ?? 52
        this.ringOpacity = args.ringOpacity ?? 0.72
        this.scaleAmount = args.scaleAmount ?? 0.82
    }

    static createBulk(mouseEvents) {
        const DURATION = 360
        const PRESS_DURATION = 80
        const RELEASE_DURATION = 180

        if (mouseEvents.length > 0) {

            const groups = getGroupedMouseEvents(mouseEvents)

            return groups.map((group, i) => {
                const nextGroup = groups[i + 1]
                const start = group.mousedown.timestamp
                const naturalEnd = start + DURATION
                const end = nextGroup
                    ? Math.min(naturalEnd, Math.max(start + 1, nextGroup.mousedown.timestamp - 1))
                    : naturalEnd

                return new ClickConfig({
                    start,
                    end,
                    intro: PRESS_DURATION,
                    outro: RELEASE_DURATION
                }).serialize()
            })
        } else return []
    }
}
