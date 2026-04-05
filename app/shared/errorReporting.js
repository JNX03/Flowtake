let cachedSystemInfo = null

export async function initSystemInfo() {
    try {
        cachedSystemInfo = await window.electron.ipcRenderer.invoke("get-system-info")
    } catch (e) {
        console.warn("[Flowtake] Failed to get system info:", e)
        cachedSystemInfo = { version: "unknown", os: "unknown", os_version: "unknown", arch: "unknown", ram_gb: 0 }
    }
}

export function buildGitHubIssueUrl(errorText) {
    const info = cachedSystemInfo || { version: "unknown", os: "unknown", os_version: "unknown", arch: "unknown", ram_gb: 0 }
    const truncated = errorText.length > 500 ? errorText.substring(0, 500) + "..." : errorText

    const title = `[Bug] ${errorText.substring(0, 80)}`
    const body = [
        "## Error",
        "```",
        truncated,
        "```",
        "",
        "## Environment",
        `- **App version:** ${info.version}`,
        `- **OS:** ${info.os} ${info.os_version}`,
        `- **Architecture:** ${info.arch}`,
        `- **RAM:** ${info.ram_gb.toFixed(1)} GB`,
        "",
        "## Steps to reproduce",
        "1. ",
    ].join("\n")

    const params = new URLSearchParams({ title, body, labels: "bug" })
    return `https://github.com/JNX03/Flowtake/issues/new?${params.toString()}`
}
