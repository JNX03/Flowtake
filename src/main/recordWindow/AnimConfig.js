import crypto from 'crypto'

export default class AnimConfig {

    constructor(args, idPrefix = "animConfig") {
        const { id, start, end } = { id: `${idPrefix}-${crypto.randomUUID()}`, ...args }
        this.id = id

        if (start != null) this.start = start
        if (end != null) this.end = end
    }

    serialize() {
        return JSON.parse(JSON.stringify(this))
    }
}
