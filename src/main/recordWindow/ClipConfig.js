import AnimConfig from "./AnimConfig"

// Duplication of renderer process ClipConfig, because redux isn't available in main process
export default class ClipConfig extends AnimConfig {

    constructor(args) {
        // TODO: parametrize 2000
        const intro = Math.min(2000, args.end - args.start)
        super({ intro, ...args }, "clip")

        const { playbackRate, layout } = args
        this.playbackRate = playbackRate
        this.layout = layout
    }

    static createBulk(clips) {
        return clips.map((clip) => new ClipConfig({ ...clip, playbackRate: 1 }).serialize())
    }
}
