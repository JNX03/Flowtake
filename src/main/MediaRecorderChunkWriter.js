import { deleteAsync } from "del"
import { open } from "fs/promises"
import slash from "slash"

export default class MediaRecorderChunkWriter {
    async init(path) {
        this.unwrittenChunks = []
        this.isWritingChunks = false
        this.promise = null
        this.isStreamOpen = true

        await deleteAsync([slash.default(path)], { force: true })

        this.fileHandle = await open(path, "w")
    }

    enqueue(chunk) {
        this.unwrittenChunks.push(chunk)  // push chunk into queue
        if (!this.isWritingChunks) this.promise = this.processQueue() // check if queue is running and if not, start it
    }

    async processQueue() {
        this.isWritingChunks = true

        const chunk = this.unwrittenChunks.shift()
        if (chunk) {
            if (this.isStreamOpen) await this.fileHandle.write(Buffer.from(chunk))
            await this.processQueue()
        }

        this.isWritingChunks = false
    }

    async end() {
        // wait for all chunks to be written
        await this.promise

        this.isStreamOpen = false

        // close file
        await this.fileHandle?.close()
    }
}
