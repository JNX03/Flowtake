import { createSlice } from '@reduxjs/toolkit'

const PLATFORM_PRESETS = {
    youtube: 'rtmp://a.rtmp.youtube.com/live2/',
    twitch: 'rtmp://live.twitch.tv/app/',
    facebook: 'rtmps://live-api-s.facebook.com:443/rtmp/',
    custom: '',
}

const initialState = {
    /// Whether a live session is active
    isLive: false,
    /// Live runtime stats (updated from `live-stats` event)
    stats: {
        fps: 0,
        bitrateKbps: 0,
        droppedFrames: 0,
        dupFrames: 0,
        elapsedMs: 0,
        speed: 0,
        connected: false,
    },
    /// Whether the user is currently holding the zoom hotkey
    zoomActive: false,
    /// User-configured streaming settings (persisted via store_set, mirrored here)
    settings: {
        platform: 'youtube',         // youtube | twitch | facebook | custom
        rtmpUrl: PLATFORM_PRESETS.youtube,
        hasStreamKey: false,          // credential itself stays in native session memory
        videoBitrateKbps: 6000,
        resolution: 'source',        // 720p30 | 1080p30 | 1080p60 | source
        framerate: 30,
        saveLocal: true,
        hideNativeCursor: true,
        captureMic: false,
        zoomHotkey: 'Ctrl+Shift+Z',
        zoomMode: 'hold',            // hold | toggle | step
        zoomTargetScale: 2.0,
        zoomEaseMs: 350,
    },
}

export const liveSlice = createSlice({
    name: 'live',
    initialState,
    reducers: {
        reset: () => initialState,
        setIsLive: (state, action) => { state.isLive = action.payload },
        setStats: (state, action) => { state.stats = { ...state.stats, ...action.payload } },
        setZoomActive: (state, action) => { state.zoomActive = action.payload },
        setSettings: (state, action) => {
            state.settings = { ...state.settings, ...action.payload }
        },
        setPlatform: (state, action) => {
            const platform = action.payload
            state.settings.platform = platform
            if (platform !== 'custom' && PLATFORM_PRESETS[platform]) {
                state.settings.rtmpUrl = PLATFORM_PRESETS[platform]
            }
        },
    },
})

export const {
    reset,
    setIsLive,
    setStats,
    setZoomActive,
    setSettings,
    setPlatform,
} = liveSlice.actions

export const selectIsLive = state => state.live.isLive
export const selectLiveStats = state => state.live.stats
export const selectLiveSettings = state => state.live.settings
export const selectZoomActive = state => state.live.zoomActive

export { PLATFORM_PRESETS }
export default liveSlice.reducer
