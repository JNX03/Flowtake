import { useQuery } from "@tanstack/react-query"
import {
  useEffect,
  useRef
} from "react"
import PropTypes from "prop-types"
import { useSelector } from "react-redux"
import {
  CONSTRAINTS_AUDIO,
  CONSTRAINTS_VIDEO
} from "@shared/helpers"
import { getAdaptiveCameraConstraints } from "@shared/adaptivePerformance"
import { selectIsCloseRequested } from "@shared/redux/appSlice"
import useAudioMeter from "@shared/hooks/useAudioMeter"
import {
  acquirePreviewMediaStream,
  stopPreviewMediaStream
} from "@shared/previewMediaStream"

export default function CameraPreview({ audioProcessingSettings, performanceProfile }) {

  const previewVideoRef = useRef(null)

  const isCloseRequested = useSelector(selectIsCloseRequested)

  const { data: cameras, isPending: isPendingCameras } = useQuery({
    queryKey: ['cameras'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "videoSources"),
    staleTime: Infinity
  })

  const { data: microphones, isPending: isPendingMicrophones } = useQuery({
    queryKey: ['microphones'],
    queryFn: async () => window.electron.ipcRenderer.invoke("store-get", "audioSources"),
    staleTime: Infinity
  })

  const { data: camera, isPending: isPendingCamera } = useQuery({
    queryKey: ['camera'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultVideoSource"),
    staleTime: Infinity
  })

  const { data: microphone, isPending: isPendingMicrophone } = useQuery({
    queryKey: ['microphone'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "defaultAudioSource"),
    staleTime: Infinity
  })

  const { data: stream, isPending: isPendingStream } = useQuery({
    queryKey: ['stream', camera, microphone, cameras, microphones, audioProcessingSettings, performanceProfile],
    queryFn: async ({ signal }) => {
      let video = false
      let videoSource = null
      if (camera) {
        videoSource = (cameras ?? []).find(({ id }) => id === camera)
        if (!videoSource) return null
        video = getAdaptiveCameraConstraints(performanceProfile, {
          ...CONSTRAINTS_VIDEO,
          deviceId: { exact: videoSource.deviceId },
        })
      }

      let audio = false
      let audioSource = null
      if (microphone) {
        audioSource = (microphones ?? []).find(({ id }) => id === microphone)
        if (!audioSource) return null
        audio = { ...CONSTRAINTS_AUDIO, ...audioProcessingSettings, deviceId: { exact: audioSource.deviceId } }
      }

      try {
        return await acquirePreviewMediaStream({
          mediaDevices: navigator.mediaDevices,
          constraints: { video, audio },
          expectedVideoTrackLabel: videoSource?.track.label,
          expectedAudioTrackLabel: audioSource?.track.label,
          signal,
        })
      } catch (e) {
        if (
          e.name === "NotReadableError" ||
          e.name === "NotFoundError" ||
          e.name === "MediaTrackError" ||
          e.name === "NotAllowedError" ||
          e.name === "PermissionDeniedError"
        ) {
          return null
        } else throw e
      }
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    enabled: (!!camera || !!microphone) && !!cameras && !!microphones && !isCloseRequested
  })

  useEffect(() => {
    const el = previewVideoRef.current
    if (!el || !stream) return
    el.srcObject = stream
    return () => {
      el.srcObject = null
      stopPreviewMediaStream(stream)
    }
  }, [stream])

  const isPending = isPendingStream || isPendingCameras || isPendingMicrophones || isPendingCamera || isPendingMicrophone
  const { level, isClipping } = useAudioMeter(
    stream,
    Boolean(microphone && stream),
    Math.min(30, performanceProfile.previewFps)
  )

  return (
    <div className={
      `${camera || microphone ? "opacity-100 scale-100" : "opacity-0 scale-50"}` +
      ` ${camera ? "size-28 rounded-3xl" : "w-28 h-8 rounded-xl"} overflow-hidden absolute left-5 bottom-5 shadow-xl bg-base-200` +
      " transition-all"} >
      <div className={`${isPending ? "opacity-100" : "opacity-0"}` +
        " w-full h-full flex items-center justify-center transition-opacity absolute left-0 top-0"}>
        <span className="loading loading-spinner"></span>
      </div>
      <video
        aria-label="Camera preview"
        ref={previewVideoRef}
        autoPlay
        muted
        className={`${isPending || !camera ? "opacity-0" : "opacity-100"}` +
          " object-cover h-full w-full bg-base-100 transition-all absolute left-0 top-0"}
      />
      {microphone && !isPending && (
        <div
          className={`absolute inset-x-2 bottom-2 h-1.5 rounded-full bg-black/35 overflow-hidden ${camera ? "" : "top-1/2 -translate-y-1/2 bottom-auto"}`}
          aria-label={isClipping ? "Microphone level is clipping" : "Live microphone level"}
          title={isClipping ? "Microphone is too loud" : "Live microphone level"}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-75 ${isClipping ? "bg-error" : "bg-emerald-400"}`}
            style={{ width: `${Math.max(3, Math.round(level * 100))}%` }}
          />
        </div>
      )}
    </div>
  )
}

CameraPreview.propTypes = {
  audioProcessingSettings: PropTypes.shape({
    noiseSuppression: PropTypes.bool,
    echoCancellation: PropTypes.bool,
    autoGainControl: PropTypes.bool,
  }).isRequired,
  performanceProfile: PropTypes.shape({
    id: PropTypes.string.isRequired,
    cameraWidth: PropTypes.number.isRequired,
    cameraHeight: PropTypes.number.isRequired,
    cameraFps: PropTypes.number.isRequired,
    previewFps: PropTypes.number.isRequired,
  }).isRequired,
}
