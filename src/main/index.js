import {
  electronApp,
  is,
  optimizer
} from "@electron-toolkit/utils"
import * as Sentry from '@sentry/electron/main'
import crypto from 'crypto'
import {
  app,
  BrowserWindow,
  ipcMain,
  protocol
} from 'electron'
import log from 'electron-log/main'
import Store from 'electron-store'
import {
  mkdir,
  open,
  readFile,
  stat
} from "fs/promises"
import mime from 'mime-types'
import path from "path"
import {
  bgGreenBright,
  bgMagenta,
  bgWhite,
  bold,
  gray,
  greenBright,
  magentaBright,
  whiteBright,
  yellow
} from "yoctocolors-cjs"
import {
  CAMERA_VIDEO_URL,
  MICROPHONE_AUDIO_URL,
  SCREEN_VIDEO_URL,
  VIDEO_SCHEME
} from "../helpers"
import AreaPickerWindow from "./areaPickerWindow/AreaPickerWindow"
import ExporterWindow from './exporterWindow/ExporterWindow'
import {
  checkPermissions,
  getMachineId
} from "./helpers"
import License from "./mainWindow/License"
import MainWindow from './mainWindow/MainWindow'
import NoteWindow from "./mainWindow/NoteWindow"
import {
  backgroundFile,
  cameraVideoFile,
  capturePreviewFile,
  getPath,
  oldProjectDir,
  projectsDir,
  projectTempDir,
  renderBackgroundFile,
  screenVideoFile,
  tempDir,
  wallpapersCacheDir,
  wallpapersThumbnailCacheDir
} from "./paths"
import RecordWindow from './recordWindow/RecordWindow'
import Render from "./Render"
import WindowPickerWindow from "./windowPickerWindow/WindowPickerWindow"

// TODO: switch to ESM once it works with bytenode. 
// With type: module in package.json top-level await works => can remove whenready.then() again
// once esm works, upgrade electron-store

// Initialize Sentry before any app events can fire
const store = new Store({
  defaults: {
    projects: {},
    presets: {},
    isIssueReportingEnabled: true,
    videoSources: null,
    audioSources: null,
    defaultVideoSource: null,
    defaultAudioSource: null,
    defaultSystemAudioSource: null,
    screenFps: 30,
    backgroundGradients: [
      { color1: '#6C5CE7', color2: '#E84393', color3: '#00CEC9', direction: { from: { x: 0, y: 1 }, to: { x: 0, y: 0 } }, id: `gradient-${crypto.randomUUID()}` },
      { color1: '#55efc4', color2: '#00CEC9', color3: '#6C5CE7', direction: { from: { x: 1, y: 0 }, to: { x: 0, y: 1 } }, id: `gradient-${crypto.randomUUID()}` },
      { color1: '#E84393', color2: '#6C5CE7', color3: '#0f0f23', direction: { from: { x: 0, y: 1 }, to: { x: 1, y: 0 } }, id: `gradient-${crypto.randomUUID()}` },
      { color1: '#00CEC9', color2: '#55efc4', color3: '#6C5CE7', direction: { from: { x: 0, y: 1 }, to: { x: 0, y: 0 } }, id: `gradient-${crypto.randomUUID()}` }
    ],
    exportDirectory: path.join(app.getPath("videos"), "Flowtake"),
    defaultExportFps: 60,
    defaultExportQuality: "high",
    defaultExportResolution: {
      "16x9": "1920x1080",
      "9x16": "1080x1920",
      "1x1": "1080x1080"
    },
    mainWindowSize: {
      width: 1000,
      height: 600
    },
    mainWindowPosition: {
      x: null,
      y: null
    },
    isMainWindowMaximized: false
  }
})

const isSentryEnabled = !is.dev && store.get("isIssueReportingEnabled")

// Initialize Sentry synchronously before any app events
if (isSentryEnabled) {
  Sentry.init({
    dsn: 'https://cf98c96b65ec8c4c15d73113a28c5d2e@o4508739475931136.ingest.de.sentry.io/4508739479142480',
    _experiments: { enableLogs: true },
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["log", "error", "warn"] }),
    ]
  })

  // Set machine ID asynchronously after Sentry is initialized
  const setSentryMachineId = async () => {
    const id = await getMachineId()
    console.log(bold(`${whiteBright(bgWhite("[Machine]"))} ${gray(id)}`))
    Sentry.setContext("machine", { id })
    // TODO: if a project is open, attach project.json to sentry errors
  }

  setSentryMachineId()
}

// Optional, initialize the logger for any renderer process
log.initialize()

Object.assign(console, log.functions)

console.log(bold(yellow(`${magentaBright(bgMagenta("[Flowtake]"))} version ${app.getVersion()} (${is.dev ? "dev" : "prod"})`)))

protocol.registerSchemesAsPrivileged([{ scheme: VIDEO_SCHEME, privileges: { stream: true } }])
protocol.registerSchemesAsPrivileged([{
  scheme: 'image',
  privileges: { secure: true, corsEnabled: true, supportFetchAPI: true }
}])

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit()
}

let saveZipPromise = null
const setSaveZipPromise = promise => saveZipPromise = promise
const getSaveZipPromise = () => saveZipPromise

let projectId = null
const license = new License()

const noteWindows = []

const onCloseMainWindow = () => noteWindows.forEach(w => w.close())
const onCloseExporterWindow = () => { mainWindow.setProgressBar.call(mainWindow, -1) }
const mainWindow = new MainWindow(setSaveZipPromise, getSaveZipPromise, onCloseMainWindow)
const recordWindow = new RecordWindow(setSaveZipPromise, getSaveZipPromise)
let windowPickerWindow = null
let areaPickerWindow = null
const exporterWindow = new ExporterWindow(setSaveZipPromise, getSaveZipPromise, onCloseExporterWindow)
mainWindow.exporterWindow = exporterWindow
exporterWindow.mainWindow = mainWindow

const setProjectId = async (id = null) => {
  projectId = id
  if (id) {
    await mkdir(projectTempDir(id), { recursive: true })
    console.log(bold(yellow(`${greenBright(bgGreenBright("[Project]"))}\nid:\t${gray(id)}\ntemp:\t${gray(projectTempDir(id))}\nzip:\t${gray(store.get(`projects.${id}.path`))}\nold:\t${gray(oldProjectDir(id))}`)))
  }

  mainWindow.projectId = id
  exporterWindow.projectId = id
  recordWindow.projectId = id

  if (!id) closeAllFiles()
}

const renders = {}

const fileHandles = {}

const files = {
  [SCREEN_VIDEO_URL]: null,
  [CAMERA_VIDEO_URL]: null,
  [MICROPHONE_AUDIO_URL]: null
}

const closeFile = async url => {
  const fileEntry = files[url]
  if (!fileEntry) return

  try {
    // Close the file descriptor if it's still open
    if (fileEntry.file?.fd !== undefined && fileEntry.file?.fd !== -1) {
      await fileEntry.file.close()
    }
  } catch (err) {
    console.error(`Error closing file descriptor for ${url}:`, err)
  } finally {
    // Remove from tracking regardless of success
    files[url] = null
  }
}

const closeAllFiles = async () => {
  await closeFile(SCREEN_VIDEO_URL)
  await closeFile(CAMERA_VIDEO_URL)
  await closeFile(MICROPHONE_AUDIO_URL)
}

const areObjectsEqual = (obj1, obj2) => {
  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)

  // Check if the number of keys is the same
  if (keys1.length !== keys2.length) return false

  // Check if all keys and values are the same
  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false
  }

  return true
}

app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling')

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.flowtake')

  // Default open or close DevTools by F12 in development
  // and  ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await mkdir(projectsDir, { recursive: true })
  await mkdir(tempDir, { recursive: true })

  ipcMain.handle('get-is-sentry-enabled', () => isSentryEnabled)
  ipcMain.handle('store-get', (_event, key) => store.get(key))
  ipcMain.handle('store-get-paginated', (_event, key, requestedPage, itemsPerPage) => {
    const allItems = Object.values(store.get(key))
      .filter(({ lastSaved }) => lastSaved)
      .sort((a, b) => a.lastSaved > b.lastSaved ? -1 : 1)
    const totalPages = Math.ceil(allItems.length / itemsPerPage)
    const page = Math.min(requestedPage, totalPages)
    const items = allItems.filter((_preset, i) => i >= page * itemsPerPage && i < (page + 1) * itemsPerPage)
    return { items, page, totalPages }
  })
  ipcMain.handle('store-set', (_event, key, value) => store.set(key, value))
  ipcMain.handle('check-permissions', () => checkPermissions())

  // Main
  ipcMain.handle('get-projects', (_event, page) => mainWindow.getProjects.call(mainWindow, page))
  ipcMain.handle('find-project', () => mainWindow.findProject.call(mainWindow))
  ipcMain.handle('save-json', (_event, json) => mainWindow.saveProjectJson.call(mainWindow, json))
  ipcMain.handle('open-project', async (_event, id) => {
    await setProjectId(id)
    if (!id) return null
    const success = await mainWindow.unzipProject(setProjectId)
    if (!success) {
      store.delete(`projects.${id}`)
      return null
    }
    const projectJson = await mainWindow.getProject()
    return projectJson
  })
  ipcMain.handle('close-project', async () => {
    await mainWindow.zipProject()
    await mainWindow.cleanUpProjectTempFolder()
    await setProjectId(null)
  })
  ipcMain.handle('open-project-dir', (_event, projectId) => mainWindow.openProjectDir(projectId))
  ipcMain.handle('open-logs-dir', () => mainWindow.openLogsDir())
  ipcMain.handle('delete-project', async (_event, projectId) => {
    await closeAllFiles()
    return mainWindow.deleteProject(projectId)
  })
  ipcMain.handle('update-background', (_event, type, relativePath) => mainWindow.updateBackground.call(mainWindow, type, relativePath))
  ipcMain.handle('get-wallpapers', mainWindow.getWallpapers.bind(mainWindow))
  ipcMain.handle('check-for-updates', async () => {
    await license.promise
    if (license.current.isReceivingUpdates) mainWindow.checkForUpdates()
  })
  ipcMain.handle('install-update', async () => {
    await license.promise
    if (license.current.isReceivingUpdates) mainWindow.installUpdate()
  })
  ipcMain.handle('get-version', mainWindow.getVersion)
  ipcMain.handle('get-camera-video-buffer', mainWindow.getCameraVideoBuffer.bind(mainWindow))
  ipcMain.handle('sync-background', (_event, background) => mainWindow.syncBackground.call(mainWindow, background))
  ipcMain.handle('get-background-images', mainWindow.getBackgroundImages.bind(mainWindow))
  ipcMain.handle('choose-background-image', mainWindow.chooseBackgroundImage.bind(mainWindow))
  ipcMain.handle('get-encoders', (_event, force) => mainWindow.getEncoders(force))
  ipcMain.handle('set-encoder', (_event, encoder) => mainWindow.setEncoder(encoder))
  ipcMain.handle('get-capturers', (_event, force) => mainWindow.getCapturers(force))
  ipcMain.handle('set-capturer', (_event, capturer) => mainWindow.setCapturer(capturer))
  ipcMain.handle('add-note', () => {
    const onClose = () => {
      const index = noteWindows.findIndex(window => window === noteWindow)
      if (index !== -1) noteWindows.splice(index, 1)
    }
    const noteWindow = new NoteWindow(onClose)
    noteWindow.create(mainWindow.window)
    noteWindows.push(noteWindow)
  })
  ipcMain.handle('open-window-picker', async () => {
    windowPickerWindow = new WindowPickerWindow()
    windowPickerWindow.create()
    mainWindow.window.hide()
  })
  ipcMain.handle('open-area-picker', async () => {
    areaPickerWindow = new AreaPickerWindow()
    areaPickerWindow.create()
    mainWindow.window.hide()
  })
  ipcMain.handle('get-license', async () => {
    await license.promise
    mainWindow.send("license", [license.current])
  })
  ipcMain.handle('activate', async (_event, licenseKey) => {
    await license.check(licenseKey)
    mainWindow.send("license", [license.current])
    return license.current
  })
  ipcMain.handle('save-preset', (_event, preset) => mainWindow.savePreset.call(mainWindow, preset))
  ipcMain.handle('get-presets', (_event, page) => mainWindow.getPresets.call(mainWindow, page))
  ipcMain.handle('delete-preset', (_event, id) => mainWindow.deletePreset.call(mainWindow, id))
  ipcMain.handle('open-preset-dir', (_event, id) => mainWindow.openPresetDir.call(mainWindow, id))
  ipcMain.handle('import-preset', () => mainWindow.importPreset.call(mainWindow))
  ipcMain.handle('get-preset', (_event, id) => mainWindow.getPreset.call(mainWindow, id))
  ipcMain.handle('get-machine-id', getMachineId)
  ipcMain.handle('close-window', () => mainWindow.close.call(mainWindow))
  ipcMain.handle('destroy', () => { if (mainWindow.isClosing) mainWindow.destroy.call(mainWindow) })
  ipcMain.handle('choose-export-directory', () => mainWindow.chooseExportDirectory.call(mainWindow))

  // Mediabunny file operations
  ipcMain.handle('open', async (_event, type, flag, args) => {
    const filePath = getPath(type, args)
    const fh = await open(filePath, flag)
    const id = `fh-${crypto.randomUUID()}`
    fileHandles[id] = fh
    return id
  })
  ipcMain.handle('get-size', async (_event, fhId) => {
    const fh = fileHandles[fhId]
    if (!fh) throw new Error(`File handle not found: ${fhId}`)
    const { size } = await fh.stat()
    return size
  })
  ipcMain.handle('read', async (_event, fhId, start, end) => {
    const fh = fileHandles[fhId]
    if (!fh) throw new Error(`File handle not found: ${fhId}`)
    const buffer = Buffer.alloc(end - start)
    await fh.read(buffer, 0, end - start, start)
    return buffer
  })
  ipcMain.handle('write', async (_event, fhId, data, position) => {
    const fh = fileHandles[fhId]
    if (!fh) throw new Error(`File handle not found: ${fhId}`)
    await fh.write(data, 0, data.byteLength, position)
  })
  ipcMain.handle('close', async (_event, fhId) => {
    const fh = fileHandles[fhId]
    if (!fh) throw new Error(`File handle not found: ${fhId}`)
    await fh.close()
    delete fileHandles[fhId]
  })

  // Window Picker
  ipcMain.handle('close-window-picker-window', () => {
    windowPickerWindow.close.call(windowPickerWindow)
    windowPickerWindow = null
    mainWindow.window.show()
  })
  ipcMain.handle('select-window', (_event, window) => {
    windowPickerWindow.close.call(windowPickerWindow)
    windowPickerWindow = null
    mainWindow.window.show()
    mainWindow.send("window-selected", [window])
  })
  ipcMain.handle('get-windows', () => windowPickerWindow.getWindows())

  // Area Picker
  ipcMain.handle('close-area-picker-window', () => {
    areaPickerWindow.close.call(areaPickerWindow)
    areaPickerWindow = null
    mainWindow.window.show()
  })
  ipcMain.handle('select-area', async (_event, selectedArea) => {
    const area = await areaPickerWindow.selectArea.call(areaPickerWindow, selectedArea)
    areaPickerWindow.close.call(areaPickerWindow)
    areaPickerWindow = null
    mainWindow.window.show()
    mainWindow.send("area-selected", [area])
  })

  // Recorder
  ipcMain.handle('get-camera-mic-config', () => recordWindow.getCameraMicConfig.call(recordWindow))
  ipcMain.handle('init-recording', (_event, source, cameraMicConfig, systemAudio) => recordWindow.initRecording.call(recordWindow, source, cameraMicConfig, systemAudio, mainWindow))
  ipcMain.handle('start-recording', () => recordWindow.startRecording.call(recordWindow, mainWindow, noteWindows))
  ipcMain.handle('pause-recording', (_event, pause) => recordWindow.pauseRecording.call(recordWindow, pause))
  ipcMain.handle('stop-recording', () => recordWindow.stopRecording.call(recordWindow, mainWindow, noteWindows))
  ipcMain.handle('reset-recording', () => recordWindow.resetRecording.call(recordWindow))
  ipcMain.handle('cancel-recording', (_event, error) => recordWindow.cancelRecording.call(recordWindow, mainWindow, noteWindows, error))
  ipcMain.handle('get-source-screenshot', async (_event, source) => await mainWindow.getSourceScreenshot.call(mainWindow, source))
  ipcMain.handle('init-camera-file', async () => await recordWindow.initCameraVideoFile.call(recordWindow))
  ipcMain.handle('enqueue-camera-chunk', async (_event, chunk) => recordWindow.enqueueCameraVideoChunk.call(recordWindow, chunk))
  ipcMain.handle('finalize-camera-file', async () => await recordWindow.finalizeCameraVideoFile.call(recordWindow))

  // Exporter
  ipcMain.handle('send-notification', (_event, renderId) => renders[renderId].sendNotification(mainWindow, exporterWindow))
  ipcMain.handle('get-project-for-export', () => exporterWindow.getProject.call(exporterWindow, setProjectId))
  ipcMain.handle('get-project-state', () => exporterWindow.getState())
  ipcMain.handle('get-open-section', () => exporterWindow.getOpenSection())
  ipcMain.handle('open-export-window', async (_event, state, section) => {
    await license.promise
    if (license.current.isValid) exporterWindow.create(mainWindow.window, state, section)
  })
  ipcMain.handle('close-export-window', () => exporterWindow.close.call(exporterWindow))
  ipcMain.handle('clear-pending-renders', () => exporterWindow.send("clear-pending-renders"))
  ipcMain.handle('cancel-running-render', () => exporterWindow.send("cancel-running-render"))
  ipcMain.handle('process-audio', async (_event, renderId) => renders[renderId].processAudio())
  ipcMain.handle('add-audio', async (_event, renderId) => renders[renderId].addAudio())
  ipcMain.handle('queue-render', async (_event, render) => {
    renders[render.id] = new Render(render)
    await renders[render.id].init()
  })
  ipcMain.handle('set-progress-bar', (_event, progress) => { if (!exporterWindow.isCancelled) mainWindow.setProgressBar.call(mainWindow, progress) })
  ipcMain.handle('set-close-mode', (_event, mode) => exporterWindow.setCloseMode.call(exporterWindow, mode))
  ipcMain.handle('close-exporter-window', () => exporterWindow.close())
  ipcMain.handle('clean-up-temp-folder', (_event, renderId) => renders[renderId].cleanUpRenderTempFolder())
  ipcMain.handle('copy-to-videos-folder', async (_event, renderId) => await renders[renderId].copyToVideosFolder())
  ipcMain.handle('reveal-video-in-file-explorer', (_event, renderId) => renders[renderId].openFolder())
  ipcMain.handle('play-video', (_event, renderId) => renders[renderId].playVideo())
  ipcMain.handle('set-has-rendering-or-completed-renders', (_event, hasRenders) => exporterWindow.setHasRenderingOrCompletedRenders.call(exporterWindow, hasRenders))
  ipcMain.handle('cancel-render', (_event, renderId) => renders[renderId].cancel())
  ipcMain.handle('get-shareable-url', async (_event, title) => {
    await license.promise
    if (license.current.isReceivingUpdates) return { id: null, presignedUrl: null, ...await exporterWindow.getShareableUrl(title) }
    else return {}
  })
  ipcMain.handle('upload', async (_event, renderId) => await renders[renderId].upload(progress => exporterWindow.send("upload-progress", [progress])))

  protocol.handle(VIDEO_SCHEME, async ({ url, headers }) => {

    if (!mainWindow.projectId) return create404Response()

    const videoUrl = url.split("?")[0]
    const absolutePath = getAbsolutePath(videoUrl)

    const { size: fileSize } = await stat(absolutePath)

    const range = headers.get('Range')

    const { startByte, endByte, isValidRange } = parseRange(range, fileSize)

    let type = mime.lookup(absolutePath)
    if (url === MICROPHONE_AUDIO_URL) type = type.replace("video", "audio")

    if (!isValidRange) return create416Response(fileSize, type)

    // https://github.com/electron/electron/issues/38749
    // https://github.com/laurent22/joplin/blob/e607a7376f8403082e87087a3e07f37cb2e1ce76/packages/app-desktop/utils/customProtocols/handleCustomProtocols.ts


    const fileHandle = await getFileHandle(url, absolutePath)

    // Create stream with auto-cleanup
    const nodeStream = fileHandle.file.createReadStream({
      start: startByte,
      end: endByte
    })

    // Convert to Web Stream with proper cleanup

    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(chunk))
        nodeStream.on('end', () => controller.close())
        nodeStream.on('error', (err) => controller.error(err))
      },
      cancel() {
        nodeStream.destroy() // Cleanup Node stream when Web Stream cancels
      }
    })

    return new Response(webStream, {
      headers: createRangeHeaders(startByte, endByte, fileSize, type),
      status: 206
    })
  })

  protocol.handle('image', async request => {
    const { searchParams, host: type } = new URL(request.url)

    switch (type) {
      case "source-screenshot":
        return await createImageResponse(capturePreviewFile)
      case "wallpaper": {
        const p = searchParams.get("path")
        const thumbnail = searchParams.get("thumbnail") === "true" ? true : false
        const dir = thumbnail ? wallpapersThumbnailCacheDir : wallpapersCacheDir
        return await createImageResponse(path.join(dir, p))
      }
      case "background": {
        const renderId = searchParams.get('renderId')
        const p = renderId === "null" ? backgroundFile(projectId) : renderBackgroundFile(renderId)
        return await createImageResponse(p)
      }
      default:
        return create404Response()
    }
  })

  const getFileHandle = async (url, absolutePath) => {
    const { searchParams } = new URL(url)
    const params = Object.fromEntries(searchParams.entries())

    if (!files[url] || files[url]?.file.fd === -1 ||
      !areObjectsEqual(files[url].params, params)) {
      await closeFile(url)
      files[url] = {
        file: await open(absolutePath, "r"),
        params,
        lastUsed: Date.now()
      }
    }
    return files[url]
  }

  const parseRange = (range, fileSize) => {
    const startByte = Number(range.match(/(\d+)-/)?.[1] || '0')
    const endByte = Number(range.match(/-(\d+)/)?.[1] || `${fileSize - 1}`)

    return { startByte, endByte, isValidRange: endByte <= fileSize && startByte >= 0 && startByte < endByte }
  }

  const createRangeHeaders = (start, end, total, type) => {
    return new Headers({
      'Accept-Ranges': 'bytes',
      'Content-Type': type,
      'Content-Length': `${end - start + 1}`,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length'
    })
  }

  const createImageResponse = async filePath => {
    return new Response(await readFile(filePath), {
      headers: {
        'Content-Type': mime.lookup(filePath),
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  const create404Response = () => {
    return new Response('The requested resource is no longer available.', {
      headers: new Headers({
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      }),
      status: 404
    })
  }

  const create416Response = (total, type) => {
    return new Response('Unsupported range.', {
      headers: new Headers({
        'Accept-Ranges': 'bytes',
        'Content-Type': type,
        'Content-Range': `bytes */${total}`,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Range'
      }),
      status: 416
    })
  }

  const getAbsolutePath = (url) => {
    switch (url) {
      case SCREEN_VIDEO_URL: return screenVideoFile(mainWindow.projectId)
      case CAMERA_VIDEO_URL: return cameraVideoFile(mainWindow.projectId)
      case MICROPHONE_AUDIO_URL: return cameraVideoFile(mainWindow.projectId)
    }
  }

  if (is.dev) await mainWindow.loadExtensions()
  mainWindow.create()

  app.on('before-quit', () => {
    try {
      recordWindow.mouseEventRecorder.stop()
    } catch (error) {
      console.error('Error pausing mouse events in before-quit:', error)
    }
  })

  process.on('exit', () => {
    try {
      recordWindow.mouseEventRecorder?.stop()
    } catch (e) {
      console.error('Error pausing mouse events in exit:', e)
    }
  })


  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow.create()
    }
  })

  // In this file you can include the rest of your app's specific main process
  // code. You can also put them in separate files and import them here.

})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
