import { is } from "@electron-toolkit/utils"
import crypto from 'crypto'
import { deleteAsync } from "del"
import {
    BrowserWindow,
    screen
} from "electron"
import { fuzzy } from "fast-fuzzy"
import {
    mkdir,
    rename
} from "fs/promises"
import { globby } from "globby"
import {
    Conversion,
    WebMOutputFormat
} from "mediabunny"
import slash from "slash"
import {
    MODE_CAMERA_OVERLAY,
    MODE_SCREEN_FULLSCREEN,
    RECORDING_CAMERA_VIDEO,
    RECORDING_SCREEN_VIDEO,
    RECORDING_UNCORRECTED_CAMERA_VIDEO,
    SOURCE_TYPE_AREA,
    SOURCE_TYPE_SCREEN,
    SOURCE_TYPE_WINDOW
} from "../../helpers"
import BaseWindow from "../BaseWindow"
import {
    getDevices,
    reportFfmpegError
} from "../ffmpeg"
import MainInputReader from "../MainInputReader"
import MainOutputWriter from "../MainOutputWriter"
import MouseEventRecorder from "../mainWindow/MouseEventRecorder"
import ScreenRecorder from "../mainWindow/ScreenRecorder"
import MediaRecorderChunkWriter from "../MediaRecorderChunkWriter"
import { PROJECT_JSON_VERSION } from "../migrations/project/v1"
import {
    recordingCameraVideoFile,
    recordingProjectJsonFile,
    recordingScreenVideoFile,
    recordingTempDir,
    recordingUncorrectedCameraVideoFile
} from "../paths"
import ClipConfig from "./ClipConfig"

export default class RecordWindow extends BaseWindow {
    constructor(setSaveZipPromise, getSaveZipPromise) {
        super(setSaveZipPromise, getSaveZipPromise)

        this.capturedArea = null
        this.screenCoords = null
        this.screenRecorder = new ScreenRecorder()
        this.mouseEventRecorder = new MouseEventRecorder()
        this.mediaRecorderChunkWriter = new MediaRecorderChunkWriter()
        this.trim = { left: 0, right: 0, top: 0, bottom: 0 }
        this.cameraMicConfig = null
        this.source = null
        this.systemAudio = null
        this.recordingId = null
    }

    create() {
        const { height: availableHeight } = screen.getPrimaryDisplay().workAreaSize
        const width = 210
        const height = 90
        const offset = 10

        this.window = new BrowserWindow({
            ...this.properties,
            width,
            height,
            x: offset,
            y: availableHeight - height - offset,
            minimizable: false,
            maximizable: false,
            resizable: false,
            closable: false,
            alwaysOnTop: true,
            webPreferences: {
                ...this.webPreferences,
                backgroundThrottling: false
            }
        })
        this.setContentProtection(true)
        this.load("recorder")

        if (is.dev) this.window.webContents.openDevTools()
    }

    async initRecording(source, cameraMicConfig, systemAudio, mainWindow) {

        this.recordingId = `recording-${crypto.randomUUID()}`

        await mkdir(recordingTempDir(this.recordingId), { recursive: true })

        this.screenCoords = await this.getScreenCoordinates()
        this.cameraMicConfig = cameraMicConfig
        this.source = source

        if (systemAudio !== null) {
            // Get devices from ffmpeg and fuzzy match with device label from enumerateDevices
            const devices = await getDevices()
            const systemAudioDevice = devices
                .map(device => ({ label: device, score: fuzzy(device, systemAudio) }))
                .filter(({ score }) => score > 0.9)
                .sort((a, b) => b.score - a.score)
                .at(0)

            this.systemAudio = systemAudioDevice?.label ?? null
        } else this.systemAudio = null

        switch (source.type) {
            case SOURCE_TYPE_WINDOW:
                try {
                    this.capturedArea = await this.getAppWindowCoordinates(source.id)
                    this.trim.left = this.capturedArea.x
                    this.trim.top = this.capturedArea.y
                    this.trim.right = this.screenCoords.width - this.capturedArea.x - this.capturedArea.width
                    this.trim.bottom = this.screenCoords.height - this.capturedArea.y - this.capturedArea.height
                    break
                } catch (error) {
                    mainWindow.send("recording-error", [error.message])
                    return
                }
            case SOURCE_TYPE_SCREEN:
                this.capturedArea = this.screenCoords
                this.trim.left = 0
                this.trim.top = 0
                this.trim.right = 0
                this.trim.bottom = 0
                break
            case SOURCE_TYPE_AREA: {
                const { x, y, width, height } = source
                this.capturedArea = { x, y, width, height }
                this.trim.left = source.x
                this.trim.top = source.y
                this.trim.right = this.screenCoords.width - source.x - source.width
                this.trim.bottom = this.screenCoords.height - source.y - source.height
                break
            }
        }

        if (this.capturedArea.width > 0 && this.capturedArea.height > 0) {
            mainWindow.window.minimize()
            this.create()
        } else mainWindow.send("recording-error", ["CaptureError"])
    }

    getCameraMicConfig() {
        return this.cameraMicConfig
    }

    startRecording(mainWindow, noteWindows) {
        const onStarted = () => {
            mainWindow.send("recording-started")
            this.send("recording-started")
            noteWindows.forEach(window => window.onStartRecording())
        }
        const onError = (code, output) => {
            this.close()
            mainWindow.restore()
            mainWindow.send("recording-error", ["CaptureError"])
            noteWindows.forEach(window => window.onStopRecording())
            this.store.delete("encoder")
            reportFfmpegError(code, output)
        }
        this.screenRecorder.start(this.screenCoords, this.recordingId, this.systemAudio, onStarted, onError)
        this.mouseEventRecorder.start()
    }

    pauseRecording(pause) {
        this.screenRecorder.pause(pause)
    }

    async stopRecording(mainWindow, noteWindows) {

        this.mouseEventRecorder.stop()
        await this.screenRecorder.stop()

        const hasCameraVideoFile =
            (await globby([slash.default(recordingUncorrectedCameraVideoFile(this.recordingId))])).length > 0

        this.window.setClosable(true)
        this.close()
        mainWindow.send("load", ["Creating project..."])
        mainWindow.restore()
        noteWindows.forEach(window => window.onStopRecording())

        const projectId = crypto.randomUUID()

        const projectFiles = []

        const project = {
            id: projectId,
            name: this.source.name,
            hasCameraVideo: false,
            hasMicrophoneAudio: false,
            cameraVideoDimensions: null
        }
        const clipAnims = {}

        if (hasCameraVideoFile) {

            const reader = new MainInputReader(RECORDING_UNCORRECTED_CAMERA_VIDEO, { recordingId: this.recordingId })
            await reader.init()

            const tracks = await reader.input.getTracks()
            project.hasCameraVideo = tracks.some(({ type }) => type === "video")
            project.hasMicrophoneAudio = tracks.some(({ type }) => type === "audio")

            const writer = new MainOutputWriter(RECORDING_CAMERA_VIDEO, { recordingId: this.recordingId }, WebMOutputFormat)
            await writer.init()

            const conversion = await Conversion.init({ input: reader.input, output: writer.output })

            if (conversion.isValid)
                await conversion.execute()
            else
                // Conversion is invalid and cannot be executed without error.
                // This field gives reasons for why tracks were discarded:
                console.error("Remux failed", conversion.discardedTracks)

            await writer.close()
            await reader.close()

            if (!conversion.isValid)
                await rename(
                    recordingUncorrectedCameraVideoFile(this.recordingId),
                    recordingCameraVideoFile(this.recordingId)
                )

            projectFiles.push(recordingCameraVideoFile(this.recordingId))
        }

        if (this.source.type === SOURCE_TYPE_SCREEN) {
            project.padding = 1
            project.borderRadius = 0
        }

        const reader = new MainInputReader(RECORDING_SCREEN_VIDEO, { recordingId: this.recordingId })
        await reader.init()
        const tracks = await reader.input.getTracks()
        project.hasSystemAudio = tracks.some(({ type }) => type === "audio")
        const d = await reader.input.computeDuration()
        const duration = Math.floor(d * 1000)
        await reader.close()

        const startTimestamp = this.screenRecorder.stopTimestamp - duration

        this.screenRecorder.clips.forEach(clip => {
            clip.start = Math.max(clip.start - startTimestamp, 0)
            clip.end = Math.min(clip.end - startTimestamp, duration)
        })

        const mouseEvents = this.mouseEventRecorder.getEvents(startTimestamp)

        project.mouseEvents = mouseEvents

        project.leftTrim = this.trim.left
        project.rightTrim = this.trim.right
        project.topTrim = this.trim.top
        project.bottomTrim = this.trim.bottom

        clipAnims.entities = ClipConfig.createBulk(this.screenRecorder.clips.map(clip => ({
            ...clip,
            layout: project.hasCameraVideo
                ? {
                    mode: MODE_CAMERA_OVERLAY,
                    config: { cameraPosition: { x: 0, y: 1 }, cameraBaseScale: .5, cameraBorderRadius: .5 }
                }
                : { mode: MODE_SCREEN_FULLSCREEN }
        })))
        project.videoDetails = {
            start: clipAnims.entities[0].start,
            end: clipAnims.entities.at(-1).end
        }

        const zipFile = await this.getUnusedZipFileName(project.name)

        const projectJson = recordingProjectJsonFile(this.recordingId)

        await this.saveJson(projectJson, { project, clipAnims }, PROJECT_JSON_VERSION)

        projectFiles.push(projectJson, recordingScreenVideoFile(this.recordingId))

        await this.createProjectZip(zipFile, projectFiles)

        await this.cleanUpRecordingTempFolder()

        this.recordingId = null

        this.store.set(`projects.${projectId}.id`, projectId)
        this.store.set(`projects.${projectId}.lastSaved`, Date.now())
        this.store.set(`projects.${projectId}.name`, project.name)
        this.store.set(`projects.${projectId}.path`, zipFile)

        mainWindow.send("project-created", [projectId])
    }

    // called when canceling recording
    async cancelRecording(mainWindow, noteWindows, error = null) {
        this.mouseEventRecorder.stop()
        await this.screenRecorder.cancelRecording()
        await this.cleanUpRecordingTempFolder()
        this.recordingId = null
        this.window.setClosable(true)
        this.close()
        mainWindow.send("recording-canceled")
        mainWindow.restore()
        if (error) mainWindow.send("recording-error", [error])
        noteWindows.forEach(window => window.send("recording-canceled"))
    }

    // called when restarting recording
    async resetRecording() {
        this.mouseEventRecorder.stop()
        await this.screenRecorder.cancelRecording()
        await this.cleanUpRecordingTempFolder()
    }

    async initCameraVideoFile() {
        await this.mediaRecorderChunkWriter.init(recordingUncorrectedCameraVideoFile(this.recordingId))
    }

    enqueueCameraVideoChunk(chunk) {
        this.mediaRecorderChunkWriter.enqueue(chunk)
    }

    async finalizeCameraVideoFile() {
        await this.mediaRecorderChunkWriter.end()
    }

    async cleanUpRecordingTempFolder() {
        try {
            await deleteAsync(["**/*"], { cwd: slash.default(recordingTempDir(this.recordingId)) })
        } catch (e) {
            console.error("Error cleaning up recording temp folder:", e)
        }
    }
}