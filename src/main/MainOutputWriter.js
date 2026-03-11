import { open } from "fs/promises"
import OutputWriter from "../OutputWriter"
import { getPath } from "./paths"

export default class MainOutputWriter extends OutputWriter {
    constructor(videoType, args, Format) {
        super(videoType, args, Format)
        this.fh = null
    }

    async open() {
        this.fh = await open(getPath(this.videoType, this.args), "w")
    }

    write(data, position) {
        return this.fh.write(data, 0, data.byteLength, position)
    }

    close() {
        return this.fh.close()
    }
}