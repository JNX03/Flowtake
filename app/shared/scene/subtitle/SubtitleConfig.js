import AnimConfig from "../AnimConfig"

// TODO: font size
// would be good to show a helper object when tweaking these settings...

export default class SubtitleConfig extends AnimConfig {
    constructor(args) {
        super(args, "subtitle")
        const { text } = args
        this.text = text
        this.entranceEffect = args.entranceEffect ?? { type: "none", duration: 300 }
        this.exitEffect = args.exitEffect ?? { type: "none", duration: 300 }
    }

    static createBulk(transcript) {
        return transcript.map(word => new SubtitleConfig(word).serialize())
    }

    // takes an old config, copies over everything and just updates all timestamps
    static fromConfig(oldConfig) {
        return oldConfig
    }
}