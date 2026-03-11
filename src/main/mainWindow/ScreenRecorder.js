import Store from 'electron-store'
import {
    bgRedBright,
    bold,
    gray,
    red,
    yellow
} from "yoctocolors-cjs"
import ffmpeg, {
    cancel,
    getCapturerConfig,
    STREAM_STDERR
} from "../ffmpeg"
import {
    recordingScreenVideoFile,
    recordingTempDir
} from "../paths"

export default class ScreenRecorder {
    constructor() {
        this.captureProcess = null
        this.capturePromise = null
        this.width = null
        this.height = null
        this.store = new Store()
        this.clips = null
    }

    start(screenCoords, recordingId, systemAudio, onStarted, onError) {

        this.stopTimestamp = null
        this.startOffset = null
        this.width = screenCoords.width
        this.height = screenCoords.height
        this.offsetX = screenCoords.x
        this.offsetY = screenCoords.y
        this.rawOutputPath = recordingScreenVideoFile(recordingId)
        this.clips = [{ start: Date.now(), end: null }]
        const fps = this.store.get("screenFps")

        const capturer = this.store.get("capturers").find(({ isSelected }) => isSelected)
        const encoder = this.store.get("encoders").find(({ isSelected }) => isSelected)

        console.log(bold(`${bgRedBright(red("[Recording]"))}\n${yellow("capturer:")}\t${gray(capturer.name)}\n${yellow("encoder:")}\t${gray(encoder.name)}\n${yellow("system audio:")}\t${gray(systemAudio)}\n${yellow("output:")}\t\t${gray(recordingTempDir(recordingId))}`))

        const args = ["-y"]

        args.push(...getCapturerConfig(capturer.name, screenCoords, fps))

        if (systemAudio !== null) args.push("-f", "dshow", "-i", `audio=${systemAudio}`)

        args.push("-c:v", encoder.name, ...encoder.config)

        if (encoder.name.includes("_mf")) args.push(...this.getBitRate(this.width, this.height, fps))

        args.push(this.rawOutputPath)

        this.capturePromise = ffmpeg(
            args,
            data => {
                if (data.includes("Press [q] to stop, [?] for help")) onStarted()
                if (this.stopTimestamp === null && data.includes("[q] command received. Exiting.")) {
                    this.stopTimestamp = Date.now()
                    if (this.clips.at(-1).end === null) this.clips.at(-1).end = this.stopTimestamp
                }
            }, STREAM_STDERR, process => this.captureProcess = process, onError)
    }

    pause(pause) {
        if (pause) this.clips.at(-1).end = Date.now()
        else this.clips.push({ start: Date.now(), end: null })
    }

    async cancelRecording() {
        cancel(this.captureProcess)
        await this.capturePromise
    }

    async stop() {
        cancel(this.captureProcess)

        const outputPath = this.rawOutputPath

        // wait for the process to exit -> FFMPEG video processing is done and file is written 
        await this.capturePromise

        return outputPath
    }

    getBitRate(width, height, fps) {
        // baseline are 7.5 Mbps for a 1080p @ 30fps video
        const mbpsPerPixel = 7.5 / (1920 * 1080 * 30)
        const mbps = mbpsPerPixel * width * height * fps
        return ["-b:v", `${Math.round(mbps * 10) / 10}M`]
    }
}
