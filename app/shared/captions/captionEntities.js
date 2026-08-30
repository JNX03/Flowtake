function normalizeId(value, fallback) {
    const normalized = String(value || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 96)
    return normalized || fallback
}

function claimUniqueId(baseId, usedIds) {
    if (!usedIds.has(baseId)) {
        usedIds.add(baseId)
        return baseId
    }

    let suffix = 2
    while (usedIds.has(`${baseId}-${suffix}`)) suffix += 1
    const uniqueId = `${baseId}-${suffix}`
    usedIds.add(uniqueId)
    return uniqueId
}

export function createCaptionEntities(cues, {
    existingIds = [],
    createId = ({ index }) => `subtitle-import-${index + 1}`,
} = {}) {
    if (!Array.isArray(cues)) throw new TypeError("Caption cues must be an array.")

    const usedIds = new Set(existingIds.map(String))
    return cues.map((cue, index) => {
        const fallback = `subtitle-import-${index + 1}`
        const requestedId = createId({ cue, index })
        const id = claimUniqueId(normalizeId(requestedId, fallback), usedIds)

        return {
            id,
            start: cue.start,
            end: cue.end,
            text: cue.text,
            entranceEffect: { type: "none", duration: 300 },
            exitEffect: { type: "none", duration: 300 },
        }
    })
}
