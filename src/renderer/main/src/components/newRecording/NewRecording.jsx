import {
  ComputerDesktopIcon,
  CursorArrowRaysIcon,
  DocumentIcon,
  WindowIcon
} from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import PropTypes from "prop-types"
import { useRef, useState } from "react"
import {
  useDispatch,
  useSelector
} from "react-redux"
import {
  SOURCE_TYPE_AREA,
  SOURCE_TYPE_SCREEN,
  SOURCE_TYPE_WINDOW,
} from "../../../../../helpers"
import { setOpenSettings } from "../../../../src/redux/appSlice"
import {
  selectSource,
  setSource
} from "../../../../src/redux/recorderSlice"
import Toggle from "../properties/Toggle"
import { SETTINGS_RECORDER } from "../settings/constants"
import CameraMicrophoneSelect from "./CameraMicrophoneSelect"
import CameraPreview from "./CameraPreview"
import RecordButton from "./RecordButton"

export default function NewRecording({ isOpen }) {

  const dispatch = useDispatch()
  const source = useSelector(selectSource)
  const [isRecordingSystemAudio, setIsRecordingSystemAudio] = useState(false)

  const { data: defaultSystemAudioSource, isPending } = useQuery({
    queryKey: ['systemAudio'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultSystemAudioSource"),
    staleTime: Infinity
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

            {/* Source type badge */}
            <div className="absolute top-3 left-3">
              <span className="badge badge-sm bg-base-300/80 backdrop-blur-sm border-base-content/10 text-base-content/60 gap-1">
                {source.type === SOURCE_TYPE_SCREEN && <><ComputerDesktopIcon className="size-3" /> Screen</>}
                {source.type === SOURCE_TYPE_WINDOW && <><WindowIcon className="size-3 scale-x-[-1]" /> {source.name || "Window"}</>}
                {source.type === SOURCE_TYPE_AREA && <><CursorArrowRaysIcon className="size-3" /> Area</>}
              </span>
            </div>

            {/* Live indicator */}
            <div className="absolute top-3 right-3">
              <span className="badge badge-sm bg-base-300/80 backdrop-blur-sm border-base-content/10 text-base-content/60 gap-1.5">
                <span className="size-1.5 rounded-full bg-success animate-pulse" />
                Live
              </span>
            </div>
          </div>
        </div>

        {/* Right: Controls panel */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4">
          {/* Source selection */}
          <div>
            <label className="text-xs font-medium text-base-content/50 mb-2 block">Source</label>
            <div className="grid grid-cols-3 gap-1.5">
              <SourceCard
                icon={ComputerDesktopIcon}
                label="Screen"
                active={source.type === SOURCE_TYPE_SCREEN}
                onClick={() => dispatch(setSource({ name: "Screen", type: SOURCE_TYPE_SCREEN, id: "screen" }))}
                disabled={isPendingCaptureSourcePreview}
              />
              <SourceCard
                icon={WindowIcon}
                label="Window"
                active={source.type === SOURCE_TYPE_WINDOW}
                onClick={openWindowPicker}
                disabled={isPendingCaptureSourcePreview}
                iconFlip
              />
              <SourceCard
                icon={CursorArrowRaysIcon}
                label="Area"
                active={source.type === SOURCE_TYPE_AREA}
                onClick={openAreaPicker}
                disabled={isPendingCaptureSourcePreview}
              />
            </div>
          </div>

          {/* Devices */}
          <div>
            <label className="text-xs font-medium text-base-content/50 mb-2 block">Devices</label>
            <CameraMicrophoneSelect />
          </div>

          {/* System audio */}
          <Toggle rightLabel="Record system audio" justifyBetween={false} value={isRecordingSystemAudio}
            onChange={onEnableSystemAudio} disabled={isPending} />

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <RecordButton isRecordingSystemAudio={isRecordingSystemAudio} />
            <div className="tooltip tooltip-left w-full" data-tip="Teleprompter notes (hidden from recording)">
              <button onClick={addNote} className="btn btn-sm btn-ghost text-base-content/50 w-full">
                <DocumentIcon className="size-4" />
                Notes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SourceCard({ icon: Icon, label, active, onClick, disabled, iconFlip }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border transition-all text-center
        ${active
          ? "bg-primary/10 border-primary/30 text-primary"
          : "bg-base-200/30 border-base-content/5 text-base-content/60 hover:bg-base-200/60 hover:border-base-content/10"
        }
        disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <Icon className={`size-4 flex-shrink-0 ${iconFlip ? "scale-x-[-1]" : ""}`} />
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

SourceCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  active: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  iconFlip: PropTypes.bool,
}

NewRecording.propTypes = {
  isOpen: PropTypes.bool.isRequired,
}
