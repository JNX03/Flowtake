export const PERFORMANCE_MODE_AUTO = "auto"
export const PERFORMANCE_MODE_EFFICIENCY = "efficiency"
export const PERFORMANCE_MODE_BALANCED = "balanced"
export const PERFORMANCE_MODE_QUALITY = "quality"

export const PERFORMANCE_MODES = Object.freeze([
    PERFORMANCE_MODE_AUTO,
    PERFORMANCE_MODE_EFFICIENCY,
    PERFORMANCE_MODE_BALANCED,
    PERFORMANCE_MODE_QUALITY,
])

const PROFILES = Object.freeze({
    [PERFORMANCE_MODE_EFFICIENCY]: Object.freeze({
        id: PERFORMANCE_MODE_EFFICIENCY,
        label: "Efficiency",
        description: "Lower-memory previews for compact and constrained devices",
        previewMaxWidth: 854,
        previewMaxHeight: 480,
        rendererMaxWidth: 960,
        rendererMaxHeight: 540,
        previewFps: 24,
        sourcePreviewIntervalMs: 10_000,
        cameraWidth: 640,
        cameraHeight: 360,
        cameraFps: 24,
    }),
    [PERFORMANCE_MODE_BALANCED]: Object.freeze({
        id: PERFORMANCE_MODE_BALANCED,
        label: "Balanced",
        description: "Smooth 720p previews with moderate memory use",
        previewMaxWidth: 1280,
        previewMaxHeight: 720,
        rendererMaxWidth: 1280,
        rendererMaxHeight: 720,
        previewFps: 30,
        sourcePreviewIntervalMs: 5_000,
        cameraWidth: 1280,
        cameraHeight: 720,
        cameraFps: 30,
    }),
    [PERFORMANCE_MODE_QUALITY]: Object.freeze({
        id: PERFORMANCE_MODE_QUALITY,
        label: "Quality",
        description: "Sharper previews for devices with ample CPU and memory",
        previewMaxWidth: 1920,
        previewMaxHeight: 1080,
        rendererMaxWidth: 1920,
        rendererMaxHeight: 1080,
        previewFps: 60,
        sourcePreviewIntervalMs: 5_000,
        cameraWidth: 1920,
        cameraHeight: 1080,
        cameraFps: 30,
    }),
})

const finitePositive = value => {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? number : null
}

const viewportPerformanceBand = value => {
    const width = finitePositive(value)
    return width !== null && width < 700 ? "compact" : "standard"
}

export function arePerformanceSignalsEquivalent(left = {}, right = {}) {
    return finitePositive(left.logicalCores) === finitePositive(right.logicalCores)
        && finitePositive(left.ramGb) === finitePositive(right.ramGb)
        && Boolean(left.saveData) === Boolean(right.saveData)
        && Boolean(left.reducedMotion) === Boolean(right.reducedMotion)
        && viewportPerformanceBand(left.viewportWidth) === viewportPerformanceBand(right.viewportWidth)
}

export function normalizePerformanceMode(value) {
    const mode = typeof value === "string" ? value.toLowerCase() : ""
    return PERFORMANCE_MODES.includes(mode) ? mode : PERFORMANCE_MODE_AUTO
}

export function readPerformanceSignals(systemInfo = {}, runtime = globalThis) {
    const navigatorValue = runtime?.navigator || {}
    const windowValue = runtime?.window || runtime
    const connection = navigatorValue.connection
        || navigatorValue.mozConnection
        || navigatorValue.webkitConnection

    let reducedMotion = false
    try {
        reducedMotion = Boolean(windowValue?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)
    } catch {
        // Some webviews expose matchMedia before its backing window is ready.
    }

    return {
        logicalCores: finitePositive(navigatorValue.hardwareConcurrency),
        ramGb: finitePositive(systemInfo?.ram_gb) || finitePositive(navigatorValue.deviceMemory),
        saveData: Boolean(connection?.saveData),
        reducedMotion,
        viewportWidth: finitePositive(windowValue?.innerWidth),
    }
}

export function selectAutomaticPerformanceMode(signals = {}) {
    const logicalCores = finitePositive(signals.logicalCores)
    const ramGb = finitePositive(signals.ramGb)
    const viewportWidth = finitePositive(signals.viewportWidth)

    if (
        signals.saveData
        || signals.reducedMotion
        || (logicalCores !== null && logicalCores <= 4)
        || (ramGb !== null && ramGb < 6)
        || (viewportWidth !== null && viewportWidth < 700)
    ) return PERFORMANCE_MODE_EFFICIENCY

    if (
        logicalCores !== null
        && logicalCores >= 12
        && ramGb !== null
        && ramGb >= 16
    ) return PERFORMANCE_MODE_QUALITY

    return PERFORMANCE_MODE_BALANCED
}

export function selectAutomaticCaptureMode(signals = {}) {
    const logicalCores = finitePositive(signals.logicalCores)
    const ramGb = finitePositive(signals.ramGb)

    if (
        (logicalCores !== null && logicalCores <= 4)
        || (ramGb !== null && ramGb < 6)
    ) return PERFORMANCE_MODE_EFFICIENCY

    if (
        logicalCores !== null
        && logicalCores >= 12
        && ramGb !== null
        && ramGb >= 16
    ) return PERFORMANCE_MODE_QUALITY

    return PERFORMANCE_MODE_BALANCED
}

export function resolvePerformanceProfile(mode, signals = {}) {
    const normalizedMode = normalizePerformanceMode(mode)
    const resolvedMode = normalizedMode === PERFORMANCE_MODE_AUTO
        ? selectAutomaticPerformanceMode(signals)
        : normalizedMode

    return PROFILES[resolvedMode]
}

export function resolveCapturePerformanceProfile(mode, signals = {}) {
    const normalizedMode = normalizePerformanceMode(mode)
    const resolvedMode = normalizedMode === PERFORMANCE_MODE_AUTO
        ? selectAutomaticCaptureMode(signals)
        : normalizedMode

    return PROFILES[resolvedMode]
}

export function getAdaptiveCameraConstraints(profile, baseConstraints = {}) {
    const resolved = profile || PROFILES[PERFORMANCE_MODE_BALANCED]
    return {
        ...baseConstraints,
        width: { ideal: resolved.cameraWidth },
        height: { ideal: resolved.cameraHeight },
        frameRate: { ideal: resolved.cameraFps },
    }
}

export function getAdaptiveRendererBounds(profile, aspectRatio = "16x9") {
    const resolved = profile || PROFILES[PERFORMANCE_MODE_BALANCED]
    const maxWidth = resolved.rendererMaxWidth
    const maxHeight = resolved.rendererMaxHeight

    if (aspectRatio === "9x16") {
        return {
            width: Math.min(maxWidth, Math.floor(maxHeight * 9 / 16)),
            height: Math.min(maxHeight, Math.floor(maxWidth * 16 / 9)),
        }
    }
    if (aspectRatio === "1x1") {
        const edge = Math.min(maxWidth, maxHeight)
        return { width: edge, height: edge }
    }
    return {
        width: Math.min(maxWidth, Math.floor(maxHeight * 16 / 9)),
        height: Math.min(maxHeight, Math.floor(maxWidth * 9 / 16)),
    }
}
