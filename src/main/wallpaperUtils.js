import crypto from "crypto"
import { globby } from "globby"
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'path'
import slash from "slash"
import ffmpeg from "./ffmpeg"
import {
    backgroundFile,
    imageCacheDir,
    imageThumbnailCacheDir,
    wallpapersCacheDir,
    wallpapersDir,
    wallpapersThumbnailCacheDir
} from "./paths"

const THUMBNAIL_WIDTH = 200
const WALLPAPER_WIDTH = 1920

export const createWallpaperThumbnail = relativePath => {
    return scaleWidth(
        path.join(wallpapersDir, relativePath),
        path.join(wallpapersThumbnailCacheDir, relativePath),
        THUMBNAIL_WIDTH
    )
}

export const copyWallpaper = async relativePath => {
    const dir = path.join(wallpapersDir, relativePath)
    if (!dir.includes("Spotlight"))
        await copy(path.join(wallpapersDir, relativePath), path.join(wallpapersCacheDir, relativePath))
}

export const copyImageToCache = async (absolutePath, name) => {
    await copy(absolutePath, path.join(imageCacheDir, name))
}

export const addWallpaperToCache = async (background, projectId) => {
    const wallpapers = await globby("**/*.{jpg,jpeg,png,webp}", { cwd: slash.default(wallpapersDir) })
    if (!wallpapers.some(image => image === background.path)) {
        const file = `${crypto.randomUUID()}${path.extname(background.path)}`
        await copyImageToCache(backgroundFile(projectId), file)
        return { type: "image", path: file }
    }
    return background
}

export const addImageToCache = async (background, projectId) => {
    const cachedImages = await globby("**/*.{jpg,jpeg,png,webp}", { cwd: slash.default(imageCacheDir) })
    if (!cachedImages.some(image => image === background.path))
        await copyImageToCache(backgroundFile(projectId), background.path)
}

const copy = async (from, to) => {
    await mkdir(path.dirname(to), { recursive: true })
    await copyFile(path.normalize(from), path.normalize(to))
}

export const createImageThumbnail = relativePath => {
    return scaleWidth(
        path.join(imageCacheDir, relativePath),
        path.join(imageThumbnailCacheDir, relativePath),
        THUMBNAIL_WIDTH
    )
}

export const createBackgroundPng = async (fromPath, toPath) => {
    await ffmpeg([
        "-y",
        "-i", slash.default(fromPath),
        "-vf", `scale=${WALLPAPER_WIDTH}:-1`,
        "-update", "true",
        slash.default(toPath)
    ])
}

export const scaleWidth = async (input, output, width) => {
    await mkdir(path.dirname(output), { recursive: true })
    await ffmpeg([
        "-n",
        "-i", slash.default(input),
        "-vf", `scale=${width}:-1`,
        "-update", "true",
        slash.default(output)
    ])
    return output
}
