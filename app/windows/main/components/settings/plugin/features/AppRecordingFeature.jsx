import { useDispatch, useSelector } from 'react-redux'
import { useState } from 'react'
import { PlusIcon, XMarkIcon } from '@heroicons/react/20/solid'
import {
    FEATURE_IDS,
    selectFeatureConfig,
    updateFeatureConfig,
} from '@shared/redux/pluginSlice'

const MAX_APP_LAYERS = 2

export default function AppRecordingFeature() {
    const dispatch = useDispatch()
    const config = useSelector(selectFeatureConfig(FEATURE_IDS.APP_RECORDING))
    const [picking, setPicking] = useState(false)
    const [available, setAvailable] = useState([])
    const [pickerError, setPickerError] = useState(null)

    const update = (patch) => {
        dispatch(updateFeatureConfig({ id: FEATURE_IDS.APP_RECORDING, patch }))
    }

    const refreshWindows = async () => {
        setPicking(true)
        setPickerError(null)
        try {
            const list = await window.electron.ipcRenderer.invoke('get-windows')
            // Keep top-level non-tool windows that have a name
            const visible = (list || []).filter(w => w?.name && (w.type === 'window' || !w.type))
            setAvailable(visible)
        } catch {
            setAvailable([])
            setPickerError('App windows could not be listed. Close the picker and try again.')
        }
    }

    const toggle = (win) => {
        const exists = (config.windows || []).some(w => w.id === win.id)
        if (!exists && (config.windows || []).length >= MAX_APP_LAYERS) return
        const nextWindows = exists
            ? config.windows.filter(w => w.id !== win.id)
            : [...(config.windows || []), { id: win.id, name: win.name }]
        update({
            windows: nextWindows,
            windowIds: nextWindows.map(w => w.id),
        })
    }

    const remove = (id) => {
        const nextWindows = (config.windows || []).filter(w => w.id !== id)
        update({
            windows: nextWindows,
            windowIds: nextWindows.map(w => w.id),
        })
    }

    return (
        <div className="flex flex-col gap-3 mt-2">
            <p className="text-[11px] text-base-content/50 leading-snug">
                Capture up to {MAX_APP_LAYERS} additional app regions as separate video layers. Each layer adds an encoder, so use only what you need.
            </p>
            <p className="text-[11px] text-warning/80 leading-snug">
                Keep selected windows open, uncovered, and in the same position until you stop recording.
            </p>

            {(config.windows || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {config.windows.map(w => (
                        <span key={w.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-primary/10 text-primary text-[11px]">
                            <span className="max-w-40 truncate">{w.name}</span>
                            <button
                                type="button"
                                onClick={() => remove(w.id)}
                                className="p-0.5 rounded hover:bg-primary/20"
                                aria-label={`Remove ${w.name}`}>
                                <XMarkIcon className="size-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {!picking ? (
                <button
                    type="button"
                    className="btn btn-sm btn-outline self-start"
                    onClick={refreshWindows}>
                    <PlusIcon className="size-4" />
                    Pick apps to record
                </button>
            ) : (
                <div className="rounded-md border border-base-content/10 max-h-60 overflow-y-auto divide-y divide-base-content/5">
                    {available.length === 0 && (
                        <div className="px-3 py-6 text-center text-xs text-base-content/40">
                            {pickerError || "No windows available."}
                        </div>
                    )}
                    {available.map(w => {
                        const checked = (config.windows || []).some(s => s.id === w.id)
                        const atLimit = !checked && (config.windows || []).length >= MAX_APP_LAYERS
                        return (
                            <label key={w.id} className={`flex items-center gap-2 px-3 py-1.5 hover:bg-base-content/5 ${atLimit ? "opacity-45 cursor-not-allowed" : "cursor-pointer"}`}>
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-xs"
                                    checked={checked}
                                    disabled={atLimit}
                                    onChange={() => toggle(w)}
                                />
                                <span className="text-xs truncate flex-1">{w.name}</span>
                                <span className="text-[10px] text-base-content/30 font-mono">{w.width}×{w.height}</span>
                            </label>
                        )
                    })}
                    <div className="px-3 py-1.5 flex justify-end">
                        <button
                            type="button"
                            className="btn btn-xs btn-ghost"
                            onClick={() => setPicking(false)}>
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
