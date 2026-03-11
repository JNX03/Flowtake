import { open } from "fs/promises"
import { getPath } from "./paths"
import InputReader from "../InputReader"

export default class MainInputReader extends InputReader {
    constructor(videoType, args) {
        super(videoType, args)
        this.fh = null
    }

    async open() {
        this.fh = await open(getPath(this.videoType, this.args), "r")
    }

    async read(start, end) {
        const buffer = Buffer.alloc(end - start)
        await this.fh.read(buffer, 0, end - start, start)
        return buffer
    }

    async getSize() {
        const { size } = await this.fh.stat()
        return size
    }

    async close() {
        await this.fh.close()
    }
}