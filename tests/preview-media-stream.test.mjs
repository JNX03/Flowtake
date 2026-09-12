import assert from "node:assert/strict"
import { test } from "node:test"

import {
    acquirePreviewMediaStream,
    stopPreviewMediaStream,
} from "../app/shared/previewMediaStream.js"

function createFakeStream({ videoLabel = "Camera", audioLabel = "Microphone" } = {}) {
    const tracks = [
        { kind: "video", label: videoLabel, stopCalls: 0, stop() { this.stopCalls += 1 } },
        { kind: "audio", label: audioLabel, stopCalls: 0, stop() { this.stopCalls += 1 } },
    ]

    return {
        tracks,
        getTracks: () => tracks,
        getVideoTracks: () => tracks.filter(track => track.kind === "video"),
        getAudioTracks: () => tracks.filter(track => track.kind === "audio"),
    }
}

function assertEveryTrackStoppedOnce(stream) {
    assert.deepEqual(stream.tracks.map(track => track.stopCalls), [1, 1])
}

test("a stream rejected for a track-label mismatch stops every acquired track", async () => {
    const stream = createFakeStream()

    await assert.rejects(
        acquirePreviewMediaStream({
            mediaDevices: { getUserMedia: async () => stream },
            constraints: { video: true, audio: true },
            expectedVideoTrackLabel: "Different camera",
            expectedAudioTrackLabel: "Microphone",
            signal: new AbortController().signal,
        }),
        { name: "MediaTrackError" }
    )

    assertEveryTrackStoppedOnce(stream)
})

test("a late stream from a cancelled query stops every track before it is returned", async () => {
    const stream = createFakeStream()
    const controller = new AbortController()
    let resolveStream
    const pendingStream = new Promise(resolve => { resolveStream = resolve })
    const acquisition = acquirePreviewMediaStream({
        mediaDevices: { getUserMedia: () => pendingStream },
        constraints: { video: true, audio: true },
        expectedVideoTrackLabel: "Camera",
        expectedAudioTrackLabel: "Microphone",
        signal: controller.signal,
    })

    controller.abort()
    resolveStream(stream)

    assert.equal(await acquisition, null)
    assertEveryTrackStoppedOnce(stream)
})

test("query replacement or unmount stops an accepted stream exactly once", async () => {
    const stream = createFakeStream()
    const controller = new AbortController()
    const acquired = await acquirePreviewMediaStream({
        mediaDevices: { getUserMedia: async () => stream },
        constraints: { video: true, audio: true },
        expectedVideoTrackLabel: "Camera",
        expectedAudioTrackLabel: "Microphone",
        signal: controller.signal,
    })

    assert.equal(acquired, stream)
    controller.abort()
    stopPreviewMediaStream(stream)

    assertEveryTrackStoppedOnce(stream)
})
