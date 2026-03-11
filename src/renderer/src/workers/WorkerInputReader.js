import { CanvasSink } from 'mediabunny'
import { toS } from "../helpers"
import RendererInputReader from "../RendererInputReader"
import { postIpc } from "./helpers"

const BATCH_SIZE = 100

export default class WorkerInputReader extends RendererInputReader {
    constructor(videoType, args) {
        super(videoType, args)
        this.sink = null
        this.prevCanvas = null
        this.timestamps = null
        this.canvases = {}
        this.hasUnextractedCanvases = true
    }

    async createSink(timestamps) {
        const track = await this.input.getPrimaryVideoTrack()
        this.sink = new CanvasSink(track, { poolSize: BATCH_SIZE })
        this.timestamps = timestamps.map(({ rendererTimestamp }) => toS(rendererTimestamp))
    }

    async getCanvas(t) {
        const timestamp = toS(t)

        const canvas = this.canvases[timestamp]

        if (canvas) {
            if (!this.prevCanvas || this.prevCanvas.timestamp !== canvas.timestamp) {
                this.prevCanvas = canvas
                return canvas
            }
        } else if (this.hasUnextractedCanvases) {
            await this.extract()
            this.prevCanvas = this.canvases[timestamp]
            return this.prevCanvas
        }
        return null
    }

    async extract() {
        const timestamps = this.timestamps.splice(0, BATCH_SIZE)

        const canvases = []

        for await (const canvas of this.sink.canvasesAtTimestamps(timestamps)) {
            canvases.push(canvas)
        }

        canvases.forEach((canvas, i) => this.canvases[timestamps[i]] = canvas)

        this.hasUnextractedCanvases = BATCH_SIZE === canvases.length
    }

    async open() {
        this.fhId = await postIpc("open", [this.videoType, "r", this.args])
    }

    read(start, end) {
        return postIpc("read", [this.fhId, start, end])
    }

    getSize() {
        return postIpc("get-size", [this.fhId])
    }

    close() {
        return postIpc("close", [this.fhId])
    }
}