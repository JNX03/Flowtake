import { getGroupedMouseEvents } from "../sceneHelpers"
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

        // Fallback: generate zoom segments from mouse pause points when no clicks exist
        if (events.length === 0) {
            return this.createFromPauses(mouseEvents, videoDetails, defaultIntro, defaultOutro, defaultTargetScale, ...additionalArgs)
        }

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

    /**
     * Generate zoom animations from mouse pause points (periods where the cursor is nearly still).
     * Used as fallback when no click events were captured during recording.
     */
    static createFromPauses(mouseEvents, videoDetails, defaultIntro, defaultOutro, defaultTargetScale, ...additionalArgs) {
        const moves = mouseEvents.filter(e => e.type === "mousemove")
        if (moves.length < 3) return []

        const MIN_PAUSE_DURATION = 800 // ms - minimum stillness to count as a focus point
        const MAX_VELOCITY = 30 // px per poll interval - threshold for "still"
        const MAX_ZOOMS = 8

        // Detect pause segments: consecutive low-velocity periods
        const pauses = []
        let pauseStart = null

        for (let i = 1; i < moves.length; i++) {
            const dx = moves[i].x - moves[i - 1].x
            const dy = moves[i].y - moves[i - 1].y
            const dist = Math.sqrt(dx * dx + dy * dy)

            if (dist < MAX_VELOCITY) {
                if (pauseStart === null) pauseStart = moves[i - 1].timestamp
            } else {
                if (pauseStart !== null) {
                    const duration = moves[i - 1].timestamp - pauseStart
                    if (duration >= MIN_PAUSE_DURATION) {
                        pauses.push({ start: pauseStart, end: moves[i - 1].timestamp })
                    }
                    pauseStart = null
                }
            }
        }
        // Handle pause at end
        if (pauseStart !== null) {
            const duration = moves[moves.length - 1].timestamp - pauseStart
            if (duration >= MIN_PAUSE_DURATION) {
                pauses.push({ start: pauseStart, end: moves[moves.length - 1].timestamp })
            }
        }

        if (pauses.length === 0) return []

        // Take the longest pauses, up to MAX_ZOOMS
        const sorted = [...pauses].sort((a, b) => (b.end - b.start) - (a.end - a.start))
        const selected = sorted.slice(0, MAX_ZOOMS).sort((a, b) => a.start - b.start)

        return selected.map(pause => {
            const start = Math.max(pause.start - defaultIntro, videoDetails.start)
            const end = Math.min(pause.end + defaultOutro, videoDetails.end)
            return new this({ start, end }, defaultIntro, defaultOutro, defaultTargetScale, ...additionalArgs).serialize()
        })
    }
}