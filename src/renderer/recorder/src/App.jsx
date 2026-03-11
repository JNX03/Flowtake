import {
    ArrowPathIcon,
    PauseIcon,
    PlayIcon,
    TrashIcon
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
import Button from "../../components/Button"
import TitleBar from "../../components/TitleBar"
import DeviceRecorder from "../../main/src/DeviceRecorder"

export default function App() {

    const [time, setTime] = useState(0)
    const [intervalId, setIntervalId] = useState(null)
    const [countdown, setCountdown] = useState(null)
    const [isRecording, setIsRecording] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [deviceRecorder, setDeviceRecorder] = useState(null)

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

    return <>
        <TitleBar overlayButtons={1} title={isRecording ? formattedTime : "Recording"} />
        <div className={`h-full w-full py-1 ${cameraMicConfig?.videoTrack ? "px-2" : "px-5"}`}>
            <div className="flex justify-between items-center gap-1 overflow-hidden">

                {(cameraMicConfig?.videoTrack || cameraMicConfig?.audioTrack) &&
                    <div className={`${cameraMicConfig.videoTrack || "hidden"} aspect-square h-10 rounded-sm overflow-hidden`}>
                        <video ref={cameraVideoRef} autoPlay muted className="object-cover h-full w-full bg-base-100" />
                    </div>}

                {countdown !== null && <span className="flex-1 flex items-center justify-center h-10">
                    <span className="font-semibold font-brand text-3xl">{countdown}</span>
                </span>}

                {(!isRecording && countdown === null) && <span className="flex-1 flex items-center justify-center h-10">
                    <span className="loading loading-spinner loading-md"></span>
                </span>}

                {isRecording && <Button
                    onClick={onClickStop}
                    className="btn-error btn-square"
                    icon={StopIcon}
                    size="md"
                />}

                {isRecording && !isPaused && <Button
                    onClick={onClickPause}
                    className="btn-square"
                    icon={PauseIcon}
                    size="sm"
                />}

                {isRecording && isPaused && <Button
                    onClick={onClickResume}
                    className="btn-square"
                    icon={PlayIcon}
                    size="sm"
                />}

                {isRecording && <Button
                    onClick={onClickRestart}
                    className="btn-square"
                    icon={ArrowPathIcon}
                    size="sm"
                />}

                {(isRecording || countdown !== null) && <Button
                    onClick={onClickCancel}
                    className="btn-square"
                    icon={TrashIcon}
                    size="sm"
                />}

            </div>
        </div>
    </>
}