import { useDispatch, useSelector } from 'react-redux'
import { useState } from 'react'
import { PlusIcon, XMarkIcon } from '@heroicons/react/20/solid'
import {
    FEATURE_IDS,
    selectFeatureConfig,
    updateFeatureConfig,
} from '@shared/redux/pluginSlice'

export default function AppRecordingFeature() {
    const dispatch = useDispatch()
    const config = useSelector(selectFeatureConfig(FEATURE_IDS.APP_RECORDING))
    const [picking, setPicking] = useState(false)
    const [available, setAvailable] = useState([])

    const update = (patch) => {
        dispatch(updateFeatureConfig({ id: FEATURE_IDS.APP_RECORDING, patch }))
    }

    const refreshWindows = async () => {
        setPicking(true)
        try {
            const list = await window.electron.ipcRenderer.invoke('get-windows')
            // Keep top-level non-tool windows that have a name
            const visible = (list || []).filter(w => w?.name && (w.type === 'window' || !w.type))
            setAvailable(visible)
        } catch {
            setAvailable([])
        }
    }

    const toggle = (win) => {
        const exists = (config.windows || []).some(w => w.id === win.id)
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
                Capture each selected app to its own video layer. You can show or hide layers in the editor before exporting.
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
                            No windows available.
                        </div>
                    )}
                    {available.map(w => {
                        const checked = (config.windows || []).some(s => s.id === w.id)
                        return (
                            <label key={w.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-base-content/5">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-xs"
                                    checked={checked}
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
