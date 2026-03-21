import {
  ComputerDesktopIcon,
  CursorArrowRaysIcon,
  DocumentIcon,
  WindowIcon,
  ChevronDownIcon,
  SpeakerWaveIcon,
  VideoCameraIcon,
  MicrophoneIcon,
} from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import PropTypes from "prop-types"
import { useEffect, useRef, useState } from "react"
import {
  useDispatch,
  useSelector
} from "react-redux"
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
import CameraMicrophoneSelect from "./CameraMicrophoneSelect"
import CameraPreview from "./CameraPreview"
import RecordButton from "./RecordButton"

export default function NewRecording({ isOpen }) {

  const dispatch = useDispatch()
  const source = useSelector(selectSource)
  const [isRecordingSystemAudio, setIsRecordingSystemAudio] = useState(false)
  const [showMonitorPicker, setShowMonitorPicker] = useState(false)
  const monitorPickerRef = useRef(null)

  const { data: defaultSystemAudioSource, isPending } = useQuery({
    queryKey: ['systemAudio'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultSystemAudioSource"),
    staleTime: Infinity
  })

  // Fetch available monitors
  const { data: monitors } = useQuery({
    queryKey: ['monitors'],
    queryFn: () => window.electron.ipcRenderer.invoke("get-monitors"),
    staleTime: 10000,
  })

  const prevPreviewRef = useRef(null)

  const { data: captureSourcePreview, isPending: isPendingCaptureSourcePreview, isError: isPreviewError } = useQuery({
    queryKey: ['captureSourcePreview', source?.id, source?.type, source?.name, source],
    queryFn: () => window.electron.ipcRenderer.invoke("get-source-screenshot", source),
    gcTime: 0,
    retry: 1,
    refetchInterval: 500,
  })

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
    }))
    setShowMonitorPicker(false)
  }

  const openWindowPicker = () => {
    window.electron.ipcRenderer.invoke("open-window-picker")
    window.electron.ipcRenderer.once(
      "window-selected",
      (_e, selectedWindow) => dispatch(setSource(selectedWindow))
    )
  }

  const openAreaPicker = () => {
    window.electron.ipcRenderer.invoke("open-area-picker")
    window.electron.ipcRenderer.once("area-selected", (_e, selectedArea) =>
      dispatch(setSource(selectedArea))
    )
  }

  const onEnableSystemAudio = async () => {
    if (defaultSystemAudioSource) {
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
    <div className={`${isOpen ? "" : "hidden"} h-full flex flex-col`}>
      {/* Main content: side-by-side layout */}
      <div className="flex-1 min-h-0 flex gap-5">
        {/* Left: Preview */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="relative rounded-2xl overflow-hidden bg-base-200/50 border border-base-content/5 flex-1 min-h-0">
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
              {!isPendingCaptureSourcePreview && captureSourcePreview && !isPreviewError && (
                <img
                  key={captureSourcePreview}
                  src={captureSourcePreview}
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
              {!isPendingCaptureSourcePreview && isPreviewError && !prevPreviewRef.current && (
                <div className="flex flex-col items-center gap-2 z-10">
                  <ComputerDesktopIcon className="size-10 text-base-content/15" />
                  <span className="text-xs text-base-content/30">Preview unavailable</span>
                </div>
              )}
              {!isPendingCaptureSourcePreview && !captureSourcePreview && !isPreviewError && !prevPreviewRef.current && (
                <div className="flex flex-col items-center gap-2 z-10">
                  <ComputerDesktopIcon className="size-10 text-base-content/15" />
                  <span className="text-xs text-base-content/30">Select a source to preview</span>
                </div>
              )}
            </div>
            <CameraPreview />

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

            {/* Live indicator - bottom right */}
            <div className="absolute bottom-3 right-3">
              <span className="badge badge-sm bg-black/50 backdrop-blur-md border-white/10 text-white/80 gap-1.5">
                <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                Live
              </span>
            </div>
          </div>
        </div>

        {/* Right: Controls panel */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3">
          {/* Source selection */}
          <div className="bg-base-200/30 rounded-xl border border-base-content/5 p-3">
            <label className="text-[11px] font-semibold text-base-content/40 uppercase tracking-wider mb-2.5 block">Source</label>
            <div className="flex flex-col gap-1.5">
              <div className="relative" ref={monitorPickerRef}>
                <SourceCard
                  icon={ComputerDesktopIcon}
                  label="Screen"
                  description={monitors && monitors.length > 1 && source.type === SOURCE_TYPE_SCREEN && source.id
                    ? `${monitors.find(m => m.id === source.id)?.isPrimary ? "Primary" : monitors.findIndex(m => m.id === source.id) + 1} - ${source.monitorWidth}x${source.monitorHeight}`
                    : "Full display capture"}
                  active={source.type === SOURCE_TYPE_SCREEN}
                  onClick={selectScreen}
                  disabled={isPendingCaptureSourcePreview}
                  hasDropdown={monitors && monitors.length > 1}
                />
                {/* Monitor picker dropdown */}
                {showMonitorPicker && monitors && monitors.length > 1 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-base-200 border border-base-content/10 rounded-xl shadow-xl overflow-hidden">
                    {monitors.map((m, i) => (
                      <button
                        key={m.id}
                        onClick={() => selectMonitor(m)}
                        className={`w-full text-left px-3 py-2.5 text-xs hover:bg-base-300/60 flex items-center gap-2.5 transition-colors
                          ${source.id === m.id ? "text-primary font-medium bg-primary/5" : "text-base-content/70"}`}
                      >
                        <ComputerDesktopIcon className="size-3.5 flex-shrink-0" />
                        <span className="flex-1 truncate">
                          {m.isPrimary ? `Monitor ${i + 1} (Primary)` : `Monitor ${i + 1}`}
                        </span>
                        <span className="text-base-content/30 font-mono text-[10px]">
                          {m.width}x{m.height}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <SourceCard
                icon={WindowIcon}
                label="Window"
                description="Single app window"
                active={source.type === SOURCE_TYPE_WINDOW}
                onClick={openWindowPicker}
                disabled={isPendingCaptureSourcePreview}
                iconFlip
              />
              <SourceCard
                icon={CursorArrowRaysIcon}
                label="Area"
                description="Custom screen region"
                active={source.type === SOURCE_TYPE_AREA}
                onClick={openAreaPicker}
                disabled={isPendingCaptureSourcePreview}
              />
            </div>
          </div>

          {/* Devices */}
          <div className="bg-base-200/30 rounded-xl border border-base-content/5 p-3">
            <label className="text-[11px] font-semibold text-base-content/40 uppercase tracking-wider mb-2.5 block">Devices</label>
            <CameraMicrophoneSelect />

            {/* System audio */}
            <div className="mt-2.5 pt-2.5 border-t border-base-content/5">
              <div className="flex items-center gap-2.5">
                <SpeakerWaveIcon className="size-4 text-base-content/40 flex-shrink-0" />
                <Toggle rightLabel={<span className="text-xs text-base-content/70">System audio</span>} justifyBetween={false} value={isRecordingSystemAudio}
                  onChange={onEnableSystemAudio} disabled={isPending} />
              </div>
            </div>
          </div>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <RecordButton isRecordingSystemAudio={isRecordingSystemAudio} />
            <button onClick={addNote} className="btn btn-sm btn-ghost text-base-content/40 w-full gap-1.5 hover:text-base-content/60">
              <DocumentIcon className="size-3.5" />
              <span className="text-xs">Teleprompter Notes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SourceCard({ icon: Icon, label, description, active, onClick, disabled, iconFlip, hasDropdown }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all w-full text-left group
        ${active
          ? "bg-primary/10 border-primary/25 shadow-[0_0_0_1px_rgba(108,92,231,0.1)]"
          : "bg-transparent border-transparent hover:bg-base-content/5"
        }
        disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <div className={`size-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
        ${active ? "bg-primary/15 text-primary" : "bg-base-content/5 text-base-content/40 group-hover:bg-base-content/8 group-hover:text-base-content/60"}`}>
        <Icon className={`size-4 ${iconFlip ? "scale-x-[-1]" : ""}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium flex items-center gap-1 transition-colors
          ${active ? "text-primary" : "text-base-content/70 group-hover:text-base-content/90"}`}>
          {label}
          {hasDropdown && <ChevronDownIcon className="size-3 opacity-50" />}
        </div>
        <div className="text-[11px] text-base-content/35 truncate">{description}</div>
      </div>
      {active && (
        <div className="size-2 rounded-full bg-primary flex-shrink-0" />
      )}
    </button>
  )
}

SourceCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string,
  active: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  iconFlip: PropTypes.bool,
  hasDropdown: PropTypes.bool,
}

NewRecording.propTypes = {
  isOpen: PropTypes.bool.isRequired,
}
