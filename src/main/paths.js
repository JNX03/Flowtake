import { app } from 'electron'
import path from 'path'
import {
    PROJECT_CAMERA_VIDEO,
    PROJECT_SCREEN_VIDEO,
    RECORDING_CAMERA_VIDEO,
    RECORDING_SCREEN_VIDEO,
    RECORDING_UNCORRECTED_CAMERA_VIDEO,
    RENDER_CAMERA_VIDEO,
    RENDER_OUTPUT_VIDEO,
    RENDER_SCREEN_VIDEO
} from "../helpers"

export const userData = app.getPath("userData")
export const tempDir = path.join(app.getPath("temp"), "flowtake")
export const oldProjectsPath = "flowtake_projects"
export const oldProjectsDir = path.join(app.getPath("appData"), oldProjectsPath)
export const projectsDir = path.join(userData, "projects")
export const projectsTempDir = path.join(tempDir, "projects")
export const recordingsTempDir = path.join(tempDir, "recordings")
export const rendersTempDir = path.join(tempDir, "renders")
export const presetsPath = path.join(userData, "presets")
export const screenVideoFileName = "screen.mp4"
const cameraVideoUncorrectedFileName = "webcam_uncorrected.webm"
export const cameraVideoFileName = "webcam.webm"
const renderedVideoFileName = "rendered.mp4"
export const renderedVideoWithAudioFileName = "video.mp4"
export const projectJsonFileName = "project.json"
export const backgroundFileName = "background.png"
export const capturePreviewFileName = "capturePreview.jpg"

export const wallpapersDir = path.join('C:', 'Windows', 'Web', 'Wallpaper')
export const wallpapersThumbnailCacheDir = path.join(tempDir, "backgrounds", "thumbnails", "wallpapers")
export const wallpapersCacheDir = path.join(userData, "backgrounds", "wallpapers")
export const imageThumbnailCacheDir = path.join(tempDir, "backgrounds", "thumbnails", "images")
export const imageCacheDir = path.join(userData, "backgrounds", "images")

export const oldProjectDir = projectId => path.join(oldProjectsDir, projectId)
export const projectTempDir = projectId => path.join(projectsTempDir, projectId)
export const renderTempDir = projectId => path.join(rendersTempDir, projectId)
export const recordingTempDir = recordingId => path.join(recordingsTempDir, recordingId)
export const screenVideoFile = projectId => path.join(projectTempDir(projectId), screenVideoFileName)
export const renderScreenVideoFile = renderId => path.join(renderTempDir(renderId), screenVideoFileName)
export const recordingScreenVideoFile = recordingId => path.join(recordingTempDir(recordingId), screenVideoFileName)
export const cameraVideoFile = projectId => path.join(projectTempDir(projectId), cameraVideoFileName)
export const renderCameraVideoFile = renderId => path.join(renderTempDir(renderId), cameraVideoFileName)
export const recordingCameraVideoFile = recordingId => path.join(recordingTempDir(recordingId), cameraVideoFileName)
export const recordingUncorrectedCameraVideoFile = recordingId => path.join(recordingTempDir(recordingId), cameraVideoUncorrectedFileName)
export const renderedVideoFile = renderId => path.join(renderTempDir(renderId), renderedVideoFileName)
export const renderedVideoWithAudioFile = projectId => path.join(renderTempDir(projectId), renderedVideoWithAudioFileName)
export const projectJsonFile = projectId => path.join(projectTempDir(projectId), projectJsonFileName)
export const recordingProjectJsonFile = recordingId => path.join(recordingTempDir(recordingId), projectJsonFileName)
export const presetFile = presetId => path.join(presetsPath, `${presetId}.json`)
export const backgroundFile = projectId => path.join(projectTempDir(projectId), backgroundFileName)
export const renderBackgroundFile = renderId => path.join(renderTempDir(renderId), backgroundFileName)
export const capturePreviewFile = path.join(tempDir, capturePreviewFileName)

export const getPath = (type, args) => {
    switch (type) {
        case RENDER_SCREEN_VIDEO:
            return renderScreenVideoFile(args.renderId)
        case RENDER_CAMERA_VIDEO:
            return renderCameraVideoFile(args.renderId)
        case RENDER_OUTPUT_VIDEO:
            return renderedVideoFile(args.renderId)
        case PROJECT_SCREEN_VIDEO:
            return screenVideoFile(args.projectId)
        case PROJECT_CAMERA_VIDEO:
            return cameraVideoFile(args.projectId)
        case RECORDING_UNCORRECTED_CAMERA_VIDEO:
            return recordingUncorrectedCameraVideoFile(args.recordingId)
        case RECORDING_SCREEN_VIDEO:
            return recordingScreenVideoFile(args.recordingId)
        case RECORDING_CAMERA_VIDEO:
            return recordingCameraVideoFile(args.recordingId)
    }
}