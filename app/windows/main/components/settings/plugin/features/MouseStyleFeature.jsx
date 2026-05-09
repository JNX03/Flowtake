import { useDispatch, useSelector } from 'react-redux'
import {
    FEATURE_IDS,
    selectFeatureConfig,
    updateFeatureConfig,
} from '@shared/redux/pluginSlice'
import Toggle from '../../../properties/Toggle'
import { MAX_TAG_LENGTH } from '../constants'

export default function MouseStyleFeature() {
    const dispatch = useDispatch()
    const config = useSelector(selectFeatureConfig(FEATURE_IDS.MOUSE_STYLE))

    const update = (patch) => {
        dispatch(updateFeatureConfig({ id: FEATURE_IDS.MOUSE_STYLE, patch }))
    }

    return (
        <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center gap-3">
                <label className="text-xs text-base-content/70 w-24">Cursor color</label>
                <input
                    type="color"
                    value={config.color}
                    onChange={(e) => update({ color: e.target.value })}
                    className="h-7 w-14 rounded border border-base-content/10 bg-transparent cursor-pointer"
                />
                <span className="text-[10px] font-mono text-base-content/40">{config.color}</span>
            </div>

            <Toggle
                leftLabel={<span className="text-xs">Show floating tag next to cursor</span>}
                value={config.showLabel}
                onChange={(e) => update({ showLabel: e.target.checked })}
            />

            <div className="flex items-center gap-3">
                <label className="text-xs text-base-content/70 w-24">Tag text</label>
                <input
                    type="text"
                    maxLength={MAX_TAG_LENGTH}
                    placeholder="FlowTake Agent"
                    value={config.label}
                    onChange={(e) => update({ label: e.target.value })}
                    disabled={!config.showLabel}
                    className="input input-sm flex-1"
                />
            </div>

            <div className="rounded-md border border-base-content/10 bg-base-content/[0.02] p-4 flex items-center justify-center min-h-24">
                <CursorPreview color={config.color} label={config.showLabel ? config.label : null} />
            </div>
        </div>
    )
}

function CursorPreview({ color, label }) {
    return (
        <div className="relative">
            <svg viewBox="0 0 24 24" width="32" height="32" style={{ color }}>
                <path d="M3 2 L3 19 L8 14 L11.5 21 L14 20 L10.5 13 L17 13 Z"
                    fill="currentColor" stroke="white" strokeWidth="1" strokeLinejoin="round" />
            </svg>
            {label && (
                <span className="absolute left-7 top-7 px-2 py-0.5 rounded-full text-[10px] font-medium text-white whitespace-nowrap shadow"
                    style={{ background: color }}>
                    {label}
                </span>
            )}
        </div>
    )
}
