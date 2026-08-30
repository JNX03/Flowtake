export const EXPORT_FORMAT_MP4 = "mp4"
export const EXPORT_FORMAT_WEBM = "webm"

const EXPORT_FORMATS = Object.freeze({
    [EXPORT_FORMAT_MP4]: Object.freeze({
        value: EXPORT_FORMAT_MP4,
        label: "MP4",
        extension: "mp4",
        outputFileName: "output.mp4",
        videoCodec: "avc",
        videoCodecLabel: "H.264/AVC",
        audioCodec: "aac",
    }),
    [EXPORT_FORMAT_WEBM]: Object.freeze({
        value: EXPORT_FORMAT_WEBM,
        label: "WebM",
        extension: "webm",
        outputFileName: "output.webm",
        videoCodec: "vp9",
        videoCodecLabel: "VP9",
        audioCodec: "opus",
    }),
})

export const EXPORT_FORMAT_OPTIONS = Object.freeze([
    EXPORT_FORMATS[EXPORT_FORMAT_MP4],
    EXPORT_FORMATS[EXPORT_FORMAT_WEBM],
])

export function resolveExportFormat(value) {
    if (value === undefined || value === null) return EXPORT_FORMAT_MP4
    if (value === EXPORT_FORMAT_MP4 || value === EXPORT_FORMAT_WEBM) return value
    throw new Error("Unsupported export format. Choose MP4 or WebM.")
}

export function getExportFormatConfig(value) {
    return EXPORT_FORMATS[resolveExportFormat(value)]
}

export async function assertExportCodecSupport(value, resolution, checkCodec) {
    const config = getExportFormatConfig(value)
    const width = Number(resolution?.x)
    const height = Number(resolution?.y)

    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
        throw new Error("Choose a valid export resolution before exporting.")
    }
    if (typeof checkCodec !== "function") {
        throw new TypeError("A codec support checker is required.")
    }

    let isSupported = false
    try {
        isSupported = await checkCodec(config.videoCodec, { width, height })
    } catch {
        isSupported = false
    }

    if (!isSupported) {
        throw new Error(
            `${config.label} export requires ${config.videoCodecLabel} encoding, ` +
            "which is not supported by this system. Choose another format or resolution."
        )
    }

    return config
}
