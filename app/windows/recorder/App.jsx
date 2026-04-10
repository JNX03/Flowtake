import {
    ArrowPathIcon,
    CameraIcon,
    DocumentTextIcon,
    MicrophoneIcon,
    PauseIcon,
    PencilIcon,
    PlayIcon,
    TrashIcon,
    VideoCameraIcon,
    VideoCameraSlashIcon,
    XMarkIcon,
} from "@heroicons/react/20/solid"
import { StopIcon } from "@heroicons/react/24/solid"
import { useQuery } from "@tanstack/react-query"
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

const StyleTag = () => (
    <style>{`
        @keyframes rec-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        @keyframes countdown-pop {
            0% { opacity: 0; transform: scale(0.5); }
            50% { opacity: 1; transform: scale(1.15); }
            100% { opacity: 1; transform: scale(1); }
        }
        .rec-dot { animation: rec-pulse 1.2s ease-in-out infinite; }
        .countdown-num { animation: countdown-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }

        /* Kill any window border/background */
        *, *::before, *::after { margin: 0; padding: 0; }
        html, body, #root {
            background: transparent !important;
            border: none !important;
            outline: none !important;
            overflow: hidden;
        }

        /* Dynamic Island morph */
        .island-pill {
            transition: width 380ms cubic-bezier(0.4, 0, 0.15, 1),
                        height 320ms cubic-bezier(0.4, 0, 0.15, 1),
                        border-radius 320ms cubic-bezier(0.4, 0, 0.15, 1),
                        box-shadow 300ms ease;
        }

        /* Fade-in for expanded-only content */
        .expand-fade {
            transition: opacity 220ms ease-out 140ms,
                        transform 220ms ease-out 140ms;
        }
        .expand-fade-hidden {
            opacity: 0;
            transform: scale(0.92) translateX(-4px);
            pointer-events: none;
        }
        .expand-fade-visible {
            opacity: 1;
            transform: scale(1) translateX(0);
            pointer-events: auto;
        }

        /* Subtle glow on hover */
        .island-pill:hover {
            box-shadow: 0 4px 32px rgba(0,0,0,0.6),
                        0 0 0 1px rgba(255,255,255,0.08) inset,
                        0 0 48px rgba(99,102,241,0.07);
        }
    `}</style>
)

// Pill background style
const pillBg = {
    background: "rgba(10, 10, 22, 0.94)",
    backdropFilter: "blur(24px) saturate(1.6)",
    WebkitBackdropFilter: "blur(24px) saturate(1.6)",
    boxShadow: "0 2px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset",
}

// Icon button component — uses relative positioning + z-index to ensure clickability over drag region
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

// Separator
const Divider = () => (
    <div className="w-px h-5 mx-1.5 flex-shrink-0 bg-white/[0.08]" />
)

export default function App() {

    const [time, setTime] = useState(0)
    const [intervalId, setIntervalId] = useState(null)
    const [countdown, setCountdown] = useState(null)
    const [isRecording, setIsRecording] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [deviceRecorder, setDeviceRecorder] = useState(null)
    const [isMicMuted, setIsMicMuted] = useState(false)
    const [isCameraOff, setIsCameraOff] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const [isDrawing, setIsDrawing] = useState(false)
    const [audioStream, setAudioStream] = useState(null)
    const { level } = useAudioMeter(audioStream, isRecording && hasMic)

    // Grab the audio stream from the device recorder once available
    useEffect(() => {
        const stream = deviceRecorder?.mediaRecorder?.stream
        if (stream && stream.getAudioTracks().length > 0) {
            setAudioStream(stream)
        } else {
            setAudioStream(null)
        }
    }, [deviceRecorder, isRecording])

    const formattedTime = useMemo(() => {
        if (typeof moment.duration.fn.format === "undefined") momentDurationFormatSetup(moment)
        return moment.duration(time).format("mm:ss", { trim: false })
    }, [time])

    const timeRef = useRef(time)
    const cameraVideoRef = useRef(null)

    const { data: cameraMicConfig } = useQuery({
        queryKey: ['cameraMicConfig'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-camera-mic-config"),
        staleTime: Infinity
    })

    const hasMic = !!cameraMicConfig?.audioTrack
    const hasCam = !!cameraMicConfig?.videoTrack

    const createDeviceRecorder = useCallback(async () => {
        const recorder = new DeviceRecorder()
        try {
            await recorder.init(cameraMicConfig, cameraVideoRef.current)
            await recorder.initFile()
            setDeviceRecorder(recorder)
        } catch (e) {
            await window.electron.ipcRenderer.invoke("cancel-recording", e.message)
        }
    }, [cameraMicConfig])

    const startRecording = useCallback(async () => {
        await new Promise(resolve => {
            window.electron.ipcRenderer.once('recording-started', (_e, value) => resolve(value))
            window.electron.ipcRenderer.invoke("start-recording")
        })
        try {
            deviceRecorder?.start()
            setIsRecording(true)
        } catch {
            await window.electron.ipcRenderer.invoke(
                "cancel-recording",
                "The selected camera or microphone could not be recorded."
            )
        }
    }, [deviceRecorder])

    useEffect(() => {
        if ((cameraMicConfig?.audioTrack || cameraMicConfig?.videoTrack) && !deviceRecorder) createDeviceRecorder()
    }, [cameraMicConfig, deviceRecorder, createDeviceRecorder])

    useEffect(() => {
        if (cameraMicConfig && (deviceRecorder || (!cameraMicConfig.videoTrack && !cameraMicConfig.audioTrack)))
            setCountdown(3)
    }, [cameraMicConfig, deviceRecorder])

    useEffect(() => {
        if (countdown !== null) {
            let counter = countdown
            let id = setTimeout(() => {
                counter--
                if (counter === 0) {
                    startRecording()
                    setCountdown(null)
                } else setCountdown(counter)
                id = null
            }, 1000)
            return () => { if (id) clearTimeout(id) }
        }
    }, [countdown, startRecording])

    useEffect(() => {
        if (intervalId !== null && (!isRecording || isPaused)) {
            clearInterval(intervalId)
            setIntervalId(null)
        } else if (intervalId === null && isRecording && !isPaused)
            setIntervalId(setInterval(() => setTime(timeRef.current + 1000), 1000))
    }, [intervalId, isRecording, isPaused])

    useEffect(() => {
        timeRef.current = time
    }, [time])

    // ─── Actions ─────────────────────────────────────────────────────

    const onClickStop = async () => {
        setIsRecording(false)
        await deviceRecorder?.stop()
        deviceRecorder?.destroy()
        window.electron.ipcRenderer.invoke("stop-recording")
    }

    const onClickPause = () => {
        setIsPaused(true)
        window.electron.ipcRenderer.invoke("pause-recording", true)
    }

    const onClickResume = () => {
        setIsPaused(false)
        window.electron.ipcRenderer.invoke("pause-recording", false)
    }

    const onClickRestart = async () => {
        setIsRecording(false)
        await deviceRecorder?.stop()
        await window.electron.ipcRenderer.invoke("reset-recording")
        setTime(0)
        setIsPaused(false)
        setIsMicMuted(false)
        setIsCameraOff(false)
        await deviceRecorder?.initFile()
        setCountdown(3)
    }

    const onClickCancel = async () => {
        setIsRecording(false)
        setCountdown(null)
        await deviceRecorder?.stop()
        deviceRecorder?.destroy()
        await window.electron.ipcRenderer.invoke("cancel-recording")
    }

    const toggleMic = () => {
        if (!deviceRecorder?.mediaRecorder?.stream) return
        const newMuted = !isMicMuted
        deviceRecorder.mediaRecorder.stream.getAudioTracks()
            .forEach(track => { track.enabled = !newMuted })
        setIsMicMuted(newMuted)
    }

    const toggleCamera = () => {
        if (!deviceRecorder?.mediaRecorder?.stream) return
        const newOff = !isCameraOff
        deviceRecorder.mediaRecorder.stream.getVideoTracks()
            .forEach(track => { track.enabled = !newOff })
        setIsCameraOff(newOff)
    }

    const openTeleprompter = () => {
        window.electron.ipcRenderer.invoke("add-note")
    }

    const takeScreenshot = () => {
        window.electron.ipcRenderer.invoke("take-recording-screenshot")
    }

    const toggleDrawing = () => {
        setIsDrawing(prev => !prev)
        window.electron.ipcRenderer.invoke("toggle-drawing-overlay")
    }

    // ─── Pre-recording: countdown / loading ──────────────────────────
    if (!isRecording) {
        return (
            <div className="h-full w-full flex items-center justify-center" style={{ padding: 2 }}>
                <StyleTag />
                <div
                    className="island-pill flex items-center justify-center gap-3 overflow-hidden"
                    data-tauri-drag-region
                    style={{
                        ...pillBg,
                        width: countdown !== null ? 160 : 150,
                        height: 52,
                        borderRadius: 26,
                    }}
                >
                    {hasCam && (
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                            <video ref={cameraVideoRef} autoPlay muted className="object-cover h-full w-full bg-base-300" />
                        </div>
                    )}

                    {countdown !== null ? (
                        <>
                            <span key={countdown} className="countdown-num text-[26px] font-bold text-white tabular-nums leading-none">
                                {countdown}
                            </span>
                            <Btn onClick={onClickCancel} title="Cancel"
                                className="w-7 h-7 rounded-full text-white/25 hover:text-white/60 hover:bg-white/[0.08]">
                                <XMarkIcon className="size-4" />
                            </Btn>
                        </>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="loading loading-spinner loading-xs text-indigo-400" style={{ width: 14, height: 14 }}></span>
                            <span className="text-[11px] text-white/30 font-medium">Preparing</span>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ─── Recording: Dynamic Island ───────────────────────────────────

    // Camera preview (shared ref, always in DOM but only visible when hasCam)
    const cameraPreview = hasCam ? (
        <div className="relative w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10">
            <video ref={cameraVideoRef} autoPlay muted
                className={`object-cover h-full w-full bg-base-300 transition-opacity duration-200 ${isCameraOff ? 'opacity-0' : ''}`}
            />
            {isCameraOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-base-300">
                    <VideoCameraSlashIcon className="size-3 opacity-30" />
                </div>
            )}
        </div>
    ) : null

    const recDot = (
        <div className={`rec-dot w-[7px] h-[7px] rounded-full flex-shrink-0 ${isPaused ? 'bg-amber-400' : 'bg-red-500'}`}
            style={isPaused ? { animation: 'none' } : {}} />
    )

    const timer = (
        <span className="font-semibold text-[13px] tabular-nums tracking-tight text-white/90"
            style={{ fontVariantNumeric: "tabular-nums" }}>
            {formattedTime}
        </span>
    )

    if (!isExpanded) {
        // ── COMPACT: just centered dot + timer ──
        return (
            <div
                className="h-full w-full flex items-start justify-center"
                style={{ pointerEvents: "none" }}
            >
                <StyleTag />
                <div
                    className="island-pill mt-1"
                    data-tauri-drag-region
                    onMouseEnter={() => setIsExpanded(true)}
                    style={{
                        ...pillBg,
                        width: 220,
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
                    {recDot}
                    {hasMic && <VolumeMeter level={isMicMuted ? 0 : level} compact />}
                    {timer}
                </div>
            </div>
        )
    }

    // ── EXPANDED: full controls ──
    return (
        <div
            className="h-full w-full flex items-start justify-center"
            style={{ pointerEvents: "none" }}
        >
            <StyleTag />
            <div
                className="island-pill mt-1"
                data-tauri-drag-region
                onMouseLeave={() => setIsExpanded(false)}
                style={{
                    ...pillBg,
                    width: 440,
                    height: 56,
                    borderRadius: 28,
                    display: "flex",
                    alignItems: "center",
                    pointerEvents: "auto",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", width: "100%", height: "100%", padding: "0 20px" }}>

                    {/* ── Left: indicator + timer ── */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8, flexShrink: 0 }}>
                        {cameraPreview}
                        {recDot}
                        {timer}
                    </div>

                    {/* ── Center: tools (shifted right with margin) ── */}
                    <div style={{ display: "flex", alignItems: "center", flexShrink: 0, marginLeft: 16 }}>
                        <Divider />
                        {hasMic && (
                            <div className="flex items-center gap-1">
                                <Btn onClick={toggleMic} title={isMicMuted ? "Unmute mic" : "Mute mic"}
                                    className={`w-8 h-8 rounded-lg ${isMicMuted ? "text-white/20" : "text-white/50 hover:text-white/80 hover:bg-white/[0.06]"}`}>
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
                                className={`w-8 h-8 rounded-lg ${isCameraOff ? "text-white/20" : "text-white/50 hover:text-white/80 hover:bg-white/[0.06]"}`}>
                                {isCameraOff ? <VideoCameraSlashIcon className="size-4" /> : <VideoCameraIcon className="size-4" />}
                            </Btn>
                        )}
                        <div className="w-px h-3.5 mx-1 bg-white/[0.04]" />
                        <Btn onClick={openTeleprompter} title="Teleprompter"
                            className="w-8 h-8 rounded-lg text-white/40 hover:text-indigo-300 hover:bg-indigo-500/10">
                            <DocumentTextIcon className="size-4" />
                        </Btn>
                        <Btn onClick={takeScreenshot} title="Screenshot"
                            className="w-8 h-8 rounded-lg text-white/40 hover:text-amber-300 hover:bg-amber-500/10">
                            <CameraIcon className="size-4" />
                        </Btn>
                        <Btn onClick={toggleDrawing} title="Draw on screen"
                            className={`relative w-8 h-8 rounded-lg ${isDrawing ? "text-indigo-400 bg-indigo-500/15" : "text-white/40 hover:text-emerald-300 hover:bg-emerald-500/10"}`}>
                            <PencilIcon className="size-4" />
                            {isDrawing && (
                                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            )}
                        </Btn>
                    </div>

                    {/* ── Spacer ── */}
                    <div style={{ flex: 1 }} />

                    {/* ── Right: actions ── */}
                    <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                        <Divider />
                        <Btn onClick={onClickRestart} title="Restart"
                            className="w-8 h-8 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/[0.06]">
                            <ArrowPathIcon className="size-4" />
                        </Btn>
                        <Btn onClick={onClickCancel} title="Discard"
                            className="w-8 h-8 rounded-lg text-white/20 hover:text-red-400/80 hover:bg-red-500/10">
                            <TrashIcon className="size-4" />
                        </Btn>

                        {!isPaused ? (
                            <Btn onClick={onClickPause} title="Pause"
                                className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white/90">
                                <PauseIcon className="size-[18px]" />
                            </Btn>
                        ) : (
                            <Btn onClick={onClickResume} title="Resume"
                                className="w-9 h-9 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400">
                                <PlayIcon className="size-[18px]" />
                            </Btn>
                        )}

                        <Btn onClick={onClickStop} title="Stop & save"
                            className="w-9 h-9 rounded-xl bg-red-500 hover:bg-red-400 active:bg-red-600 text-white ml-0.5">
                            <StopIcon className="size-[18px]" />
                        </Btn>
                    </div>
                </div>
            </div>
        </div>
    )
}
