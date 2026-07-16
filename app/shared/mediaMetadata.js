export function readAudioDurationMs(src, timeoutMs = 5000) {
    return new Promise(resolve => {
        const audio = new Audio()
        let timer = null
        let settled = false

        const cleanup = () => {
            if (timer) window.clearTimeout(timer)
            audio.removeEventListener("loadedmetadata", onMetadata)
            audio.removeEventListener("error", onError)
            audio.pause()
            audio.removeAttribute("src")
            audio.load()
        }

        const finish = duration => {
            if (settled) return
            settled = true
            cleanup()
            resolve(duration)
        }

        const onMetadata = () => {
            const duration = Number.isFinite(audio.duration) && audio.duration > 0
                ? Math.round(audio.duration * 1000)
                : null
            finish(duration)
        }

        const onError = () => finish(null)

        audio.preload = "metadata"
        audio.addEventListener("loadedmetadata", onMetadata)
        audio.addEventListener("error", onError)
        timer = window.setTimeout(() => finish(null), timeoutMs)
        audio.src = src
    })
}
