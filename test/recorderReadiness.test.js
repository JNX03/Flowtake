import assert from "node:assert/strict"
import test from "node:test"
import { buildRecorderReadinessReport, getPermissionStatus, getRecorderReadiness, isCapturePreviewLoading } from "../app/shared/recorderReadiness.js"

const healthy = {
    permissions: [{ permission: "screenCapture", hasPermission: true }],
    dependencies: [{ command: "ffmpeg", installed: true, required: true }],
    hasEngines: true,
}

test("recorder requires screen access, system FFmpeg, and capture engines", () => {
    assert.equal(getRecorderReadiness(healthy).ready, true)
    for (const state of [
        { ...healthy, permissions: [{ permission: "screenCapture", hasPermission: false }] },
        { ...healthy, dependencies: [{ command: "ffmpeg", installed: false, required: true }] },
        { ...healthy, hasEngines: false },
    ]) {
        assert.equal(getRecorderReadiness(state).ready, false)
        assert.equal(getRecorderReadiness(state).label, "Setup needed")
    }
})

test("empty or incomplete probes cannot mark the recorder ready", () => {
    for (const state of [
        {}, { permissions: [], dependencies: [] },
        { ...healthy, permissions: [{ permission: "camera", hasPermission: true }] },
        { ...healthy, dependencies: [{ command: "brew", installed: true, required: false }] },
        { ...healthy, permissions: null }, { ...healthy, dependencies: {} },
        { ...healthy, permissions: [{ permission: "screenCapture", hasPermission: "true" }] },
    ]) assert.equal(getRecorderReadiness(state).ready, false)
})

test("optional devices and optional tools do not block core recording", () => {
    const state = {
        ...healthy,
        permissions: [...healthy.permissions, { permission: "camera", hasPermission: false }, { permission: "microphone", hasPermission: false }],
        dependencies: [...healthy.dependencies, { command: "brew", installed: false, required: false }],
    }
    assert.equal(getRecorderReadiness(state).ready, true)
    for (const permission of ["camera", "microphone"])
        assert.equal(getPermissionStatus({ permission, hasPermission: true }), "Checked when enabled")
})

test("loading and failed probes override cached healthy results", () => {
    assert.equal(getRecorderReadiness({ ...healthy, isLoading: true }).label, "Checking")
    assert.equal(getRecorderReadiness({ ...healthy, isError: true }).label, "Check failed")
    assert.equal(getRecorderReadiness({ ...healthy, isError: true, isLoading: true }).ready, false)
})

test("report copies useful statuses while omitting arbitrary native data", () => {
    const secret = "/Users/private-project/token-device-id"
    const report = buildRecorderReadinessReport({
        ...healthy, platform: "darwin", version: "1.7.2",
        permissions: [
            { ...healthy.permissions[0], label: secret, settingsUrl: secret },
            { permission: "camera", hasPermission: true, label: secret },
            { permission: secret, hasPermission: false },
        ],
        dependencies: [
            { ...healthy.dependencies[0], name: secret, description: secret, path: secret },
            { command: secret, installed: false, required: false },
        ],
        error: secret, installCommand: secret, projectName: secret,
    })
    assert.match(report, /Platform: darwin/)
    assert.match(report, /Screen capture: Available/)
    assert.match(report, /FFmpeg: found \(required\)/)
    assert.match(report, /Camera: Checked when enabled/)
    assert.match(report, /Other tool: missing \(optional\)/)
    assert.equal(report.includes(secret), false)
})

test("reports validate version and platform and do not claim stale probes are current", () => {
    for (const flags of [{ isError: true }, { isLoading: true }]) {
        const report = buildRecorderReadinessReport({ ...healthy, ...flags, platform: "/private/path", version: "1.7.2\nsecret" })
        assert.match(report, /Version: unknown/)
        assert.match(report, /Platform: unknown/)
        assert.match(report, /Local checks: unverified/)
        assert.doesNotMatch(report, /FFmpeg: found|Screen capture: Available|secret|private/)
    }
})

test("preview loading appears only while fetching a confirmed source", () => {
    assert.equal(isCapturePreviewLoading({ isSourceConfirmed: false, hasPreviewSource: true, isPending: true }), false)
    assert.equal(isCapturePreviewLoading({ isSourceConfirmed: true, hasPreviewSource: false, isPending: true }), false)
    assert.equal(isCapturePreviewLoading({ isSourceConfirmed: true, hasPreviewSource: true, isPending: false }), false)
    assert.equal(isCapturePreviewLoading({ isSourceConfirmed: true, hasPreviewSource: true, isPending: true }), true)
})
