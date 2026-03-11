import { deleteAsync } from "del"
import {
    Notification,
    shell
} from "electron"
import Store from "electron-store"
import { createReadStream } from "fs"
import {
    copyFile,
    mkdir,
    stat
} from "fs/promises"
import path from "path"
import sanitize from "sanitize-filename"
import slash from "slash"
import { Readable } from "stream"
import { unusedFilename } from "unused-filename"
import waitOn from "wait-on"
import {
    bgMagenta,
    bold,
    gray,
    magentaBright,
    yellow
} from "yoctocolors-cjs"
import { selectAllClips } from "../renderer/src/redux/clipSlice"
import {
    selectBackground,
    selectHasCameraVideo,
    selectHasMicrophoneAudio,
    selectHasSystemAudio,
    selectId,
    selectName
} from "../renderer/src/redux/projectSlice"
import AudioProcessor from "./AudioProcessor"
import { api } from "./helpers"
import {
    backgroundFile,
    cameraVideoFile,
    renderBackgroundFile,
    renderCameraVideoFile,
    renderedVideoFile,
    renderedVideoWithAudioFile,
    renderScreenVideoFile,
    renderTempDir,
    screenVideoFile
} from "./paths"

export default class Render {
    constructor(render) {
        this.id = render.id
        this.state = render.state
        this.uploadConfig = render.upload
        this.video = null
        this.store = new Store()
        this.input = {}

        this.audioProcessor = new AudioProcessor(
            this.id,
            selectAllClips(this.state),
            selectHasMicrophoneAudio(this.state),
            selectHasSystemAudio(this.state)
        )
    }

    async init() {
        const projectId = selectId(this.state)
        const background = selectBackground(this.state)

        await this.cleanUpRenderTempFolder(this.id)

        await mkdir(renderTempDir(this.id), { recursive: true })

        const resources = [screenVideoFile(projectId)]
        if (selectHasCameraVideo(this.state) || selectHasMicrophoneAudio(this.state))
            resources.push(cameraVideoFile(projectId))


        if (background.type === "wallpaper" || background.type === "image")
            resources.push(backgroundFile(projectId))

        await waitOn({ resources })

        await copyFile(screenVideoFile(projectId), renderScreenVideoFile(this.id))

        if (selectHasCameraVideo(this.state) || selectHasMicrophoneAudio(this.state))
            await copyFile(cameraVideoFile(projectId), renderCameraVideoFile(this.id))

        if (background.type === "wallpaper" || background.type === "image")
            await copyFile(backgroundFile(projectId), renderBackgroundFile(this.id))

        this.log(yellow(`temp dir: ${gray(renderTempDir(this.id))}`))
    }

    async copyToVideosFolder() {
        const video = selectHasMicrophoneAudio(this.state) || selectHasSystemAudio(this.state)
            ? renderedVideoWithAudioFile(this.id)
            : renderedVideoFile(this.id)

        try {
            await waitOn({ resources: [video] })
        } catch (e) {
            console.error(e)
        }

        const outputDir = this.store.get("exportDirectory")

        await mkdir(outputDir, { recursive: true })

        const sanitizedFilename = `${sanitize(selectName(this.state)) || "video"}${path.extname(video)}`

        this.video = await unusedFilename(path.join(outputDir, sanitizedFilename))

        await copyFile(video, this.video)
    }

    async cleanUpRenderTempFolder() {
        try {
            await deleteAsync(["**/*"], { cwd: slash.default(renderTempDir(this.id)) })
        } catch (e) {
            console.error("Error cleaning up temp folder:", e)
        }
    }

    sendNotification(mainWindow, exporterWindow) {
        // For fancy notifications with buttons, use https://www.sipgate.de/blog/how-to-create-native-notifications-with-action-buttons-on-windows-for-your-electron-app
        if (!exporterWindow.window.isFocused()) {
            const name = selectName(this.state)
            if (!mainWindow.window.isFocused()) {
                const notification = new Notification({ title: "Export completed", body: name })
                notification.once("click", () => { exporterWindow.create.call(exporterWindow, mainWindow.window) })
                notification.show()
            } else {
                mainWindow.send("export-completed", [{ projectName: name }])
            }
        }
    }

    async processAudio() {
        await this.audioProcessor.process()
    }

    async addAudio() {
        await this.audioProcessor.addToVideo()
    }

    async cancel() {
        this.uploadAbortController?.abort()
    }

    openFolder() {
        shell.showItemInFolder(this.video)
    }

    playVideo() {
        shell.openPath(this.video)
    }

    async upload(onProgress) {
        this.uploadAbortController = new AbortController()
        try {
            // Get the file size (needed for Content-Length header)
            const { size: contentLength } = await stat(this.video)
            const contentType = 'video/mp4' // Ensure correct MIME type

            const fileStream = createReadStream(this.video)

            // Handle abort signal to close the file stream
            this.uploadAbortController.signal.addEventListener('abort', () => {
                fileStream.destroy()
            })

            const webReadableStream = Readable.toWeb(fileStream)

            // Capture abort controller reference for use in transform
            const abortController = this.uploadAbortController

            let uploadedBytes = 0
            const progressStream = new TransformStream({
                transform(chunk, controller) {
                    // Check if upload was cancelled
                    if (abortController.signal.aborted) {
                        controller.error(new Error('Upload cancelled'))
                        return
                    }
                    uploadedBytes += chunk.length
                    onProgress?.(uploadedBytes / contentLength)
                    controller.enqueue(chunk)
                }
            })

            // Pipe the file stream through the progress stream
            const bodyWithProgress = webReadableStream.pipeThrough(progressStream)

            const response = await fetch(this.uploadConfig.presignedUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': contentType,
                    'Content-Length': contentLength.toString(),
                },
                body: bodyWithProgress,
                duplex: 'half',
                signal: this.uploadAbortController.signal
            })

            if (response.ok) {
                this.log('Video streaming upload successful to Tigris!')
                try {
                    const key = this.store.get("licenseKey")
                    return await api('videos/ready', { key, id: this.uploadConfig.objectId })
                } catch (e) {
                    console.error('Error updating video:', e)
                    return { presignedUrl: null, id: null, hasError: true, message: "no_network" }
                }

            } else {
                const errorText = await response.text()
                console.error('Video streaming upload failed:', response.status, response.statusText, errorText)
                onProgress?.(-1)
                return { presignedUrl: null, id: null, hasError: true, message: "upload_failed" }
            }
        } catch (error) {
            if (error.name === 'AbortError' || this.uploadAbortController?.signal.aborted) {
                this.log('Upload cancelled by user')
                return { presignedUrl: null, id: null, hasError: true, message: "upload_cancelled" }
            }
            console.error('Error during streaming video upload process:', error)
            return { presignedUrl: null, id: null, hasError: true, message: "upload_error" }
        } finally {
            this.uploadAbortController = null
        }
    }

    log(text) {
        console.log(bold(`${magentaBright(bgMagenta("[Render]"))} ${text}`))
    }
}