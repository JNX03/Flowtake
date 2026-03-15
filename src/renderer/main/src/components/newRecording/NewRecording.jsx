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
import Hint from "../../../../components/Hint"
import { setOpenSettings } from "../../../../src/redux/appSlice"
import {
  selectSource,
  setSource
} from "../../../../src/redux/recorderSlice"
import Toggle from "../properties/Toggle"
import { SETTINGS_RECORDER } from "../settings/settings"
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
    // Refresh preview every 2 seconds for live-ish feel
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
    <div className={`flex-1 pt-10 px-4 ${isOpen ? "" : "hidden"}`}>
      <div className="grid grid-cols-2 gap-10 w-full">
        <div className="grid gap-6 w-full">
          <div className="join">
            <button
              className={`${source.type === SOURCE_TYPE_SCREEN && "btn-info"} btn join-item`}
              onClick={() => dispatch(setSource({ name: "Screen", type: SOURCE_TYPE_SCREEN, id: "screen" }))}
              disabled={isPendingCaptureSourcePreview}
            >
              <ComputerDesktopIcon className="size-6" />
              Screen
            </button>
            <button
              className={`${source.type === SOURCE_TYPE_WINDOW && "btn-info"} btn join-item`}
              onClick={openWindowPicker}
              disabled={isPendingCaptureSourcePreview}
            >
              <WindowIcon className="size-6 scale-x-[-1]" />
              Window
            </button>
            <button
              className={`${source.type === SOURCE_TYPE_AREA && "btn-info"} btn join-item`}
              onClick={openAreaPicker}
              disabled={isPendingCaptureSourcePreview}
            >
              <CursorArrowRaysIcon className="size-6" />
              Area
            </button>
          </div>

          <CameraMicrophoneSelect />

          <Toggle rightLabel="Record system audio" justifyBetween={false} value={isRecordingSystemAudio}
            onChange={onEnableSystemAudio} disabled={isPending} />
          <div className="flex flex-row gap-2">
            <RecordButton isRecordingSystemAudio={isRecordingSystemAudio} />
            <div
              className="tooltip"
              data-tip="Add notes that will be visible while recording, but won't appear in the video."
            >
              <button onClick={addNote} className="btn">
                <DocumentIcon className="size-6" />
              </button>
            </div>
          </div>
          <Hint>
            Currently only the primary display can be recorded. Make sure both
            Flowtake and the window you would like to record are on the primary
            display.
          </Hint>
        </div>

        <div className={`aspect-video w-full relative flex items-center justify-center rounded-xl overflow-hidden shadow-lg bg-linear-to-br from-primary via-secondary to-accent ${source.type === SOURCE_TYPE_SCREEN ? "p-0" : "p-6"}`} >
          {!isPendingCaptureSourcePreview && captureSourcePreview && !isPreviewError && (
            <img
              src={captureSourcePreview}
              className="max-w-full max-h-full bg-base-100 shadow-xl rounded-sm"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          )}
          {isPendingCaptureSourcePreview && (
            <div className="w-full h-full flex items-center justify-center bg-base-100 shadow-xl rounded-sm">
              <span className="loading loading-spinner"></span>
            </div>
          )}
          {isPreviewError && (
            <div className="w-full h-full flex items-center justify-center bg-base-100 shadow-xl rounded-sm">
              <span className="text-sm opacity-50">Preview unavailable</span>
            </div>
          )}
          <CameraPreview />
        </div>
      </div>
    </div>
  )
}

NewRecording.propTypes = {
  isOpen: PropTypes.bool.isRequired,
}