import { is } from "@electron-toolkit/utils"
import * as Sentry from '@sentry/electron/main'
import crypto from 'crypto'
import Store from "electron-store"
import {
    access,
    constants,
    mkdir,
    rmdir,
    unlink,
    writeFile
} from 'fs/promises'
import http from 'http'
import mime from 'mime-types'
import { machineId } from "node-machine-id"
import { readFile } from 'node:fs/promises'
import path from 'path'
import ahkPath from "../../resources/AutoHotkey.exe?asset"
import ffmpegPath from "../../resources/ffmpeg.exe?asset"
import {
    tempDir,
    userData,
    wallpapersDir
} from './paths'

export const openFile = async path => {
    const type = mime.lookup(path)
    try {
        const buffer = await readFile(path)
        return { buffer, type, error: null, errorMessage: null }
    } catch (e) {
        if (e.code === "ENOENT") return { data: null, type, error: "FileNotFoundError", errorMessage: "File not found" }
        else {
            console.error(e)
            Sentry.captureException(e)
            return { data: null, type, error: "UnknownError", errorMessage: "Unknown error opening file" }
        }
    }
}

export const openJson = async path => {
    try {
        const json = await readFile(path, { encoding: "utf8" })
        const data = JSON.parse(json)
        return { data, error: null, errorMessage: null }
    } catch (e) {
        if (e.code === "ENOENT") return { data: null, error: "FileNotFoundError", errorMessage: "File not found" }
        else if (e instanceof SyntaxError) return { data: null, error: "FileInvalidError", errorMessage: "File is invalid" }
        else {
            console.error(e)
            Sentry.captureException(e)
            return { data: null, error: "UnknownError", errorMessage: "Unknown error opening file" }
        }
    }
}

export const getMachineId = async () => {
    const store = new Store()
    const hasId = store.has("machineId")
    if (!hasId) {
        let id = null
        try {
            id = await machineId()
        } catch (e) {
            console.error("Error getting machine id", e)
            id = crypto.randomUUID()
        } finally {
            store.set("machineId", id)
        }
    }
    return store.get("machineId")
}

export const api = (url, body) => {
    return is.dev ? apiDev(url, body) : apiProd(url, body)
}

const apiProd = async (url, body) => {
    const res = await fetch(`https://getflowtake.com/api/${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    return await res.json()
}

const apiDev = async (url, body) => {
    const postData = JSON.stringify(body)

    const options = {
        hostname: '127.0.0.1',
        port: 4000,
        path: `/api/${url}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }

    return new Promise((resolve, reject) => {
        const req = http.request(options, res => {
            let data = ''

            res.on('data', chunk => data += chunk)

            res.on('end', () => {
                try {
                    resolve(JSON.parse(data))
                } catch (e) {
                    console.error('Error parsing response:', e)
                    reject()
                }
            })
        })

        req.on('error', reject)

        req.write(postData)
        req.end()
    })
}

// Helper function: Check if a directory can be created and removed in a given path
const canCreateDirectory = async (parentPath) => {
    const testDirName = `.flowtake-test-dir-${crypto.randomUUID()}`
    const testDir = path.join(parentPath, testDirName)

    try {
        await mkdir(testDir, { recursive: true })
        await rmdir(testDir)
        return true
    } catch {
        return false
    }
}

// Helper function: Check if a file can be created and removed in a given path
export const canCreateFile = async (parentPath) => {
    const testFileName = `.flowtake-test-file-${crypto.randomUUID()}.txt`
    const testFile = path.join(parentPath, testFileName)

    try {
        await writeFile(testFile, 'test data')
        await unlink(testFile)
        return true
    } catch {
        return false
    }
}

// Helper function: Check if a given file path has execute permissions
const hasExecutePermission = async (filePath) => {
    try {
        await access(filePath, constants.X_OK)
        return true
    } catch {
        return false
    }
}

// Helper function: Check if a path has read permissions
const hasReadPermission = async (filePath) => {
    try {
        await access(filePath, constants.R_OK)
        return true
    } catch {
        return false
    }
}

// Check permissions for all critical application paths
export const checkPermissions = async () => {
    const store = new Store()
    const exportDir = store.get("exportDirectory")

    const results = []

    // Export Directory - create file
    const exportDirCreateFile = await canCreateFile(exportDir)
    results.push({
        path: exportDir,
        permission: 'create file',
        hasPermission: exportDirCreateFile,
        label: 'Export Directory'
    })

    // Temp Directory - create folder
    const tempDirCreateFolder = await canCreateDirectory(tempDir)
    results.push({
        path: tempDir,
        permission: 'create folder',
        hasPermission: tempDirCreateFolder,
        label: 'Temp Directory'
    })

    // Temp Directory - create file
    const tempDirCreateFile = await canCreateFile(tempDir)
    results.push({
        path: tempDir,
        permission: 'create file',
        hasPermission: tempDirCreateFile,
        label: 'Temp Directory'
    })

    // User Data - create folder
    const userDataCreateFolder = await canCreateDirectory(userData)
    results.push({
        path: userData,
        permission: 'create folder',
        hasPermission: userDataCreateFolder,
        label: 'User Data'
    })

    // User Data - create file
    const userDataCreateFile = await canCreateFile(userData)
    results.push({
        path: userData,
        permission: 'create file',
        hasPermission: userDataCreateFile,
        label: 'User Data'
    })

    // Wallpapers Directory - read
    const wallpapersDirRead = await hasReadPermission(wallpapersDir)
    results.push({
        path: wallpapersDir,
        permission: 'read',
        hasPermission: wallpapersDirRead,
        label: 'Wallpapers Directory'
    })

    // FFmpeg - execute
    const ffmpegExecute = await hasExecutePermission(ffmpegPath)
    results.push({
        path: ffmpegPath,
        permission: 'execute',
        hasPermission: ffmpegExecute,
        label: 'Internal Resource 1'
    })

    // AHK - execute
    const ahkExecute = await hasExecutePermission(ahkPath)
    results.push({
        path: ahkPath,
        permission: 'execute',
        hasPermission: ahkExecute,
        label: 'Internal Resource 2'
    })

    console.log("Permissions", results)

    return results
}