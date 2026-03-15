import {
    ArrowPathIcon,
    DocumentTextIcon,
    MicrophoneIcon,
    PauseIcon,
    PlayIcon,
    TrashIcon,
    VideoCameraIcon,
    VideoCameraSlashIcon,
} from "@heroicons/react/20/solid"
import { StopIcon } from "@heroicons/react/24/outline"
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

    // Pre-recording states (loading / countdown)
    if (!isRecording) {
        return (
            <div
                className="h-full w-full flex items-center justify-between px-3 select-none"
                style={{ WebkitAppRegion: "drag" }}
            >
                {/* Camera preview */}
                {hasCam && (
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-base-content/20">
                        <video ref={cameraVideoRef} autoPlay muted className="object-cover h-full w-full bg-base-100" />
                    </div>
                )}

                {/* Countdown */}
                {countdown !== null && (
                    <div className="flex-1 flex items-center justify-center">
                        <span className="font-semibold font-brand text-2xl tabular-nums">{countdown}</span>
                    </div>
                )}

                {/* Loading spinner */}
                {countdown === null && (
                    <div className="flex-1 flex items-center justify-center">
                        <span className="loading loading-spinner loading-sm"></span>
                    </div>
                )}

                {/* Cancel */}
                {countdown !== null && (
                    <button
                        onClick={onClickCancel}
                        className="btn btn-xs btn-ghost btn-square"
                        title="Cancel"
                        style={{ WebkitAppRegion: "no-drag" }}
                    >
                        <TrashIcon className="size-3.5" />
                    </button>
                )}
            </div>
        )
    }

    // Recording state - full control bar
    return (
        <div
            className="h-full w-full flex items-center px-2 gap-0.5 select-none"
            style={{ WebkitAppRegion: "drag" }}
        >
            {/* Camera preview circle */}
            {hasCam && (
                <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-base-content/20">
                    <video
                        ref={cameraVideoRef}
                        autoPlay
                        muted
                        className={`object-cover h-full w-full bg-base-100 transition-opacity ${isCameraOff ? 'opacity-0' : ''}`}
                    />
                    {isCameraOff && (
                        <div className="absolute inset-0 flex items-center justify-center bg-base-100">
                            <VideoCameraSlashIcon className="size-3 opacity-40" />
                        </div>
                    )}
                </div>
            )}

            {/* Recording indicator + Timer */}
            <div className="flex items-center gap-1.5 px-1.5 min-w-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPaused ? 'bg-warning' : 'bg-red-500 animate-pulse'}`} />
                <span className="font-brand font-semibold text-xs tabular-nums tracking-tight">
                    {formattedTime}
                </span>
                {isPaused && (
                    <span className="text-[9px] text-warning font-bold tracking-wider">PAUSED</span>
                )}
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-base-content/15 mx-0.5 flex-shrink-0" />

            {/* Toggle controls: Mic, Camera, Teleprompter */}
            <div className="flex items-center" style={{ WebkitAppRegion: "no-drag" }}>
                {hasMic && (
                    <button
                        onClick={toggleMic}
                        className={`btn btn-xs btn-square btn-ghost relative ${isMicMuted ? 'text-error' : ''}`}
                        title={isMicMuted ? "Unmute microphone" : "Mute microphone"}
                    >
                        <MicrophoneIcon className="size-3.5" />
                        {isMicMuted && (
                            <div className="absolute w-[1.5px] h-4 bg-error rotate-45 rounded-full" />
                        )}
                    </button>
                )}

                {hasCam && (
                    <button
                        onClick={toggleCamera}
                        className={`btn btn-xs btn-square btn-ghost ${isCameraOff ? 'text-error' : ''}`}
                        title={isCameraOff ? "Turn on camera" : "Turn off camera"}
                    >
                        {isCameraOff
                            ? <VideoCameraSlashIcon className="size-3.5" />
                            : <VideoCameraIcon className="size-3.5" />
                        }
                    </button>
                )}

                <button
                    onClick={openTeleprompter}
                    className="btn btn-xs btn-square btn-ghost"
                    title="Open teleprompter"
                >
                    <DocumentTextIcon className="size-3.5" />
                </button>
            </div>

            {/* Spacer */}
            <div className="flex-1 min-w-1" />

            {/* Divider */}
            <div className="w-px h-5 bg-base-content/15 mx-0.5 flex-shrink-0" />

            {/* Recording controls */}
            <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: "no-drag" }}>
                {/* Pause / Resume */}
                {!isPaused ? (
                    <button
                        onClick={onClickPause}
                        className="btn btn-xs btn-square btn-ghost"
                        title="Pause recording"
                    >
                        <PauseIcon className="size-3.5" />
                    </button>
                ) : (
                    <button
                        onClick={onClickResume}
                        className="btn btn-xs btn-square btn-ghost text-accent"
                        title="Resume recording"
                    >
                        <PlayIcon className="size-3.5" />
                    </button>
                )}

                {/* Restart */}
                <button
                    onClick={onClickRestart}
                    className="btn btn-xs btn-square btn-ghost"
                    title="Restart recording"
                >
                    <ArrowPathIcon className="size-3.5" />
                </button>

                {/* Cancel */}
                <button
                    onClick={onClickCancel}
                    className="btn btn-xs btn-square btn-ghost"
                    title="Cancel recording"
                >
                    <TrashIcon className="size-3.5" />
                </button>

                {/* Stop - prominent red button */}
                <button
                    onClick={onClickStop}
                    className="btn btn-sm btn-square btn-error ml-1"
                    title="Stop & save recording"
                >
                    <StopIcon className="size-4" />
                </button>
            </div>
        </div>
    )
}
