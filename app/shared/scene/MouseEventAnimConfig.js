import { getGroupedMouseEvents } from "../helpers"
import AnimConfig from "./AnimConfig"

export default class MouseEventAnimConfig extends AnimConfig {

    constructor(args, defaultIntro, defaultOutro, defaultTargetScale, idPrefix = "mouseEvent") {
        const intro = args.intro ?? defaultIntro
        const outro = args.outro ?? defaultOutro
        super({ ...args, intro, outro }, idPrefix)
        this.targetScale = args.targetScale ?? defaultTargetScale
    }

    static createBulk(mouseEvents, videoDetails, defaultIntro, defaultOutro, defaultTargetScale, ...additionalArgs) {

        const isClick = (mousedown, mouseup) =>
            mousedown.x === mouseup.x && mousedown.y === mouseup.y && mouseup.timestamp - mousedown.timestamp < 500

        const events = getGroupedMouseEvents(mouseEvents)

        const eventGroups = []

        events.forEach(({ mousedown, mouseup }) => {
            const start = isClick(mousedown, mouseup) ? mouseup.timestamp - defaultIntro : mousedown.timestamp - defaultIntro

            // find a group in the output array that...
            const group = eventGroups.find(
                // has some item that satisfies the clustering criteria
                group => group.some(groupItem => groupItem.timestamp + defaultOutro >= start)
            )
            // if a group that satisfies the criteria exists, push the item...
            if (group) group.push(mousedown, mouseup)
            // ...otherwise create a new group
            else eventGroups.push([mousedown, mouseup])
        })

        return eventGroups.map(events => {
            const start = isClick(events[0], events[1]) ? events[1].timestamp - defaultIntro : events[0].timestamp - defaultIntro
            const end = Math.min(events[events.length - 1].timestamp + defaultOutro, videoDetails.end)
            return new this({ start, end }, defaultIntro, defaultOutro, defaultTargetScale, ...additionalArgs).serialize()
        })
    }
}