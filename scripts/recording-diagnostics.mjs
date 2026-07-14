import { spawn } from "node:child_process"
import { once } from "node:events"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { fileURLToPath } from "node:url"

const DEFAULT_SAMPLE_MS = 2_000
const MIN_SAMPLE_MS = 250
const MAX_SAMPLE_MS = 10_000

const POWERSHELL_SNAPSHOT = String.raw`
$ErrorActionPreference = 'Stop'
$processes = @(
    Get-CimInstance Win32_Process |
        Where-Object { $_.Name -match '^flowtake(\.exe)?$' -or $_.Name -match '^ffmpeg(?:-[a-z0-9_-]+)?(\.exe)?$' } |
        ForEach-Object {
            $cimProcess = $_
            $nativeProcess = Get-Process -Id $cimProcess.ProcessId -ErrorAction SilentlyContinue
            if ($null -ne $nativeProcess) {
                $cpuSeconds = if ($null -eq $nativeProcess.CPU) { 0 } else { [double]$nativeProcess.CPU }
                $startedAt = $null
                try { $startedAt = $nativeProcess.StartTime.ToUniversalTime().ToString('o') } catch {}

                [pscustomobject]@{
                    pid = [int]$cimProcess.ProcessId
                    parentPid = [int]$cimProcess.ParentProcessId
                    name = [string]$cimProcess.Name
                    commandLine = [string]$cimProcess.CommandLine
                    executablePath = [string]$cimProcess.ExecutablePath
                    cpuSeconds = $cpuSeconds
                    workingSetBytes = [long]$nativeProcess.WorkingSet64
                    privateBytes = [long]$nativeProcess.PrivateMemorySize64
                    handleCount = [int]$nativeProcess.HandleCount
                    threadCount = [int]$nativeProcess.Threads.Count
                    startedAt = $startedAt
                }
            }
        }
)

[pscustomobject]@{
    timestamp = [DateTime]::UtcNow.ToString('o')
    logicalProcessors = [int][Environment]::ProcessorCount
    processes = $processes
} | ConvertTo-Json -Depth 4 -Compress
`

const round = (value, digits = 2) => Number(value.toFixed(digits))
const toArray = value => Array.isArray(value) ? value : value ? [value] : []
const isFlowtake = process => /^flowtake(?:\.exe)?$/i.test(process.name)
const isFfmpeg = process => /^ffmpeg(?:-[a-z0-9_-]+)?(?:\.exe)?$/i.test(process.name)

export function parseArgs(argv) {
    const options = {
        sampleMs: DEFAULT_SAMPLE_MS,
        json: false,
        failOnOrphan: false,
        help: false,
    }

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index]
        if (argument === "--json") options.json = true
        else if (argument === "--fail-on-orphan") options.failOnOrphan = true
        else if (argument === "--help" || argument === "-h") options.help = true
        else if (argument === "--sample-ms") {
            const value = Number(argv[index + 1])
            if (!Number.isInteger(value) || value < MIN_SAMPLE_MS || value > MAX_SAMPLE_MS) {
                throw new Error(`--sample-ms must be an integer from ${MIN_SAMPLE_MS} to ${MAX_SAMPLE_MS}`)
            }
            options.sampleMs = value
            index += 1
        } else {
            throw new Error(`Unknown option: ${argument}`)
        }
    }

    return options
}

function normalizeSnapshot(snapshot) {
    return {
        timestamp: snapshot.timestamp,
        logicalProcessors: Math.max(1, Number(snapshot.logicalProcessors) || 1),
        processes: toArray(snapshot.processes).map(process => ({
            ...process,
            pid: Number(process.pid),
            parentPid: Number(process.parentPid),
            cpuSeconds: Number(process.cpuSeconds) || 0,
            workingSetBytes: Number(process.workingSetBytes) || 0,
            privateBytes: Number(process.privateBytes) || 0,
            handleCount: Number(process.handleCount) || 0,
            threadCount: Number(process.threadCount) || 0,
        })),
    }
}

function summarize(processes, predicate) {
    const selected = processes.filter(predicate)
    return {
        processCount: selected.length,
        cpuPercent: round(selected.reduce((total, process) => total + process.cpuPercent, 0)),
        cpuPercentOneCore: round(selected.reduce((total, process) => total + process.cpuPercentOneCore, 0)),
        workingSetBytes: selected.reduce((total, process) => total + process.workingSetBytes, 0),
        privateBytes: selected.reduce((total, process) => total + process.privateBytes, 0),
    }
}

export function deriveReport(beforeInput, afterInput, elapsedMs) {
    const before = normalizeSnapshot(beforeInput)
    const after = normalizeSnapshot(afterInput)
    const actualElapsedMs = Math.max(1, Number(elapsedMs) || 1)
    const beforeByPid = new Map(before.processes.map(process => [process.pid, process]))

    const processes = after.processes.map(process => {
        const previous = beforeByPid.get(process.pid)
        const sameProcess = previous && (!previous.startedAt || !process.startedAt || previous.startedAt === process.startedAt)
        const deltaCpuSeconds = sameProcess
            ? Math.max(0, process.cpuSeconds - previous.cpuSeconds)
            : 0
        const cpuPercentOneCore = deltaCpuSeconds / (actualElapsedMs / 1_000) * 100

        return {
            ...process,
            deltaCpuSeconds: round(deltaCpuSeconds, 3),
            cpuPercentOneCore: round(cpuPercentOneCore),
            cpuPercent: round(cpuPercentOneCore / after.logicalProcessors),
        }
    })

    const flowtakePids = new Set(processes.filter(isFlowtake).map(process => process.pid))
    const orphanCandidates = processes
        .filter(process => {
            if (!isFfmpeg(process) || flowtakePids.has(process.parentPid)) return false
            const provenance = `${process.commandLine ?? ""} ${process.executablePath ?? ""}`
            return /flowtake|recording-[^\\/\s]+|extra-\d+\.mp4|flowtake-live/i.test(provenance)
        })
        .map(process => ({
            pid: process.pid,
            parentPid: process.parentPid,
            commandLine: process.commandLine,
            reason: "Flowtake-like FFmpeg command has no live Flowtake parent",
        }))

    return {
        schemaVersion: 1,
        capturedAt: after.timestamp,
        sampleMs: Math.round(actualElapsedMs),
        logicalProcessors: after.logicalProcessors,
        processes,
        totals: {
            flowtake: summarize(processes, isFlowtake),
            ffmpeg: summarize(processes, isFfmpeg),
        },
        orphanCandidates,
    }
}

async function takeWindowsSnapshot() {
    const child = spawn("powershell.exe", [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy", "Bypass",
        "-Command", POWERSHELL_SNAPSHOT,
    ], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", chunk => { stdout += chunk })
    child.stderr.on("data", chunk => { stderr += chunk })

    const [exitCode] = await once(child, "close")
    if (exitCode !== 0) {
        throw new Error(`PowerShell process query failed (${exitCode}): ${stderr.trim()}`)
    }

    const payload = stdout.trim().replace(/^\uFEFF/, "")
    if (!payload) throw new Error("PowerShell process query returned no data")
    return normalizeSnapshot(JSON.parse(payload))
}

const toMiB = bytes => `${round(bytes / 1_048_576, 1).toFixed(1)} MiB`

function printHumanReport(report) {
    console.log("Flowtake recording diagnostics (read-only)")
    console.log(`Sample: ${report.sampleMs} ms | Logical CPUs: ${report.logicalProcessors}`)

    if (report.processes.length === 0) {
        console.log("No Flowtake or FFmpeg processes were found. Start a recording and rerun.")
    } else {
        console.table(report.processes.map(process => ({
            PID: process.pid,
            Process: process.name,
            "CPU machine": `${process.cpuPercent.toFixed(2)}%`,
            "CPU one core": `${process.cpuPercentOneCore.toFixed(2)}%`,
            "Working set": toMiB(process.workingSetBytes),
            Private: toMiB(process.privateBytes),
            Parent: process.parentPid,
            Threads: process.threadCount,
            Handles: process.handleCount,
        })))
    }

    console.log("Totals:")
    for (const [name, totals] of Object.entries(report.totals)) {
        console.log(`  ${name}: ${totals.processCount} process(es), ${totals.cpuPercent.toFixed(2)}% machine CPU, ${toMiB(totals.workingSetBytes)} working set`)
    }

    if (report.orphanCandidates.length === 0) {
        console.log("Orphan candidates: none")
    } else {
        console.log("Orphan candidates:")
        for (const candidate of report.orphanCandidates) {
            console.log(`  PID ${candidate.pid} (parent ${candidate.parentPid}): ${candidate.reason}`)
        }
    }
}

function printHelp() {
    console.log(`Usage: npm run diagnose:recording -- [options]

Options:
  --sample-ms <250-10000>  CPU sampling interval (default: ${DEFAULT_SAMPLE_MS})
  --json                   Print machine-readable JSON
  --fail-on-orphan         Exit with code 2 when orphan candidates are found
  -h, --help               Show this help

This command only reads Windows process telemetry. It does not start, stop, or reconfigure Flowtake.`)
}

async function main() {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
        printHelp()
        return
    }
    if (process.platform !== "win32") {
        throw new Error("Recorder diagnostics currently support Windows only; no settings were changed.")
    }

    const before = await takeWindowsSnapshot()
    const start = performance.now()
    await delay(options.sampleMs)
    const after = await takeWindowsSnapshot()
    const report = deriveReport(before, after, performance.now() - start)

    if (options.json) console.log(JSON.stringify(report, null, 2))
    else printHumanReport(report)

    if (options.failOnOrphan && report.orphanCandidates.length > 0) {
        process.exitCode = 2
    }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
    main().catch(error => {
        console.error(`Recording diagnostics failed: ${error.message}`)
        process.exitCode = 1
    })
}
