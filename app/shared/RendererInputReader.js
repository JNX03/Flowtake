import InputReader from "./InputReader"

// Helper to decode base64 string to Uint8Array
function base64ToUint8Array(base64) {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
}

export default class RendererInputReader extends InputReader {
    constructor(videoType, args) {
        super(videoType, args)
        this.fhId = null
    }

    async open() {
        this.fhId = await window.electron.ipcRenderer.invoke("open", this.videoType, "r", this.args)
    }

    async read(start, end) {
        const base64Data = await window.electron.ipcRenderer.invoke("read", this.fhId, start, end)
        // Tauri returns base64-encoded string, decode to Uint8Array for mediabunny
        if (typeof base64Data === 'string') {
            return base64ToUint8Array(base64Data)
        }
        // Fallback for array format
        return new Uint8Array(base64Data)
    }

    getSize() {
        return window.electron.ipcRenderer.invoke("get-size", this.fhId)
    }

    close() {
        return window.electron.ipcRenderer.invoke("close", this.fhId)
    }
}