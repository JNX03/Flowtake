import { is } from "@electron-toolkit/utils"
import * as Sentry from '@sentry/electron/main'
import crypto from 'crypto'
import debounce from "debounce"
import { deleteAsync } from "del"
import {
    app,
    BrowserWindow,
    dialog,
    shell
} from "electron"
import log from 'electron-log/main'
import { mkdir } from "fs/promises"
import { globby } from "globby"
import path from 'path'
import slash from "slash"
import {
    SOURCE_TYPE_AREA,
    SOURCE_TYPE_SCREEN,
    SOURCE_TYPE_WINDOW
} from "../../helpers"
import BaseWindow from "../BaseWindow"
import ffmpeg, {
    getSupportedCapturers,
    getSupportedEncoders
} from "../ffmpeg"
import {
    canCreateFile,
    openFile,
    openJson
} from "../helpers"
import {
    PRESET_JSON_VERSION,
    v1
} from "../migrations/preset/v1"
import {
    backgroundFile,
    backgroundFileName,
    cameraVideoFile,
    cameraVideoFileName,
    capturePreviewFile,
    imageCacheDir,
    imageThumbnailCacheDir,
    oldProjectDir,
    presetFile,
    presetsPath,
    projectJsonFile,
    projectJsonFileName,
    projectTempDir,
    screenVideoFileName,
    wallpapersCacheDir,
    wallpapersDir,
    wallpapersThumbnailCacheDir
} from "../paths"
import {
    addImageToCache,
    addWallpaperToCache,
    copyImageToCache,
    copyWallpaper,
    createBackgroundPng,
    createImageThumbnail,
    createWallpaperThumbnail
} from "../wallpaperUtils"
import Updater from "./Updater"

export default class MainWindow extends BaseWindow {
    constructor(setSaveZipPromise, getSaveZipPromise, onClose) {
        super(setSaveZipPromise, getSaveZipPromise, onClose)
        this.updater = new Updater()
        this.isClosing = false
        this.exporterWindow = null
        this.inputs = {}
    }

    create() {
        this.window = new BrowserWindow({
            ...this.properties,
            width: this.store.get("mainWindowSize.width"),
            height: this.store.get("mainWindowSize.height"),
            x: this.store.get("mainWindowPosition.x"),
            y: this.store.get("mainWindowPosition.y"),
            minWidth: 1000,
            minHeight: 600,
            webPreferences: { ...this.webPreferences },
            show: false
        })

        const resize = debounce(() => {
            const [width, height] = this.window.getSize()
            this.store.set("mainWindowSize.width", width)
            this.store.set("mainWindowSize.height", height)
        }, 1000)

        const move = debounce(() => {
            const [x, y] = this.window.getPosition()
            this.store.set("mainWindowPosition.x", x)
            this.store.set("mainWindowPosition.y", y)
        }, 1000)

        this.window.once('ready-to-show', () => {
            if (this.store.get("isMainWindowMaximized")) this.window.maximize()
            this.window.show()
        })

        this.window.on('resize', resize)

        this.window.on('move', move)

        this.window.on('maximize', () => {
            resize.clear()
            move.clear()
            this.store.set("isMainWindowMaximized", true)
        })

        this.window.on('unmaximize', () => {
            resize.clear()
            move.clear()
            this.store.set("isMainWindowMaximized", false)
        })

        this.load("main")

        if (is.dev) this.window.webContents.openDevTools()

        this.window.on('close', () => this.isClosing = true)
    }

    async getCapturers(force = false) {
        if (!this.store.has("capturers") || force) {
            const fps = this.store.get("screenFps")
            const supportedCapturers = await getSupportedCapturers(fps)
            console.log("supported capturers", supportedCapturers)
            this.store.set("capturers", supportedCapturers)
        }
        return this.store.get("capturers")
    }

    async setCapturer(capturerName) {
        const updatedCapturers = this.store.get("capturers").map(capturer => {
            capturer.isSelected = capturer.name === capturerName
            return capturer
        })
        this.store.set("capturers", updatedCapturers)
        return this.store.get("capturers")
    }

    async getEncoders(force = false) {
        if (!this.store.has("encoders") || force) {
            const capturer = this.store.get("capturers").find(({ isSelected }) => isSelected)
            const supportedEncoders = await getSupportedEncoders(capturer.config)
            console.log("supported encoders", supportedEncoders)
            this.store.set("encoders", supportedEncoders)
        }
        return this.store.get("encoders")
    }

    async setEncoder(encoderName) {
        const updatedEncoders = this.store.get("encoders").map(encoder => {
            encoder.isSelected = encoder.name === encoderName
            return encoder
        })
        this.store.set("encoders", updatedEncoders)
        return this.store.get("encoders")
    }

    async getSourceScreenshot(source) {
        const { type: sourceType, id } = source
        const screenCoords = await this.getScreenCoordinates()
        this.setContentProtection(true)
        try {
            let coords
            switch (sourceType) {
                case SOURCE_TYPE_WINDOW:
                    coords = await this.getAppWindowCoordinates(id)
                    break
                case SOURCE_TYPE_SCREEN:
                    coords = screenCoords
                    break
                case SOURCE_TYPE_AREA: {
                    const { x, y, width, height } = source
                    coords = { x, y, width, height }
                    break
                }
            }

            await ffmpeg(["-f", "gdigrab",
                "-framerate", 1,
                "-draw_mouse", 0,
                "-offset_x", coords.x, "-offset_y", coords.y,
                "-video_size", `${coords.width}x${coords.height}`,
                "-i", "desktop",
                "-vframes", 1,
                "-update", "true",
                "-y",
                capturePreviewFile])

        } catch (e) {
            console.log(e)
        } finally {
            this.setContentProtection(false)
        }
        return "image://source-screenshot"
    }

    getProjects(requestedPage) {
        const allProjects = Object.values(this.store.get("projects"))
            .filter(({ lastSaved }) => lastSaved)
            .sort((a, b) => a.lastSaved > b.lastSaved ? -1 : 1)
        const itemsPerPage = 30
        const totalPages = Math.ceil(allProjects.length / itemsPerPage)
        const page = Math.min(requestedPage, totalPages)
        const projects = allProjects.filter((_project, i) => i >= page * itemsPerPage && i < (page + 1) * itemsPerPage)
        return { projects, page, totalPages }
    }

    async findProject() {
        const { canceled, filePaths } = await dialog.showOpenDialog(this.window, {
            defaultPath: app.getPath("home"),
            properties: ["openFile"],
            filters: [{ name: 'Flowtake projects', extensions: ['rapi'] }]
        })
        if (canceled || !filePaths?.[0]) return null

        const zipPath = filePaths[0]

        try {
            const storeEntry = Object.entries(this.store.get("projects")).find(([, project]) => project.path === zipPath)
            if (storeEntry) return storeEntry[0]

            const projectJson = await this.readProjectJsonFromProjectZip(zipPath)

            if (!projectJson) {
                this.send("error", [{ message: "Invalid project file" }])
                return null
            }

            if (this.store.has(`projects.${projectJson.project.id}`)) {
                const id = crypto.randomUUID()
                await mkdir(projectTempDir(id), { recursive: true })
                this.store.set(`projects.${id}.path`, zipPath)
                await this.saveProjectJson({ ...projectJson, project: { ...projectJson.project, id } }, id)
                await this.updateProjectZip(zipPath, [projectJsonFile(id)])

                return id
            } else {
                this.store.set(`projects.${projectJson.project.id}`, {
                    id: projectJson.project.id,
                    name: projectJson.project.name,
                    lastSaved: Date.now(),
                    path: zipPath
                })
                return projectJson.project.id
            }
        } catch (e) {
            Sentry.captureException(e)
            this.send("error", [{ message: "Failed to open project file" }])
            return null
        }
    }

    async openProjectDir(projectId) {
        await this.migrateProject(projectId)
        shell.showItemInFolder(this.store.get(`projects.${projectId}.path`))
    }

    openLogsDir() {
        shell.showItemInFolder(log.transports.file.getFile().path)
    }

    async unzipProject(setProjectId) {
        await this.migrateProject()

        const success = await this.extractProjectZipToTemp()

        if (!success) {
            await setProjectId()
            return false
        }
        return true
    }

    async zipProject() {
        if (!this.projectId) return false

        try {
            // Get specific files from the project temp directory (top level only)
            const files = await globby([screenVideoFileName, cameraVideoFileName, projectJsonFileName, backgroundFileName], {
                cwd: slash.default(projectTempDir(this.projectId)),
                onlyFiles: true,
                deep: 1
            })

            if (files.length === 0) {
                console.log("No files to zip in project temp directory")
                return false
            }

            // Get the project zip file path
            const projectZipPath = this.store.get(`projects.${this.projectId}.path`)
            if (!projectZipPath) {
                console.error("No project zip path found in store")
                return false
            }

            // Convert relative file paths to absolute paths
            const absoluteFilePaths = files.map(file =>
                path.join(projectTempDir(this.projectId), file)
            )

            // Use the zip helper to create/update the project zip atomically
            await this.replaceProjectZip(projectZipPath, absoluteFilePaths)

            return true
        } catch (e) {
            console.error("Error zipping project:", e)
            return false
        }
    }

    async deleteProject(projectId) {
        try {
            if (this.store.has(`projects.${projectId}.path`)) {
                const zip = this.store.get(`projects.${projectId}.path`)
                await deleteAsync([path.basename(zip)], { cwd: slash.default(path.dirname(zip)) })
            } else await deleteAsync(["*/**"], { cwd: oldProjectDir(projectId) })
            this.store.delete(`projects.${projectId}`)
            return true
        } catch (e) {
            console.log(e)
            return false
        }
    }

    async updateBackground(type, relativePath) {
        switch (type) {
            case "wallpaper": {
                const toPath = backgroundFile(this.projectId)
                await createBackgroundPng(
                    path.join(wallpapersCacheDir, relativePath),
                    toPath
                )
                break
            }
            case "image": {
                const toPath = backgroundFile(this.projectId)
                await createBackgroundPng(
                    path.join(imageCacheDir, relativePath),
                    toPath
                )
                break
            }
            default:
                try {
                    await deleteAsync([backgroundFileName],
                        { cwd: slash.default(projectTempDir(this.projectId)) })
                } catch (e) {
                    console.error("Error deleting background file:", e)
                }
        }
    }

    async syncImageCache(inputDir, cacheDir, cachingFunction) {
        const inputPaths = await globby("**/*.{jpg,jpeg,png,webp}", { cwd: slash.default(inputDir) })
        const cachePaths = await globby("**/*.{jpg,jpeg,png,webp}", { cwd: slash.default(cacheDir) })
        await Promise.all(inputPaths.map(async path => {
            if (!cachePaths.includes(path)) return cachingFunction(path)
        }))
    }

    async openImages(dir) {
        const paths = await globby(`${slash.default(dir)}/**/*.{jpg,jpeg,png,webp}`)
        return Promise.all(paths.map(async path => {
            const { buffer, type } = await openFile(path)
            return { path: path.replace(`${slash.default(dir)}/`, ""), thumbnailBuffer: buffer, type }
        }))
    }

    async getWallpapers() {
        await this.syncImageCache(wallpapersDir, wallpapersCacheDir, copyWallpaper)
        await this.syncImageCache(wallpapersCacheDir, wallpapersThumbnailCacheDir, createWallpaperThumbnail)

        const thumbnailPaths = await globby(`${slash.default(wallpapersThumbnailCacheDir)}/**/*.{jpg,jpeg,png,webp}`)

        return thumbnailPaths.map(thumbnailPath => {
            const path = thumbnailPath.replace(`${slash.default(wallpapersThumbnailCacheDir)}/`, "")
            let i
            if (path.includes("Windows")) i = 0
            else if (path.includes("Theme")) i = 1
            else i = 2
            return { path, i }
        })
            .sort((a, b) => a.i - b.i || a.path.localeCompare(b.path))
            .map(({ path }) => ({ path }))
    }

    async syncBackground(background) {
        // if project background image doesn't exist yet in cache, add it
        // E.g. when project was imported
        switch (background.type) {
            case "image":
                await addImageToCache(background, this.projectId)
                break
            case "wallpaper":
                return await addWallpaperToCache(background, this.projectId)
        }
        return background
    }

    async getBackgroundImages() {
        await this.syncImageCache(imageCacheDir, imageThumbnailCacheDir, createImageThumbnail)
        return this.openImages(imageThumbnailCacheDir)
    }

    async chooseBackgroundImage() {
        const { canceled, filePaths } = await dialog.showOpenDialog(this.window, {
            defaultPath: app.getPath("pictures"),
            properties: ["openFile"],
            filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
        })
        if (!canceled && filePaths?.[0]) {
            const cachedImage = `${crypto.randomUUID()}${path.extname(filePaths[0])}`
            await copyImageToCache(filePaths[0], cachedImage)
            return cachedImage
        } else return null
    }

    checkForUpdates() {
        !is.dev && this.updater.check(
            () => this.send("update-downloaded"),
            () => this.send("error", [{ message: "There was a problem updating the application" }]))
    }

    installUpdate() {
        this.updater.install()
    }

    getVersion() {
        return app.getVersion()
    }

    async getCameraVideoBuffer() {
        const { buffer } = await openFile(cameraVideoFile(this.projectId))
        return buffer
    }

    setProgressBar(progress) {
        this.window.setProgressBar(progress)
        this.send("render-queue-progress", [progress])
    }

    async savePreset(p) {
        const id = crypto.randomUUID()
        await mkdir(presetsPath, { recursive: true })
        const preset = { id, version: PRESET_JSON_VERSION, name: "Unnamed preset", ...p }
        const { lastSaved } = await this.saveJson(path.join(presetsPath, `${preset.id}.json`), preset)
        this.store.set(`presets.${preset.id}.id`, preset.id)
        this.store.set(`presets.${preset.id}.lastSaved`, lastSaved)
        this.store.set(`presets.${preset.id}.name`, preset.name)
    }

    getPresets(requestedPage, itemsPerPage = 30) {
        const allPresets = Object.values(this.store.get("presets"))
            .filter(({ lastSaved }) => lastSaved)
            .sort((a, b) => a.lastSaved > b.lastSaved ? -1 : 1)
        const totalPages = Math.ceil(allPresets.length / itemsPerPage)
        const page = Math.min(requestedPage, totalPages)
        const presets = allPresets.filter((_preset, i) => i >= page * itemsPerPage && i < (page + 1) * itemsPerPage)
        return { presets, page, totalPages }
    }

    async deletePreset(id) {
        try {
            await deleteAsync([slash.default(presetFile(id))], { force: true })
            this.store.delete(`presets.${id}`)
            return true
        } catch {
            return false
        }
    }

    openPresetDir(id) {
        shell.showItemInFolder(presetFile(id))
    }

    async importPreset() {
        const { canceled, filePaths } = await dialog.showOpenDialog(this.window, {
            defaultPath: app.getPath("downloads"),
            properties: ["openFile"],
            filters: [{ name: 'Preset', extensions: ['json'] }]
        })
        if (!canceled && filePaths?.[0]) {

            const { data, error, errorMessage } = await openJson(filePaths?.[0])

            if (data) {
                await this.savePreset(data)
                return true
            } else if (error) this.send("error", [{ message: errorMessage }])

            return false
        } else return false
    }

    async getPreset(id) {
        const { data, error, errorMessage } = await openJson(presetFile(id))

        if (data) {
            this.store.set(`presets.${id}.lastSaved`, Date.now())
            if (data.version && data.version === PRESET_JSON_VERSION) return data
            else return v1.up(data)
        } else if (error) {
            if (error === "FileNotFoundError") this.store.delete(`presets.${id}`)
            this.send("error", [{ message: errorMessage }])
        }
        return null
    }

    async cleanUpProjectTempFolder() {
        try {
            await deleteAsync(["**/*"], { cwd: slash.default(projectTempDir(this.projectId)) })
        } catch (e) {
            console.error("Error cleaning up temp folder:", e)
        }
    }

    async chooseExportDirectory() {
        const { canceled, filePaths } = await dialog.showOpenDialog(this.window, {
            defaultPath: await this.store.get("exportDirectory"),
            properties: ["openDirectory"],
            filters: [{ name: 'Open folder' }]
        })

        if (!canceled && filePaths?.[0]) {
            if (await canCreateFile(filePaths[0])) {
                this.store.set("exportDirectory", filePaths[0])
                return { success: true, message: null }
            }
            return { success: false, message: "No write permission for this directory, please select a different one." }
        }

        return { success: false, message: null }
    }
}
