import { randomUUID } from "node:crypto"
import { createCaptionEntities } from "../../app/shared/captions/captionEntities.js"
import {
    planDelete,
    planRetainLeft,
    planRetainRight,
    planSplit,
    toEntityArray,
} from "../../app/shared/editor/commandPlanner.js"
import { migrateProjectDocument } from "../../app/shared/editor/projectSchema.js"
import { ProjectStoreError } from "./projectStore.mjs"

export const EDITABLE_ROWS = Object.freeze([
    "clips",
    "subtitles",
    "audio-tracks",
    "overlay-tracks",
    "masks",
])

// Keep this aligned with editorSlice's selectDuration semantics. Only media
// content can extend the sequence; source-synchronised captions and masks may
// contain capture timestamps that should not create an invisible timeline tail.
const TIMELINE_DURATION_ROWS = Object.freeze([
    "clips",
    "audio-tracks",
    "overlay-tracks",
])

const ROW_SLICES = Object.freeze({
    clips: "clipAnims",
    subtitles: "subtitleAnims",
    "audio-tracks": "audioTrackAnims",
    "overlay-tracks": "overlayAnims",
    masks: "maskAnims",
})

const MAX_CAPTIONS_PER_EDIT = 200
const MAX_PROJECT_CAPTIONS = 10000
const MAX_CAPTION_TEXT_LENGTH = 2000
const MIN_ITEM_DURATION_MS = 100
const EFFECT_TYPES = new Set([
    "none",
    "fade",
    "typewriter",
    "slide-up",
    "slide-down",
    "bounce",
    "scale",
])

export class FlowtakeEditError extends Error {
    constructor(code, message, details = {}) {
        super(message)
        this.name = "FlowtakeEditError"
        this.code = code
        this.details = details
    }
}

function assertEditableRow(row) {
    if (!EDITABLE_ROWS.includes(row)) {
        throw new FlowtakeEditError("unsupported-row", `Unsupported timeline row: ${row}`)
    }
}

function clone(value) {
    return structuredClone(value)
}

function getProjectDuration(document) {
    const recordedEnd = Number(document?.project?.videoDetails?.end)
    const sceneDuration = Number(
        document?.editorDomain?.scenes?.[document?.editorDomain?.activeSceneId]?.duration,
    )

    const values = [recordedEnd, sceneDuration]
    for (const row of TIMELINE_DURATION_ROWS) {
        for (const entity of getRowEntities(document, row)) values.push(entity?.end)
    }
    return Math.max(
        0,
        ...values.map(Number).filter(value => Number.isFinite(value) && value > 0),
    )
}

function normalizeDocument(document) {
    const duration = getProjectDuration(document)
    const normalized = migrateProjectDocument(document, {
        projectId: document?.project?.id ?? null,
        duration,
    })
    for (const key of Object.keys(document)) delete document[key]
    Object.assign(document, normalized)
    return document
}

export function getRowEntities(document, row) {
    assertEditableRow(row)
    return toEntityArray(document?.[ROW_SLICES[row]]).map(clone)
}

function getRowTracks(document, row) {
    const tracks = document?.[ROW_SLICES[row]]?.tracks
    return Array.isArray(tracks) ? tracks.map(clone) : []
}

function setRowEntities(document, row, entities) {
    const sliceKey = ROW_SLICES[row]
    const nextSlice = {
        ...(document[sliceKey] && typeof document[sliceKey] === "object"
            ? document[sliceKey]
            : {}),
        entities: [...entities].sort((left, right) => (
            Number(left.start) - Number(right.start)
            || Number(left.end) - Number(right.end)
            || String(left.id).localeCompare(String(right.id))
        )),
    }
    delete nextSlice.ids
    document[sliceKey] = nextSlice
}

function validateEffect(effect, label) {
    if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
        throw new FlowtakeEditError("invalid-caption-effect", `${label} must be an effect object`)
    }
    if (!EFFECT_TYPES.has(effect.type)) {
        throw new FlowtakeEditError("invalid-caption-effect", `${label} has an unsupported type`)
    }
    if (!Number.isFinite(effect.duration) || effect.duration < 0 || effect.duration > 5000) {
        throw new FlowtakeEditError("invalid-caption-effect", `${label} duration must be between 0 and 5000 ms`)
    }
}

function validateRowEntities(document, row) {
    const duration = getProjectDuration(document)
    const ids = new Set()
    const entities = getRowEntities(document, row)

    for (const [index, entity] of entities.entries()) {
        if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
            throw new FlowtakeEditError("invalid-entity", `${row} item ${index + 1} is not an object`)
        }
        if (typeof entity.id !== "string" || !entity.id.trim() || entity.id.length > 128) {
            throw new FlowtakeEditError(
                "invalid-entity-id",
                `${row} item ${index + 1} needs a unique string id before AI editing`,
            )
        }
        if (ids.has(entity.id)) {
            throw new FlowtakeEditError("duplicate-entity-id", `${row} contains duplicate id ${entity.id}`)
        }
        ids.add(entity.id)

        if (!Number.isFinite(entity.start) || !Number.isFinite(entity.end)
            || entity.start < 0 || entity.end <= entity.start) {
            throw new FlowtakeEditError("invalid-entity-range", `${row} item ${entity.id} has an invalid time range`)
        }
        if (duration > 0 && entity.end > duration + 50) {
            throw new FlowtakeEditError("outside-timeline", `${row} item ${entity.id} ends outside the project timeline`)
        }
        if (row === "subtitles") {
            if (typeof entity.text !== "string" || !entity.text.trim()) {
                throw new FlowtakeEditError("invalid-caption-text", `Caption ${entity.id} has empty text`)
            }
            if (entity.text.length > MAX_CAPTION_TEXT_LENGTH) {
                throw new FlowtakeEditError("caption-text-too-long", `Caption ${entity.id} text is too long`)
            }
            if (entity.entranceEffect) validateEffect(entity.entranceEffect, `Caption ${entity.id} entrance effect`)
            if (entity.exitEffect) validateEffect(entity.exitEffect, `Caption ${entity.id} exit effect`)
        }
    }

    if (row === "subtitles" && entities.length > MAX_PROJECT_CAPTIONS) {
        throw new FlowtakeEditError(
            "too-many-captions",
            `Projects are limited to ${MAX_PROJECT_CAPTIONS} captions`,
        )
    }
    return entities
}

function assertProjectCanEdit(document, row) {
    if (!document?.project || typeof document.project !== "object" || Array.isArray(document.project)) {
        throw new FlowtakeEditError("invalid-project", "Flowtake project metadata is missing")
    }
    normalizeDocument(document)
    const duration = getProjectDuration(document)
    if (duration <= 0) {
        throw new FlowtakeEditError("invalid-project-duration", "Project must have a positive duration before timeline editing")
    }
    return {
        duration,
        entities: validateRowEntities(document, row),
        tracks: getRowTracks(document, row),
    }
}

function getEntityOrThrow(entities, itemId, row) {
    const entity = entities.find(candidate => candidate.id === itemId)
    if (!entity) throw new FlowtakeEditError("missing-entity", `${row} item ${itemId} was not found`)
    return entity
}

function planOrThrow(plan) {
    if (plan.ok) return plan
    throw new FlowtakeEditError(
        plan.reason ?? "edit-rejected",
        `Flowtake rejected the ${plan.kind ?? "timeline"} edit: ${plan.reason ?? "unknown reason"}`,
        Object.fromEntries(Object.entries(plan).filter(([key]) => !["ok", "reason"].includes(key))),
    )
}

export function applyTimelinePlan(document, plan) {
    const entities = getRowEntities(document, plan.row)
    const byId = new Map(entities.map(entity => [entity.id, entity]))

    for (const operation of plan.operations ?? []) {
        if (operation.row !== plan.row) {
            throw new FlowtakeEditError("invalid-plan", "Timeline plan contains a cross-row operation")
        }
        if (operation.op === "remove") {
            if (!byId.delete(operation.id)) {
                throw new FlowtakeEditError("invalid-plan", `Cannot remove missing item ${operation.id}`)
            }
        } else if (operation.op === "update") {
            const current = byId.get(operation.id)
            if (!current) throw new FlowtakeEditError("invalid-plan", `Cannot update missing item ${operation.id}`)
            byId.set(operation.id, { ...current, ...clone(operation.changes) })
        } else if (operation.op === "add") {
            if (byId.has(operation.entity?.id)) {
                throw new FlowtakeEditError("invalid-plan", `Cannot add duplicate item ${operation.entity.id}`)
            }
            byId.set(operation.entity.id, clone(operation.entity))
        } else {
            throw new FlowtakeEditError("invalid-plan", `Unsupported plan operation ${operation.op}`)
        }
    }

    setRowEntities(document, plan.row, [...byId.values()])
    validateRowEntities(document, plan.row)
}

function compactPlan(plan) {
    return {
        kind: plan.kind,
        row: plan.row,
        operations: plan.operations,
        selection: plan.selection,
        ripple: plan.ripple === true,
    }
}

function compactEditResult(result) {
    const { document: _document, ...safe } = result
    return safe
}

function createSplitId(itemId, requestedId, entities) {
    const existingIds = new Set(entities.map(entity => entity.id))
    const normalized = String(requestedId ?? `${itemId}-ai-${randomUUID().slice(0, 8)}`)
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 128)
    if (!normalized || existingIds.has(normalized)) {
        throw new FlowtakeEditError("invalid-new-id", "newItemId must be non-empty and unique")
    }
    return normalized
}

function assertSourceTimingSupported(row, entity, operation) {
    if (row === "overlay-tracks" && entity?.overlayType === "video") {
        throw new FlowtakeEditError(
            "video-overlay-source-timing-unsupported",
            `Cannot ${operation} a video overlay safely yet because Flowtake's shared command planner does not preserve its source in-point. Edit this item in the desktop editor instead.`,
        )
    }
}

export function summarizeProject(document, { includeValidationWarnings = true } = {}) {
    const durationMs = getProjectDuration(document)
    const rowCounts = {}
    const warnings = []

    for (const row of EDITABLE_ROWS) {
        const entities = getRowEntities(document, row)
        rowCounts[row] = entities.length
        if (includeValidationWarnings) {
            const missingIds = entities.filter(entity => typeof entity?.id !== "string" || !entity.id.trim()).length
            const invalidRanges = entities.filter(entity => (
                !Number.isFinite(entity?.start)
                || !Number.isFinite(entity?.end)
                || entity.start < 0
                || entity.end <= entity.start
            )).length
            if (missingIds) warnings.push(`${row}: ${missingIds} item(s) need IDs before MCP editing`)
            if (invalidRanges) warnings.push(`${row}: ${invalidRanges} item(s) have invalid ranges`)
        }
    }

    return {
        id: document?.project?.id ?? null,
        name: document?.project?.name ?? "Untitled Flowtake project",
        durationMs,
        durationSeconds: Math.round(durationMs) / 1000,
        aspectRatio: document?.project?.aspectRatio ?? null,
        resolution: document?.project?.videoDetails?.width && document?.project?.videoDetails?.height
            ? {
                width: document.project.videoDetails.width,
                height: document.project.videoDetails.height,
            }
            : null,
        sources: {
            screen: true,
            camera: document?.project?.hasCameraVideo === true,
            microphone: document?.project?.hasMicrophoneAudio === true,
            systemAudio: document?.project?.hasSystemAudio === true,
        },
        editorSchemaVersion: document?.editorDomain?.schemaVersion ?? 0,
        rowCounts,
        warnings,
    }
}

function summarizeListEntry(entry, { includeNames = false } = {}) {
    if (entry.error) return entry
    const summary = summarizeProject(entry.document)
    if (!includeNames) delete summary.name
    return {
        projectRef: entry.projectRef,
        kind: entry.kind,
        revision: entry.revision,
        modifiedAt: entry.modifiedAt,
        storageState: entry.kind === "zip"
            ? {
                archive: true,
                openWorkspacePresent: entry.openWorkspacePresent === true,
                writable: entry.openWorkspacePresent !== true,
            }
            : { archive: false, openWorkspacePresent: false, writable: true },
        ...summary,
    }
}

export async function listFlowtakeProjects(store, options = {}) {
    const projects = await store.listProjects({ limit: options.limit })
    return {
        projects: projects.map(entry => summarizeListEntry(entry, {
            includeNames: options.includeNames === true,
        })),
    }
}

export async function getFlowtakeProjectSummary(store, projectRef, options = {}) {
    const loaded = await store.readProject(projectRef)
    const summary = summarizeProject(loaded.document)
    if (options.includeName !== true) delete summary.name
    return {
        projectRef: loaded.reference,
        kind: loaded.kind,
        revision: loaded.revision,
        storageState: loaded.kind === "zip"
            ? {
                archive: true,
                openWorkspacePresent: loaded.openWorkspacePresent === true,
                writable: loaded.openWorkspacePresent !== true,
                note: loaded.openWorkspacePresent
                    ? "Close this project in Flowtake before an MCP write; Flowtake would otherwise overwrite the archive when it closes."
                    : "Archive is not currently extracted by Flowtake according to the configured temp directory.",
            }
            : {
                archive: false,
                openWorkspacePresent: false,
                writable: true,
                note: "This reference points directly to an extracted project.json, not a durable Flowtake archive.",
            },
        summary,
    }
}

function timelineEntitySummary(row, entity, includeText) {
    const summary = {
        row,
        id: entity.id ?? null,
        startMs: entity.start ?? null,
        endMs: entity.end ?? null,
        durationMs: Number.isFinite(entity.start) && Number.isFinite(entity.end)
            ? entity.end - entity.start
            : null,
    }
    if (Number.isInteger(entity.trackIndex)) summary.trackIndex = entity.trackIndex

    if (row === "clips") {
        summary.playbackRate = entity.playbackRate ?? 1
        summary.sourceStartMs = entity.sourceStart ?? entity.start ?? null
        summary.sourceEndMs = entity.sourceEnd ?? entity.end ?? null
        summary.layout = entity.layout?.mode ?? null
    } else if (row === "subtitles") {
        summary.textLength = typeof entity.text === "string" ? entity.text.length : 0
        if (includeText) summary.text = entity.text ?? ""
        summary.entranceEffect = entity.entranceEffect?.type ?? "none"
        summary.exitEffect = entity.exitEffect?.type ?? "none"
    } else if (row === "audio-tracks") {
        summary.volume = entity.volume ?? null
        summary.sourceStartMs = entity.sourceStart ?? null
        summary.sourceEndMs = entity.sourceEnd ?? null
    } else if (row === "overlay-tracks") {
        summary.overlayType = entity.overlayType ?? null
        summary.opacity = entity.opacity ?? null
    }
    return summary
}

export async function getFlowtakeTimeline(store, {
    projectRef,
    rows = EDITABLE_ROWS,
    startMs = 0,
    endMs = null,
    includeText = false,
    limit = 200,
}) {
    const loaded = await store.readProject(projectRef)
    const duration = getProjectDuration(loaded.document)
    const requestedRows = [...new Set(rows)]
    requestedRows.forEach(assertEditableRow)
    const rangeEnd = endMs ?? duration
    const boundedLimit = Math.min(500, Math.max(1, Number(limit) || 200))
    const allItems = requestedRows.flatMap(row => getRowEntities(loaded.document, row)
        .filter(entity => entity.end > startMs && entity.start < rangeEnd)
        .map(entity => timelineEntitySummary(row, entity, includeText)))
        .sort((left, right) => (
            Number(left.startMs) - Number(right.startMs)
            || left.row.localeCompare(right.row)
            || String(left.id).localeCompare(String(right.id))
        ))

    return {
        projectRef: loaded.reference,
        revision: loaded.revision,
        storageState: loaded.kind === "zip"
            ? {
                archive: true,
                openWorkspacePresent: loaded.openWorkspacePresent === true,
                writable: loaded.openWorkspacePresent !== true,
            }
            : { archive: false, openWorkspacePresent: false, writable: true },
        range: { startMs, endMs: rangeEnd },
        totalMatches: allItems.length,
        truncated: allItems.length > boundedLimit,
        items: allItems.slice(0, boundedLimit),
    }
}

export async function splitFlowtakeItem(store, args) {
    const result = await store.editProject(args.projectRef, args.expectedRevision, document => {
        const { duration, entities, tracks } = assertProjectCanEdit(document, args.row)
        const original = getEntityOrThrow(entities, args.itemId, args.row)
        assertSourceTimingSupported(args.row, original, "split")
        const splitId = createSplitId(args.itemId, args.newItemId, entities)
        const plan = planOrThrow(planSplit({
            row: args.row,
            entities,
            selectedIds: [args.itemId],
            splitTime: args.splitAtMs,
            createId: () => splitId,
            tracks,
            timelineEnd: duration,
            minSegmentDuration: args.minSegmentDurationMs ?? MIN_ITEM_DURATION_MS,
        }))
        applyTimelinePlan(document, plan)
        return { plan: compactPlan(plan), newItemId: splitId }
    }, { dryRun: args.dryRun === true })
    return compactEditResult(result)
}

export async function trimFlowtakeItem(store, args) {
    const result = await store.editProject(args.projectRef, args.expectedRevision, document => {
        const context = assertProjectCanEdit(document, args.row)
        const original = getEntityOrThrow(context.entities, args.itemId, args.row)
        assertSourceTimingSupported(args.row, original, "trim")
        const nextStart = args.startMs ?? original.start
        const nextEnd = args.endMs ?? original.end
        if (nextStart < original.start || nextEnd > original.end) {
            throw new FlowtakeEditError(
                "trim-can-only-shorten",
                "Trim can only move inward; it cannot extend an item beyond its current range",
            )
        }
        if (nextEnd - nextStart < MIN_ITEM_DURATION_MS) {
            throw new FlowtakeEditError(
                "trim-too-short",
                `Trimmed items must remain at least ${MIN_ITEM_DURATION_MS} ms long`,
            )
        }

        const plans = []
        if (nextStart > original.start) {
            const plan = planOrThrow(planRetainRight({
                row: args.row,
                entities: getRowEntities(document, args.row),
                selectedIds: [args.itemId],
                splitTime: nextStart,
                tracks: context.tracks,
                timelineEnd: context.duration,
                minSegmentDuration: 0,
            }))
            applyTimelinePlan(document, plan)
            plans.push(compactPlan(plan))
        }
        const current = getEntityOrThrow(getRowEntities(document, args.row), args.itemId, args.row)
        if (nextEnd < current.end) {
            const plan = planOrThrow(planRetainLeft({
                row: args.row,
                entities: getRowEntities(document, args.row),
                selectedIds: [args.itemId],
                splitTime: nextEnd,
                tracks: context.tracks,
                timelineEnd: context.duration,
                minSegmentDuration: 0,
            }))
            applyTimelinePlan(document, plan)
            plans.push(compactPlan(plan))
        }
        validateRowEntities(document, args.row)
        return {
            itemId: args.itemId,
            previousRange: { startMs: original.start, endMs: original.end },
            range: { startMs: nextStart, endMs: nextEnd },
            plans,
            changed: plans.length > 0,
        }
    }, { dryRun: args.dryRun === true })
    return compactEditResult(result)
}

export async function deleteFlowtakeItem(store, args) {
    const result = await store.editProject(args.projectRef, args.expectedRevision, document => {
        const { duration, entities, tracks } = assertProjectCanEdit(document, args.row)
        getEntityOrThrow(entities, args.itemId, args.row)
        const plan = planOrThrow(planDelete({
            row: args.row,
            entities,
            selectedIds: [args.itemId],
            tracks,
            timelineEnd: duration,
            editingMode: args.ripple ? "ripple" : "normal",
        }))
        applyTimelinePlan(document, plan)
        return { plan: compactPlan(plan) }
    }, { dryRun: args.dryRun === true })
    return compactEditResult(result)
}

function normalizeCaptionInput(caption) {
    const text = String(caption.text ?? "").trim()
    if (!text) throw new FlowtakeEditError("invalid-caption-text", "Caption text cannot be empty")
    if (text.length > MAX_CAPTION_TEXT_LENGTH) {
        throw new FlowtakeEditError(
            "caption-text-too-long",
            `Caption text is limited to ${MAX_CAPTION_TEXT_LENGTH} characters`,
        )
    }
    if (!Number.isFinite(caption.startMs) || !Number.isFinite(caption.endMs)
        || caption.startMs < 0 || caption.endMs - caption.startMs < MIN_ITEM_DURATION_MS) {
        throw new FlowtakeEditError(
            "invalid-caption-range",
            `Captions must have a non-negative range of at least ${MIN_ITEM_DURATION_MS} ms`,
        )
    }
    return {
        id: caption.id,
        start: caption.startMs,
        end: caption.endMs,
        text,
        entranceEffect: caption.entranceEffect,
        exitEffect: caption.exitEffect,
    }
}

export async function addFlowtakeCaptions(store, args) {
    if (!Array.isArray(args.captions) || args.captions.length === 0) {
        throw new FlowtakeEditError("empty-caption-list", "At least one caption is required")
    }
    if (args.captions.length > MAX_CAPTIONS_PER_EDIT) {
        throw new FlowtakeEditError(
            "too-many-captions-in-edit",
            `Add at most ${MAX_CAPTIONS_PER_EDIT} captions per edit`,
        )
    }

    const result = await store.editProject(args.projectRef, args.expectedRevision, document => {
        const { duration, entities } = assertProjectCanEdit(document, "subtitles")
        const cues = args.captions.map(normalizeCaptionInput)
        const outside = cues.find(cue => cue.end > duration + 50)
        if (outside) throw new FlowtakeEditError("outside-timeline", "A caption ends outside the project timeline")
        if (entities.length + cues.length > MAX_PROJECT_CAPTIONS) {
            throw new FlowtakeEditError(
                "too-many-captions",
                `Projects are limited to ${MAX_PROJECT_CAPTIONS} captions`,
            )
        }

        const created = createCaptionEntities(cues, {
            existingIds: entities.map(entity => entity.id),
            createId: ({ cue, index }) => cue.id ?? `subtitle-ai-${randomUUID().slice(0, 8)}-${index + 1}`,
        }).map((caption, index) => ({
            ...caption,
            ...(cues[index].entranceEffect ? { entranceEffect: cues[index].entranceEffect } : {}),
            ...(cues[index].exitEffect ? { exitEffect: cues[index].exitEffect } : {}),
        }))

        for (const caption of created) {
            validateEffect(caption.entranceEffect, `Caption ${caption.id} entrance effect`)
            validateEffect(caption.exitEffect, `Caption ${caption.id} exit effect`)
        }
        setRowEntities(document, "subtitles", [...entities, ...created])
        validateRowEntities(document, "subtitles")
        return {
            added: created.map(caption => timelineEntitySummary("subtitles", caption, true)),
        }
    }, { dryRun: args.dryRun === true })
    return compactEditResult(result)
}

export async function updateFlowtakeCaption(store, args) {
    const result = await store.editProject(args.projectRef, args.expectedRevision, document => {
        const { duration, entities } = assertProjectCanEdit(document, "subtitles")
        const caption = getEntityOrThrow(entities, args.itemId, "subtitles")
        const next = {
            ...caption,
            ...(args.text !== undefined ? { text: String(args.text).trim() } : {}),
            ...(args.startMs !== undefined ? { start: args.startMs } : {}),
            ...(args.endMs !== undefined ? { end: args.endMs } : {}),
            ...(args.entranceEffect !== undefined ? { entranceEffect: args.entranceEffect } : {}),
            ...(args.exitEffect !== undefined ? { exitEffect: args.exitEffect } : {}),
        }
        if (next.end > duration + 50) {
            throw new FlowtakeEditError("outside-timeline", "Caption ends outside the project timeline")
        }
        const updated = entities.map(entity => entity.id === args.itemId ? next : entity)
        setRowEntities(document, "subtitles", updated)
        validateRowEntities(document, "subtitles")
        return {
            previous: timelineEntitySummary("subtitles", caption, true),
            updated: timelineEntitySummary("subtitles", next, true),
        }
    }, { dryRun: args.dryRun === true })
    return compactEditResult(result)
}

export function toMcpError(error) {
    if (error instanceof FlowtakeEditError || error instanceof ProjectStoreError) {
        return {
            error: error.code,
            message: error.message,
            ...error.details,
        }
    }
    return {
        error: "internal-error",
        message: "The local operation failed. Check the MCP server log for details.",
    }
}
