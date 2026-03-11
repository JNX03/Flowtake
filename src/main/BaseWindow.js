import { is } from "@electron-toolkit/utils"
import { deleteAsync } from "del"
import { Menu, shell } from "electron"
import installExtension, { REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } from "electron-devtools-installer"
import Store from "electron-store"
import { globby } from "globby"
import { escape } from "minimatch"
import { spawn } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { basename, dirname, normalize } from "node:path"
import { join } from 'path'
import sanitize from "sanitize-filename"
import slash from "slash"
import { unusedFilename } from "unused-filename"
import ahk from "../../resources/AutoHotkey.exe?asset"
import getScreenCoordsAhk from "../../resources/getScreenCoords.ahk?asset"
import getWindowCoordsAhk from "../../resources/getWindowCoords.ahk?asset"
import { openJson } from "./helpers"
import { PROJECT_JSON_VERSION, v1 } from "./migrations/project/v1"
import {
    backgroundFileName,
    cameraVideoFileName,
    oldProjectDir,
    oldProjectsDir,
    projectJsonFile,
    projectJsonFileName,
    projectsDir,
    projectTempDir,
    screenVideoFileName
} from "./paths"
import {
    createZip,
    extractZip,
    isValidProjectZip,
    readProjectJsonFromZip,
    replaceZip,
    updateZip
} from "./zipHelper"

export default class BaseWindow {
    constructor(setSaveZipPromise, getSaveZipPromise, onClose) {
        Menu.setApplicationMenu(null)

        this.properties = {
            frame: false,
            titleBarStyle: 'hidden',
            titleBarOverlay: {
                color: '#15191e',
                symbolColor: '#ecf9ff'
            },
            backgroundColor: "#15191e"
        }
        this.webPreferences = {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false
        }
        this.window = null
        this.projectId = null
        this.store = new Store()
        this.onClose = onClose ?? null
        this.setSaveZipPromise = setSaveZipPromise
        this.getSaveZipPromise = getSaveZipPromise
    }

    async loadExtensions() {
        // If React DevTools don't show up, reload dev tools
        // https://github.com/MarshallOfSound/electron-devtools-installer/issues/244
        await installExtension([REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS])
    }

    load(folder) {
        if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
            this.window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${folder}/index.html`)
        } else {
            this.window.loadFile(join(__dirname, `../renderer/${folder}/index.html`))
        }
        this.window.webContents.setWindowOpenHandler((details) => {
            shell.openExternal(details.url)
            return { action: 'deny' }
        })
    }

    close() {
        if (this.window && !this.window.isDestroyed()) {
            this.window.setClosable(true)
            this.window.close()
        }
    }

    async destroy() {
        if (this.window && !this.window.isDestroyed()) {
            await this.onClose?.()
            this.window.destroy()
        }
    }

    restore() {
        if (this.window && !this.window.isDestroyed()) this.window.restore()
    }

    send(message, args = []) {
        if (this.window && !this.window.isDestroyed()) this.window.webContents.send(message, ...args)
    }

    setContentProtection(bool) {
        if (this.window && !this.window.isDestroyed()) this.window.setContentProtection(bool)
    }

    async migrateProject(projectId = this.projectId) {
        if (!this.store.get(`projects.${projectId}.path`)) {

            const files = await globby([screenVideoFileName, cameraVideoFileName, projectJsonFileName, backgroundFileName],
                { cwd: slash.default(oldProjectDir(projectId)), onlyFiles: true, deep: 1 })

            let data = JSON.parse(await readFile(join(oldProjectDir(projectId), projectJsonFileName), { encoding: "utf8" }))
            if (data.version !== PROJECT_JSON_VERSION)
                data = await this.saveJson(
                    join(oldProjectDir(projectId), projectJsonFileName),
                    v1.up(data),
                    PROJECT_JSON_VERSION
                )

            const zipFile = await this.getUnusedZipFileName(data.project.name)

            await this.createProjectZip(
                zipFile,
                files.map(file => join(oldProjectDir(projectId), file))
            )

            this.store.set(`projects.${projectId}.path`, zipFile)

            // del doesn't delete folders. Seems to be a bug: https://github.com/sindresorhus/del/issues/126

            try {
                await deleteAsync(["**/*"], { cwd: slash.default(oldProjectDir(projectId)), force: true })
            } catch (e) {
                console.error("Error deleting project files", e)
            }
            try {
                await deleteAsync([projectId], { cwd: slash.default(oldProjectsDir) })
            } catch (e) {
                console.error("Error deleting project folder", e)
            }
        }
    }

    async getProject() {
        const { data } = await openJson(projectJsonFile(this.projectId))
        return data
    }

    async saveProjectJson(object, id = this.projectId) {
        if (id == null) return
        const file = projectJsonFile(id)
        try {
            const json = await this.saveJson(file, object, PROJECT_JSON_VERSION)
            this.store.set(`projects.${id}.id`, id)
            this.store.set(`projects.${id}.lastSaved`, json.lastSaved)
            this.store.set(`projects.${id}.name`, json.project.name)

        } catch (e) {
            console.error(e)
        }
    }

    async saveJson(file, object, version = null) {
        const updatedObject = { ...object, lastSaved: Date.now() }
        if (version) updatedObject.version = version
        const json = JSON.stringify(updatedObject)
        await writeFile(file, json, 'utf-8')
        return updatedObject
    }

    async getScreenCoordinates() {
        const childProcess = spawn(ahk, [getScreenCoordsAhk])
        return await new Promise(
            resolve => childProcess.stdout.on("data", data => resolve(JSON.parse(data.toString())))
        )
    }

    async getAppWindowCoordinates(appId) {
        const childProcess = spawn(ahk, [getWindowCoordsAhk, appId])
        const windowCoords = await new Promise(
            resolve => childProcess.stdout.on("data", data => resolve(JSON.parse(data.toString())))
        )
        // Window size and offset are capped by screen size.
        // Sometimes with fullscreen windows the detected offset is negative and the dimensions bigger than the screen 
        if (windowCoords.error) throw new Error(windowCoords.error)
        else return await this.limitWindowCoordsToScreen(windowCoords)
    }

    async limitWindowCoordsToScreen(coords) {
        const { x, y, width, height } = coords
        const screenDims = await this.getScreenCoordinates()
        return {
            ...coords,
            x: Math.max(x, 0),
            y: Math.max(y, 0),
            width: x + width > screenDims.width ? screenDims.width - x : width,
            height: y + height > screenDims.height ? screenDims.height - y : height,
        }
    }

    async isProjectValid(zipFilePath, sendToast = true) {
        const isValid = await isValidProjectZip(zipFilePath)
        if (!isValid && sendToast) this.send("error", [{ message: "Project is invalid." }])
        return isValid
    }

    async getUnusedZipFileName(base) {
        const truncated = base.slice(0, 50)
        const sanitized = sanitize(truncated)
        const name = sanitized.length > 0 ? sanitized : "project"
        return await unusedFilename(join(projectsDir, `${name}.rapi`))
    }

    async withBlockingZipPromise(asyncFn) {
        await this.getSaveZipPromise?.()
        const promise = asyncFn()
        this.setSaveZipPromise?.(promise)
        const result = await promise
        this.setSaveZipPromise?.(null)
        return result
    }

    // ZIP OPERATIONS USING HELPER FUNCTIONS

    async updateProjectZip(projectZipFile, files) {
        await this.withBlockingZipPromise(async () => { await updateZip(projectZipFile, files) })
    }

    async createProjectZip(projectZipFile, files) {
        await this.withBlockingZipPromise(async () => { await createZip(projectZipFile, files) })
    }

    async replaceProjectZip(projectZipFile, files) {
        await this.withBlockingZipPromise(async () => { await replaceZip(projectZipFile, files) })
    }

    async readProjectJsonFromProjectZip(projectZipFile) {
        return await this.withBlockingZipPromise(async () => {
            const result = await readProjectJsonFromZip(projectZipFile)
            if (!result) {
                this.send("error", [{ message: "Project is invalid." }])
            }
            return result
        })
    }

    async extractProjectZipToTemp() {
        return await this.withBlockingZipPromise(async () => {
            const p = normalize(this.store.get(`projects.${this.projectId}.path`))
            const files = await globby(escape(basename(p)), { cwd: slash.default(dirname(p)) })

            if (files.length > 0) {
                const success = await extractZip(p, projectTempDir(this.projectId))
                if (!success) this.send("error", [{ message: "Project is invalid." }])
                return success
            } else {
                this.send("error", [{ message: "File not found" }])
                return false
            }
        })
    }
}
