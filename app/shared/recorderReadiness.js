const optionalPermissions = new Set(["camera", "microphone"])

export function getPermissionStatus(permission) {
    if (optionalPermissions.has(permission.permission)) return "Checked when enabled"
    return permission.hasPermission === true ? "Available" : "Missing"
}

export function getRecorderReadiness({ permissions, dependencies, isLoading = false, isError = false, hasEngines = true }) {
    const requiredPermissions = Array.isArray(permissions)
        ? permissions.filter(permission => !optionalPermissions.has(permission.permission)) : []
    const allPermsOk = requiredPermissions.some(permission => permission.permission === "screenCapture")
        && requiredPermissions.every(permission => permission.hasPermission === true)
    const allDepsOk = Array.isArray(dependencies) && dependencies.some(dependency => dependency.command === "ffmpeg" && dependency.required === true)
        && dependencies.every(dependency => dependency.installed === true || dependency.required === false)
    const ready = !isLoading && !isError && hasEngines && allPermsOk && allDepsOk
    const label = isError ? "Check failed" : isLoading ? "Checking" : ready ? "Ready" : "Setup needed"
    return { allPermsOk, allDepsOk, ready, label }
}

export function buildRecorderReadinessReport({ platform, version, permissions, dependencies, isLoading, isError, hasEngines = true }) {
    const readiness = getRecorderReadiness({ permissions, dependencies, isLoading, isError, hasEngines })
    const knownPlatforms = new Set(["darwin", "win32", "linux"])
    const safeVersion = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version ?? "") ? version : "unknown"
    const tools = new Map([["ffmpeg", "FFmpeg"], ["brew", "Homebrew"], ["xdotool", "xdotool"], ["wmctrl", "wmctrl"], ["pw-cli", "PipeWire"]])
    const permissionLabels = new Map([["screenCapture", "Screen capture"], ["camera", "Camera"], ["microphone", "Microphone"]])
    const lines = ["Flowtake recorder readiness", `Version: ${safeVersion}`,
        `Platform: ${knownPlatforms.has(platform) ? platform : "unknown"}`, `Status: ${readiness.label}`,
        `Capture engines: ${hasEngines ? "available" : "unavailable"}`]
    // Failed probes can retain cached data. Do not copy those as current
    // results, native errors, or local paths.
    if (isLoading || isError) lines.push("Local checks: unverified; refresh to try again")
    else {
        for (const permission of Array.isArray(permissions) ? permissions : [])
            lines.push(`${permissionLabels.get(permission.permission) ?? "Other permission"}: ${getPermissionStatus(permission)}`)
        for (const dependency of Array.isArray(dependencies) ? dependencies : [])
            lines.push(`${tools.get(dependency.command) ?? "Other tool"}: ${dependency.installed === true ? "found" : "missing"} (${dependency.required === false ? "optional" : "required"})`)
    }
    lines.push("Local paths, project names, device identifiers, and credentials are omitted.")
    return lines.join("\n")
}

export function isCapturePreviewLoading({ isSourceConfirmed, hasPreviewSource, isPending }) {
    return Boolean(isSourceConfirmed && hasPreviewSource && isPending)
}
