import * as Sentry from '@sentry/electron/main'
import { spawn } from 'child_process'
import ffmpegPath from "../../resources/ffmpeg.exe?asset"

export const STREAM_STDERR = "stderr"
export const STREAM_STDOUT = "stdout"

const ffmpeg = async (args, onData = null, stream = STREAM_STDERR, onProcess = null, onError = reportFfmpegError) => {
    const process = spawn(ffmpegPath, ["-hide_banner", ...args])
    process[stream].setEncoding('utf8')
    process[stream].on('data', data => onData?.(data))

    let errorOutput = `ffmpeg ${args.join(" ")}\n`
    process[STREAM_STDERR].setEncoding('utf8')
    process[STREAM_STDERR].on('data', data => errorOutput += data)

    onProcess?.(process)

    return await new Promise(resolve => process.on('close', async code => {
        if (code > 0) await onError?.(code, errorOutput)
        resolve(code)
    }))
}

export const cancel = process => {
    if (process && !process.killed && process.stdin.writable) {
        process.stdin.write("q\n")
        process.stdin.end()
    }
}

export const getEncoders = async () => {
    let output = ""
    await ffmpeg(["-encoders"], data => output += data, STREAM_STDOUT)

    return output
        .split("------")[1]                                     // remove header     
        .split("\n")                                            // split by line
        .map(encoder =>
            encoder
                .replace("\r", "").trim()                       // remove trailing whitespace
                .split(" ").filter(encoder => encoder !== "")   // extract words in line
        )
        .filter(encoder => encoder.length > 1)                  // remove empty lines
        .map(encoder => encoder[1])                             // extract encoder name
        .filter(                                                // only h264 hardware encoders, and libx264 software fallback
            encoder => encoder.includes("h264") || encoder === "libx264")
}

export const getEncoderSupport = async (encoder, capturerArgs) => {
    let ffmpegProcess = null
    let encoderSupport = false
    const regex = /time=(\d{2}:\d{2}:\d{2}\.\d{2})/
    await ffmpeg([...capturerArgs,
        "-c:v", encoder, ...getEncoderConfig(encoder),
        "-f", "null", "-"],
        data => {
            if (regex.test(data) && !encoderSupport) {
                encoderSupport = true
                cancel(ffmpegProcess)
            }
        },
        STREAM_STDERR,
        process => ffmpegProcess = process,
        null    // errors are handled, don't report them
    )
    return encoderSupport
}

const getEncoderRating = encoder => {
    // MF is widely supported but needs a bit rate config depending on resolution and fps
    if (encoder.includes("_mf")) return 4
    // HW encoders
    if (encoder.includes("_qsv") || encoder.includes("_nvenc") || encoder.includes("_amf")) return 3
    // software encoder fallback
    if (encoder === "libx264") return 2
    return 0
}

const getEncoderConfig = encoder => {
    if (encoder.includes("_mf")) return []
    if (encoder.includes("_qsv")) return ["-global_quality", "10"]
    if (encoder.includes("_nvenc")) return ["-cq", "10"]
    if (encoder.includes("_amf")) return ["-quality", "quality", "-rc", "cqp", "-qp_p", "10", "-qp_i", "10", "-qp_b", "10"]
    if (encoder === "libx264") return ["-crf", "25", "-preset", "ultrafast"]
    return []
}

const getEncoderDisplayName = encoder => {
    if (encoder.includes("_mf")) return "Media Foundation"
    if (encoder.includes("_qsv")) return "Intel Quick Sync Video"
    if (encoder.includes("_nvenc")) return "NVIDIA NVENC"
    if (encoder.includes("_amf")) return "AMD AMF"
    if (encoder === "libx264") return "Software Encoder"
    return []
}

export const getSupportedEncoders = async (capturerArgs) => {
    const encoders = await getEncoders()

    const support = []
    for (const name of encoders) {
        const isSupported = await getEncoderSupport(name, capturerArgs)
        support.push({ name, isSupported })
    }

    return support
        .filter(encoder => encoder.isSupported)
        .map(({ name }) => ({
            name,
            displayName: getEncoderDisplayName(name),
            rating: getEncoderRating(name),
            config: getEncoderConfig(name),
            isSelected: false
        }))
        .sort((a, b) => b.rating - a.rating)
        .map((encoder, i) => {
            if (i === 0) encoder.isSelected = true
            return encoder
        })
}

export const getCapturerConfig = (capturer, { x, y, width, height }, fps) => {
    switch (capturer) {
        case "ddagrab":
            return ["-r", fps, "-filter_complex", "ddagrab=draw_mouse=0:output_fmt=auto,hwdownload,format=bgra"]
        case "gdigrab":
            return ["-f", "gdigrab", "-framerate", fps, "-draw_mouse", 0, "-offset_x", x,
                "-offset_y", y, "-video_size", `${width}x${height}`,
                "-i", "desktop"]
    }
}

export const getCapturerSupport = async capturer => {
    let ffmpegProcess = null
    let capturerSupport = false
    const regex = /time=(\d{2}:\d{2}:\d{2}\.\d{2})/
    await ffmpeg([...capturer.config,
        "-f", "null", "-"],
        data => {
            if (regex.test(data) && !capturerSupport) {
                capturerSupport = true
                cancel(ffmpegProcess)
            }
        },
        STREAM_STDERR,
        process => ffmpegProcess = process,
        null    // errors are handled, don't report them
    )
    return capturerSupport
}

export const getSupportedCapturers = async fps => {
    const capturers = [
        {
            name: "ddagrab",
            displayName: "Desktop Duplication API",
            rating: 2,
            config: ["-filter_complex", "ddagrab=draw_mouse=0:output_fmt=auto,hwdownload,format=bgra"],
            isSelected: false
        },
        {
            name: "gdigrab",
            displayName: "Graphics Device Interface",
            rating: 1,
            config: ["-f", "gdigrab", "-framerate", fps, "-draw_mouse", 0, "-i", "desktop"],
            isSelected: false
        }
    ]

    for (const capturer of capturers) {
        capturer.isSupported = await getCapturerSupport(capturer)
    }

    return capturers
        .filter(capturer => capturer.isSupported)
        .sort((a, b) => b.rating - a.rating)
        .map((capturer, i) => {
            if (i === 0) capturer.isSelected = true
            return capturer
        })
}

export const getDevices = async () => {
    const devices = []
    const regex = /"([^"]+)"(?=\s*\(audio\))/
    
    await ffmpeg(["-list_devices", "true", "-f", "dshow", "-i", "dummy"], data => {
        const match = data.match(regex)
        if (match) devices.push(match[1])

    }, STREAM_STDERR)

    return devices
}

export const reportFfmpegError = (code, output) => {
    const title = `FFMPEG error (exit code ${code})`
    const error = new Error(title)

    Sentry.withScope(scope => {
        scope.addAttachment({ filename: 'ffmpeg_output.txt', data: output })
        Sentry.captureException(error)
    })

    console.warn(`${title}\n${output}`)
    
    return error
}

export default ffmpeg
