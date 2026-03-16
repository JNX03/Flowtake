import {
    ArrowPathIcon,
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

const StyleTag = () => (
    <style>{`
        @keyframes rec-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        @keyframes countdown-pop {
            0% { opacity: 0; transform: scale(0.5); }
            50% { opacity: 1; transform: scale(1.1); }
            100% { opacity: 1; transform: scale(1); }
        }
        .rec-dot { animation: rec-pulse 1.2s ease-in-out infinite; }
        .countdown-num { animation: countdown-pop 0.3s ease-out; }
        html, body { background: transparent !important; }
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

    // ─── Icon button ─────────────────────────────────────────────────
    const Btn = ({ onClick, title, children, className = "" }) => (
        <button
            onClick={onClick}
            title={title}
            className={`flex items-center justify-center transition-all duration-75 cursor-pointer flex-shrink-0 active:scale-90 ${className}`}
            style={{ WebkitAppRegion: "no-drag" }}
        >
            {children}
        </button>
    )

    // Pill wrapper
    const pill = "h-full w-full flex items-center rounded-[8px]"
    const pillBg = {
        background: "rgba(10, 10, 22, 0.92)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 2px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06) inset",
    }

    // ─── Pre-recording: countdown / loading ──────────────────────────
    if (!isRecording) {
        return (
            <div className="h-full w-full p-[2px]">
                <StyleTag />
                <div className={pill + " px-2.5 justify-between"} style={{ ...pillBg, WebkitAppRegion: "drag" }}>
                    {hasCam && (
                        <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                            <video ref={cameraVideoRef} autoPlay muted className="object-cover h-full w-full bg-base-300" />
                        </div>
                    )}

                    {countdown !== null ? (
                        <div className="flex-1 flex items-center justify-center gap-1.5">
                            <div className="relative flex items-center justify-center w-5 h-5">
                                <svg className="w-5 h-5 -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                                    <circle cx="18" cy="18" r="15" fill="none" stroke="#818CF8" strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeDasharray={`${(countdown / 3) * 94.25} 94.25`}
                                        className="transition-all duration-700 ease-linear"
                                    />
                                </svg>
                                <span key={countdown} className="countdown-num absolute font-bold text-[10px] tabular-nums text-white">
                                    {countdown}
                                </span>
                            </div>
                            <span className="text-[9px] text-white/30 font-medium tracking-wider uppercase">Starting</span>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center gap-1.5">
                            <span className="loading loading-spinner loading-xs text-indigo-400" style={{ width: 10, height: 10 }}></span>
                            <span className="text-[9px] text-white/30 font-medium">Preparing...</span>
                        </div>
                    )}

                    {countdown !== null && (
                        <Btn onClick={onClickCancel} title="Cancel" className="w-5 h-5 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.06]">
                            <XMarkIcon className="size-2.5" />
                        </Btn>
                    )}
                </div>
            </div>
        )
    }

    // ─── Recording: control bar ──────────────────────────────────────
    return (
        <div className="h-full w-full p-[2px]">
            <StyleTag />
            <div className={pill + " px-1.5 gap-0.5"} style={{ ...pillBg, WebkitAppRegion: "drag" }}>

                {/* Recording indicator + timer */}
                <div className="flex items-center gap-1 flex-shrink-0 pl-1">
                    {hasCam && (
                        <div className="relative w-5 h-5 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                            <video ref={cameraVideoRef} autoPlay muted
                                className={`object-cover h-full w-full bg-base-300 transition-opacity duration-200 ${isCameraOff ? 'opacity-0' : ''}`}
                            />
                            {isCameraOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-base-300">
                                    <VideoCameraSlashIcon className="size-2 opacity-30" />
                                </div>
                            )}
                        </div>
                    )}
                    <div className={`rec-dot w-[5px] h-[5px] rounded-full flex-shrink-0 ${isPaused ? 'bg-amber-400' : 'bg-red-500'}`}
                        style={isPaused ? { animation: 'none' } : {}} />
                    <span className="font-semibold text-[11px] tabular-nums tracking-tight text-white/90 min-w-[34px]"
                        style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formattedTime}
                    </span>
                </div>

                {/* Separator */}
                <div className="w-px h-3.5 mx-0.5 flex-shrink-0 bg-white/[0.06]" />

                {/* Device toggles */}
                <div className="flex items-center flex-shrink-0">
                    {hasMic && (
                        <Btn onClick={toggleMic} title={isMicMuted ? "Unmute" : "Mute"}
                            className={`w-5 h-5 rounded ${isMicMuted ? "text-white/20" : "text-white/50 hover:text-white/80 hover:bg-white/[0.06]"}`}>
                            <div className="relative">
                                <MicrophoneIcon className="size-2.5" />
                                {isMicMuted && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-[1px] h-2.5 bg-red-400/80 rotate-45 rounded-full" />
                                    </div>
                                )}
                            </div>
                        </Btn>
                    )}
                    {hasCam && (
                        <Btn onClick={toggleCamera} title={isCameraOff ? "Camera on" : "Camera off"}
                            className={`w-5 h-5 rounded ${isCameraOff ? "text-white/20" : "text-white/50 hover:text-white/80 hover:bg-white/[0.06]"}`}>
                            {isCameraOff ? <VideoCameraSlashIcon className="size-2.5" /> : <VideoCameraIcon className="size-2.5" />}
                        </Btn>
                    )}
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Actions */}
                <div className="flex items-center gap-px flex-shrink-0">
                    <Btn onClick={onClickRestart} title="Restart"
                        className="w-5 h-5 rounded text-white/20 hover:text-white/50 hover:bg-white/[0.06]">
                        <ArrowPathIcon className="size-2.5" />
                    </Btn>
                    <Btn onClick={onClickCancel} title="Discard"
                        className="w-5 h-5 rounded text-white/20 hover:text-red-400/80 hover:bg-red-500/10">
                        <TrashIcon className="size-2.5" />
                    </Btn>

                    {/* Pause / Resume */}
                    {!isPaused ? (
                        <Btn onClick={onClickPause} title="Pause"
                            className="w-6 h-6 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white/90">
                            <PauseIcon className="size-3" />
                        </Btn>
                    ) : (
                        <Btn onClick={onClickResume} title="Resume"
                            className="w-6 h-6 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400">
                            <PlayIcon className="size-3" />
                        </Btn>
                    )}

                    {/* Stop — primary action */}
                    <Btn onClick={onClickStop} title="Stop & save"
                        className="w-6 h-6 rounded-md bg-red-500 hover:bg-red-400 active:bg-red-600 text-white ml-0.5">
                        <StopIcon className="size-3" />
                    </Btn>
                </div>
            </div>
        </div>
    )
}
