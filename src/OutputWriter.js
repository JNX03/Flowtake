import {
    Output,
    StreamTarget
} from 'mediabunny'

export default class OutputWriter {
    constructor(videoType, args, Format) {
        this.videoType = videoType
        this.args = args
        this.input = null
        this.Format = Format
    }

    async init() {
        await this.open()
        const writable = new WritableStream({ write: ({ data, position }) => this.write(data, position) })
        this.output = new Output({
            format: new this.Format(),
            target: new StreamTarget(writable, { chunked: true }),
        })
    }

    async open() { }

    async start() {
        return this.output.start()
    }

    async write() { }

    async finalize() {
        await this.output.finalize()
        await this.close()
    }

    async cancel() {
        await this.output.cancel()
        await this.close()
    }

    async close() { }
}