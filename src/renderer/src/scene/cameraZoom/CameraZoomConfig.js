import MouseEventAnimConfig from "../MouseEventAnimConfig"

export default class CameraZoomConfig extends MouseEventAnimConfig {
    constructor(args, defaultIntro, defaultOutro, defaultCameraZoomTargetScale) {
        super(args, defaultIntro, defaultOutro, defaultCameraZoomTargetScale, "cameraZoom")

        this.targetScale = args.targetScale ?? defaultCameraZoomTargetScale
    }
}