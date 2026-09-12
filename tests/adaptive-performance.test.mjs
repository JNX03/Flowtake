import assert from "node:assert/strict"
import { test } from "node:test"
import {
    arePerformanceSignalsEquivalent,
    getAdaptiveCameraConstraints,
    getAdaptiveRendererBounds,
    normalizePerformanceMode,
    readPerformanceSignals,
    resolveCapturePerformanceProfile,
    resolvePerformanceProfile,
    selectAutomaticCaptureMode,
    selectAutomaticPerformanceMode,
} from "../app/shared/adaptivePerformance.js"

test("runtime signal comparison reacts only when the selected profile can change", () => {
    const base = {
        logicalCores: 16,
        ramGb: 32,
        saveData: false,
        reducedMotion: false,
        viewportWidth: 1440,
    }

    assert.equal(arePerformanceSignalsEquivalent(base, { ...base, viewportWidth: 900 }), true)
    assert.equal(arePerformanceSignalsEquivalent(base, { ...base, viewportWidth: 699 }), false)
    assert.equal(arePerformanceSignalsEquivalent(base, { ...base, reducedMotion: true }), false)
})

test("automatic performance mode protects constrained and compact devices", () => {
    assert.equal(selectAutomaticPerformanceMode({ logicalCores: 4, ramGb: 8 }), "efficiency")
    assert.equal(selectAutomaticPerformanceMode({ logicalCores: 8, ramGb: 4 }), "efficiency")
    assert.equal(selectAutomaticPerformanceMode({ logicalCores: 8, ramGb: 16, viewportWidth: 600 }), "efficiency")
    assert.equal(selectAutomaticPerformanceMode({ logicalCores: 16, ramGb: 32, saveData: true }), "efficiency")
})

test("automatic performance mode uses quality only with clear headroom", () => {
    assert.equal(selectAutomaticPerformanceMode({ logicalCores: 8, ramGb: 16 }), "balanced")
    assert.equal(selectAutomaticPerformanceMode({ logicalCores: 12, ramGb: 16 }), "quality")
    assert.equal(selectAutomaticPerformanceMode({}), "balanced")
})

test("automatic capture quality ignores temporary UI and accessibility signals", () => {
    const highEndCompact = {
        logicalCores: 16,
        ramGb: 32,
        viewportWidth: 600,
        reducedMotion: true,
        saveData: true,
    }

    assert.equal(selectAutomaticPerformanceMode(highEndCompact), "efficiency")
    assert.equal(selectAutomaticCaptureMode(highEndCompact), "quality")
    assert.equal(resolveCapturePerformanceProfile("auto", highEndCompact).cameraWidth, 1920)
    assert.equal(resolveCapturePerformanceProfile("efficiency", highEndCompact).cameraWidth, 640)
})

test("explicit performance modes override device detection", () => {
    assert.equal(resolvePerformanceProfile("efficiency", { logicalCores: 32 }).id, "efficiency")
    assert.equal(resolvePerformanceProfile("quality", { logicalCores: 2, ramGb: 2 }).id, "quality")
    assert.equal(normalizePerformanceMode("unknown"), "auto")
})

test("camera constraints adapt without weakening unrelated constraints", () => {
    const profile = resolvePerformanceProfile("efficiency")
    assert.deepEqual(getAdaptiveCameraConstraints(profile, {
        facingMode: { ideal: "user" },
        deviceId: { exact: "camera-1" },
    }), {
        facingMode: { ideal: "user" },
        deviceId: { exact: "camera-1" },
        width: { ideal: 640 },
        height: { ideal: 360 },
        frameRate: { ideal: 24 },
    })
})

test("runtime signals prefer native RAM and tolerate missing browser APIs", () => {
    assert.deepEqual(readPerformanceSignals({ ram_gb: 12 }, {
        navigator: { hardwareConcurrency: 8, deviceMemory: 4 },
        window: { innerWidth: 1280, matchMedia: () => ({ matches: false }) },
    }), {
        logicalCores: 8,
        ramGb: 12,
        saveData: false,
        reducedMotion: false,
        viewportWidth: 1280,
    })
})

test("renderer bounds preserve common aspect ratios at every tier", () => {
    const efficiency = resolvePerformanceProfile("efficiency")
    const quality = resolvePerformanceProfile("quality")

    assert.deepEqual(getAdaptiveRendererBounds(efficiency, "16x9"), { width: 960, height: 540 })
    assert.deepEqual(getAdaptiveRendererBounds(efficiency, "9x16"), { width: 303, height: 540 })
    assert.deepEqual(getAdaptiveRendererBounds(quality, "1x1"), { width: 1080, height: 1080 })
})
