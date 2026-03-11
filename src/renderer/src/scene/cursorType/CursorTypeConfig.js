import AnimConfig from "../AnimConfig"

const DURATION = 100
const CONFIG_MIN_LENGTH = 200

export default class CursorTypeConfig extends AnimConfig {
    constructor(args) {
        super(args, "cursorType")
        const { type } = args
        this.type = type ?? "default"
    }

    static createBulk(mouseEvents, videoDetails) {

        if (mouseEvents.length > 0) {
            let groups = [{ start: mouseEvents[0].timestamp, cursor: mouseEvents[0].cursor }]
            mouseEvents.forEach(event => {
                if (event.cursor !== groups.at(-1).cursor) {
                    groups.at(-1).end = event.timestamp
                    groups.push({ start: event.timestamp, cursor: event.cursor })
                }
            })
            groups.at(-1).end = mouseEvents.at(-1).timestamp
            return groups
                // filter out short type sections
                .filter(({ start, end }) => end - start >= CONFIG_MIN_LENGTH)
                // filter out adjacent identical type sections (possible because of above filtering)
                .filter(({ cursor }, i, array) => i === 0 || array[i - 1].cursor !== cursor)
                // stretch sections to fill gap
                .map((group, i, groups) => groups[i + 1] ? { ...group, end: groups[i + 1].start } : group)
                .map((({ start, end, cursor }, i, array) => new CursorTypeConfig({
                    start: i === 0 ? 0 : start,
                    end: i === array.length - 1 ? videoDetails.end : end,
                    intro: i === 0 ? 0 : DURATION,
                    outro: i === array.length - 1 ? 0 : DURATION,
                    type: cursor
                }).serialize()))

        } else return []
    }

    // takes an old config, copies over everything and just updates all timestamps
    static fromConfig(oldConfig) {
        // cursor animations aren't editable yet, so just return the old config
        return oldConfig
    }
}