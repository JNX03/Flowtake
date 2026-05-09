export { FEATURE_IDS, FEATURE_DEFAULTS, PLUGIN_STORE_KEY } from '@shared/redux/pluginSlice'

export const KEYBOARD_MODES = [
    { value: 'full', label: 'Everything typed' },
    { value: 'keybinds', label: 'Keybinds only (Ctrl/Alt/Fn/F1–F12…)' },
]

export const KEYBOARD_POSITIONS = [
    { value: 'top-left', label: 'Top left' },
    { value: 'top-center', label: 'Top center' },
    { value: 'top-right', label: 'Top right' },
    { value: 'bottom-left', label: 'Bottom left' },
    { value: 'bottom-center', label: 'Bottom center' },
    { value: 'bottom-right', label: 'Bottom right' },
]

export const KEYBOARD_SIZES = [
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
]

export const MAX_TAG_LENGTH = 40
