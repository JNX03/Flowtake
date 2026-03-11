import { is } from "@electron-toolkit/utils"
import { BrowserWindow } from "electron"
import sanitize from "sanitize-filename"
import BaseWindow from "../BaseWindow"
import { api } from "../helpers"

const CLOSE_MODE_HIDE = "hide"
const CLOSE_MODE_CLOSE = "close"

export default class ExporterWindow extends BaseWindow {
    constructor(setSaveZipPromise, getSaveZipPromise, onClose) {
        super(setSaveZipPromise, getSaveZipPromise, onClose)
        this.state = null
        this.closeMode = CLOSE_MODE_CLOSE
        this.openSection = null
        this.mainWindow = null
    }

    create(parent, state, section) {
        this.openSection = section
        this.state = state
        if (this.window && !this.window.isDestroyed()) {
            this.send("open-section", [section])
            this.send("project-state", [state])
            this.window.show()
            this.window.focus()
        } else {
            this.window = new BrowserWindow({
                ...this.properties,
                width: 500,
                height: 550,
                minWidth: 400,
                minHeight: 500,
                minimizable: false,
                resizable: true,
                webPreferences: {
                    ...this.webPreferences,
                    backgroundThrottling: false,
                    devTools: false
                },
                parent,
                modal: true
            })

            this.load("exporter")

            if (is.dev) this.window.webContents.openDevTools()

            this.window.on('close', event => {
                event.preventDefault()
                if (this.closeMode === CLOSE_MODE_HIDE) this.window.hide()
                if (this.closeMode === CLOSE_MODE_CLOSE) {
                    this.mainWindow.send("has-exports", [false])
                    this.window.destroy()
                }
            })
        }
    }

    getState() {
        this.send("project-state", [this.state])
    }

    getOpenSection() {
        return this.openSection
    }

    setCloseMode(mode) {
        this.closeMode = mode
        if (mode === CLOSE_MODE_CLOSE) this.mainWindow.send("exporter-window-ready-to-close")
    }

    setHasRenderingOrCompletedRenders(hasRenders) {
        this.mainWindow.send("has-exports", [hasRenders])
    }

    async getShareableUrl(title) {
        const key = this.store.get("licenseKey")
        if (key) {
            try {
                return await api('videos/presigned-url', { key, title: sanitize(title) })
            } catch (e) {
                console.error('Error checking license:', e)
                return { hasError: true, message: "no_network" }
            }
        } else {
            return { hasError: true, message: "no_license" }
        }
    }
}
