import { spawn } from "child_process"
import { BrowserWindow } from "electron"
import ahk from "../../../resources/AutoHotkey.exe?asset"
import getWindowsAhk from "../../../resources/getWindows.ahk?asset"
import BaseWindow from "../BaseWindow"

export default class WindowPickerWindow extends BaseWindow {
    constructor() {
        super()
    }

    async create() {
        this.window = new BrowserWindow({
            ...this.properties,
            width: 1000,
            height: 600,
            minWidth: 1000,
            minHeight: 600,
            transparent: true,
            frame: false,
            minimizable: false,
            resizable: false,
            titleBarOverlay: false,
            alwaysOnTop: true,
            fullscreen: true,
            skipTaskbar: true,
            backgroundColor: '#00FFFFFF',
            webPreferences: {
                ...this.webPreferences
            }
        })

        this.setContentProtection(true)
        this.load("windowPicker")
        // this.window.webContents.openDevTools()
    }

    isOccluded(window, otherWindows) {
        for (let otherWindow of otherWindows) {
            if (
                otherWindow.x <= window.x &&
                otherWindow.y <= window.y &&
                otherWindow.x + otherWindow.width >= window.x + window.width &&
                otherWindow.y + otherWindow.height >= window.y + window.height
            ) {
                return true
            }
        }
        return false
    }

    filterOccludedWindows(windows) {
        let visibleWindows = []
        for (let i = 0; i < windows.length; i++) {
            let window = windows[i]
            let aboveWindows = windows.slice(0, i)
            if (!this.isOccluded(window, aboveWindows)) {
                visibleWindows.push(window)
            }
        }
        return visibleWindows
    }

    async limitCoordsToScreen(windows) {
        return (await Promise.all(windows.map(this.limitWindowCoordsToScreen.bind(this))))
            .filter(({ width, height }) => width > 0 && height > 0)
    }

    async getWindows() {
        const childProcess = spawn(ahk, [getWindowsAhk])
        const { windows } = await new Promise(
            resolve => childProcess.stdout.on("data", data => resolve(JSON.parse(data.toString())))
        )

        const sources = windows
            .filter(({ name, x, y, width, height }) => name !== "" && x >= 0 && y >= 0 && width > 0 && height > 0)
            // TODO: potentially additionally also check dimensions here
            .filter(({ name }) => name !== "Window Picker - Flowtake" && name !== "Program Manager")

        const filteredWindows = await this.limitCoordsToScreen(this.filterOccludedWindows(sources))
        filteredWindows.reverse()
        return filteredWindows
    }
}
