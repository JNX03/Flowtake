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
            setCountdown(5)
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
        setCountdown(5)
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
                background: "rgba(15, 15, 35, 0.85)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset",
            }}
        >
            {children}
        </div>
    )

    // ─── Control button helper ───────────────────────────────────────
    const CtrlBtn = ({ onClick, title, children, variant = "ghost", className = "" }) => {
        const base = "flex items-center justify-center rounded-lg transition-all duration-150 "
        const variants = {
            ghost: "w-8 h-8 hover:bg-white/10 active:bg-white/15 text-base-content/70 hover:text-base-content",
            stop: "w-9 h-9 bg-red-500 hover:bg-red-400 active:bg-red-600 text-white shadow-lg shadow-red-500/25",
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
            <div className="h-full w-full p-1">
                <Pill>
                    {/* Camera preview */}
                    {hasCam && (
                        <div className="ml-3 w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/10">
                            <video ref={cameraVideoRef} autoPlay muted className="object-cover h-full w-full bg-base-300" />
                        </div>
                    )}

                    {/* Countdown number with ring */}
                    {countdown !== null && (
                        <div className="flex-1 flex items-center justify-center gap-3">
                            <div className="relative flex items-center justify-center">
                                {/* Animated ring */}
                                <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                                    <circle
                                        cx="18" cy="18" r="15"
                                        fill="none"
                                        stroke="rgba(255,255,255,0.08)"
                                        strokeWidth="2.5"
                                    />
                                    <circle
                                        cx="18" cy="18" r="15"
                                        fill="none"
                                        stroke="#6C5CE7"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeDasharray={`${(countdown / 5) * 94.25} 94.25`}
                                        className="transition-all duration-700 ease-linear"
                                    />
                                </svg>
                                <span className="absolute font-semibold font-brand text-lg tabular-nums text-white">
                                    {countdown}
                                </span>
                            </div>
                            <span className="text-[11px] text-base-content/40 font-medium tracking-wide uppercase">
                                Starting...
                            </span>
                        </div>
                    )}

                    {/* Loading spinner */}
                    {countdown === null && (
                        <div className="flex-1 flex items-center justify-center gap-2">
                            <span className="loading loading-spinner loading-sm text-primary"></span>
                            <span className="text-[11px] text-base-content/40 font-medium">Preparing...</span>
                        </div>
                    )}

                    {/* Cancel */}
                    {countdown !== null && (
                        <div className="mr-2">
                            <CtrlBtn onClick={onClickCancel} title="Cancel recording">
                                <XMarkIcon className="size-4" />
                            </CtrlBtn>
                        </div>
                    )}
                </Pill>
            </div>
        )
    }

    // ─── Recording: full control bar ─────────────────────────────────
    return (
        <div className="h-full w-full p-1">
            <Pill className="px-2 gap-1">

                {/* Left section: status indicator */}
                <div className="flex items-center gap-2.5 pl-2">
                    {/* Camera preview */}
                    {hasCam && (
                        <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/10">
                            <video
                                ref={cameraVideoRef}
                                autoPlay
                                muted
                                className={`object-cover h-full w-full bg-base-300 transition-opacity ${isCameraOff ? 'opacity-0' : ''}`}
                            />
                            {isCameraOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-base-300">
                                    <VideoCameraSlashIcon className="size-3 opacity-30" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Recording dot + timer */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex items-center justify-center w-3 h-3">
                            {!isPaused && (
                                <div className="absolute w-3 h-3 rounded-full bg-red-500/40 animate-ping" />
                            )}
                            <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                                isPaused ? 'bg-amber-400' : 'bg-red-500'
                            }`} />
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="font-brand font-semibold text-sm tabular-nums tracking-tight text-white">
                                {formattedTime}
                            </span>
                            {isPaused && (
                                <span className="text-[9px] text-amber-400 font-bold tracking-widest mt-0.5">
                                    PAUSED
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Center: device toggles */}
                <div className="flex-1 flex items-center justify-center">
                    <div
                        className="flex items-center gap-0.5 rounded-lg p-0.5"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                        {hasMic && (
                            <CtrlBtn
                                onClick={toggleMic}
                                title={isMicMuted ? "Unmute microphone" : "Mute microphone"}
                                className={isMicMuted ? "!text-red-400" : ""}
                            >
                                <div className="relative">
                                    <MicrophoneIcon className="size-3.5" />
                                    {isMicMuted && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-[1.5px] h-4 bg-red-400 rotate-45 rounded-full" />
                                        </div>
                                    )}
                                </div>
                            </CtrlBtn>
                        )}

                        {hasCam && (
                            <CtrlBtn
                                onClick={toggleCamera}
                                title={isCameraOff ? "Turn on camera" : "Turn off camera"}
                                className={isCameraOff ? "!text-red-400" : ""}
                            >
                                {isCameraOff
                                    ? <VideoCameraSlashIcon className="size-3.5" />
                                    : <VideoCameraIcon className="size-3.5" />
                                }
                            </CtrlBtn>
                        )}

                        <CtrlBtn onClick={openTeleprompter} title="Open teleprompter">
                            <DocumentTextIcon className="size-3.5" />
                        </CtrlBtn>
                    </div>
                </div>

                {/* Right: recording actions */}
                <div className="flex items-center gap-1 pr-1.5">
                    {/* Pause / Resume */}
                    {!isPaused ? (
                        <CtrlBtn onClick={onClickPause} title="Pause recording">
                            <PauseIcon className="size-4" />
                        </CtrlBtn>
                    ) : (
                        <CtrlBtn onClick={onClickResume} title="Resume recording" className="!text-emerald-400 hover:!text-emerald-300">
                            <PlayIcon className="size-4" />
                        </CtrlBtn>
                    )}

                    {/* Restart */}
                    <CtrlBtn onClick={onClickRestart} title="Restart recording">
                        <ArrowPathIcon className="size-3.5" />
                    </CtrlBtn>

                    {/* Cancel */}
                    <CtrlBtn onClick={onClickCancel} title="Cancel recording">
                        <TrashIcon className="size-3.5" />
                    </CtrlBtn>

                    {/* Stop — the most important button, visually prominent */}
                    <CtrlBtn
                        onClick={onClickStop}
                        title="Stop & save recording"
                        variant="stop"
                    >
                        <StopIcon className="size-4" />
                    </CtrlBtn>
                </div>

            </Pill>
        </div>
    )
}
