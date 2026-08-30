const SRT_TIMING_PATTERN = /^\s*(\d{1,3}):([0-5]\d):([0-5]\d)[,.](\d{1,3})\s*-->\s*(\d{1,3}):([0-5]\d):([0-5]\d)[,.](\d{1,3})(?:\s+.*)?$/
const ASS_TIMING_PATTERN = /^\s*(\d{1,3}):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?\s*$/
const DEFAULT_ASS_FIELDS = [
    "layer",
    "start",
    "end",
    "style",
    "name",
    "marginl",
    "marginr",
    "marginv",
    "effect",
    "text",
]

export const MAX_CAPTION_CUES = 10000

export class CaptionParseError extends Error {
    constructor(message, issues = []) {
        super(message)
        this.name = "CaptionParseError"
        this.issues = issues
    }
}

function normalizeSource(source) {
    if (typeof source !== "string") {
        throw new CaptionParseError("Caption file could not be read as text.")
    }

    return source
        .replace(/^\uFEFF/, "")
        .replace(/\0/g, "")
        .replace(/\r\n?/g, "\n")
}

function fractionToMilliseconds(fraction) {
    return Number(fraction.padEnd(3, "0").slice(0, 3))
}

export function parseSrtTimestamp(value) {
    const match = String(value).match(/^(\d{1,3}):([0-5]\d):([0-5]\d)[,.](\d{1,3})$/)
    if (!match) return null

    const [, hours, minutes, seconds, fraction] = match
    return Number(hours) * 3600000
        + Number(minutes) * 60000
        + Number(seconds) * 1000
        + fractionToMilliseconds(fraction)
}

export function parseAssTimestamp(value) {
    const match = String(value).match(ASS_TIMING_PATTERN)
    if (!match) return null

    const [, hours, minutes, seconds, fraction = "0"] = match
    return Number(hours) * 3600000
        + Number(minutes) * 60000
        + Number(seconds) * 1000
        + fractionToMilliseconds(fraction)
}

function validateCue(cue, label, issues) {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end)) {
        issues.push(`${label} has an invalid timestamp.`)
        return false
    }
    if (cue.start < 0 || cue.end <= cue.start) {
        issues.push(`${label} must end after it starts.`)
        return false
    }
    if (!cue.text.trim()) {
        issues.push(`${label} has no caption text.`)
        return false
    }
    return true
}

function finalizeCues(cues, issues, warnings) {
    if (issues.length > 0) {
        throw new CaptionParseError(
            `Caption file has ${issues.length} invalid ${issues.length === 1 ? "cue" : "cues"}. ${issues[0]}`,
            issues,
        )
    }
    if (cues.length === 0) {
        throw new CaptionParseError("No usable captions were found in this file.")
    }
    if (cues.length > MAX_CAPTION_CUES) {
        throw new CaptionParseError(`Caption files are limited to ${MAX_CAPTION_CUES.toLocaleString()} cues.`)
    }

    const wasOutOfOrder = cues.some((cue, index) => index > 0 && cue.start < cues[index - 1].start)
    const sorted = cues
        .map((cue, sourceIndex) => ({ ...cue, sourceIndex }))
        .sort((a, b) => a.start - b.start || a.end - b.end || a.sourceIndex - b.sourceIndex)
        .map(({ sourceIndex: _sourceIndex, ...cue }) => cue)

    if (wasOutOfOrder) warnings.push("Out-of-order cues were arranged by start time.")

    const overlapCount = sorted.reduce((count, cue, index) => {
        if (index === 0) return count
        return count + (cue.start < sorted[index - 1].end ? 1 : 0)
    }, 0)
    if (overlapCount > 0) {
        warnings.push(`${overlapCount} overlapping ${overlapCount === 1 ? "cue was" : "cues were"} preserved.`)
    }

    return { cues: sorted, warnings }
}

export function parseSrt(source) {
    const normalized = normalizeSource(source).trim()
    if (!normalized) throw new CaptionParseError("The SRT file is empty.")

    const cues = []
    const issues = []
    const blocks = normalized.split(/\n[\t ]*\n+/)

    blocks.forEach((block, blockIndex) => {
        const lines = block.split("\n")
        const timingIndex = lines.findIndex(line => line.includes("-->"))
        const label = `SRT cue ${blockIndex + 1}`

        if (timingIndex < 0 || timingIndex > 1) {
            issues.push(`${label} is missing a valid timing line.`)
            return
        }

        const timingMatch = lines[timingIndex].match(SRT_TIMING_PATTERN)
        if (!timingMatch) {
            issues.push(`${label} has an invalid timing line.`)
            return
        }

        const start = parseSrtTimestamp(`${timingMatch[1]}:${timingMatch[2]}:${timingMatch[3]},${timingMatch[4]}`)
        const end = parseSrtTimestamp(`${timingMatch[5]}:${timingMatch[6]}:${timingMatch[7]},${timingMatch[8]}`)
        const text = lines.slice(timingIndex + 1).join("\n").trim()
        const cue = { start, end, text }
        if (validateCue(cue, label, issues)) cues.push(cue)
    })

    return { format: "srt", ...finalizeCues(cues, issues, []) }
}

function splitAssFields(value, fieldCount) {
    const fields = []
    let start = 0

    for (let index = 0; index < fieldCount - 1; index += 1) {
        const comma = value.indexOf(",", start)
        if (comma < 0) return null
        fields.push(value.slice(start, comma))
        start = comma + 1
    }
    fields.push(value.slice(start))
    return fields
}

function sanitizeAssText(text) {
    const overrideBlocks = text.match(/\{[^}]*\}/g) || []
    const hasUnclosedOverride = text.replace(/\{[^}]*\}/g, "").includes("{")
    let sanitized = text.replace(/\{[^}]*\}/g, "")
    if (hasUnclosedOverride) sanitized = sanitized.replace(/\{.*$/s, "")

    sanitized = sanitized
        .replace(/\\[Nn]/g, "\n")
        .replace(/\\h/g, " ")

    let unsupportedEscapeCount = 0
    sanitized = sanitized.replace(/\\[a-zA-Z]/g, () => {
        unsupportedEscapeCount += 1
        return ""
    })

    return {
        text: sanitized.trim(),
        overrideCount: overrideBlocks.length + Number(hasUnclosedOverride),
        unsupportedEscapeCount,
    }
}

export function parseAss(source) {
    const normalized = normalizeSource(source)
    if (!normalized.trim()) throw new CaptionParseError("The ASS file is empty.")

    const cues = []
    const issues = []
    const warnings = []
    let currentSection = ""
    let fields = DEFAULT_ASS_FIELDS
    let eventsFormatValid = true
    let dialogueCount = 0
    let overrideCount = 0
    let unsupportedEscapeCount = 0
    let ignoredEffectCount = 0

    normalized.split("\n").forEach((rawLine, lineIndex) => {
        const line = rawLine.trim()
        if (!line || line.startsWith(";")) return

        const sectionMatch = line.match(/^\[([^\]]+)]$/)
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim().toLowerCase()
            return
        }
        if (currentSection !== "events") return

        const formatMatch = line.match(/^Format\s*:\s*(.*)$/i)
        if (formatMatch) {
            const nextFields = formatMatch[1].split(",").map(field => field.trim().toLowerCase())
            if (!nextFields.includes("start") || !nextFields.includes("end") || !nextFields.includes("text")) {
                issues.push(`ASS events format on line ${lineIndex + 1} must include Start, End, and Text.`)
                eventsFormatValid = false
            } else if (nextFields.at(-1) !== "text") {
                issues.push(`ASS events format on line ${lineIndex + 1} must keep Text as the final field.`)
                eventsFormatValid = false
            } else {
                fields = nextFields
                eventsFormatValid = true
            }
            return
        }

        const dialogueMatch = line.match(/^Dialogue\s*:\s*(.*)$/i)
        if (!dialogueMatch) return
        dialogueCount += 1
        if (!eventsFormatValid) return

        const values = splitAssFields(dialogueMatch[1], fields.length)
        const label = `ASS dialogue on line ${lineIndex + 1}`
        if (!values) {
            issues.push(`${label} does not match the Events format.`)
            return
        }

        const record = Object.fromEntries(fields.map((field, index) => [field, values[index]?.trim() ?? ""]))
        const start = parseAssTimestamp(record.start)
        const end = parseAssTimestamp(record.end)
        const sanitized = sanitizeAssText(record.text)
        overrideCount += sanitized.overrideCount
        unsupportedEscapeCount += sanitized.unsupportedEscapeCount
        if (record.effect) ignoredEffectCount += 1

        const cue = { start, end, text: sanitized.text }
        if (validateCue(cue, label, issues)) cues.push(cue)
    })

    if (dialogueCount === 0) {
        throw new CaptionParseError("No Dialogue events were found in the ASS file.")
    }
    if (overrideCount > 0) {
        warnings.push(`${overrideCount} ASS formatting ${overrideCount === 1 ? "override was" : "overrides were"} removed.`)
    }
    if (unsupportedEscapeCount > 0) {
        warnings.push(`${unsupportedEscapeCount} unsupported ASS text ${unsupportedEscapeCount === 1 ? "escape was" : "escapes were"} removed.`)
    }
    if (ignoredEffectCount > 0) {
        warnings.push(`${ignoredEffectCount} ASS ${ignoredEffectCount === 1 ? "effect was" : "effects were"} ignored.`)
    }

    return { format: "ass", ...finalizeCues(cues, issues, warnings) }
}

export function detectCaptionFormat(fileName, source = "") {
    const extension = String(fileName || "").trim().toLowerCase().match(/\.([^.]+)$/)?.[1]
    if (extension === "srt" || extension === "ass") return extension

    const normalized = normalizeSource(source)
    if (/^\s*\[Events]\s*$/im.test(normalized) && /^\s*Dialogue\s*:/im.test(normalized)) return "ass"
    if (/\d{1,3}:[0-5]\d:[0-5]\d[,.]\d{1,3}\s*-->/m.test(normalized)) return "srt"
    return null
}

export function parseCaptionFile({ source, fileName } = {}) {
    const format = detectCaptionFormat(fileName, source)
    if (format === "srt") return parseSrt(source)
    if (format === "ass") return parseAss(source)
    throw new CaptionParseError("Choose a valid .srt or .ass caption file.")
}
