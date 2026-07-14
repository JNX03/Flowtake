import {
    ArrowPathIcon,
    CameraIcon,
    DocumentTextIcon,
    MicrophoneIcon,
    PencilIcon,
    RectangleGroupIcon,
    TrashIcon,
    VideoCameraIcon,
    VideoCameraSlashIcon,
    XMarkIcon,
} from "@heroicons/react/20/solid"
import { StopIcon } from "@heroicons/react/24/solid"
import { ask } from "@tauri-apps/plugin-dialog"
import { useQuery } from "@tanstack/react-query"
import moment from "moment"
import momentDurationFormatSetup from "moment-duration-format"
import {
    lazy,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import DeviceRecorder from "../main/DeviceRecorder"
import useAudioMeter from "@shared/hooks/useAudioMeter"
import VolumeMeter from "../../components/VolumeMeter"

const RecorderTutorial = lazy(() => import("./components/RecorderTutorial"))

const IDLE_ACTION = {
    status: "idle",
    message: "Recording in progress",
}

const BUSY_ACTIONS = new Set(["confirming", "saving", "restarting", "discarding"])

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
const Btn = ({
    onClick,
    title,
    children,
    className = "",
    dataTutorial,
    disabled = false,
    ariaPressed,
}) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        aria-pressed={ariaPressed}
        disabled={disabled}
        className={`relative z-10 flex items-center justify-center transition-all duration-100 cursor-pointer flex-shrink-0 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${className}`}
        style={{ WebkitUserSelect: "none" }}
        data-tutorial={dataTutorial}
    >
        {children}
    </button>
)

// Separator
const Divider = () => (
    <div className="w-px h-5 mx-1.5 flex-shrink-0 bg-white/[0.08]" />
)

// "+N apps" chip used in both the pre-recording and recording pills when the
// Individual App Recording plugin is configured.
const AppBadge = ({ count, title, status = "planned" }) => (
    <span
        title={title}
        aria-label={title}
        className={`flex items-center gap-1 px-1.5 py-[2px] rounded-full text-[10px] font-semibold flex-shrink-0 ${
            status === "failed"
                ? "bg-red-500/20 text-red-200"
                : status === "partial"
                    ? "bg-amber-500/20 text-amber-200"
                    : "bg-indigo-500/20 text-indigo-200"
        }`}>
        <RectangleGroupIcon className="size-3" />
        {status === "failed" ? "!" : `+${count}`}
    </span>
)

export default function App() {

    const [time, setTime] = useState(0)
    const [intervalId, setIntervalId] = useState(null)
    const [countdown, setCountdown] = useState(null)
    const [isRecording, setIsRecording] = useState(false)
    const [isCaptureFinalized, setIsCaptureFinalized] = useState(false)
    const [deviceRecorder, setDeviceRecorder] = useState(null)
    const [isMicMuted, setIsMicMuted] = useState(false)
    const [isCameraOff, setIsCameraOff] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const [isExpansionPinned, setIsExpansionPinned] = useState(false)
    const [isDrawing, setIsDrawing] = useState(false)
    const [audioStream, setAudioStream] = useState(null)
    const [tutorialActive, setTutorialActive] = useState(false)
    const [appCaptureStatus, setAppCaptureStatus] = useState(null)
    const [actionState, setActionState] = useState(IDLE_ACTION)

    const { data: cameraMicConfig } = useQuery({
        queryKey: ['cameraMicConfig'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-camera-mic-config"),
        staleTime: Infinity
    })

    const { data: pluginSettings } = useQuery({
        queryKey: ["pluginSettings"],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "plugins.settings"),
        staleTime: Infinity,
    })

    const isKeyboardOverlayEnabled = !!pluginSettings?.enabled?.keyboardOverlay
    const isAppRecordingEnabled = !!pluginSettings?.enabled?.appRecording
    const appRecordingWindows = useMemo(
        () => pluginSettings?.config?.appRecording?.windows || [],
        [pluginSettings]
    )
    const showAppBadge = isAppRecordingEnabled && appRecordingWindows.length > 0
    const appBadgeStatus = appCaptureStatus?.status || "planned"
    const appBadgeCount = appCaptureStatus?.count ?? appRecordingWindows.length
    const appBadgeTitle = appCaptureStatus?.message || (showAppBadge
        ? `Also capturing: ${appRecordingWindows.map(w => w.name).join(", ")}`
        : "")

    const hasMic = !!cameraMicConfig?.audioTrack
    const hasCam = !!cameraMicConfig?.videoTrack

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

    useEffect(() => {
        const preview = cameraVideoRef.current
        const stream = deviceRecorder?.stream
        if (!preview || !stream) return

        // The countdown, compact recorder, and expanded recorder render
        // different <video> elements. Reattach the live stream whenever that
        // element changes so the camera control never turns into a blank dot.
        preview.srcObject = stream
        return () => {
            if (preview.srcObject === stream) preview.srcObject = null
        }
    }, [deviceRecorder, isRecording, isExpanded])

    const formattedTime = useMemo(() => {
        if (typeof moment.duration.fn.format === "undefined") momentDurationFormatSetup(moment)
        return moment.duration(time).format("mm:ss", { trim: false })
    }, [time])

    const timeRef = useRef(time)
    const cameraVideoRef = useRef(null)
    const recordingStartClaimRef = useRef(false)
    const deviceRecorderInitRef = useRef(null)
    const countdownArmedRef = useRef(false)
    const actionLockRef = useRef(false)

    const createDeviceRecorder = useCallback(async () => {
        if (deviceRecorderInitRef.current) return deviceRecorderInitRef.current

        const initPromise = (async () => {
            const recorder = new DeviceRecorder()
            try {
                await recorder.init(cameraMicConfig, cameraVideoRef.current)
                await recorder.initFile()
                setDeviceRecorder(recorder)
                return recorder
            } catch (e) {
                recorder.destroy()
                await window.electron.ipcRenderer.invoke("cancel-recording", e.message)
                return null
            }
        })()
        deviceRecorderInitRef.current = initPromise

        try {
            return await initPromise
        } finally {
            if (deviceRecorderInitRef.current === initPromise) {
                deviceRecorderInitRef.current = null
            }
        }
    }, [cameraMicConfig])

    const startRecording = useCallback(async () => {
        if (recordingStartClaimRef.current) return
        recordingStartClaimRef.current = true
        try {
            setIsCaptureFinalized(false)
            setAppCaptureStatus(null)
            // Await the command itself instead of waiting only for the success
            // event. If FFmpeg cannot start, the command rejects; the previous
            // event-only path waited forever and left the countdown overlay
            // stranded with no actionable error.
            await window.electron.ipcRenderer.invoke("start-recording")
            await deviceRecorder?.start()
            setIsRecording(true)
            if (isKeyboardOverlayEnabled) {
                try { await window.electron.ipcRenderer.invoke("keyboard-start") } catch (e) { console.warn("[plugin] keyboard-start failed:", e) }
            }
            if (isAppRecordingEnabled && appRecordingWindows.length > 0) {
                try {
                    // Plugin selection only persists id+name. Fetch fresh window list to grab geometry.
                    const all = await window.electron.ipcRenderer.invoke("get-windows")
                    const picked = appRecordingWindows
                        .map(w => all?.find(x => x.id === w.id))
                        .filter(Boolean)
                        .map(w => ({
                            id: String(w.id),
                            name: w.name || "App",
                            x: w.x ?? 0,
                            y: w.y ?? 0,
                            width: w.width ?? 0,
                            height: w.height ?? 0,
                        }))
                        .filter(w => w.width > 0 && w.height > 0)
                    if (picked.length > 0) {
                        const tracks = await window.electron.ipcRenderer.invoke("start-multi-app-capture", picked)
                        const started = Array.isArray(tracks) ? tracks.length : 0
                        if (started === 0) {
                            setAppCaptureStatus({
                                status: "failed",
                                count: 0,
                                message: "Individual app recording could not start. The main recording is still running.",
                            })
                        } else if (started < picked.length) {
                            setAppCaptureStatus({
                                status: "partial",
                                count: started,
                                message: `${started} of ${picked.length} individual app captures started.`,
                            })
                        } else {
                            setAppCaptureStatus({
                                status: "active",
                                count: started,
                                message: `${started} individual app ${started === 1 ? "capture" : "captures"} active.`,
                            })
                        }
                    } else {
                        setAppCaptureStatus({
                            status: "failed",
                            count: 0,
                            message: "The selected app windows are no longer available. The main recording is still running.",
                        })
                    }
                } catch (e) {
                    console.warn("[plugin] start-multi-app-capture failed:", e)
                    setAppCaptureStatus({
                        status: "failed",
                        count: 0,
                        message: "Individual app recording failed. The main recording is still running.",
                    })
                }
            }
        } catch (error) {
            recordingStartClaimRef.current = false
            await window.electron.ipcRenderer.invoke(
                "cancel-recording",
                error?.message || String(error) || "The selected source could not be recorded."
            )
        }
    }, [deviceRecorder, isKeyboardOverlayEnabled, isAppRecordingEnabled, appRecordingWindows])

    useEffect(() => {
        if ((cameraMicConfig?.audioTrack || cameraMicConfig?.videoTrack) && !deviceRecorder) createDeviceRecorder()
    }, [cameraMicConfig, deviceRecorder, createDeviceRecorder])

    useEffect(() => {
        if (
            !countdownArmedRef.current
            && cameraMicConfig
            && (deviceRecorder || (!cameraMicConfig.videoTrack && !cameraMicConfig.audioTrack))
        ) {
            countdownArmedRef.current = true
            setCountdown(3)
        }
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
        if (intervalId !== null && (!isRecording || isCaptureFinalized)) {
            clearInterval(intervalId)
            setIntervalId(null)
        } else if (intervalId === null && isRecording && !isCaptureFinalized)
            setIntervalId(setInterval(() => setTime(timeRef.current + 1000), 1000))
    }, [intervalId, isRecording, isCaptureFinalized])

    useEffect(() => {
        timeRef.current = time
    }, [time])

    // ─── Actions ─────────────────────────────────────────────────────

    // Keep destructive actions serialized. React state alone is not enough here:
    // two pointer events can arrive before a render disables the buttons.
    const beginAction = (status, message) => {
        if (actionLockRef.current) return false
        actionLockRef.current = true
        setActionState({ status, message })
        return true
    }

    const releaseAction = (nextState = IDLE_ACTION) => {
        actionLockRef.current = false
        setActionState(nextState)
    }

    const failAction = (verb, error, message) => {
        console.error(`[recorder] Could not ${verb}:`, error)
        const detail = error?.message || String(error || "Unknown error")
        releaseAction({
            status: "error",
            message: message || `Couldn’t ${verb}: ${detail}`,
        })
    }

    const stopRuntimeFeatures = async ({ stopAppCapture = true } = {}) => {
        if (isKeyboardOverlayEnabled) {
            try {
                await window.electron.ipcRenderer.invoke("keyboard-stop")
            } catch (error) {
                console.warn("[plugin] keyboard-stop failed:", error)
            }
        }
        if (stopAppCapture && isAppRecordingEnabled) {
            try {
                await window.electron.ipcRenderer.invoke("stop-multi-app-capture")
            } catch (error) {
                console.warn("[plugin] stop-multi-app-capture failed:", error)
            }
        }
    }

    const onClickStop = async () => {
        if (!beginAction("saving", "Saving recording…")) return
        let captureWasFinalized = isCaptureFinalized

        try {
            try {
                await deviceRecorder?.stop()
            } catch (error) {
                const detail = error?.message || String(error || "Unknown error")
                throw new Error(`Camera or microphone track could not be finalized. ${detail}`)
            }
            // Native stop is the single owner of app-layer shutdown and
            // validation. Calling the plugin stop first could reject before
            // the primary FFmpeg process was stopped, leaving the take live
            // behind a Retry button.
            await stopRuntimeFeatures({ stopAppCapture: false })
            // stop-recording owns graceful capture shutdown and packaging.
            // From this point the timer and live-device controls must not imply
            // that frames are still being captured if packaging later rejects.
            captureWasFinalized = true
            setIsCaptureFinalized(true)
            await window.electron.ipcRenderer.invoke("stop-recording")
            // Keep the recorder and its retry/discard controls alive until the
            // native archive and project-store transaction has fully succeeded.
            deviceRecorder?.destroy()
            setIsRecording(false)
        } catch (error) {
            const detail = error?.message || String(error || "Unknown error")
            failAction(
                "save the recording",
                error,
                captureWasFinalized
                    ? `Recording stopped. Save failed — ${detail}`
                    : undefined
            )
        }
    }

    const onClickRestart = async () => {
        if (!beginAction("confirming", "Confirm restart…")) return

        let confirmed
        try {
            confirmed = await ask("Restart this recording? The current take will be permanently discarded.", {
                title: "Restart recording",
                kind: "warning",
                okLabel: "Restart",
                cancelLabel: "Keep recording",
            })
        } catch (error) {
            failAction("open the restart confirmation", error)
            return
        }

        if (!confirmed) {
            releaseAction()
            return
        }

        setActionState({ status: "restarting", message: "Restarting recording…" })
        setCountdown(null)
        setIsRecording(false)
        let resetCompleted = false

        try {
            try {
                await deviceRecorder?.stop()
            } catch (error) {
                console.warn("[recorder] Device track finalization failed during restart:", error)
            }
            await stopRuntimeFeatures()
            await window.electron.ipcRenderer.invoke("reset-recording")
            resetCompleted = true
            recordingStartClaimRef.current = false
            setIsCaptureFinalized(false)
            setTime(0)

            // Muting toggles MediaStreamTrack.enabled. Resetting only the React
            // labels left the real tracks muted/off on the next take.
            deviceRecorder?.stream?.getTracks().forEach(track => {
                track.enabled = true
            })
            setIsMicMuted(false)
            setIsCameraOff(false)
            setAppCaptureStatus(null)
            await deviceRecorder?.initFile()

            releaseAction()
            setCountdown(3)
        } catch (error) {
            // If the native reset itself failed, keep Stop & save available for
            // the original screen capture. Otherwise show a cancellable error.
            setIsRecording(!resetCompleted)
            failAction("restart the recording", error)
        }
    }

    const onClickCancel = async () => {
        const hasCurrentTake = isRecording || timeRef.current > 0
        if (!beginAction(
            hasCurrentTake ? "confirming" : "discarding",
            hasCurrentTake ? "Confirm discard…" : "Closing recorder…"
        )) return

        if (hasCurrentTake) {
            let confirmed
            try {
                confirmed = await ask("Discard this recording? This take cannot be recovered.", {
                    title: "Discard recording",
                    kind: "warning",
                    okLabel: "Discard",
                    cancelLabel: "Keep recording",
                })
            } catch (error) {
                failAction("open the discard confirmation", error)
                return
            }

            if (!confirmed) {
                releaseAction()
                return
            }
        }

        setActionState({ status: "discarding", message: "Discarding recording…" })
        setCountdown(null)
        try {
            try {
                await deviceRecorder?.stop()
            } catch (error) {
                console.warn("[recorder] Device track finalization failed during discard:", error)
            } finally {
                deviceRecorder?.destroy()
            }
            await stopRuntimeFeatures()
            await window.electron.ipcRenderer.invoke("cancel-recording")
            setIsRecording(false)
        } catch (error) {
            failAction("discard the recording", error)
        }
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

    const isActionBusy = BUSY_ACTIONS.has(actionState.status)
    const hasActionStatus = actionState.status !== "idle"
    const actionStatusClass = actionState.status === "error" ? "text-red-300" : "text-white/70"
    const stopActionTitle = actionState.status === "error"
        ? (isCaptureFinalized ? "Retry save" : "Retry stop and save")
        : "Stop and save recording"

    // ─── Pre-recording: countdown / loading ──────────────────────────
    if (!isRecording) {
        return (
            <div className="h-full w-full flex items-center justify-center" style={{ padding: 2 }}>
                <StyleTag />
                <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                    {actionState.message}
                </span>
                <div
                    className="island-pill flex items-center justify-center gap-3 overflow-hidden"
                    data-tauri-drag-region
                    style={{
                        ...pillBg,
                        width: hasActionStatus ? 300 : 220,
                        height: 52,
                        borderRadius: 26,
                    }}
                >
                    {hasCam && (
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                            <video ref={cameraVideoRef} autoPlay muted className="object-cover h-full w-full bg-base-300" />
                        </div>
                    )}

                    {showAppBadge && <AppBadge count={appBadgeCount} title={appBadgeTitle} status={appBadgeStatus} />}

                    {hasActionStatus ? (
                        <span
                            role={actionState.status === "error" ? "alert" : "status"}
                            className={`max-w-[190px] truncate text-[11px] font-semibold ${actionStatusClass}`}
                            title={actionState.message}
                        >
                            {actionState.message}
                        </span>
                    ) : countdown !== null ? (
                        <>
                            <span
                                key={countdown}
                                role="status"
                                aria-label={`Recording starts in ${countdown}`}
                                className="countdown-num text-[26px] font-bold text-white tabular-nums leading-none"
                            >
                                {countdown}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-white/50">
                                rec
                            </span>
                        </>
                    ) : (
                        <span
                            className="loading loading-spinner loading-xs text-indigo-400"
                            role="status"
                            aria-label="Preparing recorder"
                            style={{ width: 14, height: 14 }}
                        />
                    )}
                    <Btn
                        onClick={onClickCancel}
                        title={hasActionStatus && actionState.status === "error" ? "Close recorder" : "Cancel"}
                        disabled={isActionBusy}
                        className="w-7 h-7 rounded-full text-white/30 hover:text-white/70 hover:bg-white/[0.08]"
                    >
                        <XMarkIcon className="size-4" />
                    </Btn>
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
        <div aria-hidden="true" className="rec-dot w-[7px] h-[7px] rounded-full flex-shrink-0 bg-red-500" />
    )

    const timer = (
        <span
            aria-label={`Recording time ${formattedTime}`}
            className="font-semibold text-[13px] tabular-nums tracking-tight text-white/90"
            style={{ fontVariantNumeric: "tabular-nums" }}>
            {formattedTime}
        </span>
    )

    const recordingReadout = hasActionStatus ? (
        <span
            role={actionState.status === "error" ? "alert" : "status"}
            className={`max-w-[190px] truncate text-[11px] font-semibold ${actionStatusClass}`}
            title={actionState.message}
        >
            {actionState.message}
        </span>
    ) : timer

    if (!isExpanded && !tutorialActive) {
        // ── COMPACT: just centered dot + timer ──
        return (
            <div
                className="h-full w-full flex items-start justify-center"
                style={{ pointerEvents: "none" }}
            >
                <StyleTag />
                <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                    {actionState.message}
                </span>
                <div
                    className="island-pill mt-1"
                    data-tauri-drag-region
                    onMouseEnter={() => { if (!isActionBusy) setIsExpanded(true) }}
                    style={{
                        ...pillBg,
                        width: showAppBadge || hasActionStatus ? 340 : 280,
                        height: 44,
                        borderRadius: 22,
                        display: "flex",
                        alignItems: "center",
                        padding: "4px 6px 4px 10px",
                        gap: 4,
                        pointerEvents: "auto",
                    }}
                >
                    <button
                        type="button"
                        className="relative z-10 flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-1.5 py-1 text-white outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-indigo-400/80 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => {
                            setIsExpansionPinned(true)
                            setIsExpanded(true)
                        }}
                        aria-label={`Show recording controls. Recording time ${formattedTime}`}
                        aria-expanded="false"
                        disabled={isActionBusy}
                        title="Show recording controls"
                    >
                        {!hasActionStatus && cameraPreview}
                        {!isCaptureFinalized && recDot}
                        {!hasActionStatus && hasMic && <VolumeMeter level={isMicMuted ? 0 : level} compact />}
                        {recordingReadout}
                        {!hasActionStatus && showAppBadge && <AppBadge count={appBadgeCount} title={appBadgeTitle} status={appBadgeStatus} />}
                    </button>
                    <Btn
                        onClick={onClickStop}
                        title={stopActionTitle}
                        dataTutorial="rec-stop"
                        disabled={isActionBusy}
                        className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-400 active:bg-red-600 text-white"
                    >
                        <StopIcon className="size-4" />
                    </Btn>
                </div>
                <Suspense fallback={null}>
                    <RecorderTutorial onActiveChange={setTutorialActive} />
                </Suspense>
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
            <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {actionState.message}
            </span>
            <div
                className="island-pill mt-1"
                data-tauri-drag-region
                onMouseLeave={() => { if (!tutorialActive && !isExpansionPinned) setIsExpanded(false) }}
                onKeyDown={event => {
                    if (event.key === "Escape" && !tutorialActive && !isActionBusy) {
                        setIsExpansionPinned(false)
                        setIsExpanded(false)
                    }
                }}
                role="toolbar"
                aria-label="Recording controls"
                style={{
                    ...pillBg,
                    width: 456,
                    height: 56,
                    borderRadius: 28,
                    display: "flex",
                    alignItems: "center",
                    pointerEvents: "auto",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", width: "100%", height: "100%", padding: "0 10px" }}>

                    {/* ── Left: indicator + timer ── */}
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                        {!hasActionStatus && cameraPreview}
                        {!isCaptureFinalized && recDot}
                        {recordingReadout}
                        {!hasActionStatus && showAppBadge && <AppBadge count={appBadgeCount} title={appBadgeTitle} status={appBadgeStatus} />}
                    </div>

                    {/* ── Center: tools (shifted right with margin) ── */}
                    {!hasActionStatus && (
                    <div style={{ display: "flex", alignItems: "center", flexShrink: 0, marginLeft: 8 }}>
                        <Divider />
                        {hasMic && (
                            <div className="flex items-center">
                                <Btn
                                    onClick={toggleMic}
                                    title={isMicMuted ? "Unmute microphone" : "Mute microphone"}
                                    disabled={isActionBusy}
                                    ariaPressed={isMicMuted}
                                    className={`w-8 h-8 rounded-lg ${isMicMuted ? "text-white/20" : "text-white/50 hover:text-white/80 hover:bg-white/[0.06]"}`}
                                >
                                    <div className="relative">
                                        <MicrophoneIcon className="size-4" />
                                        {isMicMuted && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-[1.5px] h-4 bg-red-400/80 rotate-45 rounded-full" />
                                            </div>
                                        )}
                                    </div>
                                </Btn>
                            </div>
                        )}
                        {hasCam && (
                            <Btn
                                onClick={toggleCamera}
                                title={isCameraOff ? "Turn camera on" : "Turn camera off"}
                                disabled={isActionBusy}
                                ariaPressed={isCameraOff}
                                className={`w-8 h-8 rounded-lg ${isCameraOff ? "text-white/20" : "text-white/50 hover:text-white/80 hover:bg-white/[0.06]"}`}
                            >
                                {isCameraOff ? <VideoCameraSlashIcon className="size-4" /> : <VideoCameraIcon className="size-4" />}
                            </Btn>
                        )}
                        <div className="w-px h-3.5 mx-1 bg-white/[0.04]" />
                        <Btn onClick={openTeleprompter} title="Open teleprompter" dataTutorial="rec-teleprompter"
                            disabled={isActionBusy}
                            className="w-8 h-8 rounded-lg text-white/40 hover:text-indigo-300 hover:bg-indigo-500/10">
                            <DocumentTextIcon className="size-4" />
                        </Btn>
                        <Btn onClick={takeScreenshot} title="Take screenshot" dataTutorial="rec-screenshot"
                            disabled={isActionBusy}
                            className="w-8 h-8 rounded-lg text-white/40 hover:text-amber-300 hover:bg-amber-500/10">
                            <CameraIcon className="size-4" />
                        </Btn>
                        <Btn onClick={toggleDrawing} title={isDrawing ? "Close drawing tools" : "Draw on screen"} dataTutorial="rec-draw"
                            disabled={isActionBusy}
                            ariaPressed={isDrawing}
                            className={`relative w-8 h-8 rounded-lg ${isDrawing ? "text-indigo-400 bg-indigo-500/15" : "text-white/40 hover:text-emerald-300 hover:bg-emerald-500/10"}`}>
                            <PencilIcon className="size-4" />
                            {isDrawing && (
                                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            )}
                        </Btn>
                    </div>
                    )}

                    {/* ── Spacer ── */}
                    <div style={{ flex: 1 }} />

                    {/* ── Right: actions ── */}
                    <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                        <Divider />
                        {!isCaptureFinalized && (
                            <Btn onClick={onClickRestart} title="Restart recording"
                                disabled={isActionBusy}
                                className="w-8 h-8 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/[0.06]">
                                <ArrowPathIcon className="size-4" />
                            </Btn>
                        )}
                        <Btn onClick={onClickCancel} title="Discard recording"
                            disabled={isActionBusy}
                            className="w-8 h-8 rounded-lg text-white/20 hover:text-red-400/80 hover:bg-red-500/10">
                            <TrashIcon className="size-4" />
                        </Btn>

                        <Btn
                            onClick={onClickStop}
                            title={stopActionTitle}
                            dataTutorial="rec-stop"
                            disabled={isActionBusy}
                            className="w-9 h-9 rounded-xl bg-red-500 hover:bg-red-400 active:bg-red-600 text-white ml-0.5">
                            <StopIcon className="size-[18px]" />
                        </Btn>
                    </div>
                </div>
            </div>
            <Suspense fallback={null}>
                <RecorderTutorial onActiveChange={setTutorialActive} />
            </Suspense>
        </div>
    )
}
