import assert from "node:assert/strict"
import test from "node:test"

import { getRecorderOptions } from "../app/windows/main/DeviceRecorder.js"

const track = settings => ({ getSettings: () => settings })

test("device recorder negotiates a supported WebM codec", () => {
    globalThis.MediaRecorder = {
        isTypeSupported: mimeType => mimeType.includes("vp8")
    }

    const options = getRecorderOptions({
        getVideoTracks: () => [track({ width: 1920, height: 1080, frameRate: 30 })],
        getAudioTracks: () => [{}],
    })

    assert.equal(options.mimeType, "video/webm;codecs=vp8,opus")
    assert.equal(options.audioBitsPerSecond, 96_000)
    assert.ok(options.videoBitsPerSecond > 1_500_000)
    assert.ok(options.videoBitsPerSecond <= 12_000_000)
})

test("device recorder keeps low-resolution streams inside a safe bitrate floor", () => {
    globalThis.MediaRecorder = { isTypeSupported: () => false }

    const options = getRecorderOptions({
        getVideoTracks: () => [track({ width: 640, height: 360, frameRate: 15 })],
        getAudioTracks: () => [],
    })

    assert.equal(options.mimeType, undefined)
    assert.equal(options.videoBitsPerSecond, 1_500_000)
    assert.equal(options.audioBitsPerSecond, undefined)
})

test("device recorder chooses an audio-only container when no camera is active", () => {
    globalThis.MediaRecorder = {
        isTypeSupported: mimeType => mimeType === "audio/webm;codecs=opus"
    }

    const options = getRecorderOptions({
        getVideoTracks: () => [],
        getAudioTracks: () => [{}],
    })

    assert.deepEqual(options, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 96_000,
    })
})
