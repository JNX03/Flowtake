import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import Fieldset from "../properties/Fieldset"
import Toggle from "../properties/Toggle"
import {
    LIVE_SETTINGS_DEFAULTS as DEFAULTS,
    loadLiveSettings,
    saveLiveSettings,
} from "./liveSettingsStore"

const PLATFORM_PRESETS = {
    youtube: {
        label: "YouTube",
        url: "rtmp://a.rtmp.youtube.com/live2/",
        recommendedBitrate: 6000,
    },
    twitch: {
        label: "Twitch",
        url: "rtmp://live.twitch.tv/app/",
        recommendedBitrate: 6000,
    },
    facebook: {
        label: "Facebook",
        url: "rtmps://live-api-s.facebook.com:443/rtmp/",
        recommendedBitrate: 4000,
    },
    custom: {
        label: "Custom RTMP",
        url: "",
        recommendedBitrate: 6000,
    },
}

const RESOLUTIONS = [
    { value: "source", label: "Source (capture native)" },
    { value: "1280x720@30", label: "720p · 30fps" },
    { value: "1920x1080@30", label: "1080p · 30fps" },
    { value: "1920x1080@60", label: "1080p · 60fps" },
]

const ZOOM_MODES = [
    { value: "hold", label: "Hold to zoom (default)" },
    { value: "toggle", label: "Toggle on press" },
    { value: "step", label: "Step in / out" },
]

export default function LiveStreamingSettings() {
    const { data: settings, isPending, refetch } = useQuery({
        queryKey: ["liveSettings"],
        queryFn: loadLiveSettings,
        staleTime: Infinity,
    })

    const [showKey, setShowKey] = useState(false)
    const [recordingHotkey, setRecordingHotkey] = useState(false)
    const [draftHotkey, setDraftHotkey] = useState("")

    useEffect(() => {
        if (!recordingHotkey) return
        const onKey = (e) => {
            e.preventDefault()
            const parts = []
            if (e.ctrlKey) parts.push("Ctrl")
            if (e.shiftKey) parts.push("Shift")
            if (e.altKey) parts.push("Alt")
            if (e.metaKey) parts.push("Meta")
            const k = e.key
            if (k && k.length === 1) {
                parts.push(k.toUpperCase())
            } else if (/^F\d+$/i.test(k)) {
                parts.push(k.toUpperCase())
            } else if (k === "Escape") {
                setRecordingHotkey(false)
                return
            } else {
                return
            }
            const accel = parts.join("+")
            setDraftHotkey(accel)
            setRecordingHotkey(false)
            update({ zoomHotkey: accel })
        }
        window.addEventListener("keydown", onKey, true)
        return () => window.removeEventListener("keydown", onKey, true)
    }, [recordingHotkey])

    const update = async (patch) => {
        const next = { ...(settings || DEFAULTS), ...patch }
        await saveLiveSettings(next)
        refetch()
    }

    const handlePlatformChange = (platform) => {
        const preset = PLATFORM_PRESETS[platform]
        update({
            platform,
            rtmpUrl: preset?.url ?? settings?.rtmpUrl ?? "",
            videoBitrateKbps: preset?.recommendedBitrate ?? settings?.videoBitrateKbps,
        })
    }

    if (isPending || !settings) {
        return <div className="text-sm text-base-content/60">Loading…</div>
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <h4 className="font-semibold text-lg">Live Streaming</h4>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                    Beta
                </span>
            </div>
            <p className="text-xs text-base-content/50 -mt-2">
                Stream Flowtake's smoothed cursor + on-demand zoom directly to YouTube, Twitch, or any RTMP destination.
                Auto-zoom is disabled in live mode — use the hotkey below.
            </p>

            <Fieldset
                legend="Destination"
                description="Choose a platform preset, or enter a custom RTMP/RTMPS URL.">
                <select
                    className="select select-sm w-full"
                    value={settings.platform}
                    onChange={(e) => handlePlatformChange(e.target.value)}>
                    {Object.entries(PLATFORM_PRESETS).map(([key, p]) => (
                        <option key={key} value={key}>
                            {p.label}
                        </option>
                    ))}
                </select>
                <input
                    type="text"
                    className="input input-sm w-full font-mono"
                    placeholder="rtmp://…"
                    value={settings.rtmpUrl}
                    disabled={settings.platform !== "custom"}
                    onChange={(e) => update({ rtmpUrl: e.target.value })}
                />
                <div className="flex items-center gap-2">
                    <input
                        type={showKey ? "text" : "password"}
                        className="input input-sm w-full font-mono"
                        placeholder="Stream key"
                        value={settings.streamKey}
                        onChange={(e) => update({ streamKey: e.target.value })}
                    />
                    <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setShowKey(s => !s)}
                        title={showKey ? "Hide key" : "Show key"}>
                        {showKey ? <EyeSlashIcon className="size-4" /> : <EyeIcon className="size-4" />}
                    </button>
                </div>
            </Fieldset>

            <Fieldset legend="Quality">
                <label className="text-xs text-base-content/60">Resolution / framerate</label>
                <select
                    className="select select-sm w-full"
                    value={settings.resolution}
                    onChange={(e) => update({ resolution: e.target.value })}>
                    {RESOLUTIONS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                </select>

                <label className="text-xs text-base-content/60 mt-2">
                    Video bitrate: {settings.videoBitrateKbps} kbps
                </label>
                <input
                    type="range"
                    min={1500}
                    max={12000}
                    step={500}
                    className="range range-xs"
                    value={settings.videoBitrateKbps}
                    onChange={(e) => update({ videoBitrateKbps: Number(e.target.value) })}
                />
            </Fieldset>

            <Fieldset legend="Recording">
                <Toggle
                    leftLabel="Save local copy while streaming"
                    value={settings.saveLocal}
                    onChange={(e) => update({ saveLocal: e.target.checked })}
                />
                <Toggle
                    leftLabel="Capture microphone in stream"
                    value={settings.captureMic}
                    onChange={(e) => update({ captureMic: e.target.checked })}
                />
                <Toggle
                    leftLabel="Hide OS cursor (use Flowtake smoothed cursor)"
                    value={settings.hideNativeCursor}
                    onChange={(e) => update({ hideNativeCursor: e.target.checked })}
                />
            </Fieldset>

            <Fieldset
                legend="Manual zoom"
                description="Live mode disables auto-zoom. Use this hotkey to zoom in to the cursor position on demand.">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-base-content/60 w-24">Hotkey</span>
                    <button
                        className={`btn btn-sm flex-1 font-mono ${recordingHotkey ? "btn-primary" : "btn-outline"}`}
                        onClick={() => {
                            setDraftHotkey("")
                            setRecordingHotkey(true)
                        }}>
                        {recordingHotkey
                            ? "Press a key combination… (Esc to cancel)"
                            : (draftHotkey || settings.zoomHotkey)}
                    </button>
                </div>

                <label className="text-xs text-base-content/60">Zoom mode</label>
                <select
                    className="select select-sm w-full"
                    value={settings.zoomMode}
                    onChange={(e) => update({ zoomMode: e.target.value })}>
                    {ZOOM_MODES.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                </select>

                <label className="text-xs text-base-content/60 mt-2">
                    Zoom factor: {settings.zoomTargetScale.toFixed(1)}×
                </label>
                <input
                    type="range"
                    min={1.2}
                    max={4.0}
                    step={0.1}
                    className="range range-xs"
                    value={settings.zoomTargetScale}
                    onChange={(e) => update({ zoomTargetScale: Number(e.target.value) })}
                />

                <label className="text-xs text-base-content/60 mt-2">
                    Transition speed: {settings.zoomEaseMs} ms
                </label>
                <input
                    type="range"
                    min={100}
                    max={800}
                    step={50}
                    className="range range-xs"
                    value={settings.zoomEaseMs}
                    onChange={(e) => update({ zoomEaseMs: Number(e.target.value) })}
                />
            </Fieldset>
        </div>
    )
}
