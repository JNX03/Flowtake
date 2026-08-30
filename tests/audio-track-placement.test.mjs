import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import {
    isAudioTrackAvailable,
    resolveAudioTrackPlacement,
} from "../app/windows/main/components/timeline/audioTrackPlacement.js"

const tracks = [
    { id: 0, locked: false },
    { id: 1, locked: false },
    { id: 2, locked: true },
]

const clips = [
    { id: "first", trackIndex: 0, start: 1000, end: 3000 },
    { id: "second", trackIndex: 1, start: 5000, end: 7000 },
]

test("audio placement keeps the preferred unlocked track when its interval is free", () => {
    assert.equal(isAudioTrackAvailable(tracks[0], clips, 3000, 5000), true)
    assert.deepEqual(resolveAudioTrackPlacement({
        tracks,
        audioClips: clips,
        start: 3000,
        end: 5000,
        nextTrackId: 3,
        preferredTrackId: 0,
    }), { trackId: 0, needsNewTrack: false })
})

test("audio placement falls back to another free unlocked track instead of overlapping", () => {
    assert.deepEqual(resolveAudioTrackPlacement({
        tracks,
        audioClips: clips,
        start: 2000,
        end: 4000,
        nextTrackId: 3,
        preferredTrackId: 0,
    }), { trackId: 1, needsNewTrack: false })

    assert.deepEqual(resolveAudioTrackPlacement({
        tracks,
        audioClips: clips,
        start: 3000,
        end: 5000,
        nextTrackId: 3,
        preferredTrackId: 2,
    }), { trackId: 0, needsNewTrack: false })
})

test("audio placement creates a track when every unlocked interval is occupied", () => {
    assert.deepEqual(resolveAudioTrackPlacement({
        tracks,
        audioClips: clips,
        start: 2000,
        end: 6000,
        nextTrackId: 3,
        preferredTrackId: 0,
    }), { trackId: 3, needsNewTrack: true })
})

test("timeline and row insertion paths share placement logic instead of reimplementing it", async () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
    const timeline = await readFile(path.join(repoRoot, "app/windows/main/components/timeline/Timeline.jsx"), "utf8")
    const audioTracks = await readFile(path.join(repoRoot, "app/windows/main/components/timeline/AudioTracks.jsx"), "utf8")

    // Both drop paths plan through the shared lane-insert module so neither
    // reimplements gap-finding. The timeline additionally scans every lane for
    // the gap closest to the drop point; the row path resolves a target lane
    // first, falling back to a free or new track.
    assert.match(timeline, /planTimelineLaneInsert/)
    assert.match(audioTracks, /planTimelineLaneInsert/)
    assert.match(audioTracks, /resolveAudioTrackPlacement/)

    for (const source of [timeline, audioTracks]) {
        assert.doesNotMatch(source, /clip\.start < end && clip\.end > start/)
    }
})
