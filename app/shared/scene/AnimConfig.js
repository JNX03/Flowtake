export default class AnimConfig {

    constructor(args, idPrefix = "animConfig") {
        const { id, start, end, intro, outro } = { id: `${idPrefix}-${self.crypto.randomUUID()}`, ...args }
        this.id = id

        if (start != null) this.start = Math.max(start, 0)
        if (end != null) this.end = end
        if (intro != null) this.intro = intro
        if (outro != null) this.outro = outro
    }

    serialize() {
        return JSON.parse(JSON.stringify(this))
    }
}
