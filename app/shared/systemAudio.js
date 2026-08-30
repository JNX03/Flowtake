const LOOPBACK_DEVICE_PATTERN = /(?:stereo mix|what u hear|wave out mix|loopback|virtual[- ]audio[- ]capturer|blackhole|soundflower|monitor of|\.monitor\b|vb[- ]?audio|vb[- ]?cable|voicemeeter|cable (?:input|output))/i

export function isLikelySystemAudioSource(label) {
    return typeof label === "string" && LOOPBACK_DEVICE_PATTERN.test(label.trim())
}

export function getSystemAudioSources(devices = []) {
    return [...new Set(devices
        .filter(({ kind, label }) => kind === "audioinput" && isLikelySystemAudioSource(label))
        .map(({ label }) => label.trim()))]
}
