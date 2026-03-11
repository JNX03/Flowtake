export const PRESET_JSON_VERSION = 1

export const v1 = {

    up(oldFormat) {
        // Create new format base
        const newFormat = {
            version: PRESET_JSON_VERSION,
            project: {},
            clipAnims: {},
            clickAnims: {},
            cursorTypeAnims: { isStatic: false },
            subtitleAnims: {},
            panAnims: {},
            zoomAnims: {},
            cameraZoomAnims: {},
            cursorCoords: {}
        }

        // Copy project-level properties
        const projectProps = [
            'background',
            'padding',
            'shadowAlpha',
            'cursorScale',
            'cursorFill',
            'cursorStroke',
            'cursorShadowAlpha',
            'webcamVideoScale',
            'webcamVideoBorderRadius',
            'borderRadius',
            'aspectRatio'
        ]

        projectProps.forEach(prop => {
            newFormat.project[prop] = oldFormat[prop]
        })

        newFormat.project.cameraVideoShadowAlpha = oldFormat.webcamVideoShadowAlpha
        newFormat.project.hasCameraVideoBackgroundBlur = oldFormat.hasWebcamVideoBackgroundBlur
        newFormat.project.cameraVideoBackgroundBlurAmount = oldFormat.webcamVideoBackgroundBlurAmount

        // Move and rename other properties
        newFormat.clipAnims = {
            playbackRate: oldFormat.videoSegmentPlaybackRate
        }

        newFormat.cursorTypeAnims = {
            isStatic: oldFormat.hasDefaultCursorType
        }

        newFormat.subtitleAnims = {
            backgroundColor: oldFormat.subtitlesBackgroundColor,
            textColor: oldFormat.subtitlesTextColor,
            position: oldFormat.subtitlesPosition,
            width: oldFormat.subtitlesMaxWidth,
            shadowAlpha: oldFormat.subtitlesShadowAlpha
        }

        newFormat.zoomAnims = {
            blurStrength: oldFormat.zoomBlurStrength,
            targetScale: oldFormat.zoomAnimTargetScale,
            intro: oldFormat.zoomAnimIntro,
            outro: oldFormat.zoomAnimOutro,
        }

        newFormat.cameraZoomAnims = {
            targetScale: oldFormat.webcamZoomAnimTargetScale
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

        oldFormat.hasDefaultCursorType = newFormat.cursorTypeAnims.isStatic

        oldFormat.subtitlesBackgroundColor = newFormat.subtitleAnims.backgroundColor
        oldFormat.subtitlesTextColor = newFormat.subtitleAnims.textColor
        oldFormat.subtitlesPosition = newFormat.subtitleAnims.position
        oldFormat.subtitlesMaxWidth = newFormat.subtitleAnims.width
        oldFormat.subtitlesShadowAlpha = newFormat.subtitleAnims.shadowAlpha

        oldFormat.zoomBlurStrength = newFormat.zoomAnims.blurStrength
        oldFormat.zoomAnimTargetScale = newFormat.zoomAnims.targetScale
        oldFormat.zoomAnimIntro = newFormat.zoomAnims.intro
        oldFormat.zoomAnimOutro = newFormat.zoomAnims.outro

        oldFormat.webcamZoomAnimTargetScale = newFormat.cameraZoomAnims.targetScale

        oldFormat.cursorAnimation = newFormat.cursorCoords.inertia
        oldFormat.cursorCutOff = newFormat.cursorCoords.cutOff
        oldFormat.isCursorLooping = newFormat.cursorCoords.isLoop
        oldFormat.cursorBlurStrength = newFormat.cursorCoords.blurStrength

        oldFormat.webcamVideoShadowAlpha = newFormat.project.cameraVideoShadowAlpha
        oldFormat.hasWebcamVideoBackgroundBlur = newFormat.project.hasCameraVideoBackgroundBlur
        oldFormat.webcamVideoBackgroundBlurAmount = newFormat.project.cameraVideoBackgroundBlurAmount

        // Remove version from down-migrated format
        delete oldFormat.version

        return oldFormat
    }
}
