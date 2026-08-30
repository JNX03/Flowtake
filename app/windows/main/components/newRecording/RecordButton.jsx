import {
  ArrowRightIcon
} from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import PropTypes from "prop-types"
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react"
import {
  useDispatch,
  useSelector
} from "react-redux"
import Button from "../../../../components/Button"
import {
  CONSTRAINTS_AUDIO,
  CONSTRAINTS_VIDEO
} from "@shared/helpers"
import {
  selectCapturers,
  selectEncoders,
  selectIsProjectClosing,
  selectRenderQueueProgress,
  setOpenSettings,
  setLoaderMessage
} from "@shared/redux/appSlice"
import {
  selectIsRecording,
  selectSource,
  setIsRecording
} from "@shared/redux/recorderSlice"
import RecordModal from "./RecordModal"
import { SETTINGS_RECORDER } from "../settings/constants"

export default function RecordButton({ isRecordingSystemAudio, excludedAudioPids = [], audioProcessingSettings }) {

  const dispatch = useDispatch()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [startError, setStartError] = useState(null)
  const [isStarting, setIsStarting] = useState(false)
  const startInFlightRef = useRef(false)

  const source = useSelector(selectSource)
  const isRecording = useSelector(selectIsRecording)
  const capturers = useSelector(selectCapturers)
  const encoders = useSelector(selectEncoders)
  const renderQueueProgress = useSelector(selectRenderQueueProgress)
  const isProjectClosing = useSelector(selectIsProjectClosing)

  const { data: camera, isPending: isPendingCamera } = useQuery({
    queryKey: ['camera'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultVideoSource"),
    staleTime: Infinity
  })

  const { data: cameras, isPending: isPendingCameras } = useQuery({
    queryKey: ['cameras'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "videoSources"),
    staleTime: Infinity
  })

  const { data: microphone, isPending: isPendingMicrophone } = useQuery({
    queryKey: ['microphone'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultAudioSource"),
    staleTime: Infinity
  })

  const { data: microphones, isPending: isPendingMicrophones } = useQuery({
    queryKey: ['microphones'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "audioSources"),
    staleTime: Infinity
  })

  const { data: systemAudio, isPending: isPendingSystemAudio } = useQuery({
    queryKey: ['systemAudio'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultSystemAudioSource"),
    staleTime: Infinity
  })

  useEffect(() => {
    if (!isProjectClosing) dispatch(setLoaderMessage(isRecording ? "Recording..." : null))
  }, [dispatch, isRecording, isProjectClosing])

  const start = useCallback(async () => {
    if (startInFlightRef.current || isRecording) return
    startInFlightRef.current = true
    setIsStarting(true)

    const video = (cameras ?? []).find(({ id }) => id === camera) ?? null
    const audio = (microphones ?? []).find(({ id }) => id === microphone) ?? null

    const mediaSourceConfig = {
      videoTrack: video?.track.label,
      audioTrack: audio?.track.label,
      constraints: {
        video: video
          ? { ...CONSTRAINTS_VIDEO, deviceId: { exact: video.deviceId } }
          : false,
        audio: audio
          ? { ...CONSTRAINTS_AUDIO, ...audioProcessingSettings, deviceId: { exact: audio.deviceId } }
          : false,
      },
    }

    try {
      setStartError(null)
      await window.electron.ipcRenderer.invoke("init-recording", source, mediaSourceConfig, isRecordingSystemAudio ? systemAudio : null)

      // Mute excluded apps when recording with system audio
      if (isRecordingSystemAudio && excludedAudioPids.length > 0) {
        window.electron.ipcRenderer.invoke("mute-audio-sessions", excludedAudioPids)
      }

      dispatch(setIsRecording(true))
    } catch (err) {
      console.error("[Flowtake] init-recording failed:", err)
      setStartError(err?.message || String(err) || "Recording could not start. Check your devices and try again.")
      dispatch(setIsRecording(false))
    } finally {
      startInFlightRef.current = false
      setIsStarting(false)
    }
  }, [cameras, microphones, source, isRecordingSystemAudio, systemAudio, dispatch, camera, microphone, excludedAudioPids, audioProcessingSettings, isRecording])

  const onClick = useCallback(() => {
    if (renderQueueProgress === -1) start()
    else setIsModalOpen(true)
  }, [renderQueueProgress, start])

  const onModalCancel = useCallback(() => setIsModalOpen(false), [])

  const onModalRecord = useCallback(() => {
    setIsModalOpen(false)
    start()
  }, [start])

  const isPending = isPendingCamera || isPendingCameras || isPendingMicrophone || isPendingMicrophones ||
    isPendingSystemAudio
  const hasRecorderEngine = (capturers?.length ?? 0) > 0 && (encoders?.length ?? 0) > 0
  const primaryAction = hasRecorderEngine || isPending
    ? onClick
    : () => dispatch(setOpenSettings(SETTINGS_RECORDER))

  return (<>
    <Button
      onClick={primaryAction}
      isLoading={isStarting || isPending}
      disabled={isStarting || isRecording || isPending}
      icon={ArrowRightIcon}
      className="btn-primary w-full"
    >
      {hasRecorderEngine ? "Record" : "Set up recorder"}
    </Button>
    {!isPending && !hasRecorderEngine && (
      <p className="mt-1 text-[11px] leading-snug text-warning" role="status">
        Capture engine needs attention. Open Recorder settings to repair it.
      </p>
    )}
    {startError && (
      <p className="mt-1 text-[11px] leading-snug text-error" role="alert">
        {startError}
      </p>
    )}
    <RecordModal
      isOpen={isModalOpen}
      onCancel={onModalCancel}
      onRecord={onModalRecord}
    />
  </>)
}

RecordButton.propTypes = {
  isRecordingSystemAudio: PropTypes.bool.isRequired,
  excludedAudioPids: PropTypes.arrayOf(PropTypes.number),
  audioProcessingSettings: PropTypes.shape({
    noiseSuppression: PropTypes.bool,
    echoCancellation: PropTypes.bool,
    autoGainControl: PropTypes.bool,
  }).isRequired,
}
