import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
    buildCustomAudioExportClips,
    findActiveAudioClip,
    getAudioClipSplitTiming,
    getEffectiveAudioVolume,
    resolveAudioClipTimingChange,
    timelineTimeToAudioSourceMs,
} from "../app/shared/editor/audioTimeline.js"
import { planSplit } from "../app/shared/editor/commandPlanner.js"

test("timeline audio maps gaps and trimmed clips to source time", () => {
    const clip = {
        id: "music",
        trackIndex: 0,
        start: 5_000,
        end: 9_000,
        sourceStart: 1_000,
        sourceEnd: 5_000,
    }

    assert.equal(findActiveAudioClip([clip], 0, 4_999), null)
    assert.equal(findActiveAudioClip([clip], 0, 5_000), clip)
    assert.equal(findActiveAudioClip([clip], 0, 9_000), null)
    assert.equal(timelineTimeToAudioSourceMs(clip, 6_500), 2_500)
})

test("audio trim, move, and split preserve source in-points", () => {
    const clip = {
        id: "voice",
        trackIndex: 0,
        start: 2_000,
        end: 6_000,
        sourceStart: 0,
        sourceEnd: 4_000,
        sourceDuration: 8_000,
    }

    assert.deepEqual(resolveAudioClipTimingChange(clip, 3_000, 6_000), {
        start: 3_000,
        end: 6_000,
        sourceStart: 1_000,
        sourceEnd: 4_000,
    })
    assert.deepEqual(resolveAudioClipTimingChange(clip, 4_000, 8_000), {
        start: 4_000,
        end: 8_000,
        sourceStart: 0,
        sourceEnd: 4_000,
    })
    assert.deepEqual(getAudioClipSplitTiming(clip, 4_500), {
        left: {
            end: 4_500,
            sourceStart: 0,
            sourceEnd: 2_500,
        },
        right: {
            start: 4_500,
            sourceStart: 2_500,
            sourceEnd: 4_000,
        },
    })

    const split = planSplit({
        row: "audio-tracks",
        entities: [clip],
        selectedIds: [clip.id],
        tracks: [{ id: 0, locked: false }],
        splitTime: 4_500,
        createId: () => "voice-right",
        timelineEnd: 10_000,
        minSegmentDuration: 0,
    })
    assert.equal(split.ok, true)
    assert.deepEqual(split.operations[0].changes, {
        end: 4_500,
        sourceEnd: 2_500,
    })
    assert.equal(split.operations[1].entity.sourceStart, 2_500)
})

test("export keeps overlapping tracks independent and applies track mute and volume", () => {
    const clips = [
        {
            id: "music",
            trackIndex: 0,
            relativePath: "assets/music.wav",
            start: 1_000,
            end: 5_000,
            sourceStart: 500,
            sourceEnd: 4_500,
            volume: 0.8,
        },
        {
            id: "voice",
            trackIndex: 1,
            relativePath: "assets/voice.wav",
            start: 2_000,
            end: 4_000,
            sourceStart: 1_000,
            sourceEnd: 3_000,
            volume: 0.5,
        },
        {
            id: "muted",
            trackIndex: 2,
            relativePath: "assets/muted.wav",
            start: 0,
            end: 6_000,
            volume: 1,
        },
    ]
    const tracks = [
        { id: 0, muted: false, volume: 0.5 },
        { id: 1, muted: false, volume: 1.5 },
        { id: 2, muted: true, volume: 1 },
    ]

    const exported = buildCustomAudioExportClips({
        clips,
        tracks,
        timelineStart: 0,
        timelineEnd: 6_000,
    })

    assert.equal(exported.length, 2)
    assert.deepEqual(exported.map(({ relativePath, start, end, volume }) => ({
        relativePath,
        start,
        end,
        volume,
    })), [
        {
            relativePath: "assets/music.wav",
            start: 1_000,
            end: 5_000,
            volume: 0.4,
        },
        {
            relativePath: "assets/voice.wav",
            start: 2_000,
            end: 4_000,
            volume: 0.75,
        },
    ])
    assert.equal(getEffectiveAudioVolume(clips[2], tracks[2]), 0)
})

test("export clips are trimmed when the requested timeline starts inside them", () => {
    const [clip] = buildCustomAudioExportClips({
        clips: [{
            id: "bed",
            trackIndex: 0,
            relativePath: "assets/bed.wav",
            start: 0,
            end: 5_000,
            sourceStart: 2_000,
            sourceEnd: 7_000,
        }],
        tracks: [{ id: 0, muted: false, volume: 1 }],
        timelineStart: 1_500,
        timelineEnd: 4_000,
    })

    assert.equal(clip.start, 1_500)
    assert.equal(clip.end, 4_000)
    assert.equal(clip.sourceStart, 3_500)
    assert.equal(clip.sourceEnd, 6_000)
})

test("preview, native import, render worker, and FFmpeg bridge are wired", async () => {
    const [
        videoWrapper,
        player,
        audioTracks,
        renderWorker,
        exporter,
    ] = await Promise.all([
        readFile(new URL("../app/windows/main/components/VideoWrapper.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/windows/main/components/TimelineAudioPlayback.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/windows/main/components/timeline/AudioTracks.jsx", import.meta.url), "utf8"),
        readFile(new URL("../app/shared/workers/renderWorker.js", import.meta.url), "utf8"),
        readFile(new URL("../src-tauri/src/commands/exporter.rs", import.meta.url), "utf8"),
    ])

    assert.match(videoWrapper, /<TimelineAudioPlayback \/>/)
    assert.match(player, /one reusable HTMLAudioElement per timeline track/)
    assert.match(player, /timelineTimeToAudioSourceMs\(clip, time\)/)
    assert.match(player, /getEffectiveAudioVolume\(clip, track\)/)
    assert.match(audioTracks, /importProjectMedia\(sourcePath\)/)
    assert.match(audioTracks, /dispatch\(upsertMedia\(durableMetadata\)\)/)
    assert.match(renderWorker, /customClips/)
    assert.match(renderWorker, /buildCustomAudioExportClips/)
    assert.match(exporter, /resolve_render_audio_asset/)
    assert.match(exporter, /adelay=\{delay_ms:\.3\}:all=1/)
    assert.match(exporter, /amix=inputs=\{\}:duration=longest/)
})
