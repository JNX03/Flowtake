export const DECODE_CANVAS_POOL_SIZE = 1

const NO_TIMESTAMP = Symbol("no timestamp")

export function dedupeSequentialTimestamps(timestamps) {
    const result = []
    let previousTimestamp = NO_TIMESTAMP

    for (const timestamp of timestamps) {
        if (timestamp === previousTimestamp) continue
        result.push(timestamp)
        previousTimestamp = timestamp
    }

    return result
}

/**
 * Pull one requested frame at a time from a single MediaBunny iterator.
 * Keeping the iterator alive lets the decoder move through each packet once;
 * keeping one canvas in its pool bounds native-resolution RGBA memory.
 */
export class SequentialCanvasCursor {
    constructor(iterator) {
        this.iterator = iterator
        this.lastRequestedTimestamp = NO_TIMESTAMP
        this.lastFrameTimestamp = NO_TIMESTAMP
    }

    async read(timestamp) {
        // The export renderer asks for the first frame once while setting up
        // the scene and once again in its render loop. Retain the uploaded
        // texture without advancing the decoder on that duplicate request.
        if (timestamp === this.lastRequestedTimestamp) return null
        this.lastRequestedTimestamp = timestamp

        const result = await this.iterator?.next()
        if (!result || result.done) {
            this.iterator = null
            return null
        }

        const wrappedCanvas = result.value
        if (!wrappedCanvas) return null

        const isSameFrame = wrappedCanvas.timestamp === this.lastFrameTimestamp
        this.lastFrameTimestamp = wrappedCanvas.timestamp
        return isSameFrame ? null : wrappedCanvas
    }

    async close() {
        const iterator = this.iterator
        this.iterator = null
        await iterator?.return?.()
    }
}
