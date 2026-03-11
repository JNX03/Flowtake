import { rename } from "fs/promises"
import moment from 'moment'
import momentDurationFormatSetup from 'moment-duration-format'
import path from "path"
import waitOn from "wait-on"
import { RENDER_SCREEN_VIDEO } from "../helpers"
import ffmpeg, {
    reportFfmpegError
} from "./ffmpeg"
import MainInputReader from "./MainInputReader"
import {
    renderCameraVideoFile,
    renderedVideoFile,
    renderedVideoWithAudioFile,
    renderScreenVideoFile,
    renderTempDir
} from "./paths"

const SUFFIX_WEBCAM = "webcam"
const SUFFIX_SYSTEM_AUDIO = "systemAudio"

export default class AudioProcessor {
    constructor(renderId, clips, hasMicrophoneAudio, hasSystemAudio) {
        this.renderId = renderId
        this.tempPath = renderTempDir(this.renderId)
        this.clips = clips
        this.hasMicrophoneAudio = hasMicrophoneAudio
        this.hasSystemAudio = hasSystemAudio
    }

    async process() {
        const tracks = []

        const duration = await MainInputReader.getDuration(RENDER_SCREEN_VIDEO, { renderId: this.renderId })

        if (this.hasMicrophoneAudio) {
            const extracted = await this.extract(renderCameraVideoFile(this.renderId), SUFFIX_WEBCAM)
            const needsProcessing = this.clips.some((clip, i) =>
                clip.playbackRate !== 1 ||
                clip.microphoneAudioVolume !== 1 ||
                (i === 0 && clip.start > 0) ||
                (i === this.clips.length - 1 && clip.end < duration) ||
                (i < this.clips.length - 1 && clip.end !== this.clips[i + 1].start))

            if (needsProcessing) {
                const audioClips = await this.createAudioClips(extracted, SUFFIX_WEBCAM, this.clips)
                const track = await this.concat(SUFFIX_WEBCAM, audioClips)
                tracks.push(track)
            } else
                tracks.push(extracted)
        }

        if (this.hasSystemAudio) {
            const extracted = await this.extract(renderScreenVideoFile(this.renderId), SUFFIX_SYSTEM_AUDIO)
            const needsProcessing = this.clips.some((clip, i) =>
                clip.playbackRate !== 1 ||
                clip.systemAudioVolume !== 1 ||
                (i === 0 && clip.start > 0) ||
                (i === this.clips.length - 1 && clip.end < duration) ||
                (i < this.clips.length - 1 && clip.end !== this.clips[i + 1].start))

            if (needsProcessing) {
                const audioClips = await this.createAudioClips(extracted, SUFFIX_SYSTEM_AUDIO, this.clips)
                const track = await this.concat(SUFFIX_SYSTEM_AUDIO, audioClips)
                tracks.push(track)
            } else
                tracks.push(extracted)
        }

        if (tracks.length > 0) return this.mix(tracks)
    }
    async addToVideo() {
        await waitOn({ resources: [renderedVideoFile(this.renderId), path.join(this.tempPath, "final.mp3")] })

        await this.ffmpeg([
            "-y",
            "-i", renderedVideoFile(this.renderId),
            "-i", path.join(this.tempPath, "final.mp3"),
            "-map", "0:v",
            "-map", "1:a",
            "-c:v", "copy",
            "-shortest",
            renderedVideoWithAudioFile(this.renderId)
        ])
    }

    async extract(input, outputSuffix) {
        await waitOn({ resources: [input] })

        const output = path.join(this.tempPath, `${outputSuffix}.wav`)

        await this.ffmpeg([
            "-y",
            "-i", input,
            "-q:a", 0,
            "-map", "a",
            output
        ])
        return output
    }

    async createAudioClips(input, outputSuffix, clips) {
        await waitOn({ resources: [input] })

        const output = []
        await Promise.all(clips.map(({ id, start, end, playbackRate, microphoneAudioVolume, systemAudioVolume }) => {

            const filter = []

            if (playbackRate !== 1 ||
                (outputSuffix === SUFFIX_WEBCAM && microphoneAudioVolume !== 1) ||
                (outputSuffix === SUFFIX_SYSTEM_AUDIO && systemAudioVolume !== 1)) {
                filter.push("-filter:a", "")
            }

            if (playbackRate !== 1) {
                filter[1] += `rubberband=tempo=${playbackRate}`
            }

            if (microphoneAudioVolume !== 1 && outputSuffix === SUFFIX_WEBCAM) {
                if (filter[1].length > 0) filter[1] += ","
                filter[1] += `volume=${microphoneAudioVolume}`
            }

            if (systemAudioVolume !== 1 && outputSuffix === SUFFIX_SYSTEM_AUDIO) {
                if (filter[1].length > 0) filter[1] += ","
                filter[1] += `volume=${systemAudioVolume}`
            }

            const outputFile = path.join(this.tempPath, `${id}-${outputSuffix}.wav`)

            const args = [
                "-y",
                "-ss", this.formatMs(start),
                "-to", this.formatMs(end),
                "-i", input,
                "-q:a", 0,
                "-map", "a",
                ...filter,
                outputFile
            ]

            output.push(outputFile)

            return this.ffmpeg(args)
        }))

        return output
    }

    async concat(suffix, audioClips) {
        await waitOn({ resources: audioClips })

        const outputFile = path.join(this.tempPath, `final-${suffix}.wav`)

        if (audioClips.length > 1) {
            const args = ["-y"]
            const mapping = audioClips.map((_, i) => `[${i}:a]`).join('')
            audioClips.forEach(clip => args.push("-i", clip))

            args.push(
                "-filter_complex", `${mapping}concat=n=${audioClips.length}:v=0:a=1[aout]`,
                "-map", "[aout]",
                outputFile
            )

            await this.ffmpeg(args)
        } else
            await rename(audioClips[0], outputFile)

        return outputFile
    }

    async mix(tracks) {
        await waitOn({ resources: tracks })

        const output = path.join(this.tempPath, "final.mp3")

        const args = ["-y"]
        tracks.forEach(track => args.push("-i", track))
        if (tracks.length === 2) args.push("-filter_complex", "amix=inputs=2:duration=shortest")
        args.push("-codec:a", "libmp3lame", output)

        await this.ffmpeg(args)

        return output
    }

    formatMs(ms) {
        momentDurationFormatSetup(moment)
        return moment.duration(ms).format("mm:ss.SSS", { trim: false })
    }

    ffmpeg(args) {
        return ffmpeg(
            args,
            undefined,
            undefined,
            undefined,
            (...args) => {
                const error = reportFfmpegError(...args)
                throw error
            }
        )
    }
}