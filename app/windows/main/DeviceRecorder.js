const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const supportedMimeType = candidates => {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return ""
    return candidates.find(candidate => MediaRecorder.isTypeSupported(candidate)) || ""
}

export function getRecorderOptions(stream) {
    const hasVideo = stream.getVideoTracks().length > 0
    const hasAudio = stream.getAudioTracks().length > 0

    const mimeCandidates = hasVideo
        ? (hasAudio
            ? [
                "video/webm;codecs=vp9,opus",
                "video/webm;codecs=vp8,opus",
                "video/webm",
            ]
            : [
                "video/webm;codecs=vp9",
                "video/webm;codecs=vp8",
                "video/webm",
            ])
        : ["audio/webm;codecs=opus", "audio/webm"]

    const options = {}
    const mimeType = supportedMimeType(mimeCandidates)
    if (mimeType) options.mimeType = mimeType

    if (hasAudio) options.audioBitsPerSecond = 96_000

    if (hasVideo) {
        const settings = stream.getVideoTracks()[0].getSettings?.() || {}
        const width = Number(settings.width) || 1280
        const height = Number(settings.height) || 720
        const frameRate = Number(settings.frameRate) || 30

        // Scale camera bitrate with the actual negotiated stream instead of
        // forcing every device into the old 1 Mbps ceiling. The cap keeps 4K
        // camera streams bounded while leaving WebView hardware encoders room
        // to produce a clean 1080p image.
        options.videoBitsPerSecond = clamp(
            Math.round(width * height * frameRate * 0.07),
            1_500_000,
            12_000_000
        )
    }

    return options
}

export default class DeviceRecorder {

    constructor() {
        this.mediaRecorder = null
        this.enqueuePromise = Promise.resolve()
        this.enqueueError = null
        this.previewEl = null
        this.stream = null
        this.pendingChunks = 0
        this.finalized = false
    }

    async init(cameraMicConfig, videoEl = null) {
        const stream = await navigator.mediaDevices.getUserMedia(cameraMicConfig.constraints)

        if ((cameraMicConfig.audioTrack && !stream.getAudioTracks().some(({ label }) => label === cameraMicConfig.audioTrack)) ||
            (cameraMicConfig.videoTrack && !stream.getVideoTracks().some(({ label }) => label === cameraMicConfig.videoTrack))) {
            stream.getTracks().forEach(track => track.stop())
            throw new Error("The selected camera or microphone was not found.")
        }

        stream.getTracks().forEach(track => {
            if ((track.kind === "audio" && track.label !== cameraMicConfig.audioTrack) ||
                (track.kind === "video" && track.label !== cameraMicConfig.videoTrack))
                stream.removeTrack(track)
        })

        if (videoEl && cameraMicConfig.videoTrack) {
            videoEl.srcObject = stream
            this.previewEl = videoEl
        }

        try {
            this.stream = stream
            this.mediaRecorder = new MediaRecorder(stream, getRecorderOptions(stream))

            const enqueue = async data =>
                window.electron.ipcRenderer.invoke("enqueue-camera-chunk", await data.arrayBuffer())

            // Handle data chunks
            this.mediaRecorder.addEventListener('dataavailable', ({ data }) => {
                // This event listener needs to be non-async to make sure it completes before the dataavailable callback in 
                // stop. enqueuePromise makes sure chunks are written in order. finalize-camera-file
                // ensures the queue is completed.
                if (data.size > 0) {
                    this.pendingChunks += 1
                    this.enqueuePromise = this.enqueuePromise
                        .then(() => enqueue(data))
                        .catch(error => {
                            this.enqueueError = this.enqueueError || error
                        })
                        .finally(() => {
                            this.pendingChunks = Math.max(0, this.pendingChunks - 1)
                        })
                }
            })
        } catch {
            stream.getTracks().forEach(track => track.stop())
            throw new Error("The selected camera or microphone could not be recorded.")
        }
    }

    async initFile() {
        this.enqueuePromise = Promise.resolve()
        this.enqueueError = null
        this.pendingChunks = 0
        this.finalized = false
        await window.electron.ipcRenderer.invoke("init-camera-file")
    }

    async start() {
        if (!this.mediaRecorder) throw new Error("Camera and microphone are not ready.")
        if (this.mediaRecorder.state !== "inactive") return
        // Smaller chunks avoid large renderer/IPC spikes during longer recordings.
        this.mediaRecorder.start(1000)
    }

    pause() {
        if (this.mediaRecorder?.state === "recording") this.mediaRecorder.pause()
    }

    resume() {
        if (this.mediaRecorder?.state === "paused") this.mediaRecorder.resume()
    }

    async stop() {
        if (this.finalized) return

        // Wait for MediaRecorder's stop event, which is emitted after its final
        // dataavailable event. Waiting on dataavailable alone can finalize the
        // native file before the last chunk has joined the ordered IPC queue.
        if (this.mediaRecorder?.state !== "inactive") {
            await new Promise((resolve, reject) => {
                const cleanup = () => {
                    this.mediaRecorder.removeEventListener("stop", onStop)
                    this.mediaRecorder.removeEventListener("error", onError)
                }
                const onStop = () => {
                    cleanup()
                    resolve()
                }
                const onError = event => {
                    cleanup()
                    reject(event?.error || new Error("Device recording failed."))
                }
                this.mediaRecorder.addEventListener("stop", onStop, { once: true })
                this.mediaRecorder.addEventListener("error", onError, { once: true })
                this.mediaRecorder.stop()
            })
        }

        await this.enqueuePromise
        if (this.enqueueError) throw this.enqueueError

        await window.electron.ipcRenderer.invoke("finalize-camera-file")
        this.finalized = true
    }

    destroy() {
        this.stream?.getTracks().forEach(track => track.stop())
        if (this.previewEl) this.previewEl.srcObject = null
        this.mediaRecorder = null
        this.stream = null
        this.previewEl = null
        this.pendingChunks = 0
    }
}
