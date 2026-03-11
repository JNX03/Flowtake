import InputReader from "../../InputReader"

export default class RendererInputReader extends InputReader {
    constructor(videoType, args) {
        super(videoType, args)
        this.fhId = null
    }

    async open() {
        this.fhId = await window.electron.ipcRenderer.invoke("open", this.videoType, "r", this.args)
    }

    read(start, end) {
        return window.electron.ipcRenderer.invoke("read", this.fhId, start, end)
    }

    getSize() {
        return window.electron.ipcRenderer.invoke("get-size", this.fhId)
    }

    close() {
        return window.electron.ipcRenderer.invoke("close", this.fhId)
    }
}