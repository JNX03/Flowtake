import { CanvasSink } from 'mediabunny'
import { toS } from "../helpers"
import RendererInputReader from "../RendererInputReader"
import { postIpc } from "./helpers"
import {
    DECODE_CANVAS_POOL_SIZE,
    SequentialCanvasCursor,
} from "./sequentialCanvasCursor.js"

// CanvasSink keeps one native-resolution RGBA canvas per pool slot. Reuse one
// canvas through a continuous decode iterator so 4K exports do not reserve
// gigabytes of canvases or repeatedly seek at artificial batch boundaries.
// Width/height are intentionally omitted below: this only bounds decode memory
// and never changes the source or export resolution.

// Decode base64 string to Uint8Array (Tauri backend returns base64-encoded binary data)
function base64ToUint8Array(base64) {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
}

export default class WorkerInputReader extends RendererInputReader {
    constructor(videoType, args) {
        super(videoType, args)
        this.sink = null
        this.timestamps = null
        this.canvasCursor = null
    }

    async createSink(timestamps) {
        const track = await this.input.getPrimaryVideoTrack()
        if (!track) throw new Error(`No video track found in "${this.videoType}" — the recording may be missing or corrupted`)
        this.sink = new CanvasSink(track, { poolSize: DECODE_CANVAS_POOL_SIZE })
        this.timestamps = timestamps.map(({ rendererTimestamp, sourceTimestamp }) =>
            toS(sourceTimestamp ?? rendererTimestamp))
        this.canvasCursor = new SequentialCanvasCursor(
            this.sink.canvasesAtTimestamps(this.timestamps)
        )
    }

    async getCanvas(t) {
        return this.canvasCursor?.read(toS(t)) ?? null
    }

    async open() {
        this.fhId = await postIpc("open", [this.videoType, "r", this.args])
    }

    async read(start, end) {
        const result = await postIpc("read", [this.fhId, start, end])
        // Tauri returns base64-encoded string, decode to Uint8Array for mediabunny
        if (typeof result === 'string') {
            return base64ToUint8Array(result)
        }
        return new Uint8Array(result)
    }

    getSize() {
        return postIpc("get-size", [this.fhId])
    }

    async close() {
        let iteratorError = null
        try {
            await this.canvasCursor?.close()
        } catch (error) {
            iteratorError = error
        }
        this.canvasCursor = null
        this.sink = null
        this.input?.dispose()
        this.input = null

        const fhId = this.fhId
        this.fhId = null
        if (fhId !== null) await postIpc("close", [fhId])
        if (iteratorError) throw iteratorError
    }
}
