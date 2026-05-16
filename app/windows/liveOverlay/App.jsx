import {
    BoltIcon,
    MicrophoneIcon,
    SignalIcon,
    VideoCameraIcon,
    VideoCameraSlashIcon,
    XMarkIcon,
} from "@heroicons/react/20/solid"
import { StopIcon } from "@heroicons/react/24/solid"
import { useQuery } from "@tanstack/react-query"
import { invoke } from "@tauri-apps/api/core"
import { emit, listen } from "@tauri-apps/api/event"
import moment from "moment"
import momentDurationFormatSetup from "moment-duration-format"
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import DeviceRecorder from "../main/DeviceRecorder"
import useAudioMeter from "@shared/hooks/useAudioMeter"
import VolumeMeter from "../../components/VolumeMeter"
import { loadLiveSettings } from "../main/components/settings/liveSettingsStore"

const StyleTag = () => (
    <style>{`
        @keyframes live-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.55; transform: scale(0.85); }
        }
        .live-dot { animation: live-pulse 1.4s ease-in-out infinite; }

        @keyframes live-ring {
            0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.45); }
            100% { box-shadow: 0 0 0 9px rgba(239, 68, 68, 0); }
        }
        .live-ring { animation: live-ring 1.6s ease-out infinite; border-radius: 9999px; }

        *, *::before, *::after { margin: 0; padding: 0; }
        html, body, #root {
            background: transparent !important;
            border: none !important;
            outline: none !important;
            overflow: hidden;
        }

        .island-pill {
            transition: width 380ms cubic-bezier(0.4, 0, 0.15, 1),
                        height 320ms cubic-bezier(0.4, 0, 0.15, 1),
                        border-radius 320ms cubic-bezier(0.4, 0, 0.15, 1),
                        box-shadow 300ms ease;
        }

        .island-pill:hover {
            box-shadow: 0 4px 32px rgba(0,0,0,0.6),
                        0 0 0 1px rgba(239, 68, 68, 0.18) inset,
                        0 0 48px rgba(239, 68, 68, 0.10);
        }

        .zoom-chip {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.55);
            border-radius: 6px;
            padding: 2px 6px;
            font-size: 9px;
            font-weight: 600;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .zoom-chip[data-active="true"] {
            background: rgba(239, 68, 68, 0.16);
            border-color: rgba(239, 68, 68, 0.4);
            color: rgba(252, 165, 165, 0.95);
        }
    `}</style>
)

const pillBg = {
    background: "rgba(10, 10, 22, 0.94)",
    backdropFilter: "blur(24px) saturate(1.6)",
    WebkitBackdropFilter: "blur(24px) saturate(1.6)",
    boxShadow: "0 2px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(239, 68, 68, 0.10) inset",
}

const Btn = ({ onClick, title, children, className = "" }) => (
    <button
        onClick={onClick}
        title={title}
        className={`relative z-10 flex items-center justify-center transition-all duration-100 cursor-pointer flex-shrink-0 active:scale-90 ${className}`}
        style={{ WebkitUserSelect: "none" }}
    >
        {children}
    </button>
)

const Divider = () => (
    <div className="w-px h-5 mx-1.5 flex-shrink-0 bg-white/[0.08]" />
)

export default function App() {

    const [time, setTime] = useState(0)
    const [intervalId, setIntervalId] = useState(null)
    const [deviceRecorder, setDeviceRecorder] = useState(null)
    const [isMicMuted, setIsMicMuted] = useState(false)
    const [isCameraOff, setIsCameraOff] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const [audioStream, setAudioStream] = useState(null)
    const [liveStats, setLiveStats] = useState(null)
    const [zoomActive, setZoomActive] = useState(false)
    const [isStopping, setIsStopping] = useState(false)

    const liveStartedRef = useRef(false)
    const cameraVideoRef = useRef(null)
    const timeRef = useRef(time)

    const { data: liveSettings } = useQuery({
        queryKey: ["liveSettings"],
        queryFn: loadLiveSettings,
        staleTime: Infinity,
    })

    const { data: cameraMicConfig } = useQuery({
        queryKey: ["cameraMicConfig"],
        queryFn: () => window.electron.ipcRenderer.invoke("get-camera-mic-config"),
        staleTime: Infinity,
    })

    const hasMic = !!cameraMicConfig?.audioTrack
    const hasCam = !!cameraMicConfig?.videoTrack

    const { level } = useAudioMeter(audioStream, !!liveStats && hasMic)

    const formattedTime = useMemo(() => {
        if (typeof moment.duration.fn.format === "undefined") momentDurationFormatSetup(moment)
        return moment.duration(time).format("mm:ss", { trim: false })
    }, [time])

    useEffect(() => {
        timeRef.current = time
    }, [time])

    // Build the device recorder so the camera preview shows and the mic VU meter has a stream.
    const createDeviceRecorder = useCallback(async () => {
        const recorder = new DeviceRecorder()
        try {
            await recorder.init(cameraMicConfig, cameraVideoRef.current)
            setDeviceRecorder(recorder)
        } catch (e) {
            console.warn("[live-overlay] device recorder init failed:", e)
        }
    }, [cameraMicConfig])

    useEffect(() => {
        if ((cameraMicConfig?.audioTrack || cameraMicConfig?.videoTrack) && !deviceRecorder) {
            createDeviceRecorder()
        }
    }, [cameraMicConfig, deviceRecorder, createDeviceRecorder])

    useEffect(() => {
        const stream = deviceRecorder?.mediaRecorder?.stream
        if (stream && stream.getAudioTracks().length > 0) setAudioStream(stream)
        else setAudioStream(null)
    }, [deviceRecorder])

    // Kick off the live session once settings are loaded.
    useEffect(() => {
        if (!liveSettings || liveStartedRef.current) return
        liveStartedRef.current = true
        ;(async () => {
            try {
                await invoke("open_live_composer")
                await new Promise((resolve) => {
                    let unlisten
                    const timeout = setTimeout(() => { try { unlisten?.() } catch {} ; resolve() }, 4000)
                    listen("live:composer-mounted", () => {
                        clearTimeout(timeout)
                        try { unlisten?.() } catch {}
                        resolve()
                    }).then(fn => { unlisten = fn })
                })
                await emit("live:start", liveSettings || {})
            } catch (err) {
                console.error("[live-overlay] start failed:", err)
                liveStartedRef.current = false
            }
        })()
    }, [liveSettings])

    // Subscribe to backend events
    useEffect(() => {
        let unlistenStats, unlistenStopped, unlistenZoom
        listen("live-stats", (e) => setLiveStats(e.payload)).then(fn => { unlistenStats = fn })
        listen("live:stopped", () => {
            setLiveStats(null)
            liveStartedRef.current = false
            invoke("destroy_window").catch(() => {})
        }).then(fn => { unlistenStopped = fn })
        listen("live:zoom-active", (e) => setZoomActive(!!e.payload)).then(fn => { unlistenZoom = fn })
        return () => {
            try { unlistenStats?.() } catch {}
            try { unlistenStopped?.() } catch {}
            try { unlistenZoom?.() } catch {}
        }
    }, [])

    // Timer ticks once the first stats packet arrives (= live is actually rolling).
    useEffect(() => {
        if (liveStats && intervalId === null) {
            setIntervalId(setInterval(() => setTime(timeRef.current + 1000), 1000))
        }
    }, [liveStats, intervalId])

    useEffect(() => () => { if (intervalId) clearInterval(intervalId) }, [intervalId])

    const onClickStop = useCallback(async () => {
        if (isStopping) return
        setIsStopping(true)
        try {
            await deviceRecorder?.stop()
            deviceRecorder?.destroy()
        } catch (e) {
            console.warn("[live-overlay] device recorder stop error:", e)
        }
        try { await emit("live:stop") } catch (e) { console.warn("[live-overlay] emit live:stop failed:", e) }
    }, [deviceRecorder, isStopping])

    const onClickCancel = useCallback(async () => {
        try { await emit("live:stop") } catch {}
        try { await invoke("destroy_window") } catch {}
    }, [])

    const toggleMic = useCallback(() => {
        if (!deviceRecorder?.mediaRecorder?.stream) return
        const newMuted = !isMicMuted
        deviceRecorder.mediaRecorder.stream.getAudioTracks()
            .forEach(track => { track.enabled = !newMuted })
        setIsMicMuted(newMuted)
    }, [deviceRecorder, isMicMuted])

    const toggleCamera = useCallback(() => {
        if (!deviceRecorder?.mediaRecorder?.stream) return
        const newOff = !isCameraOff
        deviceRecorder.mediaRecorder.stream.getVideoTracks()
            .forEach(track => { track.enabled = !newOff })
        setIsCameraOff(newOff)
    }, [deviceRecorder, isCameraOff])

    const zoomHotkey = liveSettings?.zoomHotkey || "Ctrl+Shift+Z"
    const zoomMode = liveSettings?.zoomMode || "hold"
    const zoomLabel = zoomMode === "hold" ? `Hold ${zoomHotkey}` : zoomMode === "toggle" ? `Tap ${zoomHotkey}` : `Step ${zoomHotkey}`

    const bitrate = liveStats ? `${Math.round(liveStats.bitrateKbps || 0)}k` : "—"
    const fps = liveStats ? Math.round(liveStats.fps || 0) : null
    const dropped = liveStats?.droppedFrames ?? 0
    const isConnecting = !liveStats

    // ── COMPACT ──
    const cameraPreview = hasCam ? (
        <div className="relative w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-red-500/30">
            <video ref={cameraVideoRef} autoPlay muted
                className={`object-cover h-full w-full bg-base-300 transition-opacity duration-200 ${isCameraOff ? "opacity-0" : ""}`} />
            {isCameraOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-base-300">
                    <VideoCameraSlashIcon className="size-3 opacity-30" />
                </div>
            )}
        </div>
    ) : null

    const liveIndicator = (
        <div className="relative flex items-center justify-center" style={{ width: 16, height: 16 }}>
            <span className="live-ring absolute inset-0" />
            <span className="live-dot w-[8px] h-[8px] rounded-full bg-red-500" />
        </div>
    )

    const timer = (
        <span className="font-semibold text-[13px] tabular-nums tracking-tight text-white/90">
            {formattedTime}
        </span>
    )

    if (isConnecting) {
        return (
            <div className="h-full w-full flex items-start justify-center" style={{ pointerEvents: "none" }}>
                <StyleTag />
                <div
                    className="island-pill mt-1"
                    data-tauri-drag-region
                    style={{
                        ...pillBg,
                        width: 240,
                        height: 44,
                        borderRadius: 22,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        pointerEvents: "auto",
                    }}
                >
                    <SignalIcon className="size-3.5 text-red-400/80" />
                    <span className="loading loading-spinner loading-xs text-red-400/60" style={{ width: 12, height: 12 }} />
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-white/55">
                        Connecting&hellip;
                    </span>
                    <Btn onClick={onClickCancel} title="Cancel"
                        className="w-6 h-6 rounded-full text-white/30 hover:text-white/70 hover:bg-white/[0.06]">
                        <XMarkIcon className="size-3.5" />
                    </Btn>
                </div>
            </div>
        )
    }

    if (!isExpanded) {
        return (
            <div className="h-full w-full flex items-start justify-center" style={{ pointerEvents: "none" }}>
                <StyleTag />
                <div
                    className="island-pill mt-1"
                    data-tauri-drag-region
                    onMouseEnter={() => setIsExpanded(true)}
                    style={{
                        ...pillBg,
                        width: 260,
                        height: 44,
                        borderRadius: 22,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        pointerEvents: "auto",
                    }}
                >
                    {cameraPreview}
                    {liveIndicator}
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-300">Live</span>
                    {hasMic && <VolumeMeter level={isMicMuted ? 0 : level} compact />}
                    {timer}
                    <span className="text-[10px] text-white/40 tabular-nums">{bitrate}/s</span>
                </div>
            </div>
        )
    }

    // ── EXPANDED ──
    return (
        <div className="h-full w-full flex items-start justify-center" style={{ pointerEvents: "none" }}>
            <StyleTag />
            <div
                className="island-pill mt-1"
                data-tauri-drag-region
                onMouseLeave={() => setIsExpanded(false)}
                style={{
                    ...pillBg,
                    width: 480,
                    height: 56,
                    borderRadius: 28,
                    display: "flex",
                    alignItems: "center",
                    pointerEvents: "auto",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", width: "100%", height: "100%", padding: "0 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 6, flexShrink: 0 }}>
                        {cameraPreview}
                        {liveIndicator}
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-300">Live</span>
                        {timer}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", flexShrink: 0, marginLeft: 14 }}>
                        <Divider />
                        {hasMic && (
                            <div className="flex items-center gap-1">
                                <Btn onClick={toggleMic} title={isMicMuted ? "Unmute mic" : "Mute mic"}
                                    className={`w-8 h-8 rounded-lg ${isMicMuted ? "text-white/20" : "text-white/50 hover:text-white/85 hover:bg-white/[0.06]"}`}>
                                    <div className="relative">
                                        <MicrophoneIcon className="size-4" />
                                        {isMicMuted && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-[1.5px] h-4 bg-red-400/80 rotate-45 rounded-full" />
                                            </div>
                                        )}
                                    </div>
                                </Btn>
                                <div className="w-12">
                                    <VolumeMeter level={isMicMuted ? 0 : level} />
                                </div>
                            </div>
                        )}
                        {hasCam && (
                            <Btn onClick={toggleCamera} title={isCameraOff ? "Camera on" : "Camera off"}
                                className={`w-8 h-8 rounded-lg ${isCameraOff ? "text-white/20" : "text-white/50 hover:text-white/85 hover:bg-white/[0.06]"}`}>
                                {isCameraOff ? <VideoCameraSlashIcon className="size-4" /> : <VideoCameraIcon className="size-4" />}
                            </Btn>
                        )}
                    </div>

                    <div style={{ flex: 1 }} />

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <div className="zoom-chip" data-active={zoomActive ? "true" : "false"} title={`Zoom mode: ${zoomMode}`}>
                            <BoltIcon className="size-3" />
                            {zoomLabel}
                        </div>
                        <div className="flex flex-col items-end text-white/45 leading-tight" style={{ minWidth: 64 }}>
                            <span className="text-[10px] tabular-nums">{bitrate}/s {fps != null && <span className="text-white/30">· {fps}fps</span>}</span>
                            {dropped > 0 && (
                                <span className="text-[9px] text-amber-300/90 tabular-nums" title="Dropped frames">⚠ {dropped} dropped</span>
                            )}
                        </div>
                        <Btn onClick={onClickStop} title="End stream"
                            className="w-9 h-9 rounded-xl bg-red-500 hover:bg-red-400 active:bg-red-600 text-white ml-1">
                            <StopIcon className="size-[18px]" />
                        </Btn>
                    </div>
                </div>
            </div>
        </div>
    )
}
