import { is } from "@electron-toolkit/utils"
import { BrowserWindow, screen } from "electron"
import BaseWindow from "../BaseWindow"

export default class NoteWindow extends BaseWindow {
    constructor(onClose) { super(null, null, onClose) }

    create(parent) {
        const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize

        const width = 250
        const height = 250

        const x = Math.round((screenWidth - width) * .5)
        const y = 0

        this.window = new BrowserWindow({
            ...this.properties,
            width,
            height,
            minWidth: 250,
            minHeight: 250,
            x,
            y,
            minimizable: false,
            maximizable: false,
            alwaysOnTop: true,
            webPreferences: {
                ...this.webPreferences,
            }
        })

        this.setContentProtection(true)
        this.load("note")

        if (is.dev) this.window.webContents.openDevTools()

        parent.on("close", () => this.close.bind(this))
        this.window.on("close", this.onClose)
    }

    onStartRecording() {
        this.window.setResizable(false)
        this.send("recording-started")
    }

    onStopRecording() {
        this.window.setResizable(true)
        this.send("recording-stopped")
    }
}
