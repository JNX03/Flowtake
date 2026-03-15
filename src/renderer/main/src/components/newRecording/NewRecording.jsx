import {
  ComputerDesktopIcon,
  CursorArrowRaysIcon,
  DocumentIcon,
  WindowIcon
} from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import PropTypes from "prop-types"
import { useState } from "react"
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

  const { data: captureSourcePreview, isPending: isPendingCaptureSourcePreview, isError: isPreviewError } = useQuery({
    queryKey: ['captureSourcePreview', source?.id, source?.type, source?.name, source],
    queryFn: () => window.electron.ipcRenderer.invoke("get-source-screenshot", source),
    gcTime: 0,
    retry: 1,
    refetchInterval: 2000,
  })

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
    <div className={`${isOpen ? "" : "hidden"} flex flex-col gap-6`}>
      {/* Preview area */}
      <div className="relative rounded-2xl overflow-hidden bg-base-200/50 border border-base-content/5">
        <div className="aspect-video w-full flex items-center justify-center">
          {!isPendingCaptureSourcePreview && captureSourcePreview && !isPreviewError && (
            <img
              src={captureSourcePreview}
              className="w-full h-full object-contain"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          )}
          {isPendingCaptureSourcePreview && (
            <div className="flex flex-col items-center gap-3">
              <span className="loading loading-spinner loading-md text-primary/50"></span>
              <span className="text-xs text-base-content/30">Loading preview</span>
            </div>
          )}
          {!isPendingCaptureSourcePreview && isPreviewError && (
            <div className="flex flex-col items-center gap-2">
              <ComputerDesktopIcon className="size-10 text-base-content/15" />
              <span className="text-xs text-base-content/30">Preview unavailable</span>
            </div>
          )}
          {!isPendingCaptureSourcePreview && !captureSourcePreview && !isPreviewError && (
            <div className="flex flex-col items-center gap-2">
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
      </div>

      {/* Controls section */}
      <div className="grid grid-cols-[1fr_auto] gap-6 items-start">
        {/* Left: Source + Devices */}
        <div className="flex flex-col gap-4">
          {/* Source selection cards */}
          <div className="grid grid-cols-3 gap-2">
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

          {/* Devices */}
          <CameraMicrophoneSelect />

          {/* System audio */}
          <Toggle rightLabel="Record system audio" justifyBetween={false} value={isRecordingSystemAudio}
            onChange={onEnableSystemAudio} disabled={isPending} />
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-3 items-end pt-0.5">
          <RecordButton isRecordingSystemAudio={isRecordingSystemAudio} />
          <div className="tooltip tooltip-left" data-tip="Teleprompter notes (hidden from recording)">
            <button onClick={addNote} className="btn btn-sm btn-ghost text-base-content/50">
              <DocumentIcon className="size-4" />
              Notes
            </button>
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="text-xs text-base-content/30 flex items-center gap-1.5">
        <svg className="size-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.75 8a.75.75 0 0 0 0 1.5h.75v1.75a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8.25 8h-1.5Z" clipRule="evenodd" />
        </svg>
        Only the primary display can be recorded. Make sure the target window is on your primary display.
      </p>
    </div>
  )
}

function SourceCard({ icon: Icon, label, active, onClick, disabled, iconFlip }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all text-left
        ${active
          ? "bg-primary/10 border-primary/30 text-primary"
          : "bg-base-200/30 border-base-content/5 text-base-content/60 hover:bg-base-200/60 hover:border-base-content/10"
        }
        disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <Icon className={`size-5 flex-shrink-0 ${iconFlip ? "scale-x-[-1]" : ""}`} />
      <span className="text-sm font-medium">{label}</span>
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
