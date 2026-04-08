import AnimConfig from "../AnimConfig"

export default class SpatialConfig extends AnimConfig {
    constructor(args, defaultIntro, defaultOutro, defaultRotateX, defaultRotateY, defaultRotateZ,
        defaultPerspective, defaultCameraDistance, defaultEyeContactEnabled) {
        const intro = args.intro ?? defaultIntro
        const outro = args.outro ?? defaultOutro
        super({ ...args, intro, outro }, "spatial")
        this.rotateX = args.rotateX ?? defaultRotateX
        this.rotateY = args.rotateY ?? defaultRotateY
        this.rotateZ = args.rotateZ ?? defaultRotateZ
        this.perspective = args.perspective ?? defaultPerspective
        this.cameraDistance = args.cameraDistance ?? defaultCameraDistance
        this.eyeContactEnabled = args.eyeContactEnabled ?? defaultEyeContactEnabled
        this.easing = args.easing ?? "expOut"
    }
}
