import { useEffect, useState } from 'react'
import { FolderOpenIcon, ArrowPathIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/20/solid'
import { useDispatch, useSelector } from 'react-redux'
import Fieldset from '../../properties/Fieldset'
import {
    selectDetectedPlugins,
    selectPluginsDir,
    setDetectedPlugins,
    setPluginsDir,
} from '@shared/redux/pluginSlice'

const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const formatDate = (ms) => {
    if (!ms) return ''
    try {
        return new Date(ms).toLocaleString()
    } catch {
        return ''
    }
}

export default function PluginFolderSection() {
    const dispatch = useDispatch()
    const dir = useSelector(selectPluginsDir)
    const detected = useSelector(selectDetectedPlugins)
    const [copied, setCopied] = useState(false)
    const [refreshing, setRefreshing] = useState(false)

    const refresh = async () => {
        setRefreshing(true)
        try {
            const path = await window.electron.ipcRenderer.invoke('ensure-plugins-dir')
            dispatch(setPluginsDir(path))
            const list = await window.electron.ipcRenderer.invoke('list-plugins')
            dispatch(setDetectedPlugins(list || []))
        } finally {
            setRefreshing(false)
        }
    }

    useEffect(() => {
        refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const copyPath = async () => {
        if (!dir) return
        try {
            await navigator.clipboard.writeText(dir)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch {
            /* clipboard might be unavailable */
        }
    }

    return (
        <Fieldset
            legend="Plugin folder"
            description="Drop plugin files into this folder. Detected files are listed below — they are NOT executed in this preview build.">
            <div className="flex items-stretch gap-2">
                <input
                    type="text"
                    readOnly
                    value={dir || 'Loading…'}
                    className="input input-sm flex-1 font-mono text-[11px]"
                />
                <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={copyPath}
                    title="Copy path">
                    {copied ? <CheckIcon className="size-4 text-success" /> : <ClipboardIcon className="size-4" />}
                </button>
                <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => window.electron.ipcRenderer.invoke('open-plugins-folder')}>
                    <FolderOpenIcon className="size-4" />
                    Open
                </button>
                <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={refresh}
                    disabled={refreshing}
                    title="Refresh">
                    <ArrowPathIcon className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="rounded-md border border-base-content/10 divide-y divide-base-content/5">
                {detected.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-base-content/40">
                        No plugins detected. Drop files into the folder above and refresh.
                    </div>
                ) : (
                    detected.map((p) => (
                        <div key={p.name} className="flex items-center gap-3 px-3 py-2">
                            <div className="size-7 flex items-center justify-center rounded bg-base-content/5 text-[10px] font-mono text-base-content/60">
                                {p.is_dir ? 'DIR' : (p.kind || '?').toUpperCase().slice(0, 4)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium truncate">{p.name}</div>
                                <div className="text-[10px] text-base-content/40">
                                    {formatSize(p.size)} · {formatDate(p.modified_ms)}
                                </div>
                            </div>
                            <span className="px-1.5 py-0.5 rounded bg-base-content/5 text-[9px] font-bold uppercase tracking-wider text-base-content/50">
                                Detected
                            </span>
                        </div>
                    ))
                )}
            </div>
        </Fieldset>
    )
}
