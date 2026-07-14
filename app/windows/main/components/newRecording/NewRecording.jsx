import {
  ComputerDesktopIcon,
  CursorArrowRaysIcon,
  DocumentIcon,
  WindowIcon,
  ChevronDownIcon,
  SpeakerWaveIcon,
  MicrophoneIcon,
  ChevronUpIcon,
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import PropTypes from "prop-types"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  useDispatch,
  useSelector
} from "react-redux"
import {
  SOURCE_TYPE_AREA,
  SOURCE_TYPE_SCREEN,
  SOURCE_TYPE_WINDOW,
} from "@shared/constants"
import {
  selectCapturers,
  selectEncoders,
  setOpenSettings,
} from "@shared/redux/appSlice"
import {
  selectSource,
  setSource
} from "@shared/redux/recorderSlice"
import { isLikelySystemAudioSource } from "@shared/systemAudio"
import Toggle from "../properties/Toggle"
import { SETTINGS_RECORDER } from "../settings/constants"
import CameraMicrophoneSelect from "./CameraMicrophoneSelect"
import CameraPreview from "./CameraPreview"
import AppAudioControl from "./AppAudioControl"
import RecordButton from "./RecordButton"

export default function NewRecording({ isOpen }) {

  const dispatch = useDispatch()
  const queryClient = useQueryClient()
  const source = useSelector(selectSource)
  const capturers = useSelector(selectCapturers)
  const encoders = useSelector(selectEncoders)
  const [isRecordingSystemAudio, setIsRecordingSystemAudio] = useState(false)
  const [excludedAudioPids, setExcludedAudioPids] = useState([])
  const [showMonitorPicker, setShowMonitorPicker] = useState(false)
  const [showAudioSettings, setShowAudioSettings] = useState(false)
  const [pickerError, setPickerError] = useState(null)
  const monitorPickerRef = useRef(null)

  const { data: defaultSystemAudioSource, isPending } = useQuery({
    queryKey: ['systemAudio'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultSystemAudioSource"),
    staleTime: Infinity
  })

  // Check if a microphone is selected
  const { data: selectedMicrophone } = useQuery({
    queryKey: ['microphone'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultAudioSource"),
    staleTime: Infinity
  })

  // Audio processing settings
  const { data: noiseSuppression } = useQuery({
    queryKey: ['audioSetting', 'noiseSuppression'],
    queryFn: async () => {
      const v = await window.electron.ipcRenderer.invoke("store-get", "noiseSuppression")
      return v ?? true
    },
    staleTime: Infinity
  })
  const { data: echoCancellation } = useQuery({
    queryKey: ['audioSetting', 'echoCancellation'],
    queryFn: async () => {
      const v = await window.electron.ipcRenderer.invoke("store-get", "echoCancellation")
      return v ?? true
    },
    staleTime: Infinity
  })
  const { data: autoGainControl } = useQuery({
    queryKey: ['audioSetting', 'autoGainControl'],
    queryFn: async () => {
      const v = await window.electron.ipcRenderer.invoke("store-get", "autoGainControl")
      return v ?? true
    },
    staleTime: Infinity
  })
  const { data: screenFps } = useQuery({
    queryKey: ['screenFps'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "screenFps"),
    staleTime: Infinity,
  })
  const { data: recordingQuality } = useQuery({
    queryKey: ['recordingQuality'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "recordingQuality"),
    staleTime: Infinity,
  })

  const audioProcessingSettings = useMemo(() => ({
    noiseSuppression: noiseSuppression ?? true,
    echoCancellation: echoCancellation ?? true,
    autoGainControl: autoGainControl ?? true,
  }), [noiseSuppression, echoCancellation, autoGainControl])

  const selectedCapturer = capturers?.find(item => item.isSelected)
  const selectedEncoder = encoders?.find(item => item.isSelected)
  const captureLabel = selectedCapturer?.displayName || selectedCapturer?.name || selectedCapturer?.value || "Not selected"
  const encoderLabel = selectedEncoder?.displayName || selectedEncoder?.name || selectedEncoder?.value || "Not selected"
  const isEngineReady = (capturers?.length ?? 0) > 0 && (encoders?.length ?? 0) > 0
  const hasConfiguredSystemAudio = isLikelySystemAudioSource(defaultSystemAudioSource)

  const setAudioSetting = useCallback(async (key, value) => {
    await window.electron.ipcRenderer.invoke("store-set", key, value)
    await queryClient.invalidateQueries({ queryKey: ['audioSetting', key] })
  }, [queryClient])

  // Fetch available monitors
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

  const { data: captureSourcePreview, isPending: isPendingCaptureSourcePreview, isError: isPreviewError, error: previewError, refetch: refetchCaptureSourcePreview } = useQuery({
    queryKey: ['captureSourcePreview', previewSource],
    queryFn: () => window.electron.ipcRenderer.invoke("get-source-screenshot", previewSource),
    enabled: isOpen && !!previewSource,
    gcTime: 0,
    // Smooth over one transient native-capture startup failure. Permission errors
    // still stop immediately so the UI can show the correct recovery action.
    retry: (failureCount, error) => {
      const message = typeof error === "string" ? error : error?.message || String(error)
      return failureCount < 1 && !message.includes("ScreenPermissionDenied")
    },
    retryDelay: 500,
    // Keep preview fresh; permission failures use the cheap native permission probe before screencapture.
    refetchInterval: screenPermissionDenied || previewUnavailable ? 10000 : 5000,
    refetchIntervalInBackground: false,
  })

  useEffect(() => {
    if (captureSourcePreview) {
      setScreenPermissionDenied(false)
      setPreviewUnavailable(false)
      return
    }
    if (isPreviewError) {
      const message = typeof previewError === "string" ? previewError : previewError?.message || String(previewError)
      setScreenPermissionDenied(message.includes("ScreenPermissionDenied"))
      setPreviewUnavailable(true)
    }
  }, [captureSourcePreview, isPreviewError, previewError])

  const retryPreview = useCallback(() => {
    setScreenPermissionDenied(false)
    setPreviewUnavailable(false)
    refetchCaptureSourcePreview()
  }, [refetchCaptureSourcePreview])

  // Keep previous frame visible during transitions for smooth crossfade
  if (captureSourcePreview) prevPreviewRef.current = captureSourcePreview

  const addNote = () => window.electron.ipcRenderer.invoke("add-note")

  // Auto-select primary monitor when monitors are loaded and no specific monitor is set
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

  // Close monitor picker when clicking outside
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
      // Multiple monitors: show picker
      setShowMonitorPicker(!showMonitorPicker)
    } else if (monitorList.length === 1) {
      // Single monitor: select it with dimensions
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
      // Fallback: select screen without monitor info (captures entire desktop)
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
    setPickerError(null)
    // Clean up any stale listener from a previous cancelled picker
    if (windowSelectedCbRef.current) {
      window.electron.ipcRenderer.removeListener("window-selected", windowSelectedCbRef.current)
    }

    const cb = (_e, selectedWindow) => {
      windowSelectedCbRef.current = null
      setPickerError(null)
      dispatch(setSource(selectedWindow))
    }
    windowSelectedCbRef.current = cb
    window.electron.ipcRenderer.once("window-selected", cb)

    try {
      await window.electron.ipcRenderer.invoke("open-window-picker")
    } catch (err) {
      window.electron.ipcRenderer.removeListener("window-selected", cb)
      windowSelectedCbRef.current = null
      console.error("[Flowtake] Failed to open window picker:", err)
      setPickerError("Window picker could not open. Try again or record the full screen.")
    }
  }, [dispatch])

  const openAreaPicker = useCallback(async () => {
    setPickerError(null)
    if (areaSelectedCbRef.current) {
      window.electron.ipcRenderer.removeListener("area-selected", areaSelectedCbRef.current)
    }

    const cb = (_e, selectedArea) => {
      areaSelectedCbRef.current = null
      setPickerError(null)
      dispatch(setSource(selectedArea))
    }
    areaSelectedCbRef.current = cb
    window.electron.ipcRenderer.once("area-selected", cb)

    try {
      await window.electron.ipcRenderer.invoke("open-area-picker")
    } catch (err) {
      window.electron.ipcRenderer.removeListener("area-selected", cb)
      areaSelectedCbRef.current = null
      console.error("[Flowtake] Failed to open area picker:", err)
      setPickerError("Area picker could not open. Try again or record the full screen.")
    }
  }, [dispatch])

  // Clean up picker listeners on unmount
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
    if (hasConfiguredSystemAudio) {
      setIsRecordingSystemAudio(!isRecordingSystemAudio)
    } else if (!isRecordingSystemAudio) {
      dispatch(setOpenSettings(SETTINGS_RECORDER))
    }
  }

  // Build screen source label
  const screenLabel = () => {
    if (source.type !== SOURCE_TYPE_SCREEN) return "Screen"
    if (source.name && source.name !== "Screen") return source.name
    return "Screen"
  }

  // Build source detail string
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

  return (
    <div className={`${isOpen ? "" : "hidden"} h-full min-h-0 flex flex-col`}>
      {/* Main content: always side-by-side */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 md:gap-4 overflow-y-auto md:overflow-hidden pr-1 md:pr-0">
        {/* Left: Preview */}
        <div className="flex-1 min-w-0 min-h-56 md:min-h-0 flex flex-col">
          <div className="relative rounded-xl overflow-hidden bg-base-200/50 border border-base-content/5 flex-1 min-h-0">
            <div className="w-full h-full flex items-center justify-center relative">
              {/* Previous frame as background for smooth crossfade */}
              {prevPreviewRef.current && (
                <img
                  src={prevPreviewRef.current}
                  className="absolute inset-0 w-full h-full object-contain"
                  aria-hidden="true"
                />
              )}
              {/* Current frame crossfades on top */}
              {!isPendingCaptureSourcePreview && captureSourcePreview && !isPreviewError && !previewUnavailable && (
                <img
                  src={captureSourcePreview}
                  alt={`Preview of ${source.name || "selected recording source"}`}
                  className="absolute inset-0 w-full h-full object-contain animate-[fadeIn_150ms_ease-out]"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              )}
              {/* Loading state only shown on first load */}
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
                    <>
                      <span className="text-xs text-base-content/30">Preview unavailable</span>
                      <button type="button" className="btn btn-xs btn-outline mt-1" onClick={retryPreview}>
                        <ArrowPathIcon className="size-3.5" />
                        Retry
                      </button>
                    </>
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
            <CameraPreview audioProcessingSettings={audioProcessingSettings} />

            {/* Bottom gradient overlay for badges */}
            {(captureSourcePreview || prevPreviewRef.current) && (
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
            )}

            {/* Source type badge - bottom left */}
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

            {/* Audio source badges - bottom right area */}
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
              <span className="badge badge-sm bg-black/50 backdrop-blur-md border-white/10 text-white/80 gap-1.5">
                <span className="size-1.5 rounded-full bg-primary/70" />
                Preview
              </span>
            </div>
          </div>
        </div>

        {/* Right: scrollable setup with the primary action always visible. */}
        <div className="w-full md:w-64 xl:w-72 flex-shrink-0 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 flex flex-col gap-2.5">
          {/* Source — horizontal segmented */}
          <div className="relative flex-shrink-0" ref={monitorPickerRef} data-tutorial="source-panel">
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
            {/* Active source detail */}
            <div className="mt-1 px-1 text-[10px] text-base-content/40 truncate">
              {source.type === SOURCE_TYPE_SCREEN && (monitors && monitors.length > 1 && source.id
                ? `${monitors.find(m => m.id === source.id)?.isPrimary ? "Primary display" : `Monitor ${monitors.findIndex(m => m.id === source.id) + 1}`} · ${source.monitorWidth}×${source.monitorHeight}`
                : "Full display capture")}
              {source.type === SOURCE_TYPE_WINDOW && (source.name || "Click to pick a window")}
              {source.type === SOURCE_TYPE_AREA && "Custom screen region"}
            </div>
            {/* Monitor picker dropdown */}
            {showMonitorPicker && monitors && monitors.length > 1 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-base-200 border border-base-content/10 rounded-lg shadow-xl overflow-hidden">
                {monitors.map((m, i) => (
                  <button
                    type="button"
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

          {pickerError && (
            <div className="rounded-md border border-error/25 bg-error/10 px-2 py-1.5 text-[11px] leading-snug text-error" role="alert">
              {pickerError}
            </div>
          )}

          {/* Devices */}
          <div className="flex-shrink-0">
            <SectionLabel>Devices</SectionLabel>
            <CameraMicrophoneSelect audioProcessingSettings={audioProcessingSettings} />
          </div>

          {/* Audio toggles — inline row */}
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
              type="button"
              onClick={() => setShowAudioSettings(v => !v)}
              className="flex items-center gap-2 w-full group text-left"
              aria-expanded={showAudioSettings}
              aria-controls="record-audio-processing"
            >
              <AdjustmentsHorizontalIcon className="size-3.5 text-base-content/40 flex-shrink-0" />
              <span className="text-xs text-base-content/70 flex-1">Audio processing</span>
              <ChevronUpIcon className={`size-3 text-base-content/30 transition-transform ${showAudioSettings ? "" : "rotate-180"}`} />
            </button>
            {showAudioSettings && (
              <div id="record-audio-processing" className="ml-5 flex flex-col gap-1">
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

          <div className="rounded-lg border border-base-content/5 bg-base-200/30 p-2.5 flex-shrink-0" aria-label="Recording quality summary">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content/35">Quality</span>
              <span className={`text-[10px] font-medium ${isEngineReady ? "text-emerald-500" : "text-warning"}`}>
                <span className="capitalize">{recordingQuality || "balanced"}</span> - {screenFps ?? 30} FPS
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] min-w-0">
              <span className={`size-1.5 rounded-full flex-shrink-0 ${isEngineReady ? "bg-emerald-500" : "bg-warning"}`} />
              <span className="truncate text-base-content/55" title={`${captureLabel} to ${encoderLabel}`}>
                {isEngineReady ? `${captureLabel} to ${encoderLabel}` : "Choose a capture and encoder"}
              </span>
              <button
                type="button"
                className="ml-auto flex-shrink-0 text-[10px] font-medium text-primary hover:underline"
                onClick={() => dispatch(setOpenSettings(SETTINGS_RECORDER))}
              >
                Adjust
              </button>
            </div>
          </div>

          </div>

          <div className="flex gap-2 flex-shrink-0 pt-2 mt-1 border-t border-base-content/5 bg-base-100/20">
            <div className="flex-[4] min-w-0" data-tutorial="record-button">
              <RecordButton
                isRecordingSystemAudio={isRecordingSystemAudio}
                excludedAudioPids={excludedAudioPids}
                audioProcessingSettings={audioProcessingSettings}
              />
            </div>
            <button type="button" onClick={addNote} className="flex-[1] btn btn-sm btn-ghost bg-base-200/30 border border-base-content/5 text-base-content/40 hover:text-base-content/60 h-auto" title="Teleprompter Notes" aria-label="Open teleprompter notes">
              <DocumentIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
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
      type="button"
      onClick={onClick}
      aria-label={`${label} recording source`}
      aria-pressed={active}
      className={`min-h-11 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md transition-all
        ${active
          ? "bg-primary/15 text-primary"
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

NewRecording.propTypes = {
  isOpen: PropTypes.bool.isRequired,
}
