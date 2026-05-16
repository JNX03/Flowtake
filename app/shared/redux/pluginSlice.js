import { createSlice } from '@reduxjs/toolkit'

export const FEATURE_IDS = {
    APP_RECORDING: 'appRecording',
    MOUSE_STYLE: 'mouseStyle',
    KEYBOARD_OVERLAY: 'keyboardOverlay',
}

export const PLUGIN_STORE_KEY = 'plugins.settings'

export const FEATURE_DEFAULTS = {
    [FEATURE_IDS.APP_RECORDING]: {
        windowIds: [],
        windows: [],
    },
    [FEATURE_IDS.MOUSE_STYLE]: {
        color: '#ff3b30',
        label: 'FlowTake Agent',
        showLabel: true,
    },
    [FEATURE_IDS.KEYBOARD_OVERLAY]: {
        mode: 'keybinds',
        position: 'bottom-center',
        size: 'md',
    },
}

const initialState = {
    enabled: {
        [FEATURE_IDS.APP_RECORDING]: false,
        [FEATURE_IDS.MOUSE_STYLE]: false,
        [FEATURE_IDS.KEYBOARD_OVERLAY]: false,
    },
    config: { ...FEATURE_DEFAULTS },
    detected: [],
    pluginsDir: null,
    isHydrated: false,
    isDrawMouseModeActive: false,
}

export const pluginSlice = createSlice({
    name: 'plugin',
    initialState,
    reducers: {
        hydrate: (state, action) => {
            const payload = action.payload || {}
            if (payload.enabled) {
                Object.assign(state.enabled, payload.enabled)
            }
            if (payload.config) {
                for (const id of Object.keys(payload.config)) {
                    state.config[id] = { ...FEATURE_DEFAULTS[id], ...payload.config[id] }
                }
            }
            state.isHydrated = true
        },
        setFeatureEnabled: (state, action) => {
            const { id, enabled } = action.payload
            state.enabled[id] = enabled
        },
        updateFeatureConfig: (state, action) => {
            const { id, patch } = action.payload
            state.config[id] = { ...(state.config[id] || FEATURE_DEFAULTS[id]), ...patch }
        },
        setDetectedPlugins: (state, action) => {
            state.detected = action.payload || []
        },
        setPluginsDir: (state, action) => {
            state.pluginsDir = action.payload
        },
        setIsDrawMouseModeActive: (state, action) => {
            state.isDrawMouseModeActive = !!action.payload
        },
    },
})

export const {
    hydrate,
    setFeatureEnabled,
    updateFeatureConfig,
    setDetectedPlugins,
    setPluginsDir,
    setIsDrawMouseModeActive,
} = pluginSlice.actions

export const selectIsFeatureEnabled = id => state => !!state.plugin.enabled[id]
export const selectFeatureConfig = id => state => state.plugin.config[id] || FEATURE_DEFAULTS[id]
export const selectAllEnabled = state => state.plugin.enabled
export const selectDetectedPlugins = state => state.plugin.detected
export const selectPluginsDir = state => state.plugin.pluginsDir
export const selectIsHydrated = state => state.plugin.isHydrated
export const selectIsDrawMouseModeActive = state => !!state.plugin.isDrawMouseModeActive

export const selectPersistedShape = state => ({
    enabled: state.plugin.enabled,
    config: state.plugin.config,
})

export default pluginSlice.reducer
