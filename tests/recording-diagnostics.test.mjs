import assert from "node:assert/strict"
import test from "node:test"

import { deriveReport, parseArgs } from "../scripts/recording-diagnostics.mjs"

test("recording diagnostics parse safe defaults and explicit flags", () => {
    assert.deepEqual(parseArgs([]), {
        sampleMs: 2_000,
        json: false,
        failOnOrphan: false,
        help: false,
    })
    assert.deepEqual(parseArgs(["--sample-ms", "5000", "--json", "--fail-on-orphan"]), {
        sampleMs: 5_000,
        json: true,
        failOnOrphan: true,
        help: false,
    })
    assert.throws(() => parseArgs(["--sample-ms", "100"]), /250 to 10000/)
    assert.throws(() => parseArgs(["--unknown"]), /Unknown option/)
})

test("recording diagnostics calculates machine CPU and memory totals", () => {
    const startedAt = "2026-07-14T00:00:00.000Z"
    const before = {
        timestamp: "2026-07-14T00:00:02.000Z",
        logicalProcessors: 8,
        processes: [
            { pid: 10, parentPid: 1, name: "Flowtake.exe", cpuSeconds: 4, startedAt },
            { pid: 20, parentPid: 10, name: "ffmpeg.exe", cpuSeconds: 8, startedAt },
        ],
    }
    const after = {
        timestamp: "2026-07-14T00:00:04.000Z",
        logicalProcessors: 8,
        processes: [
            {
                pid: 10, parentPid: 1, name: "Flowtake.exe", cpuSeconds: 4.8, startedAt,
                workingSetBytes: 100 * 1_048_576, privateBytes: 80 * 1_048_576,
            },
            {
                pid: 20, parentPid: 10, name: "ffmpeg-x86_64-pc-windows-msvc.exe", cpuSeconds: 9.6, startedAt,
                commandLine: "ffmpeg -i recording-demo.mp4", workingSetBytes: 50 * 1_048_576,
                privateBytes: 40 * 1_048_576,
            },
        ],
    }

    const report = deriveReport(before, after, 2_000)

    assert.equal(report.processes[0].cpuPercentOneCore, 40)
    assert.equal(report.processes[0].cpuPercent, 5)
    assert.equal(report.processes[1].cpuPercentOneCore, 80)
    assert.equal(report.processes[1].cpuPercent, 10)
    assert.equal(report.totals.flowtake.workingSetBytes, 100 * 1_048_576)
    assert.equal(report.totals.ffmpeg.privateBytes, 40 * 1_048_576)
    assert.deepEqual(report.orphanCandidates, [])
})

test("recording diagnostics only flags Flowtake-like detached FFmpeg processes", () => {
    const after = {
        timestamp: "2026-07-14T00:00:02.000Z",
        logicalProcessors: 4,
        processes: [
            { pid: 10, parentPid: 1, name: "Flowtake.exe", cpuSeconds: 1 },
            { pid: 20, parentPid: 10, name: "ffmpeg.exe", commandLine: "ffmpeg recording-active.mp4", cpuSeconds: 1 },
            { pid: 30, parentPid: 999, name: "ffmpeg.exe", commandLine: "ffmpeg recording-detached.mp4", cpuSeconds: 1 },
            { pid: 40, parentPid: 999, name: "ffmpeg.exe", commandLine: "ffmpeg vacation.mov", cpuSeconds: 1 },
        ],
    }

    const report = deriveReport({ ...after, processes: [] }, after, 1_000)

    assert.deepEqual(report.orphanCandidates.map(candidate => candidate.pid), [30])
})
