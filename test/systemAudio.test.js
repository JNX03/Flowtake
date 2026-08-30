import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
    getSystemAudioSources,
    isLikelySystemAudioSource,
} from "../app/shared/systemAudio.js"

const settingsSource = await readFile(
    new URL("../app/windows/main/components/settings/SystemAudio.jsx", import.meta.url),
    "utf8"
)

test("system audio accepts loopback devices and rejects normal microphones", () => {
    assert.equal(isLikelySystemAudioSource("Stereo Mix (Realtek Audio)"), true)
    assert.equal(isLikelySystemAudioSource("BlackHole 2ch"), true)
    assert.equal(isLikelySystemAudioSource("Monitor of Built-in Audio"), true)
    assert.equal(isLikelySystemAudioSource("CABLE Output (VB-Audio Virtual Cable)"), true)
    assert.equal(isLikelySystemAudioSource("VoiceMeeter Output (VB-Audio VoiceMeeter VAIO)"), true)
    assert.equal(isLikelySystemAudioSource("Microphone Array (Intel Smart Sound)"), false)
    assert.equal(isLikelySystemAudioSource("USB Webcam Microphone"), false)
})

test("system audio source list is filtered and deduplicated", () => {
    const devices = [
        { kind: "audioinput", label: "Microphone Array" },
        { kind: "audioinput", label: "Stereo Mix" },
        { kind: "audioinput", label: "Stereo Mix" },
        { kind: "audioinput", label: "" },
        { kind: "videoinput", label: "Loopback Camera" },
    ]

    assert.deepEqual(getSystemAudioSources(devices), ["Stereo Mix"])
})

test("system audio permission probe only runs from explicit refresh", () => {
    assert.doesNotMatch(settingsSource, /useEffect/)
    assert.match(settingsSource, /const refreshDevices = useCallback\(async \(\) =>/)
    assert.match(settingsSource, /getUserMedia\(\{ audio: true, video: false \}\)/)
    assert.match(settingsSource, /permissionStream\?\.getTracks\(\)\.forEach\(track => track\.stop\(\)\)/)
    assert.match(settingsSource, /onClick=\{refreshDevices\}/)
})
