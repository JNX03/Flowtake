import {
    ArrowPathIcon,
    DocumentTextIcon,
    MicrophoneIcon,
    PauseIcon,
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
import DeviceRecorder from "../../main/src/DeviceRecorder"

// ─── Inline style tag for custom animations ──────────────────────
const StyleTag = () => (
    <style>{`
        @keyframes rec-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes rec-ring {
            0% { opacity: 0.5; transform: scale(1); }
            100% { opacity: 0; transform: scale(2.2); }
        }
        @keyframes countdown-pop {
            0% { opacity: 0; transform: scale(0.5); }
            50% { opacity: 1; transform: scale(1.1); }
            100% { opacity: 1; transform: scale(1); }
        }
        .rec-dot { animation: rec-pulse 1.5s ease-in-out infinite; }
        .rec-ring { animation: rec-ring 1.5s ease-out infinite; }
        .countdown-num { animation: countdown-pop 0.35s ease-out; }
    `}</style>
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

    // ─── Shared pill wrapper ─────────────────────────────────────────
    const Pill = ({ children, className = "" }) => (
        <div
            className={`h-full w-full flex items-center select-none rounded-2xl ${className}`}
            style={{
                WebkitAppRegion: "drag",
                background: "#0e0e1f",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
            }}
        >
            {children}
        </div>
    )

    // ─── Divider ─────────────────────────────────────────────────────
    const Divider = () => (
        <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />
    )

    // ─── Control button helper ───────────────────────────────────────
    const CtrlBtn = ({ onClick, title, children, variant = "ghost", active, className = "" }) => {
        const base = "flex items-center justify-center transition-all duration-150 cursor-pointer "
        const variants = {
            ghost: `w-9 h-9 rounded-xl hover:bg-white/[0.08] active:bg-white/[0.12] active:scale-95 ${
                active === false ? "text-white/30" : "text-white/60 hover:text-white/90"
            }`,
            toggle: `w-9 h-9 rounded-xl ${
                active
                    ? "bg-white/[0.12] text-white/90"
                    : "text-white/40 hover:bg-white/[0.06] hover:text-white/70"
            } active:scale-95`,
            pause: "w-10 h-10 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] active:bg-white/[0.18] active:scale-95 text-white/80 hover:text-white",
            resume: "w-10 h-10 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 active:bg-emerald-500/40 active:scale-95 text-emerald-400 hover:text-emerald-300",
            danger: "w-8 h-8 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 active:scale-95",
            stop: "h-10 px-4 gap-2 rounded-xl bg-red-500 hover:bg-red-400 active:bg-red-600 active:scale-[0.97] text-white font-semibold text-[13px] shadow-lg shadow-red-500/20",
        }
        return (
            <button
                onClick={onClick}
                title={title}
                className={`${base} ${variants[variant] || variants.ghost} ${className}`}
                style={{ WebkitAppRegion: "no-drag" }}
            >
                {children}
            </button>
        )
    }

    // ─── Pre-recording: countdown / loading ──────────────────────────
    if (!isRecording) {
        return (
            <div className="h-full w-full px-px py-px">
                <StyleTag />
                <Pill className="px-3">
                    {/* Camera preview */}
                    {hasCam && (
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
                            style={{ boxShadow: "0 0 0 2px rgba(255,255,255,0.1), 0 2px 8px rgba(0,0,0,0.3)" }}
                        >
                            <video ref={cameraVideoRef} autoPlay muted className="object-cover h-full w-full bg-base-300" />
                        </div>
                    )}

                    {/* Countdown number with ring */}
                    {countdown !== null && (
                        <div className="flex-1 flex items-center justify-center gap-3">
                            <div className="relative flex items-center justify-center">
                                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                                    <circle
                                        cx="18" cy="18" r="15"
                                        fill="none"
                                        stroke="rgba(255,255,255,0.06)"
                                        strokeWidth="2"
                                    />
                                    <circle
                                        cx="18" cy="18" r="15"
                                        fill="none"
                                        stroke="url(#countdown-grad)"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeDasharray={`${(countdown / 3) * 94.25} 94.25`}
                                        className="transition-all duration-700 ease-linear"
                                    />
                                    <defs>
                                        <linearGradient id="countdown-grad" x1="0" y1="0" x2="1" y2="1">
                                            <stop offset="0%" stopColor="#818CF8" />
                                            <stop offset="100%" stopColor="#6C5CE7" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <span key={countdown} className="countdown-num absolute font-semibold text-lg tabular-nums text-white">
                                    {countdown}
                                </span>
                            </div>
                            <span className="text-[11px] text-white/30 font-medium tracking-wide uppercase">
                                Starting
                            </span>
                        </div>
                    )}

                    {/* Loading spinner */}
                    {countdown === null && (
                        <div className="flex-1 flex items-center justify-center gap-2.5">
                            <span className="loading loading-spinner loading-sm text-indigo-400"></span>
                            <span className="text-[11px] text-white/30 font-medium">Preparing...</span>
                        </div>
                    )}

                    {/* Cancel */}
                    {countdown !== null && (
                        <CtrlBtn onClick={onClickCancel} title="Cancel recording">
                            <XMarkIcon className="size-4" />
                        </CtrlBtn>
                    )}
                </Pill>
            </div>
        )
    }

    // ─── Recording: full control bar ─────────────────────────────────
    return (
        <div className="h-full w-full px-px py-px">
            <StyleTag />
            <Pill className="px-2.5 gap-0.5">

                {/* ── Left: Recording status ── */}
                <div className="flex items-center gap-2.5 pl-1.5">
                    {/* Camera preview */}
                    {hasCam && (
                        <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
                            style={{ boxShadow: "0 0 0 2px rgba(255,255,255,0.1), 0 2px 8px rgba(0,0,0,0.3)" }}
                        >
                            <video
                                ref={cameraVideoRef}
                                autoPlay
                                muted
                                className={`object-cover h-full w-full bg-base-300 transition-opacity duration-300 ${isCameraOff ? 'opacity-0' : ''}`}
                            />
                            {isCameraOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-base-300">
                                    <VideoCameraSlashIcon className="size-3.5 opacity-30" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Recording dot + timer */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex items-center justify-center w-3.5 h-3.5">
                            {!isPaused && (
                                <div className="rec-ring absolute w-3 h-3 rounded-full bg-red-500/30" />
                            )}
                            <div className={`rec-dot w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                                isPaused ? 'bg-amber-400' : 'bg-red-500'
                            }`} style={isPaused ? { animation: 'none' } : {}} />
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="font-semibold text-[15px] tabular-nums tracking-tight text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
                                {formattedTime}
                            </span>
                            {isPaused && (
                                <span className="text-[9px] text-amber-400/80 font-bold tracking-[0.15em] mt-0.5">
                                    PAUSED
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <Divider />

                {/* ── Center: Device toggles ── */}
                <div className="flex items-center gap-0.5 px-0.5">
                    {hasMic && (
                        <CtrlBtn
                            onClick={toggleMic}
                            title={isMicMuted ? "Unmute microphone" : "Mute microphone"}
                            variant="toggle"
                            active={!isMicMuted}
                        >
                            <div className="relative">
                                <MicrophoneIcon className="size-4" />
                                {isMicMuted && (
                                    <div className="absolute -top-0.5 -right-0.5 -bottom-0.5 -left-0.5 flex items-center justify-center">
                                        <div className="w-[1.5px] h-[18px] bg-red-400 rotate-45 rounded-full" />
                                    </div>
                                )}
                            </div>
                        </CtrlBtn>
                    )}

                    {hasCam && (
                        <CtrlBtn
                            onClick={toggleCamera}
                            title={isCameraOff ? "Turn on camera" : "Turn off camera"}
                            variant="toggle"
                            active={!isCameraOff}
                        >
                            {isCameraOff
                                ? <VideoCameraSlashIcon className="size-4" />
                                : <VideoCameraIcon className="size-4" />
                            }
                        </CtrlBtn>
                    )}

                    <CtrlBtn onClick={openTeleprompter} title="Teleprompter" variant="toggle">
                        <DocumentTextIcon className="size-4" />
                    </CtrlBtn>
                </div>

                <Divider />

                {/* ── Right: Actions ── */}
                <div className="flex items-center gap-1 pr-1">
                    {/* Pause / Resume — distinct states */}
                    {!isPaused ? (
                        <CtrlBtn onClick={onClickPause} title="Pause" variant="pause">
                            <PauseIcon className="size-[18px]" />
                        </CtrlBtn>
                    ) : (
                        <CtrlBtn onClick={onClickResume} title="Resume" variant="resume">
                            <PlayIcon className="size-[18px]" />
                        </CtrlBtn>
                    )}

                    {/* Restart — subtle destructive */}
                    <CtrlBtn onClick={onClickRestart} title="Restart" variant="danger">
                        <ArrowPathIcon className="size-3.5" />
                    </CtrlBtn>

                    {/* Cancel — subtle destructive */}
                    <CtrlBtn onClick={onClickCancel} title="Discard" variant="danger">
                        <TrashIcon className="size-3.5" />
                    </CtrlBtn>

                    {/* Stop — THE primary action, labeled */}
                    <CtrlBtn onClick={onClickStop} title="Stop & save" variant="stop">
                        <StopIcon className="size-4" />
                        <span>Stop</span>
                    </CtrlBtn>
                </div>

            </Pill>
        </div>
    )
}
