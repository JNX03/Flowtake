import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const readRepoFile = file => readFile(new URL(`../${file}`, import.meta.url), "utf8")

test("live camera preview and capture receive the adaptive profile", async () => {
    const [live, button] = await Promise.all([
        readRepoFile("app/windows/main/components/live/Live.jsx"),
        readRepoFile("app/windows/main/components/live/GoLiveButton.jsx"),
    ])

    assert.match(live, /useAdaptivePerformanceProfile\(\)/)
    assert.match(live, /<CameraPreview[\s\S]*performanceProfile=\{performanceProfile\}/)
    assert.match(live, /<GoLiveButton[\s\S]*cameraCaptureProfile=\{captureProfile\}/)
    assert.match(button, /getAdaptiveCameraConstraints\(cameraCaptureProfile/)
})
