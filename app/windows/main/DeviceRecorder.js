export default class DeviceRecorder {

    constructor() {
        this.mediaRecorder = null
        this.enqueuePromise = Promise.resolve()
        this.enqueueError = null
        this.previewEl = null
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
            // Create MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9,opus',
                audioBitsPerSecond: 64000,
                videoBitsPerSecond: 1000000
            })

            const enqueue = async data =>
                window.electron.ipcRenderer.invoke("enqueue-camera-chunk", await data.arrayBuffer())

            // Handle data chunks
            this.mediaRecorder.addEventListener('dataavailable', ({ data }) => {
                // This event listener needs to be non-async to make sure it completes before the dataavailable callback in 
                // stop. enqueuePromise makes sure chunks are written in order. finalize-camera-file
                // ensures the queue is completed.
                if (data.size > 0) {
                    this.enqueuePromise = this.enqueuePromise
                        .then(() => enqueue(data))
                        .catch(error => {
                            this.enqueueError = this.enqueueError || error
                        })
                }
            })
        } catch {
            stream.getTracks().forEach(track => track.stop())
            throw new Error("The selected camera or microphone could not be recorded.")
        }
    }

    async initFile() {
        await window.electron.ipcRenderer.invoke("init-camera-file")
    }

    async start() {
        // Smaller chunks avoid large renderer/IPC spikes during longer recordings.
        this.mediaRecorder.start(1000)
    }

    async stop() {
        // Request any remaining buffered data
        if (this.mediaRecorder.state !== "inactive") {
            await new Promise(resolve => {
                this.mediaRecorder.addEventListener('dataavailable', resolve, { once: true })
                this.mediaRecorder.stop()
            })
            await this.enqueuePromise
            if (this.enqueueError) throw this.enqueueError
        }

        await window.electron.ipcRenderer.invoke("finalize-camera-file")
    }

    destroy() {
        this.mediaRecorder?.stream?.getTracks().forEach(track => track.stop())
        if (this.previewEl) this.previewEl.srcObject = null
        this.mediaRecorder = null
        this.previewEl = null
    }
}
