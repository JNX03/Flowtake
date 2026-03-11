import {
    QUALITY_HIGH,
    QUALITY_LOW,
    QUALITY_MEDIUM,
    QUALITY_VERY_HIGH,
    QUALITY_VERY_LOW,
    VideoSample,
    VideoSampleSource
} from 'mediabunny'
import OutputWriter from "../../../OutputWriter"
import { toS } from "../helpers"
import { postIpc } from "./helpers"

export default class WorkerOutputWriter extends OutputWriter {
    constructor(videoType, args, Format, fps, resolution, quality) {
        super(videoType, args, Format)
        this.fps = fps
        this.resolution = resolution
        this.quality = this.getQuality(quality)
        this.fhId = null
    }

    async init() {
        await super.init()
        this.videoSampleSource = new VideoSampleSource({ codec: 'avc', bitrate: this.quality })
        this.output.addVideoTrack(this.videoSampleSource, { frameRate: this.fps })
    }

    async open() {
        this.fhId = await postIpc("open", [this.videoType, "w", this.args])
    }

    write(data, position) {
        return postIpc("write", [this.fhId, data, position])
    }

    close() {
        return postIpc("close", [this.fhId])
    }

    // FIXME: "Uncaught EncodingError: Decoding error." most likely occurs on the decode (read) side. It's probably related to the shitty files mediarecorder saves.
    // - check github issue for mediabunny
    // - same as bug report from email?

    async addFrame(buffer, timestamp) {
        await this.videoSampleSource.add(new VideoSample(buffer, {
            format: 'RGBA',
            codedWidth: this.resolution.x,
            codedHeight: this.resolution.y,
            timestamp: toS(timestamp),
        }))
    }

    getQuality(value) {
        switch (value) {
            case "very_high": return QUALITY_VERY_HIGH
            case "high": return QUALITY_HIGH
            case "medium": return QUALITY_MEDIUM
            case "low": return QUALITY_LOW
            case "very_low": return QUALITY_VERY_LOW
            default: return QUALITY_MEDIUM
        }
    }
}
