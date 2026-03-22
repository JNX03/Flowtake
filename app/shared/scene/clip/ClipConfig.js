import {
    MODE_CAMERA_OVERLAY,
    MODE_SIDE_BY_SIDE
} from "../../constants"
import {
    CAMERA_OVERLAY_DEFAULT_CONFIG,
    SIDE_BY_SIDE_DEFAULT_CONFIG
} from "../../redux/clipSlice"
import AnimConfig from "../AnimConfig"

export default class ClipConfig extends AnimConfig {

    constructor(args, defaultPlaybackRate, defaultLayout, defaultMicrophoneAudioVolume, defaultSystemAudioVolume,
        crypto = self.crypto) {

        const intro = Math.min(2000, args.end - args.start)
        super({ intro, ...args }, "clip", crypto)
        this.playbackRate = args.playbackRate ?? defaultPlaybackRate

        const layoutConfig = args.layout?.config ?? []

        switch (args.layout?.mode) {
            case MODE_CAMERA_OVERLAY:
                this.layout = { ...args.layout, config: { ...CAMERA_OVERLAY_DEFAULT_CONFIG, ...layoutConfig } }
                break
            case MODE_SIDE_BY_SIDE:
                this.layout = { ...args.layout, config: { ...SIDE_BY_SIDE_DEFAULT_CONFIG, ...layoutConfig } }
                break
            default:
                this.layout = args.layout ?? defaultLayout
        }

        this.microphoneAudioVolume = args.microphoneAudioVolume !== undefined
            ? args.microphoneAudioVolume
            : defaultMicrophoneAudioVolume

        this.systemAudioVolume = args.systemAudioVolume !== undefined
            ? args.systemAudioVolume
            : defaultSystemAudioVolume

        this.transitionIn = args.transitionIn ?? { type: "none", duration: 500 }
        this.transitionOut = args.transitionOut ?? { type: "none", duration: 500 }
    }

    static createBulk(clips, defaultPlaybackRate, defaultLayout, defaultMicrophoneAudioVolume, defaultSystemAudioVolume,
        crypto = self.crypto) {
        return clips.map(({ start, end }) =>
            new ClipConfig({ start, end, playbackRate: 1 }, defaultPlaybackRate, defaultLayout,
                defaultMicrophoneAudioVolume, defaultSystemAudioVolume, crypto).serialize())
    }

    // takes an old config, copies over everything and just updates all timestamps
    static fromConfig(oldConfig) {
        // cursor animations aren't editable yet, so just return the old config
        return oldConfig
    }
}