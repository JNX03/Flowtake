export const PROJECT_JSON_VERSION = 1

export const v1 = {

    up(oldFormat) {
        // Create new format base
        const newFormat = {
            version: PROJECT_JSON_VERSION,
            project: {},
            clipAnims: { entities: [] },
            clickAnims: { entities: [] },
            cursorTypeAnims: { entities: [], isStatic: false },
            subtitleAnims: { entities: [] },
            panAnims: { entities: [] },
            zoomAnims: { entities: [] },
            cameraZoomAnims: { entities: [] },
            cursorCoords: {}
        }

        // Copy project-level properties
        const projectProps = [
            'name',
            'id',
            'mouseEvents',
            'screenVideoDimensions',
            'videoDetails',
            'background',
            'padding',
            'shadowAlpha',
            'cursorScale',
            'cursorFill',
            'cursorStroke',
            'cursorShadowAlpha',
            'webcamVideoScale',
            'webcamVideoBorderRadius',
            'leftTrim',
            'rightTrim',
            'topTrim',
            'bottomTrim',
            'borderRadius',
            'aspectRatio'
        ]

        projectProps.forEach(prop => {
            newFormat.project[prop] = oldFormat[prop]
        })

        newFormat.project.hasCameraVideo = oldFormat.hasWebcamVideo
        newFormat.project.hasMicrophoneAudio = oldFormat.hasWebcamAudio
        newFormat.project.cameraVideoDimensions = oldFormat.webcamVideoDimensions
        newFormat.project.cameraVideoShadowAlpha = oldFormat.webcamVideoShadowAlpha
        newFormat.project.hasCameraVideoBackgroundBlur = oldFormat.hasWebcamVideoBackgroundBlur
        newFormat.project.cameraVideoBackgroundBlurAmount = oldFormat.webcamVideoBackgroundBlurAmount

        // Move and rename other properties
        newFormat.clipAnims = {
            playbackRate: oldFormat.videoSegmentPlaybackRate,
            entities: oldFormat.videoSegmentConfigs
        }

        newFormat.clickAnims.entities = oldFormat.clickAnimConfigs
        newFormat.cursorTypeAnims = {
            isStatic: oldFormat.hasDefaultCursorType,
            entities: oldFormat.cursorTypeAnimConfigs
        }

        newFormat.subtitleAnims = {
            transcript: oldFormat.transcript,
            backgroundColor: oldFormat.subtitlesBackgroundColor,
            textColor: oldFormat.subtitlesTextColor,
            position: oldFormat.subtitlesPosition,
            width: oldFormat.subtitlesMaxWidth,
            shadowAlpha: oldFormat.subtitlesShadowAlpha,
            entities: oldFormat.subtitleAnimConfigs
        }

        newFormat.panAnims.entities = oldFormat.panAnimConfigs

        newFormat.zoomAnims = {
            blurStrength: oldFormat.zoomBlurStrength,
            targetScale: oldFormat.zoomAnimTargetScale,
            intro: oldFormat.zoomAnimIntro,
            outro: oldFormat.zoomAnimOutro,
            entities: oldFormat.zoomAnimConfigs
        }

        newFormat.cameraZoomAnims = {
            targetScale: oldFormat.webcamZoomAnimTargetScale,
            entities: oldFormat.webcamZoomAnimConfigs ?? []
        }

        newFormat.cursorCoords = {
            inertia: oldFormat.cursorAnimation,
            cutOff: oldFormat.cursorCutOff,
            isLoop: oldFormat.isCursorLooping,
            blurStrength: oldFormat.cursorBlurStrength
        }

        return newFormat
    },

    down(newFormat) {
        // Validate version
        if (newFormat.version !== 1) {
            throw new Error(`Cannot downgrade version ${newFormat.version}`)
        }

        // Create old format base
        const oldFormat = { ...newFormat.project }

        // Reverse structural changes
        oldFormat.videoSegmentPlaybackRate = newFormat.clipAnims.playbackRate
        oldFormat.videoSegmentConfigs = newFormat.clipAnims.entities

        oldFormat.clickAnimConfigs = newFormat.clickAnims.entities

        oldFormat.hasDefaultCursorType = newFormat.cursorTypeAnims.isStatic
        oldFormat.cursorTypeAnimConfigs = newFormat.cursorTypeAnims.entities

        oldFormat.subtitleAnimConfigs = newFormat.subtitleAnims.entities
        oldFormat.transcript = newFormat.subtitleAnims.transcript
        oldFormat.subtitlesBackgroundColor = newFormat.subtitleAnims.backgroundColor
        oldFormat.subtitlesTextColor = newFormat.subtitleAnims.textColor
        oldFormat.subtitlesPosition = newFormat.subtitleAnims.position
        oldFormat.subtitlesMaxWidth = newFormat.subtitleAnims.width
        oldFormat.subtitlesShadowAlpha = newFormat.subtitleAnims.shadowAlpha

        oldFormat.panAnimConfigs = newFormat.panAnims.entities

        oldFormat.zoomBlurStrength = newFormat.zoomAnims.blurStrength
        oldFormat.zoomAnimTargetScale = newFormat.zoomAnims.targetScale
        oldFormat.zoomAnimIntro = newFormat.zoomAnims.intro
        oldFormat.zoomAnimOutro = newFormat.zoomAnims.outro
        oldFormat.zoomAnimConfigs = newFormat.zoomAnims.entities

        oldFormat.webcamZoomAnimTargetScale = newFormat.cameraZoomAnims.targetScale
        oldFormat.webcamZoomAnimConfigs = newFormat.cameraZoomAnims.entities.length > 0 ? newFormat.cameraZoomAnims.entities : null

        oldFormat.cursorAnimation = newFormat.cursorCoords.inertia
        oldFormat.cursorCutOff = newFormat.cursorCoords.cutOff
        oldFormat.isCursorLooping = newFormat.cursorCoords.isLoop
        oldFormat.cursorBlurStrength = newFormat.cursorCoords.blurStrength

        oldFormat.hasWebcamVideo = newFormat.project.hasCameraVideo
        oldFormat.hasWebcamAudio = newFormat.project.hasMicrophoneAudio
        oldFormat.webcamVideoDimensions = newFormat.project.cameraVideoDimensions
        oldFormat.webcamVideoShadowAlpha = newFormat.project.cameraVideoShadowAlpha
        oldFormat.hasWebcamVideoBackgroundBlur = newFormat.project.hasCameraVideoBackgroundBlur
        oldFormat.webcamVideoBackgroundBlurAmount = newFormat.project.cameraVideoBackgroundBlurAmount

        // Remove version from down-migrated format
        delete oldFormat.version

        return oldFormat
    }
}
