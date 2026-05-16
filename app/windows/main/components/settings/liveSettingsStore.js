// Shared loader + defaults for the persisted live-streaming settings.
// Keeping this in its own module avoids React-Query cache collisions: every
// consumer must produce the same DEFAULTS-merged shape under the
// ['liveSettings'] query key, otherwise a queryFn that returns a raw `null`
// from `store-get` will starve the settings panel into a permanent "Loading…".

const PLATFORM_PRESETS = {
    youtube: "rtmp://a.rtmp.youtube.com/live2/",
    twitch: "rtmp://live.twitch.tv/app/",
    facebook: "rtmps://live-api-s.facebook.com:443/rtmp/",
    custom: "",
}

export const LIVE_SETTINGS_STORE_KEY = "live.settings"

export const LIVE_SETTINGS_DEFAULTS = {
    platform: "youtube",
    rtmpUrl: PLATFORM_PRESETS.youtube,
    streamKey: "",
    videoBitrateKbps: 6000,
    resolution: "source",
    saveLocal: true,
    hideNativeCursor: true,
    captureMic: false,
    zoomHotkey: "Ctrl+Shift+Z",
    zoomMode: "hold",
    zoomTargetScale: 2.0,
    zoomEaseMs: 350,
}

export async function loadLiveSettings() {
    try {
        const stored = await window.electron.ipcRenderer.invoke("store-get", LIVE_SETTINGS_STORE_KEY)
        return { ...LIVE_SETTINGS_DEFAULTS, ...(stored || {}) }
    } catch {
        return { ...LIVE_SETTINGS_DEFAULTS }
    }
}

export async function saveLiveSettings(next) {
    await window.electron.ipcRenderer.invoke("store-set", LIVE_SETTINGS_STORE_KEY, next)
}
