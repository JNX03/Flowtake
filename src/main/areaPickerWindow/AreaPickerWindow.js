import { BrowserWindow } from "electron"
import { SOURCE_TYPE_AREA } from "../../helpers"
import BaseWindow from "../BaseWindow"

export default class AreaPickerWindow extends BaseWindow {
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
        this.load("areaPicker")
        // this.window.webContents.openDevTools()
    }

    percentToPixels(percentDims, { width, height }) {
        return {
            x: Math.round(percentDims.x / 100 * width),
            y: Math.round(percentDims.y / 100 * height)
        }
    }

    async selectArea(area) {
        const { x, y, width, height } = area
        const screenCoords = await this.getScreenCoordinates()

        const pos = this.percentToPixels({ x, y }, screenCoords)
        const dims = this.percentToPixels({ x: width, y: height }, screenCoords)

        return {
            x: pos.x,
            y: pos.y,
            width: dims.x,
            height: dims.y,
            type: SOURCE_TYPE_AREA,
            name: "Area"
        }
    }
}
