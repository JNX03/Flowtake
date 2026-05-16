import {
    AdjustmentsHorizontalIcon,
    ArrowPathIcon,
    BoltIcon,
    ChevronUpIcon,
    ComputerDesktopIcon,
    CursorArrowRaysIcon,
    MicrophoneIcon,
    SignalIcon,
    SpeakerWaveIcon,
    WindowIcon,
    ChevronDownIcon,
} from "@heroicons/react/24/outline"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import PropTypes from "prop-types"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
    SOURCE_TYPE_AREA,
    SOURCE_TYPE_SCREEN,
    SOURCE_TYPE_WINDOW,
} from "@shared/constants"
import { setOpenSettings } from "@shared/redux/appSlice"
import {
    selectSource,
    setSource
} from "@shared/redux/recorderSlice"
import Toggle from "../properties/Toggle"
import { SETTINGS_RECORDER } from "../settings/constants"
import CameraMicrophoneSelect from "../newRecording/CameraMicrophoneSelect"
import CameraPreview from "../newRecording/CameraPreview"
import AppAudioControl from "../newRecording/AppAudioControl"
import LiveStreamingSettings from "../settings/LiveStreamingSettings"
import { loadLiveSettings } from "../settings/liveSettingsStore"
import GoLiveButton from "./GoLiveButton"

export default function Live({ isOpen }) {

    const dispatch = useDispatch()
    const queryClient = useQueryClient()
    const source = useSelector(selectSource)
    const [isRecordingSystemAudio, setIsRecordingSystemAudio] = useState(false)
    const [excludedAudioPids, setExcludedAudioPids] = useState([])
    const [showMonitorPicker, setShowMonitorPicker] = useState(false)
    const [showAudioSettings, setShowAudioSettings] = useState(false)
    const [showDestination, setShowDestination] = useState(false)
    const monitorPickerRef = useRef(null)

    const { data: defaultSystemAudioSource, isPending } = useQuery({
        queryKey: ['systemAudio'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultSystemAudioSource"),
        staleTime: Infinity
    })
    const { data: selectedMicrophone } = useQuery({
        queryKey: ['microphone'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultAudioSource"),
        staleTime: Infinity
    })
    const { data: noiseSuppression } = useQuery({
        queryKey: ['audioSetting', 'noiseSuppression'],
        queryFn: async () => (await window.electron.ipcRenderer.invoke("store-get", "noiseSuppression")) ?? true,
        staleTime: Infinity
    })
    const { data: echoCancellation } = useQuery({
        queryKey: ['audioSetting', 'echoCancellation'],
        queryFn: async () => (await window.electron.ipcRenderer.invoke("store-get", "echoCancellation")) ?? true,
        staleTime: Infinity
    })
    const { data: autoGainControl } = useQuery({
        queryKey: ['audioSetting', 'autoGainControl'],
        queryFn: async () => (await window.electron.ipcRenderer.invoke("store-get", "autoGainControl")) ?? true,
        staleTime: Infinity
    })

    const { data: liveSettings } = useQuery({
        queryKey: ['liveSettings'],
        queryFn: loadLiveSettings,
        staleTime: Infinity,
    })
    const hasStreamKey = !!(liveSettings?.streamKey && liveSettings.streamKey.trim().length > 0)
    const hasRtmp = !!(liveSettings?.rtmpUrl && liveSettings.rtmpUrl.trim().length > 0)
    const isConfigured = hasRtmp && hasStreamKey
    const zoomHotkey = liveSettings?.zoomHotkey || "Ctrl+Shift+Z"
    const zoomMode = liveSettings?.zoomMode || "hold"

    const setAudioSetting = useCallback((key, value) => {
        window.electron.ipcRenderer.invoke("store-set", key, value)
        queryClient.invalidateQueries({ queryKey: ['audioSetting', key] })
    }, [queryClient])

    const { data: monitors } = useQuery({
        queryKey: ['monitors'],
        queryFn: () => window.electron.ipcRenderer.invoke("get-monitors"),
        staleTime: 10000,
    })

    const prevPreviewRef = useRef(null)
    const [screenPermissionDenied, setScreenPermissionDenied] = useState(false)
    const [previewUnavailable, setPreviewUnavailable] = useState(false)

    const previewSource = useMemo(() => source ? {
        id: source.id,
        type: source.type,
        name: source.name,
        x: source.x,
        y: source.y,
        width: source.width,
        height: source.height,
        monitorX: source.monitorX,
        monitorY: source.monitorY,
        monitorWidth: source.monitorWidth,
        monitorHeight: source.monitorHeight,
        monitorIndex: source.monitorIndex,
        physicalX: source.physicalX,
        physicalY: source.physicalY,
        physicalWidth: source.physicalWidth,
        physicalHeight: source.physicalHeight,
        scaleFactor: source.scaleFactor,
    } : null, [source])

    useEffect(() => {
        prevPreviewRef.current = null
        setPreviewUnavailable(false)
        setScreenPermissionDenied(false)
    }, [previewSource])

    const { data: captureSourcePreview, isPending: isPendingCaptureSourcePreview, isError: isPreviewError, refetch: refetchCaptureSourcePreview } = useQuery({
        queryKey: ['captureSourcePreview', previewSource],
        queryFn: async () => {
            try {
                const result = await window.electron.ipcRenderer.invoke("get-source-screenshot", previewSource)
                setScreenPermissionDenied(false)
                setPreviewUnavailable(false)
                return result
            } catch (e) {
                const msg = typeof e === 'string' ? e : e?.message || String(e)
                setScreenPermissionDenied(msg.includes("ScreenPermissionDenied"))
                setPreviewUnavailable(true)
                throw e
            }
        },
        enabled: isOpen && !!previewSource,
        gcTime: 0,
        retry: false,
        refetchInterval: screenPermissionDenied || previewUnavailable ? 5000 : 2000,
        refetchIntervalInBackground: false,
    })

    const retryPreview = useCallback(() => {
        setScreenPermissionDenied(false)
        setPreviewUnavailable(false)
        refetchCaptureSourcePreview()
    }, [refetchCaptureSourcePreview])

    if (captureSourcePreview) prevPreviewRef.current = captureSourcePreview

    useEffect(() => {
        if (!monitors || monitors.length === 0) return
        if (source.type === SOURCE_TYPE_SCREEN && !source.monitorWidth) {
            const primary = monitors.find(m => m.isPrimary) || monitors[0]
            dispatch(setSource({
                name: primary.isPrimary ? "Screen" : primary.name,
                type: SOURCE_TYPE_SCREEN,
                id: primary.id,
                monitorX: primary.x,
                monitorY: primary.y,
                monitorWidth: primary.width,
                monitorHeight: primary.height,
                monitorIndex: primary.index ?? 0,
                physicalX: primary.physicalX ?? primary.x,
                physicalY: primary.physicalY ?? primary.y,
                physicalWidth: primary.physicalWidth ?? primary.width,
                physicalHeight: primary.physicalHeight ?? primary.height,
                scaleFactor: primary.scaleFactor ?? 1,
            }))
        }
    }, [monitors]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!showMonitorPicker) return
        const handleClick = (e) => {
            if (monitorPickerRef.current && !monitorPickerRef.current.contains(e.target)) {
                setShowMonitorPicker(false)
            }
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [showMonitorPicker])

    const selectScreen = () => {
        const monitorList = monitors || []
        if (monitorList.length > 1) {
            setShowMonitorPicker(!showMonitorPicker)
        } else if (monitorList.length === 1) {
            const m = monitorList[0]
            dispatch(setSource({
                name: m.isPrimary ? "Screen" : m.name,
                type: SOURCE_TYPE_SCREEN,
                id: m.id,
                monitorX: m.x,
                monitorY: m.y,
                monitorWidth: m.width,
                monitorHeight: m.height,
                monitorIndex: m.index ?? 0,
                physicalX: m.physicalX ?? m.x,
                physicalY: m.physicalY ?? m.y,
                physicalWidth: m.physicalWidth ?? m.width,
                physicalHeight: m.physicalHeight ?? m.height,
                scaleFactor: m.scaleFactor ?? 1,
            }))
        } else {
            dispatch(setSource({ name: "Screen", type: SOURCE_TYPE_SCREEN, id: "screen" }))
        }
    }

    const selectMonitor = (m) => {
        dispatch(setSource({
            name: m.isPrimary ? "Screen" : m.name,
            type: SOURCE_TYPE_SCREEN,
            id: m.id,
            monitorX: m.x,
            monitorY: m.y,
            monitorWidth: m.width,
            monitorHeight: m.height,
            monitorIndex: m.index ?? 0,
            physicalX: m.physicalX ?? m.x,
            physicalY: m.physicalY ?? m.y,
            physicalWidth: m.physicalWidth ?? m.width,
            physicalHeight: m.physicalHeight ?? m.height,
            scaleFactor: m.scaleFactor ?? 1,
        }))
        setShowMonitorPicker(false)
    }

    const windowSelectedCbRef = useRef(null)
    const areaSelectedCbRef = useRef(null)

    const openWindowPicker = useCallback(async () => {
        if (windowSelectedCbRef.current) {
            window.electron.ipcRenderer.removeListener("window-selected", windowSelectedCbRef.current)
        }
        const cb = (_e, selectedWindow) => {
            windowSelectedCbRef.current = null
            dispatch(setSource(selectedWindow))
        }
        windowSelectedCbRef.current = cb
        window.electron.ipcRenderer.once("window-selected", cb)
        try { await window.electron.ipcRenderer.invoke("open-window-picker") }
        catch (err) {
            window.electron.ipcRenderer.removeListener("window-selected", cb)
            windowSelectedCbRef.current = null
            console.error("[Flowtake] Failed to open window picker:", err)
        }
    }, [dispatch])

    const openAreaPicker = useCallback(async () => {
        if (areaSelectedCbRef.current) {
            window.electron.ipcRenderer.removeListener("area-selected", areaSelectedCbRef.current)
        }
        const cb = (_e, selectedArea) => {
            areaSelectedCbRef.current = null
            dispatch(setSource(selectedArea))
        }
        areaSelectedCbRef.current = cb
        window.electron.ipcRenderer.once("area-selected", cb)
        try { await window.electron.ipcRenderer.invoke("open-area-picker") }
        catch (err) {
            window.electron.ipcRenderer.removeListener("area-selected", cb)
            areaSelectedCbRef.current = null
            console.error("[Flowtake] Failed to open area picker:", err)
        }
    }, [dispatch])

    useEffect(() => {
        return () => {
            if (windowSelectedCbRef.current) {
                window.electron.ipcRenderer.removeListener("window-selected", windowSelectedCbRef.current)
            }
            if (areaSelectedCbRef.current) {
                window.electron.ipcRenderer.removeListener("area-selected", areaSelectedCbRef.current)
            }
        }
    }, [])

    const onEnableSystemAudio = async () => {
        if (defaultSystemAudioSource) {
            setIsRecordingSystemAudio(!isRecordingSystemAudio)
        } else if (!isRecordingSystemAudio) {
            dispatch(setOpenSettings(SETTINGS_RECORDER))
        }
    }

    const screenLabel = () => {
        if (source.type !== SOURCE_TYPE_SCREEN) return "Screen"
        if (source.name && source.name !== "Screen") return source.name
        return "Screen"
    }

    const sourceDetail = () => {
        if (source.type === SOURCE_TYPE_SCREEN && source.monitorWidth && source.monitorHeight) {
            return `${source.monitorWidth} x ${source.monitorHeight}`
        }
        if (source.type === SOURCE_TYPE_WINDOW && source.width && source.height) {
            return `${source.width} x ${source.height}`
        }
        if (source.type === SOURCE_TYPE_AREA) return "Custom region"
        return null
    }

    if (!isOpen) return null

    return (
        <div className="h-full min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 flex gap-3 md:gap-4">
                {/* Left: Preview */}
                <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                    <div className="relative rounded-xl overflow-hidden bg-base-200/50 border border-base-content/5 flex-1 min-h-0">
                        <div className="w-full h-full flex items-center justify-center relative">
                            {prevPreviewRef.current && (
                                <img
                                    src={prevPreviewRef.current}
                                    className="absolute inset-0 w-full h-full object-contain"
                                    aria-hidden="true"
                                />
                            )}
                            {!isPendingCaptureSourcePreview && captureSourcePreview && !isPreviewError && !previewUnavailable && (
                                <img
                                    src={captureSourcePreview}
                                    className="absolute inset-0 w-full h-full object-contain animate-[fadeIn_150ms_ease-out]"
                                    onError={(e) => { e.target.style.display = 'none' }}
                                />
                            )}
                            {isPendingCaptureSourcePreview && !prevPreviewRef.current && (
                                <div className="flex flex-col items-center gap-3 z-10">
                                    <span className="loading loading-spinner loading-md text-primary/50"></span>
                                    <span className="text-xs text-base-content/30">Loading preview</span>
                                </div>
                            )}
                            {!isPendingCaptureSourcePreview && (isPreviewError || previewUnavailable) && !prevPreviewRef.current && (
                                <div className="flex flex-col items-center gap-2 z-10">
                                    <ComputerDesktopIcon className="size-10 md:size-12 text-base-content/15" />
                                    {screenPermissionDenied ? (
                                        <>
                                            <span className="text-xs text-warning/80 font-medium">Screen recording permission required</span>
                                            <span className="text-xs text-base-content/40 text-center max-w-xs">
                                                Enable this exact Flowtake app in System Settings &rarr; Privacy &amp; Security &rarr; Screen Recording, then quit and reopen Flowtake if macOS still blocks it.
                                            </span>
                                            <button type="button" className="btn btn-xs btn-outline mt-1" onClick={retryPreview}>
                                                <ArrowPathIcon className="size-3.5" />
                                                Retry
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-xs text-base-content/30">Preview unavailable</span>
                                    )}
                                </div>
                            )}
                            {!isPendingCaptureSourcePreview && !captureSourcePreview && !isPreviewError && !prevPreviewRef.current && (
                                <div className="flex flex-col items-center gap-2 z-10">
                                    <ComputerDesktopIcon className="size-10 md:size-12 text-base-content/15" />
                                    <span className="text-xs text-base-content/30">Select a source to preview</span>
                                </div>
                            )}
                        </div>
                        <CameraPreview />

                        {(captureSourcePreview || prevPreviewRef.current) && (
                            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                        )}

                        {/* Source badge */}
                        <div className="absolute bottom-3 left-3 flex items-center gap-2">
                            <span className="badge badge-sm bg-black/50 backdrop-blur-md border-white/10 text-white/80 gap-1.5 font-medium">
                                {source.type === SOURCE_TYPE_SCREEN && <><ComputerDesktopIcon className="size-3" /> {screenLabel()}</>}
                                {source.type === SOURCE_TYPE_WINDOW && <><WindowIcon className="size-3 scale-x-[-1]" /> {source.name || "Window"}</>}
                                {source.type === SOURCE_TYPE_AREA && <><CursorArrowRaysIcon className="size-3" /> Area</>}
                            </span>
                            {sourceDetail() && (
                                <span className="badge badge-sm bg-black/40 backdrop-blur-md border-white/10 text-white/50 font-mono text-[10px]">
                                    {sourceDetail()}
                                </span>
                            )}
                        </div>

                        {/* LIVE identity badge */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                            <span className="badge badge-sm bg-red-500/95 border-red-300/30 text-white gap-1.5 font-bold shadow-lg shadow-red-500/30">
                                <SignalIcon className="size-3" />
                                LIVE
                                <span className="text-[8px] text-white/85 font-bold ml-0.5">&beta;</span>
                            </span>
                        </div>

                        {/* Mic + zoom hint chips - bottom right */}
                        <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                            {selectedMicrophone && (
                                <span className="badge badge-sm bg-black/50 backdrop-blur-md border-white/10 text-emerald-400/90 gap-1">
                                    <MicrophoneIcon className="size-3" /> Mic
                                </span>
                            )}
                            {isRecordingSystemAudio && (
                                <span className="badge badge-sm bg-black/50 backdrop-blur-md border-white/10 text-blue-400/90 gap-1">
                                    <SpeakerWaveIcon className="size-3" /> System
                                </span>
                            )}
                            <span className="badge badge-sm bg-black/55 backdrop-blur-md border-white/10 text-red-300/90 gap-1" title={`Zoom mode: ${zoomMode}`}>
                                <BoltIcon className="size-3" />
                                {zoomMode === "hold" ? `Hold ${zoomHotkey}` : zoomMode === "toggle" ? `Tap ${zoomHotkey}` : zoomHotkey}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right: Controls panel */}
                <div className="w-60 lg:w-64 xl:w-72 flex-shrink-0 min-h-0 flex flex-col gap-2.5 overflow-y-auto">
                    {/* Source */}
                    <div className="relative flex-shrink-0" ref={monitorPickerRef}>
                        <SectionLabel>Source</SectionLabel>
                        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-base-200/40 border border-base-content/5">
                            <SourceSegment
                                icon={ComputerDesktopIcon}
                                label="Screen"
                                active={source.type === SOURCE_TYPE_SCREEN}
                                onClick={selectScreen}
                                hasDropdown={monitors && monitors.length > 1}
                            />
                            <SourceSegment
                                icon={WindowIcon}
                                label="Window"
                                active={source.type === SOURCE_TYPE_WINDOW}
                                onClick={openWindowPicker}
                                iconFlip
                            />
                            <SourceSegment
                                icon={CursorArrowRaysIcon}
                                label="Area"
                                active={source.type === SOURCE_TYPE_AREA}
                                onClick={openAreaPicker}
                            />
                        </div>
                        <div className="mt-1 px-1 text-[10px] text-base-content/40 truncate">
                            {source.type === SOURCE_TYPE_SCREEN && (monitors && monitors.length > 1 && source.id
                                ? `${monitors.find(m => m.id === source.id)?.isPrimary ? "Primary display" : `Monitor ${monitors.findIndex(m => m.id === source.id) + 1}`} · ${source.monitorWidth}×${source.monitorHeight}`
                                : "Full display capture")}
                            {source.type === SOURCE_TYPE_WINDOW && (source.name || "Click to pick a window")}
                            {source.type === SOURCE_TYPE_AREA && "Custom screen region"}
                        </div>
                        {showMonitorPicker && monitors && monitors.length > 1 && (
                            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-base-200 border border-base-content/10 rounded-lg shadow-xl overflow-hidden">
                                {monitors.map((m, i) => (
                                    <button
                                        key={m.id}
                                        onClick={() => selectMonitor(m)}
                                        className={`w-full text-left px-2.5 py-2 text-xs hover:bg-base-300/60 flex items-center gap-2 transition-colors
                                            ${source.id === m.id ? "text-primary font-medium bg-primary/5" : "text-base-content/70"}`}
                                    >
                                        <ComputerDesktopIcon className="size-3.5 flex-shrink-0" />
                                        <span className="flex-1 truncate">
                                            {m.isPrimary ? `Monitor ${i + 1} (Primary)` : `Monitor ${i + 1}`}
                                        </span>
                                        <span className="text-base-content/30 font-mono text-[10px]">
                                            {m.width}×{m.height}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Devices */}
                    <div className="flex-shrink-0">
                        <SectionLabel>Devices</SectionLabel>
                        <CameraMicrophoneSelect />
                    </div>

                    {/* Audio toggles */}
                    <div className="flex-shrink-0 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                            <SpeakerWaveIcon className="size-3.5 text-base-content/40 flex-shrink-0" />
                            <Toggle rightLabel={<span className="text-xs text-base-content/70">System audio</span>} justifyBetween={false} value={isRecordingSystemAudio}
                                onChange={onEnableSystemAudio} disabled={isPending} />
                        </div>
                        {isRecordingSystemAudio && (
                            <AppAudioControl onExcludedAppsChange={setExcludedAudioPids} />
                        )}
                        <button
                            onClick={() => setShowAudioSettings(v => !v)}
                            className="flex items-center gap-2 w-full group text-left"
                        >
                            <AdjustmentsHorizontalIcon className="size-3.5 text-base-content/40 flex-shrink-0" />
                            <span className="text-xs text-base-content/70 flex-1">Audio processing</span>
                            <ChevronUpIcon className={`size-3 text-base-content/30 transition-transform ${showAudioSettings ? "" : "rotate-180"}`} />
                        </button>
                        {showAudioSettings && (
                            <div className="ml-5 flex flex-col gap-1">
                                <Toggle
                                    rightLabel={<span className="text-[11px] text-base-content/60">Noise suppression</span>}
                                    justifyBetween={false}
                                    value={noiseSuppression ?? true}
                                    onChange={() => setAudioSetting("noiseSuppression", !(noiseSuppression ?? true))}
                                />
                                <Toggle
                                    rightLabel={<span className="text-[11px] text-base-content/60">Echo cancellation</span>}
                                    justifyBetween={false}
                                    value={echoCancellation ?? true}
                                    onChange={() => setAudioSetting("echoCancellation", !(echoCancellation ?? true))}
                                />
                                <Toggle
                                    rightLabel={<span className="text-[11px] text-base-content/60">Auto gain</span>}
                                    justifyBetween={false}
                                    value={autoGainControl ?? true}
                                    onChange={() => setAudioSetting("autoGainControl", !(autoGainControl ?? true))}
                                />
                            </div>
                        )}
                    </div>

                    {/* Destination — collapsible */}
                    <div className="flex-shrink-0 rounded-lg border border-base-content/5 bg-base-100/40">
                        <button
                            onClick={() => setShowDestination(v => !v)}
                            className="flex items-center gap-2 w-full px-2.5 py-2 text-left"
                        >
                            <SignalIcon className={`size-3.5 flex-shrink-0 ${isConfigured ? "text-red-400" : "text-amber-400"}`} />
                            <span className="text-xs text-base-content/80 font-medium flex-1">Destination</span>
                            <span className={`text-[9px] uppercase tracking-wider font-bold ${isConfigured ? "text-emerald-400" : "text-amber-400"}`}>
                                {isConfigured ? "Ready" : "Setup"}
                            </span>
                            <ChevronDownIcon className={`size-3 text-base-content/30 transition-transform ${showDestination ? "rotate-180" : ""}`} />
                        </button>
                        {showDestination && (
                            <div className="px-2.5 pb-2.5 pt-1 border-t border-base-content/5">
                                <LiveStreamingSettings />
                            </div>
                        )}
                    </div>

                    {/* Go Live button - pinned bottom */}
                    <div className="mt-auto flex-shrink-0 pt-1">
                        <GoLiveButton
                            isRecordingSystemAudio={isRecordingSystemAudio}
                            excludedAudioPids={excludedAudioPids}
                        />
                        {!isConfigured && (
                            <button
                                onClick={() => setShowDestination(true)}
                                className="mt-1.5 w-full text-[10px] text-amber-400/85 hover:text-amber-300 text-center"
                            >
                                {hasRtmp ? "Add a stream key &rarr;" : "Set RTMP destination &rarr;"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

Live.propTypes = {
    isOpen: PropTypes.bool.isRequired,
}

function SectionLabel({ children }) {
    return (
        <label className="text-[10px] font-semibold text-base-content/35 uppercase tracking-wider mb-1 block">{children}</label>
    )
}

SectionLabel.propTypes = {
    children: PropTypes.node.isRequired,
}

function SourceSegment({ icon: Icon, label, active, onClick, iconFlip, hasDropdown }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md transition-all
                ${active
                    ? "bg-red-500/15 text-red-300"
                    : "text-base-content/50 hover:text-base-content/80 hover:bg-base-content/5"
                }`}
        >
            <div className="flex items-center gap-0.5">
                <Icon className={`size-4 ${iconFlip ? "scale-x-[-1]" : ""}`} />
                {hasDropdown && active && <ChevronDownIcon className="size-2.5 opacity-60" />}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
        </button>
    )
}

SourceSegment.propTypes = {
    icon: PropTypes.elementType.isRequired,
    label: PropTypes.string.isRequired,
    active: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
    iconFlip: PropTypes.bool,
    hasDropdown: PropTypes.bool,
}
