import {
  ArrowRightIcon
} from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import PropTypes from "prop-types"
import {
  useCallback,
  useEffect,
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
  setLoaderMessage
} from "@shared/redux/appSlice"
import {
  selectIsRecording,
  selectSource,
  setIsRecording
} from "@shared/redux/recorderSlice"
import RecordModal from "./RecordModal"

export default function RecordButton({ isRecordingSystemAudio }) {

  const dispatch = useDispatch()

  const [isModalOpen, setIsModalOpen] = useState(false)

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

  const start = useCallback(() => {
    const video = (cameras ?? []).find(({ id }) => id === camera) ?? null
    const audio = (microphones ?? []).find(({ id }) => id === microphone) ?? null

    const mediaSourceConfig = {
      videoTrack: video?.track.label,
      audioTrack: audio?.track.label,
      constraints: {
        video: video
          ? { ...CONSTRAINTS_VIDEO, deviceId: video.deviceId }
          : false,
        audio: audio
          ? { ...CONSTRAINTS_AUDIO, deviceId: audio.deviceId }
          : false,
      },
    }

    window.electron.ipcRenderer.invoke("init-recording", source, mediaSourceConfig, isRecordingSystemAudio ? systemAudio : null)

    dispatch(setIsRecording(true))
  }, [cameras, microphones, source, isRecordingSystemAudio, systemAudio, dispatch, camera, microphone])

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

  return (<>
    <Button
      onClick={onClick}
      isLoading={isPending || capturers.length === 0 || encoders.length === 0}
      disabled={isPending || capturers.length === 0 || encoders.length === 0}
      icon={ArrowRightIcon}
      className="btn-primary"
    >
      Record
    </Button>
    <RecordModal
      isOpen={isModalOpen}
      onCancel={onModalCancel}
      onRecord={onModalRecord}
    />
  </>)
}

RecordButton.propTypes = {
  isRecordingSystemAudio: PropTypes.bool.isRequired,
}