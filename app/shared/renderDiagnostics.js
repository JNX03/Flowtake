const MAX_ERROR_LENGTH = 4_000

export function sanitizeRenderError(value) {
    return String(value || "Unknown render failure")
        .replace(/\b[A-Za-z]:\\[^\s"'<>|]*/g, "[local path]")
        .replace(/\/(?:Users|home)\/[^\s"'<>|]+/g, "[local path]")
        .replace(
            /\b(token|secret|password|authorization)\s*[:=]\s*[^\s,;]+/gi,
            "$1=[redacted]"
        )
        .slice(0, MAX_ERROR_LENGTH)
}

export function buildRenderDiagnostic(render) {
    const resolution = render?.config?.resolution
    const resolutionText = resolution?.x && resolution?.y
        ? `${resolution.x}x${resolution.y}`
        : "unknown"
    const includeAudio = render?.config?.includeAudio !== false
    const format = render?.config?.format
    const formatText = format === undefined || format === null || format === "mp4"
        ? "MP4"
        : format === "webm" ? "WebM" : "invalid"

    return [
        "Flowtake export diagnostic",
        `Status: ${render?.status || "unknown"}`,
        `Format: ${formatText}`,
        `Resolution: ${resolutionText}`,
        `Frame rate: ${render?.config?.fps || "unknown"} FPS`,
        `Quality: ${render?.config?.quality || "unknown"}`,
        `Audio: ${includeAudio ? "included" : "excluded"}`,
        `Error: ${sanitizeRenderError(render?.error)}`,
    ].join("\n")
}
