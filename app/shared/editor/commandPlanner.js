import { getClipSplitTiming } from "./playbackClock.js"
import { getAudioClipSplitTiming } from "./audioTimeline.js"

const COMMAND_ROWS = new Set([
    "clips",
    "subtitles",
    "audio-tracks",
    "overlay-tracks",
    "masks",
])

const TRACKED_ROWS = new Set(["audio-tracks", "overlay-tracks"])

export const EDITOR_COMMAND_ROWS = Object.freeze([...COMMAND_ROWS])
export const DEFAULT_MIN_SEGMENT_DURATION_MS = 1000
// Media metadata can differ from the frame-aligned timeline edge by a few
// milliseconds. Keep command validation strict while tolerating one small
// frame-boundary rounding discrepancy.
export const TIMELINE_BOUNDARY_EPSILON_MS = 50
export const RIPPLE_EDITING_MODE = "ripple"

const failure = (kind, row, reason, details = {}) => ({
    ok: false,
    kind,
    row,
    reason,
    ...details,
})

const success = (kind, row, operations, selection, details = {}) => ({
    ok: true,
    kind,
    row,
    operations,
    selection,
    ...details,
})

const isFiniteNumber = value => typeof value === "number" && Number.isFinite(value)

function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue)
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]))
    }
    return value
}

export function toEntityArray(source) {
    if (!source) return []
    if (Array.isArray(source)) return source.filter(Boolean)
    if (source.entities && typeof source.entities === "object") {
        return Object.values(source.entities).filter(Boolean)
    }
    if (typeof source === "object") return Object.values(source).filter(Boolean)
    return []
}

export function rangesOverlap(first, second) {
    return first.start < second.end && second.start < first.end
}

export function getEntityLane(row, entity) {
    if (TRACKED_ROWS.has(row)) return "track:" + String(entity.trackIndex)
    if (row === "masks") return "mask:" + String(entity.row ?? 0)
    return "row:" + row
}

export function findRangeCollision({ row, candidate, entities, excludeIds = [] }) {
    const excluded = new Set(excludeIds)
    const lane = getEntityLane(row, candidate)
    return toEntityArray(entities).find(entity => (
        !excluded.has(entity.id) &&
        getEntityLane(row, entity) === lane &&
        rangesOverlap(candidate, entity)
    )) ?? null
}

function validateRow(kind, row) {
    return COMMAND_ROWS.has(row) ? null : failure(kind, row, "unsupported-row")
}

function validateTimelineBounds(kind, row, entity, timelineStart, timelineEnd) {
    if (!isFiniteNumber(entity.start) || !isFiniteNumber(entity.end) || entity.end <= entity.start) {
        return failure(kind, row, "invalid-entity-range", { entityId: entity.id })
    }
    if (
        entity.start < timelineStart - TIMELINE_BOUNDARY_EPSILON_MS ||
        entity.end > timelineEnd + TIMELINE_BOUNDARY_EPSILON_MS
    ) {
        return failure(kind, row, "outside-timeline", { entityId: entity.id })
    }
    return null
}

function getTrackLockFailure(kind, row, entity, tracks) {
    if (!TRACKED_ROWS.has(row)) return null
    if (entity.trackIndex === undefined || entity.trackIndex === null) {
        return failure(kind, row, "missing-track", { entityId: entity.id })
    }
    const track = toEntityArray(tracks).find(candidate => candidate.id === entity.trackIndex)
    if (track?.locked) return failure(kind, row, "locked-track", { entityId: entity.id, trackId: track.id })
    return null
}

function resolveSelected({ kind, row, entities, selectedIds, tracks, timelineStart, timelineEnd }) {
    const rowFailure = validateRow(kind, row)
    if (rowFailure) return rowFailure

    const ids = [...new Set(selectedIds ?? [])]
    if (ids.length === 0) return failure(kind, row, "empty-selection")

    const all = toEntityArray(entities)
    const byId = new Map(all.map(entity => [entity.id, entity]))
    const selected = []

    for (const id of ids) {
        const entity = byId.get(id)
        if (!entity) return failure(kind, row, "missing-entity", { entityId: id })

        const boundsFailure = validateTimelineBounds(kind, row, entity, timelineStart, timelineEnd)
        if (boundsFailure) return boundsFailure

        const lockFailure = getTrackLockFailure(kind, row, entity, tracks)
        if (lockFailure) return lockFailure

        selected.push(entity)
    }

    return { ok: true, all, selected }
}

function createPlannedId({ kind, row, createId, source, index, usedIds }) {
    if (typeof createId !== "function") return failure(kind, row, "missing-id-factory")
    const id = createId({ row, sourceId: source.id, index })
    if (typeof id !== "string" || id.length === 0 || usedIds.has(id)) {
        return failure(kind, row, "invalid-generated-id", { sourceId: source.id, generatedId: id })
    }
    usedIds.add(id)
    return { ok: true, id }
}

function validatePlannedPlacement({ kind, row, planned, existing, excludeIds = [] }) {
    const accepted = []
    for (const entity of planned) {
        const collision = findRangeCollision({
            row,
            candidate: entity,
            entities: [...existing, ...accepted],
            excludeIds,
        })
        if (collision) {
            return failure(kind, row, "overlap", {
                entityId: entity.id,
                collisionId: collision.id,
                lane: getEntityLane(row, entity),
            })
        }
        accepted.push(entity)
    }
    return null
}

function isRippleEditing(editingMode) {
    return editingMode === RIPPLE_EDITING_MODE
}

function lanesFor(row, entities) {
    return new Set(entities.map(entity => getEntityLane(row, entity)))
}

function getAffectedEntities(row, entities, affectedLanes) {
    return toEntityArray(entities).filter(entity => affectedLanes.has(getEntityLane(row, entity)))
}

function validateRippleTrack(kind, row, entity, tracks) {
    if (!TRACKED_ROWS.has(row)) return null

    const track = toEntityArray(tracks).find(candidate => candidate.id === entity.trackIndex)
    if (!track) {
        return failure(kind, row, "missing-track", {
            entityId: entity.id,
            trackId: entity.trackIndex,
        })
    }
    if (track.locked) {
        return failure(kind, row, "locked-track", {
            entityId: entity.id,
            trackId: track.id,
        })
    }
    return null
}

function validateRippleLanes({
    kind,
    row,
    entities,
    affectedLanes,
    tracks,
    timelineStart,
    timelineEnd,
    overlapReason,
    checkTrackLocks = false,
}) {
    const byLane = new Map()

    for (const entity of getAffectedEntities(row, entities, affectedLanes)) {
        const boundsFailure = validateTimelineBounds(kind, row, entity, timelineStart, timelineEnd)
        if (boundsFailure) return boundsFailure

        if (checkTrackLocks) {
            const lockFailure = validateRippleTrack(kind, row, entity, tracks)
            if (lockFailure) return lockFailure
        }

        const lane = getEntityLane(row, entity)
        if (!byLane.has(lane)) byLane.set(lane, [])
        byLane.get(lane).push(entity)
    }

    for (const [lane, laneEntities] of byLane) {
        const ordered = laneEntities.toSorted((first, second) => (
            first.start - second.start || first.end - second.end || String(first.id).localeCompare(String(second.id))
        ))

        for (let index = 1; index < ordered.length; index += 1) {
            const previous = ordered[index - 1]
            const current = ordered[index]
            if (rangesOverlap(previous, current)) {
                return failure(kind, row, overlapReason, {
                    entityId: current.id,
                    collisionId: previous.id,
                    lane,
                })
            }
        }
    }

    return null
}

function projectOperations(entities, operations) {
    const projected = new Map(toEntityArray(entities).map(entity => [entity.id, cloneValue(entity)]))

    for (const operation of operations) {
        if (operation.op === "remove") {
            projected.delete(operation.id)
        } else if (operation.op === "update") {
            const current = projected.get(operation.id)
            if (current) projected.set(operation.id, { ...current, ...cloneValue(operation.changes) })
        } else if (operation.op === "add") {
            projected.set(operation.entity.id, cloneValue(operation.entity))
        }
    }

    return [...projected.values()]
}

function validateRippleResult(args, operations, affectedLanes) {
    return validateRippleLanes({
        ...args,
        entities: projectOperations(args.entities, operations),
        affectedLanes,
        overlapReason: "ripple-overlap",
        checkTrackLocks: true,
    })
}

function validateRippleInput(args, affectedLanes) {
    return validateRippleLanes({
        ...args,
        affectedLanes,
        overlapReason: "ripple-existing-overlap",
        checkTrackLocks: true,
    })
}

function shiftedRange(entity, amount) {
    return {
        start: entity.start + amount,
        end: entity.end + amount,
    }
}

function splitChanges(row, entity, splitTime, side) {
    if (row === "clips") {
        const timing = getClipSplitTiming(entity, splitTime)
        return side === "left"
            ? { end: splitTime, sourceEnd: timing.left.sourceEnd }
            : { start: splitTime, sourceStart: timing.right.sourceStart }
    }
    if (row === "audio-tracks") {
        const timing = getAudioClipSplitTiming(entity, splitTime)
        return side === "left"
            ? { end: splitTime, sourceEnd: timing.left.sourceEnd }
            : { start: splitTime, sourceStart: timing.right.sourceStart }
    }
    return side === "left" ? { end: splitTime } : { start: splitTime }
}

function planRippleRetain({
    kind,
    row,
    resolved,
    retainSide,
    splitTime,
    tracks,
    timelineStart,
    timelineEnd,
}) {
    const affectedLanes = lanesFor(row, resolved.selected)
    const validationArgs = {
        kind,
        row,
        entities: resolved.all,
        tracks,
        timelineStart,
        timelineEnd,
    }
    const inputFailure = validateRippleInput(validationArgs, affectedLanes)
    if (inputFailure) return inputFailure

    const selectedIds = new Set(resolved.selected.map(entity => entity.id))
    const operations = []
    const shiftsByLane = new Map()

    for (const entity of resolved.selected) {
        const lane = getEntityLane(row, entity)
        const removedDuration = retainSide === "left"
            ? entity.end - splitTime
            : splitTime - entity.start

        // Retaining the right side closes the removed leading range by moving
        // the shortened timeline item back to its original start. Source/media
        // in-point semantics remain the responsibility of the entity schema.
        const changes = retainSide === "left"
            ? splitChanges(row, entity, splitTime, "left")
            : {
                end: entity.end - removedDuration,
                ...(row === "clips"
                    ? { sourceStart: getClipSplitTiming(entity, splitTime).right.sourceStart }
                    : row === "audio-tracks"
                        ? { sourceStart: getAudioClipSplitTiming(entity, splitTime).right.sourceStart }
                    : {}),
            }

        operations.push({ op: "update", row, id: entity.id, changes })
        shiftsByLane.set(lane, {
            amount: -removedDuration,
            startsAt: entity.end,
        })
    }

    for (const entity of resolved.all) {
        if (selectedIds.has(entity.id)) continue

        const shift = shiftsByLane.get(getEntityLane(row, entity))
        if (shift && entity.start >= shift.startsAt) {
            operations.push({
                op: "update",
                row,
                id: entity.id,
                changes: shiftedRange(entity, shift.amount),
            })
        }
    }

    const resultFailure = validateRippleResult(validationArgs, operations, affectedLanes)
    if (resultFailure) return resultFailure

    return success(kind, row, operations, resolved.selected.map(entity => entity.id), {
        ripple: true,
    })
}

export function planSplit({
    row,
    entities,
    selectedIds,
    splitTime,
    createId,
    retainSide = "both",
    tracks = [],
    timelineStart = 0,
    timelineEnd = Infinity,
    minSegmentDuration = DEFAULT_MIN_SEGMENT_DURATION_MS,
    editingMode = "normal",
}) {
    const kind = retainSide === "both" ? "split" : "retain-" + retainSide
    if (!["both", "left", "right"].includes(retainSide)) {
        return failure("split", row, "invalid-retain-side")
    }
    if (!isFiniteNumber(splitTime)) return failure(kind, row, "invalid-split-time")
    if (!isFiniteNumber(minSegmentDuration) || minSegmentDuration < 0) {
        return failure(kind, row, "invalid-min-segment-duration")
    }

    const resolved = resolveSelected({
        kind,
        row,
        entities,
        selectedIds,
        tracks,
        timelineStart,
        timelineEnd,
    })
    if (!resolved.ok) return resolved

    for (const entity of resolved.selected) {
        if (splitTime - entity.start < minSegmentDuration || entity.end - splitTime < minSegmentDuration) {
            return failure(kind, row, "split-too-close-to-edge", { entityId: entity.id })
        }
        if (Array.isArray(entity.keyframes) && entity.keyframes.length > 0) {
            return failure(kind, row, "keyframed-split-requires-interpolation", { entityId: entity.id })
        }
    }

    if (retainSide !== "both") {
        if (isRippleEditing(editingMode)) {
            return planRippleRetain({
                kind,
                row,
                resolved,
                retainSide,
                splitTime,
                tracks,
                timelineStart,
                timelineEnd,
            })
        }

        const operations = resolved.selected.map(entity => ({
            op: "update",
            row,
            id: entity.id,
            changes: splitChanges(row, entity, splitTime, retainSide),
        }))
        return success(kind, row, operations, resolved.selected.map(entity => entity.id))
    }

    // A plain split replaces one range with two touching ranges of the same
    // total duration. It neither opens nor closes time, so ripple mode uses
    // this same duration-neutral plan and does not shift later entities.
    const usedIds = new Set(resolved.all.map(entity => entity.id))
    const operations = []
    const selection = []

    for (const [index, entity] of resolved.selected.entries()) {
        const generated = createPlannedId({ kind, row, createId, source: entity, index, usedIds })
        if (!generated.ok) return generated

        const right = cloneValue(entity)
        right.id = generated.id
        right.start = splitTime
        if (row === "clips") {
            const timing = getClipSplitTiming(entity, splitTime)
            right.sourceStart = timing.right.sourceStart
            right.sourceEnd = timing.right.sourceEnd
        } else if (row === "audio-tracks") {
            const timing = getAudioClipSplitTiming(entity, splitTime)
            right.sourceStart = timing.right.sourceStart
            right.sourceEnd = timing.right.sourceEnd
        }

        operations.push({
            op: "update",
            row,
            id: entity.id,
            changes: row === "clips"
                ? {
                    end: splitTime,
                    sourceEnd: getClipSplitTiming(entity, splitTime).left.sourceEnd,
                }
                : row === "audio-tracks"
                    ? {
                        end: splitTime,
                        sourceEnd: getAudioClipSplitTiming(entity, splitTime).left.sourceEnd,
                    }
                : { end: splitTime },
        })
        operations.push({ op: "add", row, entity: right })
        selection.push(right.id)
    }

    return success(kind, row, operations, selection)
}

export const planRetainLeft = args => planSplit({ ...args, retainSide: "left" })
export const planRetainRight = args => planSplit({ ...args, retainSide: "right" })

export function planDelete({
    row,
    entities,
    selectedIds,
    tracks = [],
    timelineStart = 0,
    timelineEnd = Infinity,
    editingMode = "normal",
}) {
    const kind = "delete"
    const resolved = resolveSelected({
        kind,
        row,
        entities,
        selectedIds,
        tracks,
        timelineStart,
        timelineEnd,
    })
    if (!resolved.ok) return resolved

    if (isRippleEditing(editingMode)) {
        const affectedLanes = lanesFor(row, resolved.selected)
        const validationArgs = {
            kind,
            row,
            entities: resolved.all,
            tracks,
            timelineStart,
            timelineEnd,
        }
        const inputFailure = validateRippleInput(validationArgs, affectedLanes)
        if (inputFailure) return inputFailure

        const selectedIdsSet = new Set(resolved.selected.map(entity => entity.id))
        const removedByLane = new Map()

        for (const selected of resolved.selected) {
            const lane = getEntityLane(row, selected)
            if (!removedByLane.has(lane)) removedByLane.set(lane, [])
            removedByLane.get(lane).push(selected)
        }

        const operations = resolved.selected.map(entity => ({ op: "remove", row, id: entity.id }))
        for (const entity of resolved.all) {
            if (selectedIdsSet.has(entity.id)) continue

            const removed = removedByLane.get(getEntityLane(row, entity)) ?? []
            const shift = removed.reduce((total, selected) => (
                selected.end <= entity.start
                    ? total - (selected.end - selected.start)
                    : total
            ), 0)

            if (shift !== 0) {
                operations.push({
                    op: "update",
                    row,
                    id: entity.id,
                    changes: shiftedRange(entity, shift),
                })
            }
        }

        const resultFailure = validateRippleResult(validationArgs, operations, affectedLanes)
        if (resultFailure) return resultFailure

        return success(kind, row, operations, [], { ripple: true })
    }

    return success(
        kind,
        row,
        resolved.selected.map(entity => ({ op: "remove", row, id: entity.id })),
        [],
    )
}

export function createClipboardPayload({
    row,
    entities,
    selectedIds,
    tracks = [],
    timelineStart = 0,
    timelineEnd = Infinity,
}) {
    const kind = "copy"
    const resolved = resolveSelected({
        kind,
        row,
        entities,
        selectedIds,
        tracks,
        timelineStart,
        timelineEnd,
    })
    if (!resolved.ok) return resolved

    const anchorStart = Math.min(...resolved.selected.map(entity => entity.start))
    const elements = resolved.selected.map(entity => ({
        sourceId: entity.id,
        offset: entity.start - anchorStart,
        entity: cloneValue(entity),
    }))

    return {
        ok: true,
        kind,
        row,
        clipboard: {
            version: 1,
            row,
            anchorStart,
            elements,
        },
    }
}

export function planPaste({
    clipboard,
    entities,
    at,
    createId,
    tracks = [],
    timelineStart = 0,
    timelineEnd = Infinity,
    editingMode = "normal",
}) {
    const kind = "paste"
    const row = clipboard?.row
    const rowFailure = validateRow(kind, row)
    if (rowFailure) return rowFailure
    if (clipboard?.version !== 1 || !Array.isArray(clipboard.elements) || clipboard.elements.length === 0) {
        return failure(kind, row, "invalid-clipboard")
    }
    if (!isFiniteNumber(at)) return failure(kind, row, "invalid-placement-time")
    if (isRippleEditing(editingMode) && (at < timelineStart || at > timelineEnd)) {
        return failure(kind, row, "outside-timeline")
    }

    const existing = toEntityArray(entities)
    const usedIds = new Set(existing.map(entity => entity.id))
    const planned = []

    for (const [index, item] of clipboard.elements.entries()) {
        if (!item?.entity || !isFiniteNumber(item.offset)) return failure(kind, row, "invalid-clipboard")
        if (isRippleEditing(editingMode) && item.offset < 0) {
            return failure(kind, row, "ripple-negative-offset", { sourceId: item.sourceId })
        }

        const source = item.entity
        const duration = source.end - source.start
        if (!isFiniteNumber(duration) || duration <= 0) {
            return failure(kind, row, "invalid-entity-range", { entityId: source.id })
        }

        const generated = createPlannedId({ kind, row, createId, source, index, usedIds })
        if (!generated.ok) return generated

        const entity = cloneValue(source)
        entity.id = generated.id
        entity.start = at + item.offset
        entity.end = entity.start + duration

        const boundsFailure = validateTimelineBounds(kind, row, entity, timelineStart, timelineEnd)
        if (boundsFailure) return boundsFailure

        const lockFailure = getTrackLockFailure(kind, row, entity, tracks)
        if (lockFailure) return lockFailure

        planned.push(entity)
    }

    if (isRippleEditing(editingMode)) {
        const plannedFailure = validatePlannedPlacement({ kind, row, planned, existing: [] })
        if (plannedFailure) return plannedFailure

        const affectedLanes = lanesFor(row, planned)
        const validationArgs = {
            kind,
            row,
            entities: existing,
            tracks,
            timelineStart,
            timelineEnd,
        }
        const inputFailure = validateRippleInput(validationArgs, affectedLanes)
        if (inputFailure) return inputFailure

        for (const entity of planned) {
            const trackFailure = validateRippleTrack(kind, row, entity, tracks)
            if (trackFailure) return trackFailure
        }

        const insertionSpanByLane = new Map()
        for (const entity of planned) {
            const lane = getEntityLane(row, entity)
            insertionSpanByLane.set(
                lane,
                Math.max(insertionSpanByLane.get(lane) ?? 0, entity.end - at),
            )
        }

        const operations = []
        for (const entity of existing) {
            const lane = getEntityLane(row, entity)
            const insertionSpan = insertionSpanByLane.get(lane)
            if (insertionSpan === undefined) continue

            if (entity.start < at && entity.end > at) {
                return failure(kind, row, "ripple-insertion-intersects-entity", {
                    entityId: entity.id,
                    lane,
                    at,
                })
            }

            if (entity.start >= at) {
                operations.push({
                    op: "update",
                    row,
                    id: entity.id,
                    changes: shiftedRange(entity, insertionSpan),
                })
            }
        }
        operations.push(...planned.map(entity => ({ op: "add", row, entity })))

        const resultFailure = validateRippleResult(
            { ...validationArgs, entities: existing },
            operations,
            affectedLanes,
        )
        if (resultFailure) return resultFailure

        return success(
            kind,
            row,
            operations,
            planned.map(entity => entity.id),
            { ripple: true },
        )
    }

    const placementFailure = validatePlannedPlacement({ kind, row, planned, existing })
    if (placementFailure) return placementFailure

    return success(
        kind,
        row,
        planned.map(entity => ({ op: "add", row, entity })),
        planned.map(entity => entity.id),
    )
}

export function planDuplicate({
    row,
    entities,
    selectedIds,
    createId,
    tracks = [],
    timelineStart = 0,
    timelineEnd = Infinity,
    editingMode = "normal",
}) {
    const copied = createClipboardPayload({
        row,
        entities,
        selectedIds,
        tracks,
        timelineStart,
        timelineEnd,
        editingMode,
    })
    if (!copied.ok) return { ...copied, kind: "duplicate" }

    const selected = copied.clipboard.elements.map(item => item.entity)
    const placementTime = Math.max(...selected.map(entity => entity.end))
    const pasted = planPaste({
        clipboard: copied.clipboard,
        entities,
        at: placementTime,
        createId,
        tracks,
        timelineStart,
        timelineEnd,
        editingMode,
    })

    return { ...pasted, kind: "duplicate" }
}
