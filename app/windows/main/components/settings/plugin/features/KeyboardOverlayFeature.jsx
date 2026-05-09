import { useDispatch, useSelector } from 'react-redux'
import {
    FEATURE_IDS,
    selectFeatureConfig,
    updateFeatureConfig,
} from '@shared/redux/pluginSlice'
import { KEYBOARD_MODES, KEYBOARD_POSITIONS, KEYBOARD_SIZES } from '../constants'

export default function KeyboardOverlayFeature() {
    const dispatch = useDispatch()
    const config = useSelector(selectFeatureConfig(FEATURE_IDS.KEYBOARD_OVERLAY))

    const update = (patch) => {
        dispatch(updateFeatureConfig({ id: FEATURE_IDS.KEYBOARD_OVERLAY, patch }))
    }

    return (
        <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center gap-3">
                <label className="text-xs text-base-content/70 w-24">Capture mode</label>
                <select
                    className="select select-sm flex-1"
                    value={config.mode}
                    onChange={(e) => update({ mode: e.target.value })}>
                    {KEYBOARD_MODES.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                </select>
            </div>
            <div className="flex items-center gap-3">
                <label className="text-xs text-base-content/70 w-24">Position</label>
                <select
                    className="select select-sm flex-1"
                    value={config.position}
                    onChange={(e) => update({ position: e.target.value })}>
                    {KEYBOARD_POSITIONS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                </select>
            </div>
            <div className="flex items-center gap-3">
                <label className="text-xs text-base-content/70 w-24">Size</label>
                <select
                    className="select select-sm flex-1"
                    value={config.size}
                    onChange={(e) => update({ size: e.target.value })}>
                    {KEYBOARD_SIZES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
            </div>

            <div className="rounded-md border border-base-content/10 bg-base-content/[0.02] p-4 flex items-end justify-center min-h-20">
                <KeyboardPreview mode={config.mode} size={config.size} />
            </div>

            <p className="text-[10px] text-base-content/40 leading-snug">
                {config.mode === 'keybinds'
                    ? 'Only modifier combos (Ctrl/Alt/Meta/Shift+key), function keys (F1–F12), and special keys like Backspace, Delete, Tab, Esc, Enter, and arrows are shown.'
                    : 'Every keypress is shown — including individual letters, numbers, and modifier combos.'}
            </p>
        </div>
    )
}

const SAMPLE_KEYS = {
    full: ['H', 'e', 'l', 'l', 'o'],
    keybinds: ['Ctrl', '+', 'S', 'F5', 'Esc'],
}

const SIZE_CLASSES = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-2.5 py-1.5',
}

function KeyboardPreview({ mode, size }) {
    const keys = SAMPLE_KEYS[mode] || SAMPLE_KEYS.full
    const sz = SIZE_CLASSES[size] || SIZE_CLASSES.md
    return (
        <div className="flex items-center gap-1">
            {keys.map((k, i) => (
                <kbd key={i} className={`kbd ${sz}`}>{k}</kbd>
            ))}
        </div>
    )
}
