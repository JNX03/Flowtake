import {
    Input,
    MP4,
    StreamSource,
    WEBM
} from 'mediabunny'

export default class InputReader {
    constructor(videoType, args) {
        this.videoType = videoType
        this.args = args
        this.input = null
    }

    async init() {
        await this.open()
        const source = new StreamSource({ read: this.read.bind(this), getSize: this.getSize.bind(this) })
        this.input = new Input({ formats: [MP4, WEBM], source })
    }

    async open() { }

    async read() { }

    async getSize() { }

    async close() { }

    static async getDimensions(...args) {
        const reader = new this(...args)
        await reader.init()
        const track = await reader.input.getPrimaryVideoTrack()
        await reader.close()
        if (!track) throw new Error(`No video track found in "${reader.videoType}" — the recording may be missing or corrupted`)
        return { x: track.displayWidth, y: track.displayHeight }
    }

    static async getDuration(...args) {
        const reader = new this(...args)
        await reader.init()
        const duration = await reader.input.computeDuration()
        await reader.close()
        return Math.round(duration * 1000)
    }
}